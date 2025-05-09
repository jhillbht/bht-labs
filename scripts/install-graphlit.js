/**
 * Custom script to install graphlit-mcp-server
 * This approach avoids potential installation issues that might occur
 * during npm install of the main package
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Installing graphlit-mcp-server...');

try {
  execSync('npm install graphlit-mcp-server@latest', {
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=2048' }
  });
  console.log('Successfully installed graphlit-mcp-server');
} catch (error) {
  console.error('Failed to install graphlit-mcp-server:', error.message);
  
  // Create a marker file to indicate installation failure
  fs.writeFileSync(
    path.join(__dirname, '..', 'graphlit-install-failed.txt'),
    `Installation failed at ${new Date().toISOString()}\nError: ${error.message}`
  );
  
  // Don't exit with error to allow deployment to continue
  console.log('Continuing deployment without graphlit-mcp-server');
}
