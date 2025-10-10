#!/usr/bin/env node

/**
 * Guardian Notification System - Phase 17
 *
 * Sends email notifications to domain owners when Guardian detects
 * CRITICAL or SENSITIVE changes requiring approval.
 *
 * Usage:
 *   node scripts/notify-guardian.js --case-id=<case-id>
 *
 * Environment Variables:
 *   RESEND_API_KEY       - Resend API key (primary)
 *   POSTMARK_API_KEY     - Postmark API key (fallback)
 *   GUARDIAN_FROM_EMAIL  - From email address (default: guardian@roastr.ai)
 *
 * Exit Codes:
 *   0 - Email sent successfully
 *   1 - Error sending email (case found, notification failed)
 *   2 - Critical error (case not found, config error)
 */

const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const https = require('https');

// ============================================================
// Configuration
// ============================================================

const PRODUCT_GUARD_CONFIG = path.join(__dirname, '../config/product-guard.yaml');
const CASES_DIR = path.join(__dirname, '../docs/guardian/cases');
const FROM_EMAIL = process.env.GUARDIAN_FROM_EMAIL || 'guardian@roastr.ai';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const POSTMARK_API_KEY = process.env.POSTMARK_API_KEY;

// ============================================================
// CLI Arguments
// ============================================================

const args = process.argv.slice(2);
const caseIdArg = args.find(arg => arg.startsWith('--case-id='));

if (!caseIdArg) {
  console.error('❌ Error: Missing --case-id argument');
  console.error('Usage: node scripts/notify-guardian.js --case-id=<case-id>');
  process.exit(2);
}

const caseId = caseIdArg.split('=')[1];

if (!caseId) {
  console.error('❌ Error: Invalid --case-id argument (empty value)');
  process.exit(2);
}

// ============================================================
// Guardian Notifier Class
// ============================================================

class GuardianNotifier {
  constructor() {
    this.config = null;
    this.caseData = null;
  }

  /**
   * Load product guard configuration
   */
  loadConfig() {
    try {
      const configContent = fs.readFileSync(PRODUCT_GUARD_CONFIG, 'utf8');
      this.config = yaml.parse(configContent);
      console.log('✅ Configuration loaded successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to load configuration:', error.message);
      return false;
    }
  }

