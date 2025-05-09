/**
 * Custom script to install graphlit-mcp-server
 * This approach avoids potential installation issues that might occur
 * during npm install of the main package
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Checking for Graphlit environment variables...');

// Only attempt to install if Graphlit env vars are available
const graphlitOrgId = process.env.GRAPHLIT_ORGANIZATION_ID;
const graphlitEnvId = process.env.GRAPHLIT_ENVIRONMENT_ID;
const graphlitJwtSecret = process.env.GRAPHLIT_JWT_SECRET;

if (!graphlitOrgId || !graphlitEnvId || !graphlitJwtSecret) {
  console.log('Graphlit environment variables not found, skipping installation');
  process.exit(0);
}

console.log('Graphlit environment variables found, installing graphlit-mcp-server...');

try {
  // First try to install with production flag
  execSync('npm install --no-save --production graphlit-mcp-server@latest', {
    stdio: 'inherit',
    env: { 
      ...process.env, 
      NODE_OPTIONS: '--max-old-space-size=2048' 
    },
    timeout: 120000 // 2 minutes timeout
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
