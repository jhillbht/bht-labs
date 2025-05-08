// Simple Express server with health check
const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/', (req, res) => {
  res.send('BHT Labs MCP Server is running');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
