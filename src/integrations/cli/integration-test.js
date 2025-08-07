require('dotenv').config();
const IntegrationManager = require('../integrationManager');

async function main() {
  console.log('🔍 Starting integration test (dry run)...');

  const manager = new IntegrationManager({ testMode: true });
  await manager.runAllIntegrationsOnce();

  console.log('✅ Integration test completed successfully');
}

main().catch((error) => {
  console.error('❌ Integration test failed:', error);
  process.exit(1);
});
