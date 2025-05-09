FROM node:20.10-alpine

WORKDIR /app

# Install system dependencies required for process management
RUN apk add --no-cache procps curl

# Copy package files
COPY package*.json ./

# Install dependencies with more verbose output for debugging
RUN npm install --production --no-optional --loglevel verbose && \
    npm cache clean --force

# Create data directory and set permissions
RUN mkdir -p /app/data /app/data/knowledge_graph

# Copy application code
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV MCP_DATA_DIR=/app/data

# Expose the application port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Set proper command
CMD ["node", "server.js"]
