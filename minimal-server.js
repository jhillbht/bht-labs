const express = require('express');
const cors = require('cors');
const { createHttpSseHandler, FastMCP } = require('@modelcontextprotocol/server');
const { withFileSystem } = require('@modelcontextprotocol/server-filesystem');
const { withKnowledgeGraph } = require('@modelcontextprotocol/server-knowledge-graph');
const fs = require('fs-extra');
const path = require('path');

// Environment variables
const PORT = process.env.PORT || 8080;
const DATA_DIR = process.env.MCP_DATA_DIR || './data';

// Create data directories if they don't exist
fs.mkdirpSync(path.join(DATA_DIR, 'documents'));
fs.mkdirpSync(path.join(DATA_DIR, 'knowledge_graph'));

// Create sample document if it doesn't exist
const sampleDocPath = path.join(DATA_DIR, 'documents', 'sample.txt');
if (!fs.existsSync(sampleDocPath)) {
  fs.writeFileSync(sampleDocPath, 'This is a sample document created by the BHT Labs MCP Server.');
}

// Create MCP server
const mcp = new FastMCP('BHT Labs MCP Server');

// Add filesystem capability
withFileSystem(mcp, { path: DATA_DIR });

// Add knowledge graph capability
const kgStoragePath = path.join(DATA_DIR, 'knowledge_graph', 'kg_data.json');
withKnowledgeGraph(mcp, { 
  persistPath: kgStoragePath,
  initialGraph: fs.existsSync(kgStoragePath) ? JSON.parse(fs.readFileSync(kgStoragePath, 'utf8')) : undefined
});

// Create Express app
const app = express();

// CORS middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-MCP-Auth']
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'BHT Labs MCP Server is running',
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.send('BHT Labs MCP Server is running. Connect to /mcp for MCP functionality.');
});

// Create SSE handler for MCP
const mcpHandler = createHttpSseHandler(mcp);

// MCP endpoint
app.all('/mcp', (req, res) => {
  // Set SSE headers
  if (req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
  }
  
  // Send heartbeat
  const heartbeatInterval = setInterval(() => {
    if (!res.writableEnded) {
      res.write(':\n\n');
    }
  }, 30000);
  
  // Clean up on close
  req.on('close', () => {
    clearInterval(heartbeatInterval);
  });
  
  mcpHandler(req, res);
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`BHT Labs MCP Server listening on port ${PORT}`);
  console.log(`Filesystem path: ${DATA_DIR}`);
  console.log(`Knowledge Graph storage: ${kgStoragePath}`);
});
