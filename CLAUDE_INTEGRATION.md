# Connecting Your MCP Server to Claude

This guide provides step-by-step instructions for integrating your deployed BHT Labs MCP Server with Anthropic's Claude.

## Prerequisites

- A successfully deployed BHT Labs MCP Server on Fly.io
- A Claude subscription (Max, Team, or Enterprise) that supports custom integrations
- Your MCP server URL and authentication key (if configured)

## Integration Steps

### 1. Find Your MCP Server URL

Your MCP server URL follows this format:
```
https://bht-labs-mcp-server.fly.dev/mcp
```

Replace `bht-labs-mcp-server.fly.dev` with your actual Fly.io app domain if you used a different name.

### 2. Add the MCP Server to Claude

#### For Claude Max Users:

1. Go to [Claude settings](https://claude.ai/settings/profile)
2. Scroll to the "Integrations" section
3. Click "Add more"
4. Enter your MCP server URL in the provided field
5. Click "Add" to save

#### For Claude Team/Enterprise Users:

1. If you're an Owner or Primary Owner:
   - Go to [Settings > Integrations](https://claude.ai/settings/integrations) (for Teams) or [Settings > Data management](https://claude.ai/settings/data-management) (for Enterprise)
   - Locate the "Integrations" section
   - Click "Add more"
   - Enter your MCP server URL
   - Click "Add" to save

2. If you're not an Owner or Primary Owner:
   - Ask your workspace administrator to add the integration

### 3. Authenticate Your MCP Server (If Required)

If you configured authentication when deploying:

1. After adding the integration, Claude will prompt you to authenticate
2. Enter the authentication key you received during deployment
3. Click "Connect" to complete the authentication

### 4. Enable Tools in Your Conversation

1. Start a new conversation with Claude
2. Click the "Search and tools" button (magnifying glass icon)
3. Find your MCP server in the list of available integrations
4. Enable the specific tools you want to use in this conversation

## Available MCP Tools

The BHT Labs MCP Server provides several powerful tools:

### Filesystem Operations
- `read_file`: Read the contents of a file
- `write_file`: Write content to a file
- `create_directory`: Create a new directory
- `list_directory`: List the contents of a directory
- `move_file`: Move or rename a file or directory
- `search_files`: Search for files with a given pattern
- `get_file_info`: Get detailed information about a file

### Knowledge Graph Operations
- `create_entities`: Create new entities in the knowledge graph
- `create_relations`: Create relations between entities
- `add_observations`: Add observations to existing entities
- `delete_entities`: Delete entities from the knowledge graph
- `delete_observations`: Delete specific observations from entities
- `delete_relations`: Delete relations from the knowledge graph
- `read_graph`: Read the entire knowledge graph
- `search_nodes`: Search for nodes in the knowledge graph
- `open_nodes`: Open specific nodes by their names

### Command Execution
- `execute_command`: Execute a terminal command on the server
- `read_output`: Get output from a long-running command
- `force_terminate`: Forcefully terminate a running command
- `list_sessions`: List all active command sessions
- `list_processes`: List running processes on the system
- `kill_process`: Terminate a process by PID

## Example Usage

Here's an example of how to use your MCP server with Claude:

```
User: Can you list the contents of the data directory on my MCP server?

Claude: I'll help you list the contents of the data directory on your MCP server.

[Claude uses the list_directory tool]

Here are the contents of your data directory:
- documents/
  - sample.txt
- knowledge_graph/
  - kg_data.json

The documents folder contains a sample text file, and the knowledge_graph folder contains your knowledge graph data.

Would you like me to read any of these files or perform another operation?
```

## Troubleshooting

### Connection Issues

- Verify that your MCP server is running with `fly status`
- Check that the URL you provided is correct and includes the `/mcp` endpoint
- Ensure the authentication key is entered correctly (if using authentication)

### Authorization Errors

- Check if your MCP server is configured with the `MCP_AUTH_KEY` setting
- Make sure you're using the correct key when connecting from Claude
- Try regenerating the authentication key with `fly secrets set MCP_AUTH_KEY="your-new-key"`

### Tool Execution Failures

- Check the MCP server logs with `fly logs`
- Verify that the requested operation is supported by the server
- Ensure the server has the necessary permissions for the requested action

## Security Considerations

- Only enable the specific tools you need for each conversation
- Be cautious when using the `execute_command` tool as it can run arbitrary commands
- Monitor your MCP server logs for suspicious activity
- Regularly review and update the command blacklist in `server.js`

## Additional Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io/)
- [Anthropic Custom Integrations Guide](https://support.anthropic.com/en/articles/11175166-about-custom-integrations-using-remote-mcp)
- [Fly.io Documentation](https://fly.io/docs/)
