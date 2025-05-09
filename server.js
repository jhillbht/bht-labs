const express = require('express');
const cors = require('cors');
const { createHttpSseHandler, FastMCP } = require('@modelcontextprotocol/server');
const { withFileSystem } = require('@modelcontextprotocol/server-filesystem');
const { withKnowledgeGraph } = require('@modelcontextprotocol/server-knowledge-graph');
const { spawn } = require('child_process');
const http = require('http');
const httpProxy = require('http-proxy');
const fs = require('fs');
const path = require('path');

// Read environment variables
const PORT = process.env.PORT || 8080;  // App Platform sets PORT env var
const AUTH_KEY = process.env.MCP_AUTH_KEY;
const DATA_DIR = process.env.MCP_DATA_DIR || './data';
const GRAPHLIT_ORG_ID = process.env.GRAPHLIT_ORGANIZATION_ID;
const GRAPHLIT_ENV_ID = process.env.GRAPHLIT_ENVIRONMENT_ID;
const GRAPHLIT_JWT_SECRET = process.env.GRAPHLIT_JWT_SECRET;
const GRAPHLIT_PORT = 3000; // Default port for Graphlit MCP server

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

// Create Express app
const app = express();

// Add CORS middleware with appropriate settings
app.use(cors({
  origin: '*', // Allow all origins
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-MCP-Auth']
}));

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

// Start Graphlit MCP Server if credentials are available
let graphlitProcess = null;
let graphlitReady = false;

if (GRAPHLIT_ORG_ID && GRAPHLIT_ENV_ID && GRAPHLIT_JWT_SECRET) {
  console.log('Starting Graphlit MCP Server...');
  
  // Set up proxy for Graphlit MCP Server
  const proxy = httpProxy.createProxyServer();
  
  // Handle proxy errors
  proxy.on('error', (err, req, res) => {
    console.error('Proxy error:', err);
    res.writeHead(500, {
      'Content-Type': 'text/plain'
    });
    res.end('Proxy error connecting to Graphlit MCP Server');
  });
  
  // Start Graphlit MCP Server process
  graphlitProcess = spawn('npx', ['-y', 'graphlit-mcp-server'], {
    env: {
      ...process.env,
      GRAPHLIT_ORGANIZATION_ID: GRAPHLIT_ORG_ID,
      GRAPHLIT_ENVIRONMENT_ID: GRAPHLIT_ENV_ID,
      GRAPHLIT_JWT_SECRET: GRAPHLIT_JWT_SECRET,
      PORT: GRAPHLIT_PORT
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  // Log output from Graphlit MCP Server
  graphlitProcess.stdout.on('data', (data) => {
    const output = data.toString();
    console.log(`Graphlit: ${output}`);
    
    // Check if server is ready
    if (output.includes('Server listening')) {
      graphlitReady = true;
      console.log('Graphlit MCP Server is ready');
    }
  });
  
  graphlitProcess.stderr.on('data', (data) => {
    console.error(`Graphlit Error: ${data}`);
  });
  
  graphlitProcess.on('exit', (code) => {
    console.log(`Graphlit process exited with code ${code}`);
    graphlitProcess = null;
    graphlitReady = false;
  });
  
  // Set up proxy route for Graphlit MCP
  app.all('/graphlit-mcp*', authenticate, (req, res) => {
    if (!graphlitReady) {
      return res.status(503).json({ error: 'Graphlit MCP Server is not ready yet' });
    }
    
    // Remove /graphlit-mcp prefix for proxying
    req.url = req.url.replace(/^\/graphlit-mcp/, '');
    
    // Forward the request to Graphlit MCP Server
    proxy.web(req, res, { target: `http://localhost:${GRAPHLIT_PORT}` });
  });
  
  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    if (graphlitProcess) {
      console.log('Terminating Graphlit process...');
      graphlitProcess.kill();
    }
    process.exit(0);
  });
  
  console.log('Graphlit MCP Server integration initialized');
  
  // Wait for Graphlit server to be ready
  const waitForGraphlit = () => {
    if (!graphlitReady) {
      console.log('Waiting for Graphlit MCP Server to be ready...');
      setTimeout(waitForGraphlit, 2000);
    } else {
      console.log('Graphlit MCP Server is ready to receive requests');
    }
  };
  
  waitForGraphlit();
}

// Add health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'BHT Labs MCP Server is running',
    graphlit: graphlitReady ? 'ready' : 'not ready' 
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
      graphlit: graphlitReady
    }
  });
});

// Add tools endpoint to list available tools
app.get('/tools', authenticate, (req, res) => {
  const mcpTools = mcp.listTools().map(tool => ({
    name: tool.name,
    description: tool.description,
    type: 'core'
  }));
  
  const graphlitTools = graphlitReady ? [
    { name: 'retrieveSources', description: 'Retrieve sources from Graphlit', type: 'graphlit' },
    { name: 'visuallyDescribeImage', description: 'Visually describe images', type: 'graphlit' },
    { name: 'ingestFile', description: 'Ingest files (PDFs, DOCX, PPTX, etc.)', type: 'graphlit' },
    { name: 'ingestWebPage', description: 'Ingest web pages', type: 'graphlit' },
    { name: 'ingestText', description: 'Ingest text content', type: 'graphlit' },
    { name: 'webCrawl', description: 'Crawl websites', type: 'graphlit' },
    { name: 'webSearch', description: 'Perform web searches', type: 'graphlit' },
    { name: 'webMap', description: 'Map website structures', type: 'graphlit' },
    { name: 'screenshotPage', description: 'Capture website screenshots', type: 'graphlit' },
    { name: 'createCollection', description: 'Create collections of content', type: 'graphlit' },
    { name: 'addContentsToCollection', description: 'Add content to collections', type: 'graphlit' },
    { name: 'removeContentsFromCollection', description: 'Remove content from collections', type: 'graphlit' },
    { name: 'deleteCollection', description: 'Delete collections', type: 'graphlit' },
    { name: 'deleteFeed', description: 'Delete data feeds', type: 'graphlit' },
    { name: 'deleteContent', description: 'Delete content', type: 'graphlit' },
    { name: 'isFeedDone', description: 'Check if a feed is done', type: 'graphlit' },
    { name: 'isContentDone', description: 'Check if content processing is done', type: 'graphlit' }
  ] : [];
  
  res.status(200).json({
    tools: [...mcpTools, ...graphlitTools]
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
  console.log(`Graphlit integration: ${graphlitProcess ? 'Initializing' : 'Disabled'}`);
  console.log(`Available MCP tools: ${mcp.listTools().map(tool => tool.name).join(', ')}`);
});
