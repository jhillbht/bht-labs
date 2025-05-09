const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const { createHttpSseHandler, FastMCP } = require('@modelcontextprotocol/server');
const { withFileSystem } = require('@modelcontextprotocol/server-filesystem');
const { withKnowledgeGraph } = require('@modelcontextprotocol/server-knowledge-graph');
const psList = require('ps-list');
const treeKill = require('tree-kill');

// Read environment variables
const PORT = process.env.PORT || 8080;
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
  
  // Create knowledge graph data directory
  const kgDir = path.join(DATA_DIR, 'knowledge_graph');
  fs.mkdirSync(kgDir, { recursive: true });
}

// Constants
const TIMEOUT_DEFAULT = 30000; // 30 seconds
const MAX_OUTPUT_SIZE = 1000000; // ~1MB
const MEMORY_FILE_PATH = path.join(DATA_DIR, 'memory.json');

// In-memory storage for active commands and their output
const activeSessions = {};
let nextSessionId = 1;
const blacklistedCommands = [
  "rm -rf", // Dangerous delete
  "sudo rm", // Sudo delete
  ":(){:|:&};:", // Fork bomb
  "> /dev/sda", // Overwrite disk
  "dd if=/dev/zero", // Disk destroyer
  "chmod -R 777 /", // Permission change on root
  "mkfs", // Format filesystem
  "mv ~ /dev/null", // Move home to null
  "wget http", // Download and pipe to shell
  "curl http", // Download and pipe to shell
];

// Initialize Knowledge Graph with persistent storage
const kgStoragePath = path.join(DATA_DIR, 'knowledge_graph', 'kg_data.json');

// Create MCP server with filesystem and knowledge graph capabilities
const mcp = new FastMCP('BHT Labs MCP Server');

// Add filesystem capabilities
withFileSystem(mcp, { path: DATA_DIR });

// Add knowledge graph capabilities
withKnowledgeGraph(mcp, { 
  persistPath: kgStoragePath,
  // Load existing graph data if available
  initialGraph: fs.existsSync(kgStoragePath) ? JSON.parse(fs.readFileSync(kgStoragePath, 'utf8')) : undefined
});

// Add process management capabilities
mcp.tool('list_processes', 'List running processes on the system', {
  filter: { type: 'string', description: 'Optional filter string to match against process command', required: false }
}, async ({ filter }) => {
  try {
    const processes = await psList();
    let filteredProcesses = processes;
    
    if (filter) {
      const filterLower = filter.toLowerCase();
      filteredProcesses = processes.filter(proc => 
        proc.name.toLowerCase().includes(filterLower) || 
        (proc.cmd && proc.cmd.toLowerCase().includes(filterLower))
      );
    }
    
    // Format and limit results
    const results = filteredProcesses.slice(0, 100).map(proc => ({
      pid: proc.pid,
      name: proc.name,
      cmd: proc.cmd || '<unknown>',
      cpu: proc.cpu !== undefined ? `${proc.cpu.toFixed(1)}%` : 'N/A',
      memory: proc.memory !== undefined ? `${(proc.memory/1024).toFixed(1)} MB` : 'N/A'
    }));
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(results, null, 2)
      }]
    };
  } catch (error) {
    return {
      isError: true,
      content: [{
        type: 'text',
        text: `Error listing processes: ${error.message}`
      }]
    };
  }
});

