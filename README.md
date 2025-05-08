# BHT Labs MCP Server

This is a Model Context Protocol (MCP) server implementation designed to work with Anthropic Claude and other MCP-compatible AI systems. It provides file system access capabilities through a standard MCP interface.

## Features

- Complete MCP protocol implementation
- File system access through MCP tools
- Authentication for secure access
- CORS support for cross-origin requests
- Health check endpoint for monitoring
- Detailed server information endpoint

## Deployment

This server is designed to be deployed to DigitalOcean App Platform. The repository includes:

- `server.js`: The main server implementation
- `package.json`: Node.js dependencies
- `Dockerfile`: Container configuration for deployment

## Environment Variables

- `PORT`: The port to run the server on (set automatically by App Platform)
- `MCP_AUTH_KEY`: Authentication key for securing access to the MCP server
- `MCP_DATA_DIR`: Directory for storing files (default: `/app/data`)

## Endpoints

- `/`: Root endpoint with basic server information
- `/health`: Health check endpoint
- `/info`: Detailed server information
- `/mcp`: MCP protocol endpoint (requires authentication)

## Authentication

The server implements Bearer token authentication. To access the MCP endpoint, include an `Authorization` header:

```
Authorization: Bearer YOUR_AUTH_KEY
```

or

```
X-MCP-Auth: Bearer YOUR_AUTH_KEY
```

## How It Works

1. The server creates an Express application
2. CORS middleware is added for cross-origin access
3. Authentication middleware is applied to the MCP endpoint
4. The MCP server is initialized with file system capabilities
5. The server listens on the configured port

## For Development

```bash
npm install
MCP_AUTH_KEY=your_auth_key node server.js
```

## For Anthropic Claude Integration

This server meets all of Anthropic's requirements for remote MCP servers:

1. HTTPS with a valid certificate (provided by App Platform)
2. Authentication via Bearer token
3. Correct implementation of the MCP protocol

For more information, see [Anthropic's documentation on custom integrations using remote MCP](https://support.anthropic.com/en/articles/11175166-about-custom-integrations-using-remote-mcp).
