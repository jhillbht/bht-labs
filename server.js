const express = require('express');
const cors = require('cors');
const { createHttpSseHandler, FastMCP } = require('@modelcontextprotocol/server');
const { withFileSystem } = require('@modelcontextprotocol/server-filesystem');
const { withKnowledgeGraph } = require('@modelcontextprotocol/server-knowledge-graph');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Read environment variables
const PORT = process.env.PORT || 8080;  // App Platform sets PORT env var
const AUTH_KEY = process.env.MCP_AUTH_KEY;
const DATA_DIR = process.env.MCP_DATA_DIR || './data';
const GRAPHLIT_ORG_ID = process.env.GRAPHLIT_ORGANIZATION_ID;
const GRAPHLIT_ENV_ID = process.env.GRAPHLIT_ENVIRONMENT_ID;
const GRAPHLIT_JWT_SECRET = process.env.GRAPHLIT_JWT_SECRET;

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
  
  // Create knowledge graph data directory
  const kgDir = path.join(DATA_DIR, 'knowledge_graph');
  fs.mkdirSync(kgDir, { recursive: true });
}

// Create MCP server with filesystem and knowledge graph capabilities
const mcp = new FastMCP('BHT Labs MCP Server');
withFileSystem(mcp, { path: DATA_DIR });

// Initialize Knowledge Graph with persistent storage
const kgStoragePath = path.join(DATA_DIR, 'knowledge_graph', 'kg_data.json');
withKnowledgeGraph(mcp, { 
  persistPath: kgStoragePath,
  // Load existing graph data if available
  initialGraph: fs.existsSync(kgStoragePath) ? JSON.parse(fs.readFileSync(kgStoragePath, 'utf8')) : undefined
});

// Start Graphlit MCP Server as a separate process
let graphlitProcess = null;
let graphlitStarted = false;

const startGraphlit = () => {
  if (!GRAPHLIT_ORG_ID || !GRAPHLIT_ENV_ID || !GRAPHLIT_JWT_SECRET) {
    console.log('Graphlit credentials not found, skipping Graphlit initialization');
    return;
  }

  try {
    console.log('Starting Graphlit MCP Server...');
    
    // Create a simple script to run Graphlit
    const scriptPath = path.join(DATA_DIR, 'run-graphlit.js');
    fs.writeFileSync(scriptPath, `
      const { spawn } = require('child_process');
      const graphlit = spawn('npx', ['-y', 'graphlit-mcp-server'], {
        env: {
          GRAPHLIT_ORGANIZATION_ID: "${GRAPHLIT_ORG_ID}",
          GRAPHLIT_ENVIRONMENT_ID: "${GRAPHLIT_ENV_ID}",
          GRAPHLIT_JWT_SECRET: "${GRAPHLIT_JWT_SECRET}"
        }
      });
      graphlit.stdout.on('data', (data) => console.log(data.toString()));
      graphlit.stderr.on('data', (data) => console.error(data.toString()));
    `);
    
    // Execute the script in a separate process
    graphlitProcess = spawn('node', [scriptPath]);
    graphlitStarted = true;
    
    console.log('Graphlit MCP Server started as a separate process');
  } catch (error) {
    console.error('Error starting Graphlit MCP Server:', error);
  }
};

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
  res.status(200).json({ 
    status: 'ok', 
    message: 'BHT Labs MCP Server is running',
    graphlit: graphlitStarted ? 'started' : 'not started' 
  });
});

// Add info endpoint
app.get('/info', (req, res) => {
  res.status(200).json({
    name: 'BHT Labs MCP Server',
    version: '1.0.0',
    description: 'An MCP server compatible with Anthropic Claude',
    anthropicCompatible: true,
    capabilities: {
      filesystem: true,
      knowledgeGraph: true,
      graphlit: graphlitStarted
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
  console.log(`Knowledge Graph storage: ${kgStoragePath}`);
  console.log(`Authentication: ${AUTH_KEY ? 'Enabled' : 'Disabled'}`);
  
  // Start Graphlit after the main server is running
  startGraphlit();
  
  console.log(`Available tools: ${mcp.listTools().map(tool => tool.name).join(', ')}`);
});
