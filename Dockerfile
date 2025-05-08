# Dockerfile for BHT Labs MCP Server
FROM node:18-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

RUN mkdir -p /app/data

ENV MCP_DATA_DIR=/app/data
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "server.js"]