// Add kill process capability
mcp.tool('kill_process', 'Terminate a process by PID', {
  pid: { type: 'number', description: 'Process ID to kill', required: true }
}, async ({ pid }) => {
  if (!pid || pid <= 0) {
    return {
      isError: true,
      content: [{
        type: 'text',
        text: 'Invalid PID provided'
      }]
    };
  }
  
  try {
    // Don't allow killing system processes
    if (pid < 100) {
      return {
        isError: true,
        content: [{
          type: 'text',
          text: 'Cannot terminate system processes (PID < 100)'
        }]
      };
    }
    
    // Use tree-kill for process termination
    await new Promise((resolve, reject) => {
      treeKill(pid, 'SIGTERM', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    return {
      content: [{
        type: 'text',
        text: `Process ${pid} has been terminated`
      }]
    };
  } catch (error) {
    return {
      isError: true,
      content: [{
        type: 'text',
        text: `Error terminating process: ${error.message}`
      }]
    };
  }
});

// Add command execution capability
mcp.tool('execute_command', 'Execute a terminal command with streaming output', {
  command: { type: 'string', description: 'Command to execute', required: true },
  cwd: { type: 'string', description: 'Working directory (defaults to server directory)', required: false },
  timeout: { type: 'number', description: 'Timeout in milliseconds (default: 30000)', required: false },
  detached: { type: 'boolean', description: 'Run in background (default: false)', required: false }
}, async ({ command, cwd, timeout, detached }) => {
  // Security: Check for blacklisted commands
  if (blacklistedCommands.some(blacklisted => command.includes(blacklisted))) {
    return {
      isError: true,
      content: [{
        type: 'text',
        text: 'Command contains blacklisted operations for security. If this is in error, please use block_command to modify the blacklist.'
      }]
    };
  }
  
  // Set defaults
  const execTimeout = timeout || TIMEOUT_DEFAULT;
  const workingDir = cwd || process.cwd();
  
  try {
    // For detached commands, spawn and return
    if (detached) {
      const sessionId = nextSessionId++;
      const commandProcess = exec(command, { cwd: workingDir });
      
      activeSessions[sessionId] = {
        process: commandProcess,
        command,
        startTime: new Date(),
        output: '',
        status: 'running'
      };
      
      return {
        content: [{
          type: 'text',
          text: `Command started in background with session ID: ${sessionId}`
        }]
      };
    }
    
    // For normal commands, execute and wait for completion
    const output = await new Promise((resolve, reject) => {
      exec(command, { cwd: workingDir, timeout: execTimeout }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`${error.message}\n${stderr}`));
        } else {
          resolve(stdout || stderr);
        }
      });
    });
    
    // Trim output if too large
    const trimmedOutput = output.length > MAX_OUTPUT_SIZE 
      ? output.substring(0, MAX_OUTPUT_SIZE) + '...\n[Output truncated due to size]' 
      : output;
    
    return {
      content: [{
        type: 'text',
        text: trimmedOutput
      }]
    };
  } catch (error) {
    return {
      isError: true,
      content: [{
        type: 'text',
        text: `Command execution failed: ${error.message}`
      }]
    };
  }
});

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

// Add security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for SSE
}));

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
    version: '1.0.0'
  });
});

// Add root endpoint
app.get('/', (req, res) => {
  res.send('BHT Labs MCP Server is running. Connect to /mcp for MCP functionality.');
});

// Add an endpoint to list all available tools
app.get('/tools', authenticate, (req, res) => {
  const tools = mcp.listTools().map(tool => ({
    name: tool.name,
    description: tool.description,
    status: 'active'
  }));
  
  res.status(200).json({
    tools
  });
});

// Create SSE handler for MCP
const mcpHandler = createHttpSseHandler(mcp);

// Add MCP SSE endpoint
app.all('/mcp', authenticate, (req, res) => {
  // Set SSE headers to disable buffering
  if (req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
  }
  
  mcpHandler(req, res);
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`BHT Labs MCP Server listening on port ${PORT}`);
  console.log(`Filesystem path: ${DATA_DIR}`);
  console.log(`Knowledge Graph storage: ${kgStoragePath}`);
  console.log(`Authentication: ${AUTH_KEY ? 'Enabled' : 'Disabled'}`);
  console.log(`Available core tools: ${mcp.listTools().map(tool => tool.name).join(', ')}`);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down BHT Labs MCP Server...');
  
  // Terminate any running command sessions
  Object.keys(activeSessions).forEach(sessionId => {
    const session = activeSessions[sessionId];
    if (session.process && session.status === 'running') {
      try {
        session.process.kill();
      } catch (error) {
        console.error(`Error terminating session ${sessionId}: ${error.message}`);
      }
    }
  });
  
  process.exit(0);
});
