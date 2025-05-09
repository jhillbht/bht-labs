# BHT Labs MCP Server Quick Start Guide

This guide provides the fastest way to deploy your MCP server to Fly.io and connect it to Claude.

## One-Line Deployment (Bash Shell)

```bash
curl -L https://raw.githubusercontent.com/jhillbht/bht-labs/main/deploy.sh | bash
```

This script:
1. Installs Fly.io CLI if needed
2. Logs you in to Fly.io (if not already)
3. Creates the app and volume
4. Deploys the server
5. Displays the MCP URL to use with Claude

## Manual Quick Start

If you prefer to run the commands manually:

### 1. Install Fly.io CLI

```bash
curl -L https://fly.io/install.sh | sh
```

### 2. Login to Fly.io

```bash
fly auth login
```

### 3. Deploy in One Command

```bash
fly launch --name bht-labs-mcp-server --region dfw --no-deploy && \
fly volumes create bht_labs_data --region dfw --size 1 && \
fly deploy
```

## Connect to Claude

1. Go to [Claude settings](https://claude.ai/settings/profile)
2. In the "Integrations" section, click "Add more"
3. Add your MCP server URL: `https://bht-labs-mcp-server.fly.dev/mcp`

## What's in the Box?

Your deployed MCP server provides Claude with:

- **File System Operations**: Read, write, list files
- **Knowledge Graph Management**: Store structured information
- **Process Management**: List and control processes
- **Command Execution**: Run commands on the server

## Where to Go From Here

- Check server status: `fly status`
- View logs: `fly logs`
- Read the full docs: See [README.md](README.md)
- Claude integration details: See [CLAUDE_INTEGRATION.md](CLAUDE_INTEGRATION.md)

## Troubleshooting

- **Connection Issues**: Ensure your app is running with `fly status`
- **Authentication**: If you set up authentication, don't forget to use it with Claude
- **File System**: The server stores data at `/app/data` on the Fly.io VM
