import { spawn } from 'child_process';

// Start the MCP server
const server = spawn('bun', ['run', 'src/mcp-server.ts'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

function send(message: object) {
  server.stdin.write(JSON.stringify(message) + '\n');
}

server.stdout.on('data', (data) => {
  console.log('SERVER:', data.toString().trim());
});

server.stderr.on('data', (data) => {
  console.error('STDERR:', data.toString().trim());
});

// Wait for server to start
setTimeout(async () => {
  // 1. Discover server
  send({
    jsonrpc: '2.0',
    id: 1,
    method: 'server/discover',
    params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } }
  });

  // 2. List tools
  setTimeout(() => {
    send({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } }
    });
  }, 500);

  // 3. Call tool
  setTimeout(() => {
    send({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'get_router_recommendation',
        arguments: {
          task: 'Fix the bug in this React component',
          budget_per_request: 0.001
        },
        _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' }
      }
    });

    // Close after test
    setTimeout(() => {
      server.stdin.end();
    }, 1000);
  }, 1000);
}, 1000);

server.on('close', (code) => {
  console.log('Server exited with code:', code);
});
