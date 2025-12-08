/**
 * CLI Parser Helper
 *
 * Parses command-line arguments supporting both forms:
 *   --flag=value
 *   --flag value
 */

/**
 * Parse CLI arguments with support for both --flag=value and --flag value
 * @param {string[]} args - Process.argv.slice(2)
 * @returns {Object} - Parsed options
 */
function parseArgs(args) {
  const options = {};
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    // Handle --flag=value form
    if (arg.startsWith('--') && arg.includes('=')) {
      const [flag, value] = arg.split('=', 2);
      const flagName = flag.replace('--', '').replace(/-/g, '_');
      options[flagName] = value;
      i++;
      continue;
    }

    // Handle --flag value form
    if (arg.startsWith('--')) {
      const flagName = arg.replace('--', '').replace(/-/g, '_');
      
      // Check if next arg exists and doesn't start with --
      if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        options[flagName] = args[i + 1];
        i += 2;
      } else {
        // Boolean flag (no value)
        options[flagName] = true;
        i++;
      }
      continue;
    }

    // Positional argument
    if (!options._) {
      options._ = [];
    }
    options._.push(arg);
    i++;
  }

  return options;
}

/**
 * Get a specific option value
 * @param {Object} options - Parsed options
 * @param {string} flagName - Flag name (with or without --)
 * @param {any} defaultValue - Default value if not found
 * @returns {any} - Option value or default
 */
function getOption(options, flagName, defaultValue = undefined) {
  const normalized = flagName.replace('--', '').replace(/-/g, '_');
  return options[normalized] !== undefined ? options[normalized] : defaultValue;
}

/**
 * Check if a flag is present
 * @param {Object} options - Parsed options
 * @param {string} flagName - Flag name (with or without --)
 * @returns {boolean} - True if flag is present
 */
function hasFlag(options, flagName) {
  const normalized = flagName.replace('--', '').replace(/-/g, '_');
  return options[normalized] === true || options[normalized] !== undefined;
}

module.exports = {
  parseArgs,
  getOption,
  hasFlag
};

