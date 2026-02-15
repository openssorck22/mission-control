#!/usr/bin/env node
/**
 * GitHub Webhook Relay for OpenClaw
 * Receives GitHub webhooks and forwards them to OpenClaw with authentication
 */

const http = require('http');
const fs = require('fs');

const OPENCLAW_URL = 'http://127.0.0.1:63362/hooks/github';
const OPENCLAW_TOKEN = 'azTYuLlJbB7NyN6Ct5inIBoisY99jxeD';
const LISTEN_PORT = 8765;
const DEBUG_LOG = '/data/.openclaw/workspace/webhook-relay-debug.log';

function log(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(DEBUG_LOG, line);
  console.log(line.trim());
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/hooks/github') {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    log(`Received webhook: ${body.length} bytes`);
    
    // Log payload for debugging
    try {
      const payload = JSON.parse(body);
      log(`Event: ${req.headers['x-github-event']}`);
      log(`Repo: ${payload.repository?.full_name}`);
      log(`Ref: ${payload.ref}`);
      log(`Commits: ${payload.commits?.length || 0}`);
      if (payload.commits && payload.commits[0]) {
        log(`First commit SHA: ${payload.commits[0].id}`);
      }
    } catch (e) {
      log(`Failed to parse payload: ${e.message}`);
    }
    
    // Forward to OpenClaw with authentication
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
      proxyRes.on('data', chunk => {
        responseBody += chunk.toString();
      });

      proxyRes.on('end', () => {
        log(`OpenClaw response: ${proxyRes.statusCode} - ${responseBody}`);
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        res.end(responseBody);
      });
    });

    proxyReq.on('error', (error) => {
      log(`Proxy error: ${error.message}`);
      res.writeHead(502);
      res.end('Bad Gateway');
    });

    proxyReq.write(body);
    proxyReq.end();
  });
});

server.listen(LISTEN_PORT, '127.0.0.1', () => {
  log(`GitHub Webhook Relay listening on http://127.0.0.1:${LISTEN_PORT}`);
  log(`Forwarding to: ${OPENCLAW_URL}`);
});
