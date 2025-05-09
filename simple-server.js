const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

// Environment variables
const PORT = process.env.PORT || 8080;
const DATA_DIR = process.env.MCP_DATA_DIR || './data';

// Create data directories if they don't exist
fs.mkdirpSync(path.join(DATA_DIR, 'documents'));
fs.mkdirpSync(path.join(DATA_DIR, 'files'));

// Create sample document if it doesn't exist
const sampleDocPath = path.join(DATA_DIR, 'documents', 'sample.txt');
if (!fs.existsSync(sampleDocPath)) {
  fs.writeFileSync(sampleDocPath, 'This is a sample document created by the BHT Labs MCP Server.');
}

// Create Express app
const app = express();

// CORS middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-MCP-Auth']
}));

// Parse JSON requests
app.use(express.json());

// Simple in-memory session store
const sessions = {};

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    message: 'BHT Labs MCP Server is running',
    version: '1.0.0',
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>BHT Labs MCP Server</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
          h1 { color: #333; }
          .container { max-width: 800px; margin: 0 auto; }
          code { background-color: #f4f4f4; padding: 2px 5px; border-radius: 3px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>BHT Labs MCP Server</h1>
          <p>This server provides Claude integration capabilities via SSE.</p>
          <p>Server status: <strong>Running</strong></p>
          <p>To connect Claude to this MCP server, use the endpoint: <code>${req.protocol}://${req.headers.host}/mcp</code></p>
          <p>Available tools:</p>
          <ul>
            <li><code>read_file</code>: Read the contents of a file</li>
            <li><code>write_file</code>: Write content to a file</li>
            <li><code>list_directory</code>: List the contents of a directory</li>
            <li><code>execute_command</code>: Execute a terminal command</li>
          </ul>
        </div>
      </body>
    </html>
  `);
});

// List available tools endpoint
app.get('/tools', (req, res) => {
  res.status(200).json({
    tools: [
      { name: 'read_file', description: 'Read contents of a file', status: 'active' },
      { name: 'write_file', description: 'Write content to a file', status: 'active' },
      { name: 'list_directory', description: 'List contents of a directory', status: 'active' },
      { name: 'execute_command', description: 'Execute a terminal command', status: 'active' }
    ]
  });
});

// MCP endpoint for SSE connections
app.get('/mcp', (req, res) => {
  // Create a new session
  const sessionId = crypto.randomUUID();
  sessions[sessionId] = { 
    id: sessionId,
    createdAt: new Date(),
    lastActivity: new Date()
  };
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  
  // Send session info
  const connectEvent = {
    jsonrpc: '2.0',
    method: 'connect',
    params: {
      server: {
        name: 'BHT Labs MCP Server',
        version: '1.0.0',
        tools: [
          {
            name: 'read_file',
            description: 'Read the contents of a file',
            params: {
              path: { type: 'string', description: 'Path to the file to read', required: true }
            }
          },
          {
            name: 'write_file',
            description: 'Write content to a file',
            params: {
              path: { type: 'string', description: 'Path to the file to write', required: true },
              content: { type: 'string', description: 'Content to write to the file', required: true },
              append: { type: 'boolean', description: 'Append to file instead of overwriting', required: false }
            }
          },
          {
            name: 'list_directory',
            description: 'List the contents of a directory',
            params: {
              path: { type: 'string', description: 'Path to the directory to list', required: true }
            }
          },
          {
            name: 'execute_command',
            description: 'Execute a terminal command',
            params: {
              command: { type: 'string', description: 'Command to execute', required: true }
            }
          }
        ]
      }
    }
  };
  
  res.write(`data: ${JSON.stringify(connectEvent)}\n\n`);
  
  // Send a heartbeat every 30 seconds to keep the connection alive
  const heartbeatInterval = setInterval(() => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ jsonrpc: '2.0', method: 'heartbeat', params: {} })}\n\n`);
      sessions[sessionId].lastActivity = new Date();
    }
  }, 30000);
  
  // Clean up on connection close
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    delete sessions[sessionId];
    console.log(`Session ${sessionId} closed`);
  });
});

// MCP request endpoint for handling tool calls
app.post('/mcp', express.json(), async (req, res) => {
  const { method, params, id } = req.body;
  
  if (method === 'call') {
    const { tool, params: toolParams } = params;
    let result;
    
    try {
      if (tool === 'read_file') {
        const { path: filePath } = toolParams;
        const safePath = path.join(DATA_DIR, filePath.replace(/^\/+/, ''));
        
        if (!fs.existsSync(safePath)) {
          result = { error: { message: `File not found: ${filePath}` } };
        } else {
          const content = await fs.readFile(safePath, 'utf8');
          result = { content: [{ type: 'text', text: content }] };
        }
      } 
      else if (tool === 'write_file') {
        const { path: filePath, content, append } = toolParams;
        const safePath = path.join(DATA_DIR, filePath.replace(/^\/+/, ''));
        
        // Ensure directory exists
        await fs.mkdirp(path.dirname(safePath));
        
        // Write content
        if (append) {
          await fs.appendFile(safePath, content);
        } else {
          await fs.writeFile(safePath, content);
        }
        
        result = { content: [{ type: 'text', text: `Successfully wrote to ${filePath}` }] };
      } 
      else if (tool === 'list_directory') {
        const { path: dirPath } = toolParams;
        const safePath = path.join(DATA_DIR, dirPath.replace(/^\/+/, ''));
        
        if (!fs.existsSync(safePath)) {
          result = { error: { message: `Directory not found: ${dirPath}` } };
        } else {
          const files = await fs.readdir(safePath);
          const fileStats = await Promise.all(
            files.map(async (file) => {
              const stats = await fs.stat(path.join(safePath, file));
              return {
                name: file,
                type: stats.isDirectory() ? 'directory' : 'file',
                size: stats.size,
                modifiedTime: stats.mtime
              };
            })
          );
          
          result = { content: [{ type: 'text', text: JSON.stringify(fileStats, null, 2) }] };
        }
      } 
      else if (tool === 'execute_command') {
        // For security, this is a mocked version
        const { command } = toolParams;
        result = { 
          content: [{ 
            type: 'text', 
            text: `Command execution is mocked for security. Would have executed: ${command}` 
          }] 
        };
      } 
      else {
        result = { error: { message: `Unknown tool: ${tool}` } };
      }
    } catch (err) {
      result = { 
        error: { 
          message: `Error executing tool ${tool}: ${err.message}` 
        } 
      };
    }
    
    // Send the response
    res.json({
      jsonrpc: '2.0',
      id,
      result
    });
  } else {
    res.status(400).json({
      jsonrpc: '2.0',
      id,
      error: { message: `Unsupported method: ${method}` }
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`BHT Labs MCP Server listening on port ${PORT}`);
  console.log(`Filesystem path: ${DATA_DIR}`);
  console.log(`Available tools: read_file, write_file, list_directory, execute_command`);
});
