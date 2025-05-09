# BHT Labs MCP Server with Graphlit Integration

This branch contains the BHT Labs MCP Server with integrated Graphlit capabilities, providing enhanced functionality for document processing, web crawling, and knowledge management.

## Features

- **Core MCP Capabilities**:
  - Filesystem operations
  - Knowledge Graph storage and retrieval
  - Terminal/shell command execution
  - Git repository management

- **Graphlit Integration**:
  - Web crawling and search
  - Document processing (PDF, DOCX, PPTX conversion to Markdown)
  - Audio/video transcription
  - Content retrieval through semantic search
  - Image analysis
  - Data connector tools (Slack, Google Drive, etc.)

## Environment Variables

The following environment variables must be set for full functionality:

- `MCP_AUTH_KEY`: Authentication key for the MCP server
- `MCP_DATA_DIR`: Directory for storing MCP data
- `GRAPHLIT_ORGANIZATION_ID`: Organization ID from Graphlit
- `GRAPHLIT_ENVIRONMENT_ID`: Environment ID from Graphlit
- `GRAPHLIT_JWT_SECRET`: JWT secret from Graphlit

## Deployment

This repository is designed to be deployed on DigitalOcean App Platform or any other container hosting service.

## Getting Started

1. Clone this repository
2. Install dependencies: `npm install`
3. Set the required environment variables
4. Start the server: `npm start`
