#!/usr/bin/env node
const http = require('http');

const OPENCLAW_URL = 'http://127.0.0.1:63362/hooks/github';
const OPENCLAW_TOKEN = 'azTYuLlJbB7NyN6Ct5inIBoisY99jxeD';
const LISTEN_PORT = 8765;

console.log(`[${new Date().toISOString()}] Starting relay on port ${LISTEN_PORT}`);

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/hooks/github') {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk.toString(); });
  req.on('end', () => {
    console.log(`[${new Date().toISOString()}] Webhook: ${body.length} bytes`);
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': req.headers['content-type'] || 'application/json',
        'Authorization': `Bearer ${OPENCLAW_TOKEN}`,
        'X-Hub-Signature-256': req.headers['x-hub-signature-256'] || '',
        'X-GitHub-Event': req.headers['x-github-event'] || '',
        'X-GitHub-Delivery': req.headers['x-github-delivery'] || '',
      }
    };

    const proxyReq = http.request(OPENCLAW_URL, options, (proxyRes) => {
      let responseBody = '';
      proxyRes.on('data', chunk => { responseBody += chunk.toString(); });
      proxyRes.on('end', () => {
        console.log(`[${new Date().toISOString()}] Response: ${proxyRes.statusCode}`);
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        res.end(responseBody);
      });
    });

    proxyReq.on('error', (error) => {
      console.error(`[${new Date().toISOString()}] Error: ${error.message}`);
      res.writeHead(502);
      res.end('Bad Gateway');
    });

    proxyReq.write(body);
    proxyReq.end();
  });
});

server.on('error', (err) => {
  console.error(`[${new Date().toISOString()}] Server error:`, err);
});

server.listen(LISTEN_PORT, '127.0.0.1');
