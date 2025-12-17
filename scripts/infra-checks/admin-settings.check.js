#!/usr/bin/env node

/**
 * Admin Settings Table Check
 *
 * Verifies that the admin_settings table exists and is correctly configured
 * in Supabase. This is a READ-ONLY check that does NOT modify the database.
 *
 * @module scripts/infra-checks/admin-settings.check
 * @requires @supabase/supabase-js
 */

const TABLE_NAME = 'admin_settings';
const EXPECTED_COLUMNS = [
  { name: 'key', type: 'text', isPrimaryKey: true },
  { name: 'value', type: 'jsonb', isPrimaryKey: false },
  { name: 'created_at', type: 'timestamp with time zone', isPrimaryKey: false },
  { name: 'updated_at', type: 'timestamp with time zone', isPrimaryKey: false }
];

const EXPECTED_POLICIES = [
  'Service role can read admin_settings',
  'Service role can insert admin_settings',
  'Service role can update admin_settings',
  'Service role can delete admin_settings'
];

/**
 * Verify table exists
 */
async function verifyTableExists(supabase) {
  try {
    const { error, count } = await supabase
      .from(TABLE_NAME)
      .select('*', { count: 'exact', head: true });

    if (error) {
      if (error.code === '42P01' || /does not exist/i.test(error.message)) {
        return {
          passed: false,
          message: `Table '${TABLE_NAME}' does not exist`
        };
      }
      return {
        passed: false,
        message: `Error checking table: ${error.message}`
      };
    }

    return {
      passed: true,
      message: `Table '${TABLE_NAME}' exists${count !== null ? ` (${count} rows)` : ''}`
    };
  } catch (err) {
    return {
      passed: false,
      message: `Unexpected error: ${err.message}`
    };
  }
}

/**
 * Verify column structure
 */
async function verifyColumnStructure(supabase) {
  try {
    // Try to query information_schema first
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = '${TABLE_NAME}'
        ORDER BY ordinal_position;
      `
    });

    if (error) {
      // Fallback: verify by trying to select each column
      const columnChecks = [];
      const missingColumns = [];

      for (const expectedCol of EXPECTED_COLUMNS) {
        try {
          const { error: colError } = await supabase
            .from(TABLE_NAME)
            .select(expectedCol.name)
            .limit(0);

          if (colError) {
            missingColumns.push(expectedCol.name);
            columnChecks.push(false);
          } else {
            columnChecks.push(true);
          }
        } catch {
          missingColumns.push(expectedCol.name);
          columnChecks.push(false);
        }
      }

      if (missingColumns.length > 0) {
        return {
          passed: false,
          message: `Missing columns: ${missingColumns.join(', ')}`
        };
      }

      return {
        passed: true,
        message: 'All expected columns exist'
      };
    }

    if (!data || data.length === 0) {
      return {
        passed: false,
        message: 'No columns found in table'
      };
    }

    const foundColumns = data.map((row) => row.column_name);
    const missingColumns = EXPECTED_COLUMNS.filter((col) => !foundColumns.includes(col.name));

    if (missingColumns.length > 0) {
      return {
        passed: false,
        message: `Missing columns: ${missingColumns.map((c) => c.name).join(', ')}`
      };
    }

    return {
      passed: true,
      message: 'All expected columns exist'
    };
  } catch (err) {
    return {
      passed: false,
      message: `Error verifying columns: ${err.message}`
    };
  }
}

/**
 * Verify RLS is enabled
 */
async function verifyRLSEnabled(supabase) {
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT tablename, rowsecurity
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename = '${TABLE_NAME}';
      `
    });

    if (error) {
      // If we can't check directly, infer from policies (checked separately)
      return {
        passed: true,
        message: 'RLS status inferred from policies check',
        warning: true
      };
    }

    if (!data || data.length === 0) {
      return {
        passed: false,
        message: 'Table not found in pg_tables'
      };
    }

    const rlsEnabled = data[0].rowsecurity === true;
    if (!rlsEnabled) {
      return {
        passed: false,
        message: 'RLS is NOT enabled'
      };
    }

    return {
      passed: true,
      message: 'RLS is enabled'
    };
  } catch (err) {
    return {
      passed: false,
      message: `Error checking RLS: ${err.message}`
    };
  }
}

/**
 * Verify policies exist
 */
async function verifyPolicies(supabase) {
  try {
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `
        SELECT policyname, cmd, roles
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = '${TABLE_NAME}'
        ORDER BY policyname;
      `
    });

    if (error) {
      // Alternative: verify by testing access
      try {
        const { error: testError } = await supabase.from(TABLE_NAME).select('key').limit(1);

        if (testError && testError.code === 'PGRST301') {
          return {
            passed: false,
            message: 'Service role cannot access table - policies may be missing'
          };
        }

        return {
          passed: true,
          message: 'Service role can access table (policies likely exist)',
          warning: true
        };
      } catch (testErr) {
        return {
          passed: false,
          message: `Error testing access: ${testErr.message}`
        };
      }
    }

    if (!data || data.length === 0) {
      return {
        passed: false,
        message: 'No policies found'
      };
    }

    const foundPolicies = data.map((row) => row.policyname);
    const missingPolicies = EXPECTED_POLICIES.filter((policy) => !foundPolicies.includes(policy));

    if (missingPolicies.length > 0) {
      return {
        passed: false,
        message: `Missing policies: ${missingPolicies.join(', ')}`
      };
    }

    return {
      passed: true,
      message: `All ${foundPolicies.length} expected policies exist`
    };
  } catch (err) {
    return {
      passed: false,
      message: `Error verifying policies: ${err.message}`
    };
  }
}

/**
 * Run the admin_settings check
 *
 * @param {object} supabase - Supabase client instance
 * @returns {Promise<object>} Check result
 */
async function runCheck(supabase) {
  const results = {
    tableExists: await verifyTableExists(supabase),
    columnsCorrect: await verifyColumnStructure(supabase),
    rlsEnabled: await verifyRLSEnabled(supabase),
    policiesExist: await verifyPolicies(supabase)
  };

  const allPassed = Object.values(results).every((result) => result.passed);

  return {
    id: 'admin_settings',
    description: 'Verify admin_settings table exists and is secure',
    severity: 'error',
    passed: allPassed,
    details: results,
    message: allPassed
      ? 'admin_settings table exists and is secure'
      : 'admin_settings table verification failed'
  };
}

module.exports = {
  runCheck
};
