FROM node:18-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache procps curl

# Copy package files
COPY package*.json ./

# Simple, reliable npm install
RUN npm install --production

# Create data directory
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
