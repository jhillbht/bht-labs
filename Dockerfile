FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY . .

RUN mkdir -p /app/data

ENV MCP_DATA_DIR=/app/data
ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=1536

EXPOSE 8080

CMD ["node", "server.js"]
