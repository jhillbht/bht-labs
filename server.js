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

// Start Graphlit MCP Server if credentials are available
let graphlitProcess = null;
if (GRAPHLIT_ORG_ID && GRAPHLIT_ENV_ID && GRAPHLIT_JWT_SECRET) {
  console.log('Starting Graphlit MCP Server...');
  
  graphlitProcess = spawn('npx', ['-y', 'graphlit-mcp-server'], {
    env: {
      ...process.env,
      GRAPHLIT_ORGANIZATION_ID: GRAPHLIT_ORG_ID,
      GRAPHLIT_ENVIRONMENT_ID: GRAPHLIT_ENV_ID,
      GRAPHLIT_JWT_SECRET: GRAPHLIT_JWT_SECRET
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  // Log output from Graphlit MCP Server
  graphlitProcess.stdout.on('data', (data) => {
    console.log(`Graphlit: ${data}`);
  });
  
  graphlitProcess.stderr.on('data', (data) => {
    console.error(`Graphlit Error: ${data}`);
  });
  
  graphlitProcess.on('exit', (code) => {
    console.log(`Graphlit process exited with code ${code}`);
    graphlitProcess = null;
  });
  
  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    if (graphlitProcess) {
      console.log('Terminating Graphlit process...');
      graphlitProcess.kill();
    }
    process.exit(0);
  });
  
  console.log('Graphlit MCP Server started');
}

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
    graphlit: graphlitProcess ? 'running' : 'not running' 
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
      graphlit: graphlitProcess ? true : false
    }
  });
});

// Create MCP handler with authentication
const mcpHandler = createHttpSseHandler(mcp);
app.use('/mcp', authenticate, (req, res) => mcpHandler(req, res));

// Proxy requests to Graphlit MCP Server if running
if (graphlitProcess) {
  app.use('/graphlit-mcp', authenticate, (req, res) => {
    // Implementation would need a proper proxy setup 
    // This is a placeholder for the actual proxy implementation
    res.status(200).json({ status: 'ok', message: 'Graphlit MCP endpoint' });
  });
}

// Start the server
app.listen(PORT, () => {
  console.log(`MCP Server listening on port ${PORT}`);
  console.log(`Filesystem path: ${DATA_DIR}`);
  console.log(`Knowledge Graph storage: ${kgStoragePath}`);
  console.log(`Authentication: ${AUTH_KEY ? 'Enabled' : 'Disabled'}`);
  console.log(`Graphlit integration: ${graphlitProcess ? 'Enabled' : 'Disabled'}`);
  console.log(`Available tools: ${mcp.listTools().map(tool => tool.name).join(', ')}`);
});