  /**
   * Load case data from JSON file
   */
  loadCase(caseId) {
    try {
      const caseFile = path.join(CASES_DIR, `${caseId}.json`);

      if (!fs.existsSync(caseFile)) {
        console.error(`❌ Case file not found: ${caseFile}`);
        return false;
      }

      const caseContent = fs.readFileSync(caseFile, 'utf8');
      this.caseData = JSON.parse(caseContent);
      console.log(`✅ Case data loaded: ${caseId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to load case data:', error.message);
      return false;
    }
  }

  /**
   * Resolve domain owners from configuration
   */
  resolveOwners() {
    const owners = new Set();

    for (const domainName of this.caseData.domains) {
      const domain = this.config.domains[domainName];
      if (domain && domain.owners) {
        domain.owners.forEach(owner => owners.add(owner));
      }
    }

    if (owners.size === 0) {
      console.warn('⚠️  No owners found for domains:', this.caseData.domains.join(', '));
      console.warn('   Notification will not be sent.');
      return [];
    }

    console.log(`✅ Resolved ${owners.size} owner(s):`, Array.from(owners).join(', '));
    return Array.from(owners);
  }

  /**
   * Generate HTML email template
   */
  generateEmailHTML() {
    const { case_id, timestamp, actor, domains, files_changed, severity, action } = this.caseData;
    const domainList = domains.join(', ');
    const filesList = files_changed.join('<br>        ');
    const severityColor = severity === 'CRITICAL' ? '#FF0000' : '#FFA500';
    const approvalUrl = `${process.env.ADMIN_PANEL_URL || 'http://localhost:3000'}/admin/governance?case=${case_id}`;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Courier New', monospace; background-color: #0a0a0a; color: #00FF41; padding: 20px; }
    .container { max-width: 800px; margin: 0 auto; border: 2px solid #00FF41; padding: 30px; background-color: #111; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #00FF41; padding-bottom: 20px; }
    .severity { display: inline-block; padding: 5px 15px; background-color: ${severityColor}; color: #000; font-weight: bold; }
    .section { margin: 20px 0; padding: 15px; border-left: 3px solid #00FF41; }
    .label { color: #00FF41; font-weight: bold; }
    .value { color: #FFF; }
    .cta { text-align: center; margin: 30px 0; }
    .button { display: inline-block; padding: 15px 40px; background-color: #00FF41; color: #000; text-decoration: none; font-weight: bold; border: 2px solid #00FF41; }
    .button:hover { background-color: #000; color: #00FF41; }
    .footer { text-align: center; margin-top: 30px; border-top: 2px solid #00FF41; padding-top: 20px; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛡️ GUARDIAN ALERT</h1>
      <span class="severity">${severity}</span>
    </div>

    <div class="section">
      <p><span class="label">Case ID:</span> <span class="value">${case_id}</span></p>
      <p><span class="label">Timestamp:</span> <span class="value">${timestamp}</span></p>
      <p><span class="label">Actor:</span> <span class="value">${actor}</span></p>
      <p><span class="label">Action:</span> <span class="value">${action}</span></p>
    </div>

    <div class="section">
      <p><span class="label">Domains Affected:</span></p>
      <p class="value">${domainList}</p>
    </div>

    <div class="section">
      <p><span class="label">Files Changed (${files_changed.length}):</span></p>
      <p class="value" style="font-size: 12px;">
        ${filesList}
      </p>
    </div>

    <div class="section">
      <p><span class="label">What Happened:</span></p>
      <p class="value">
        Guardian detected ${severity === 'CRITICAL' ? 'critical' : 'sensitive'} changes to protected domains.
        ${severity === 'CRITICAL' ? 'These changes require immediate review and approval before they can be merged.' : 'These changes should be reviewed for compliance.'}
      </p>
    </div>

    <div class="cta">
      <a href="${approvalUrl}" class="button">
        REVIEW & APPROVE
      </a>
    </div>

    <div class="footer">
      <p>This is an automated notification from Guardian Agent (GDD 2.0 Phase 17)</p>
      <p>Do not reply to this email. Visit the admin panel to take action.</p>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Generate plain text email (fallback)
   */
  generateEmailText() {
    const { case_id, timestamp, actor, domains, files_changed, severity, action } = this.caseData;
    const approvalUrl = `${process.env.ADMIN_PANEL_URL || 'http://localhost:3000'}/admin/governance?case=${case_id}`;

    return `
🛡️ GUARDIAN ALERT - ${severity}

Case ID: ${case_id}
Timestamp: ${timestamp}
Actor: ${actor}
Action: ${action}

Domains Affected:
${domains.join(', ')}

Files Changed (${files_changed.length}):
${files_changed.map(f => `  - ${f}`).join('\n')}

What Happened:
Guardian detected ${severity === 'CRITICAL' ? 'critical' : 'sensitive'} changes to protected domains.
${severity === 'CRITICAL' ? 'These changes require immediate review and approval before they can be merged.' : 'These changes should be reviewed for compliance.'}

Review & Approve:
${approvalUrl}

---
This is an automated notification from Guardian Agent (GDD 2.0 Phase 17)
Do not reply to this email. Visit the admin panel to take action.
    `.trim();
  }

  /**
   * Send email via Resend API
   */
  async sendViaResend(recipients) {
    if (!RESEND_API_KEY) {
      console.log('⏩ Resend API key not configured, skipping Resend');
      return false;
    }

    const emailHTML = this.generateEmailHTML();
    const emailText = this.generateEmailText();

    const payload = JSON.stringify({
      from: FROM_EMAIL,
      to: recipients,
      subject: `🛡️ Guardian Alert: ${this.caseData.severity} - ${this.caseData.domains.join(', ')}`,
      html: emailHTML,
      text: emailText
    });

    return new Promise((resolve) => {
      const options = {
        hostname: 'api.resend.com',
        port: 443,
        path: '/emails',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('✅ Email sent via Resend');
            resolve(true);
          } else {
            console.error(`❌ Resend API error (${res.statusCode}):`, data);
            resolve(false);
          }
        });
      });

      req.on('error', (error) => {
        console.error('❌ Resend request error:', error.message);
        resolve(false);
      });

      req.write(payload);
      req.end();
    });
  }

  /**
   * Send email via Postmark API (fallback)
   */
  async sendViaPostmark(recipients) {
    if (!POSTMARK_API_KEY) {
      console.log('⏩ Postmark API key not configured, skipping Postmark');
      return false;
    }

    const emailHTML = this.generateEmailHTML();
    const emailText = this.generateEmailText();

    const payload = JSON.stringify({
      From: FROM_EMAIL,
      To: recipients.join(', '),
      Subject: `🛡️ Guardian Alert: ${this.caseData.severity} - ${this.caseData.domains.join(', ')}`,
      HtmlBody: emailHTML,
      TextBody: emailText,
      MessageStream: 'outbound'
    });

    return new Promise((resolve) => {
      const options = {
        hostname: 'api.postmarkapp.com',
        port: 443,
        path: '/email',
        method: 'POST',
        headers: {
          'X-Postmark-Server-Token': POSTMARK_API_KEY,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('✅ Email sent via Postmark');
            resolve(true);
          } else {
            console.error(`❌ Postmark API error (${res.statusCode}):`, data);
            resolve(false);
          }
        });
      });

      req.on('error', (error) => {
        console.error('❌ Postmark request error:', error.message);
        resolve(false);
      });

      req.write(payload);
      req.end();
    });
  }

  /**
   * Send notification (tries Resend, fallback to Postmark)
   */
  async notify() {
    console.log('\n📧 Guardian Notification System\n');

    // Load configuration
    if (!this.loadConfig()) {
      return 2; // Critical error
    }

    // Load case data
    if (!this.loadCase(caseId)) {
      return 2; // Critical error
    }

    // Resolve owners
    const owners = this.resolveOwners();
    if (owners.length === 0) {
      console.log('\n✅ No notification sent (no owners configured)');
      return 0; // Success (no action needed)
    }

    // Try Resend first
    console.log('\n📤 Attempting to send via Resend...');
    const resendSuccess = await this.sendViaResend(owners);

    if (resendSuccess) {
      console.log('\n✅ Notification sent successfully via Resend\n');
      return 0; // Success
    }

    // Fallback to Postmark
    console.log('\n📤 Falling back to Postmark...');
    const postmarkSuccess = await this.sendViaPostmark(owners);

    if (postmarkSuccess) {
      console.log('\n✅ Notification sent successfully via Postmark\n');
      return 0; // Success
    }

    // Both failed
    console.error('\n❌ Failed to send notification via both Resend and Postmark');
    console.error('   Check API keys and network connectivity.\n');
    return 1; // Error (notification failed)
  }
}

// ============================================================
// Main Execution
// ============================================================

async function main() {
  const notifier = new GuardianNotifier();
  const exitCode = await notifier.notify();
  process.exit(exitCode);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { GuardianNotifier };
