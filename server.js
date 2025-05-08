// This is a basic Node.js server that implements the Model Context Protocol (MCP)
const express = require('express');
const cors = require('cors');
const { createHttpSseHandler, FastMCP } = require('@modelcontextprotocol/server');
const { withFileSystem } = require('@modelcontextprotocol/server-filesystem');
const fs = require('fs');
const path = require('path');

// Read environment variables
const PORT = process.env.PORT || 8080;  // App Platform sets PORT env var
const AUTH_KEY = process.env.MCP_AUTH_KEY;
const DATA_DIR = process.env.MCP_DATA_DIR || './data';

// Create data directory if it doesn't exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  
  // Create sample document
  const docsDir = path.join(DATA_DIR, 'documents');
  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(
    path.join(docsDir, 'sample.txt'),
    'This is a sample document created by the BHT Labs MCP Server.'
  );
}

// Create MCP server with filesystem capabilities
const mcp = new FastMCP('BHT Labs MCP Server');
withFileSystem(mcp, { path: DATA_DIR });

// Add authentication middleware
const authenticate = (req, res, next) => {
  // If AUTH_KEY is set, require it in headers
  if (AUTH_KEY) {
    const authHeader = req.headers['x-mcp-auth'] || req.headers['authorization'];
    
    if (!authHeader || authHeader !== `Bearer ${AUTH_KEY}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }
  
  next();
};

// Create Express app
const app = express();

// Add CORS middleware with appropriate settings
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-MCP-Auth']
}));

// Add health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'BHT Labs MCP Server is running' });
});

// Add info endpoint
app.get('/info', (req, res) => {
  res.status(200).json({
    name: 'BHT Labs MCP Server',
    version: '1.0.0',
    description: 'An MCP server compatible with Anthropic Claude',
    anthropicCompatible: true,
    capabilities: {
      filesystem: true
    }
  });
});

// Create MCP handler with authentication
const mcpHandler = createHttpSseHandler(mcp);
app.use('/mcp', authenticate, (req, res) => mcpHandler(req, res));

// Start the server
app.listen(PORT, () => {
  console.log(`MCP Server listening on port ${PORT}`);
  console.log(`Filesystem path: ${DATA_DIR}`);
  console.log(`Authentication: ${AUTH_KEY ? 'Enabled' : 'Disabled'}`);
});
