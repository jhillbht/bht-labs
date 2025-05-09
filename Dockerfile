FROM node:20-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache python3 make g++

# Copy package files first to leverage caching
COPY package.json ./

# Install dependencies with more memory available
ENV NODE_OPTIONS=--max-old-space-size=2048
RUN npm install --omit=optional

# Copy the rest of the application code
COPY . .

# Try to install graphlit if environment variables are available
RUN if [ -n "$GRAPHLIT_ORGANIZATION_ID" ] && [ -n "$GRAPHLIT_ENVIRONMENT_ID" ] && [ -n "$GRAPHLIT_JWT_SECRET" ]; then \
      echo "Graphlit environment variables present, attempting installation"; \
      npm install --no-save graphlit-mcp-server@latest || echo "Graphlit installation failed, continuing anyway"; \
    else \
      echo "Skipping Graphlit installation, environment variables not set"; \
    fi

# Create data directory
RUN mkdir -p /app/data

# Set environment variables
ENV MCP_DATA_DIR=/app/data
ENV NODE_ENV=production

# Expose port
EXPOSE 8080

# Start the server
CMD ["node", "server.js"]
