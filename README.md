# BHT Labs MCP Server

A Model Context Protocol (MCP) server compatible with Anthropic Claude, optimized for deployment on Fly.io.

## Features

- **SSE Transport**: Uses Server-Sent Events (SSE) transport for Fly.io compatibility
- **File System Access**: Browse and manage files securely
- **Knowledge Graph**: Store and retrieve structured information
- **Process Management**: List and manage system processes
- **Command Execution**: Run commands with security safeguards

## Deployment Instructions

### Fly.io Deployment

1. Install the Fly.io CLI:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```

2. Login to Fly.io:
   ```bash
   fly auth login
   ```

3. Deploy the application:
   ```bash
   fly launch
   ```
   Or for an existing app:
   ```bash
   fly deploy
   ```

4. Create a persistent volume:
   ```bash
   fly volumes create bht_labs_data --size 1 --region dfw
   ```

5. Set environment variables (if needed):
   ```bash
   fly secrets set MCP_AUTH_KEY=your_auth_key
   ```

6. Monitor your app:
   ```bash
   fly status
   fly logs
   ```

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/jhillbht/bht-labs.git
   cd bht-labs
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run locally:
   ```bash
   npm start
   ```

## Using with Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "bht-labs": {
      "sse": {
        "url": "https://your-app-name.fly.dev/mcp",
        "messageEndpoint": "https://your-app-name.fly.dev/mcp"
      }
    }
  }
}
```

If authentication is enabled:

```json
{
  "mcpServers": {
    "bht-labs": {
      "sse": {
        "url": "https://your-app-name.fly.dev/mcp",
        "messageEndpoint": "https://your-app-name.fly.dev/mcp",
        "headers": {
          "Authorization": "Bearer your_auth_key"
        }
      }
    }
  }
}
```

## API Endpoints

- `GET /health` - Health check endpoint
- `GET /` - Server information
- `GET /tools` - List all available tools
- `/mcp` - MCP protocol endpoint for SSE communication

## Environment Variables

- `PORT` - Server port (default: 8080)
- `MCP_AUTH_KEY` - Optional authentication key
- `MCP_DATA_DIR` - Data directory path (default: './data')

## Available Tools

- `file_*` - Filesystem operations
- `knowledge_graph_*` - Knowledge graph operations
- `execute_command` - Execute terminal commands
- `list_processes` - List system processes
- `kill_process` - Terminate a process

## Security

- Command blacklisting
- Authentication support
- Volume isolation
- Process sandboxing
