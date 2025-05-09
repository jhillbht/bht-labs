FROM node:20-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache python3 make g++

# Copy package files first to leverage caching
COPY package.json ./

# Install dependencies with more memory available
ENV NODE_OPTIONS=--max-old-space-size=2048
RUN npm install

# Copy the rest of the application code
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Set environment variables
ENV MCP_DATA_DIR=/app/data
ENV NODE_ENV=production

# Expose port
EXPOSE 8080

# Start the server
CMD ["node", "server.js"]
