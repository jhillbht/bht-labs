FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --no-optional

COPY . .

RUN mkdir -p /app/data

ENV MCP_DATA_DIR=/app/data
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "server.js"]
