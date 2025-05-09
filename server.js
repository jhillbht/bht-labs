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

// Check if Graphlit credentials are available
const graphlitCredentialsAvailable = Boolean(GRAPHLIT_ORG_ID && GRAPHLIT_ENV_ID && GRAPHLIT_JWT_SECRET);

// Check if installation failed
const graphlitInstallFailed = fs.existsSync(path.join(__dirname, 'graphlit-install-failed.txt'));

// Check if Graphlit package is available
let graphlitModuleAvailable = false;
let graphlitProcess = null;
let graphlitRunning = false;

try {
  // This just checks if the module exists
  require.resolve('graphlit-mcp-server');
  graphlitModuleAvailable = true;
  console.log('Graphlit module is available');
} catch (err) {
  console.log('Graphlit module is not available:', err.message);
}

// Function to start Graphlit
const startGraphlit = () => {
  if (!graphlitCredentialsAvailable || !graphlitModuleAvailable || graphlitInstallFailed) {
    console.log('Not starting Graphlit due to missing prerequisites');
    return false;
  }

  try {
    console.log('Starting Graphlit MCP Server...');
    
    // Launch Graphlit in a child process
    graphlitProcess = spawn('npx', ['graphlit-mcp-server'], {
      env: {
        ...process.env,
        GRAPHLIT_ORGANIZATION_ID: GRAPHLIT_ORG_ID,
        GRAPHLIT_ENVIRONMENT_ID: GRAPHLIT_ENV_ID,
        GRAPHLIT_JWT_SECRET: GRAPHLIT_JWT_SECRET
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // Handle output
    graphlitProcess.stdout.on('data', (data) => {
      console.log(`Graphlit: ${data.toString().trim()}`);
    });
    
    graphlitProcess.stderr.on('data', (data) => {
      console.error(`Graphlit Error: ${data.toString().trim()}`);
    });
    
    // Handle process exit
    graphlitProcess.on('exit', (code) => {
      console.log(`Graphlit process exited with code ${code}`);
      graphlitRunning = false;
      graphlitProcess = null;
    });
    
    // Set running flag
    graphlitRunning = true;
    
    // Graceful shutdown
    process.on('SIGTERM', () => {
      if (graphlitProcess) {
        console.log('Terminating Graphlit process...');
        graphlitProcess.kill();
      }
    });
    
    console.log('Graphlit MCP Server started successfully');
    return true;
  } catch (error) {
    console.error('Error starting Graphlit MCP Server:', error);
    return false;
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
    graphlit: {
      credentialsAvailable: graphlitCredentialsAvailable,
      moduleAvailable: graphlitModuleAvailable,
      installationFailed: graphlitInstallFailed,
      running: graphlitRunning
    }
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
      graphlit: {
        available: graphlitModuleAvailable && !graphlitInstallFailed,
        active: graphlitRunning
      }
    }
  });
});

// Add an endpoint to list all available tools
app.get('/tools', authenticate, (req, res) => {
  const coreTools = mcp.listTools().map(tool => ({
    name: tool.name,
    description: tool.description,
    type: 'core',
    status: 'active'
  }));
  
  // Define Graphlit tools that would be available if Graphlit was initialized
  const graphlitTools = (graphlitModuleAvailable && graphlitCredentialsAvailable && !graphlitInstallFailed) ? [
    { name: 'retrieveSources', description: 'Retrieve sources from Graphlit', type: 'graphlit', status: graphlitRunning ? 'active' : 'pending' },
    { name: 'visuallyDescribeImage', description: 'Visually describe images', type: 'graphlit', status: graphlitRunning ? 'active' : 'pending' },
    { name: 'ingestFile', description: 'Ingest files (PDFs, DOCX, PPTX, etc.)', type: 'graphlit', status: graphlitRunning ? 'active' : 'pending' },
    { name: 'ingestWebPage', description: 'Ingest web pages', type: 'graphlit', status: graphlitRunning ? 'active' : 'pending' },
    { name: 'ingestText', description: 'Ingest text content', type: 'graphlit', status: graphlitRunning ? 'active' : 'pending' },
    { name: 'webCrawl', description: 'Crawl websites', type: 'graphlit', status: graphlitRunning ? 'active' : 'pending' },
    { name: 'webSearch', description: 'Perform web searches', type: 'graphlit', status: graphlitRunning ? 'active' : 'pending' },
    { name: 'webMap', description: 'Map website structures', type: 'graphlit', status: graphlitRunning ? 'active' : 'pending' },
    { name: 'screenshotPage', description: 'Capture website screenshots', type: 'graphlit', status: graphlitRunning ? 'active' : 'pending' }
  ] : [];
  
  res.status(200).json({
    tools: [...coreTools, ...graphlitTools]
  });
});

// Add Graphlit control endpoints
app.get('/graphlit/start', authenticate, (req, res) => {
  if (graphlitRunning) {
    return res.status(200).json({ status: 'already-running', message: 'Graphlit MCP Server is already running' });
  }
  
  const success = startGraphlit();
  
  if (success) {
    res.status(200).json({ status: 'started', message: 'Graphlit MCP Server has been started' });
  } else {
    res.status(500).json({ status: 'failed', message: 'Failed to start Graphlit MCP Server' });
  }
});

app.get('/graphlit/status', authenticate, (req, res) => {
  res.status(200).json({
    available: graphlitModuleAvailable && graphlitCredentialsAvailable && !graphlitInstallFailed,
    running: graphlitRunning,
    credentials: {
      organizationId: GRAPHLIT_ORG_ID ? '***' : undefined,
      environmentId: GRAPHLIT_ENV_ID ? '***' : undefined,
      jwtSecret: GRAPHLIT_JWT_SECRET ? '***' : undefined
    },
    module: {
      available: graphlitModuleAvailable,
      installFailed: graphlitInstallFailed
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
  console.log(`Graphlit credentials available: ${graphlitCredentialsAvailable}`);
  console.log(`Graphlit module available: ${graphlitModuleAvailable}`);
  if (graphlitInstallFailed) {
    console.log('Graphlit installation failed previously. Check graphlit-install-failed.txt for details.');
  }
  console.log(`Available core tools: ${mcp.listTools().map(tool => tool.name).join(', ')}`);
  
  // Start Graphlit if prerequisites are met
  if (startGraphlit()) {
    console.log('Graphlit MCP Server started automatically');
  } else {
    console.log('Graphlit MCP Server not started automatically. Use /graphlit/start endpoint to start it if needed.');
  }
});
