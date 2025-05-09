FROM node:20-alpine

WORKDIR /app

# Install system dependencies required for process management
RUN apk add --no-cache procps curl

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Create data directory and set permissions
RUN mkdir -p /app/data
RUN mkdir -p /app/data/knowledge_graph

# Copy application code
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV MCP_DATA_DIR=/app/data

# Expose the application port
EXPOSE 8080

# Set proper command
CMD ["node", "server.js"]
