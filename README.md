# BHT Labs MCP Server

A Model Context Protocol (MCP) server designed for deployment on Fly.io, providing tools and data access capabilities for Anthropic's Claude.

## Features

- File system operations through MCP
- Knowledge graph management
- Process management and execution
- Secure command execution
- Persistent storage for data
- Server-Sent Events (SSE) transport

## Deployment to Fly.io

### Prerequisites

- [Fly.io CLI](https://fly.io/docs/hands-on/install-flyctl/)
- Fly.io account (sign up at [fly.io](https://fly.io/))

### Installation Steps

1. **Install the Fly.io CLI:**

```bash
curl -L https://fly.io/install.sh | sh
```

2. **Login to Fly.io:**

```bash
fly auth login
```

3. **Create a Volume for Persistent Storage:**

```bash
fly volumes create bht_labs_data --region dfw --size 1
```

4. **Deploy the Application:**

```bash
fly deploy
```

5. **Check Status:**

```bash
fly status
```

### Optional: Configure Authentication

For additional security, set an authentication key:

```bash
# Generate a secure random key
AUTH_KEY=$(openssl rand -hex 32)

# Add the secret to Fly.io
fly secrets set MCP_AUTH_KEY="$AUTH_KEY"
```

## Connect to Claude

1. Go to [Claude settings](https://claude.ai/settings/profile)
2. In the "Integrations" section, click "Add more"
3. Add your MCP server URL: `https://bht-labs-remote-mcp.fly.dev/mcp`
4. If authentication is enabled, provide the authentication key when prompted

## Available MCP Tools

- `execute_command`: Run shell commands on the server
- `list_processes`: View running processes
- `kill_process`: Terminate a process by PID
- File system operations: read, write, list files, etc.
- Knowledge graph operations: create, read, update entities and relations

## Monitoring & Management

### View Logs

```bash
fly logs
```

### Scale Resources

```bash
# Upgrade VM resources
fly scale vm shared-cpu-2x --memory 1024

# Deploy multiple instances
fly scale count 2
```

### Create Backups

```bash
# SSH into the VM
fly ssh console

# Backup the data directory
tar -czf /tmp/backup.tar.gz /app/data

# Copy the backup locally
fly ssh sftp get /tmp/backup.tar.gz ./bht-labs-backup.tar.gz
```

## Security Considerations

- Set `MCP_AUTH_KEY` for authentication
- Command blacklist prevents dangerous operations
- CORS headers manage cross-origin requests
- Resource constraints prevent abuse

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | 8080 |
| `MCP_AUTH_KEY` | Authentication key | Not set (no auth) |
| `MCP_DATA_DIR` | Data directory path | /app/data |

## Troubleshooting

- **Connection Issues**: Check `fly status` and `fly ips list`
- **Authentication Errors**: Verify auth key is set correctly
- **Persistence Problems**: Ensure volume is mounted with `fly volumes list`
- **Resource Constraints**: Monitor with `fly metrics`
