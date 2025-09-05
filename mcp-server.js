import express from 'express';
import { spawn } from 'child_process';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Xero provider (lazy-boot via init on first use)
const providers = {
    xero: {
        init: initMCPServer,
        send: sendMCPMessage,
    },
};

// Store MCP server process
let mcpServerProcess = null;
let messageId = 1;

// Initialize MCP server
function initMCPServer() {
    if (mcpServerProcess) {
        return Promise.resolve(true);
    }

    return new Promise((resolve, reject) => {
        console.log('🚀 Starting MCP server...');
        
        mcpServerProcess = spawn('node', ['dist/index.js'], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ...process.env,
                XERO_CLIENT_ID: process.env.XERO_CLIENT_ID,
                XERO_CLIENT_SECRET: process.env.XERO_CLIENT_SECRET
            }
        });

        // Initialize the MCP server
        const initMessage = {
            jsonrpc: "2.0",
            id: messageId++,
            method: "initialize",
            params: {
                protocolVersion: "2024-11-05",
                capabilities: { tools: {} },
                clientInfo: { name: "http-wrapper", version: "1.0.0" }
            }
        };

        // Robust initialization: tolerate non-JSON logs on stdout
        const onInitData = (data) => {
            const text = data.toString();
            const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
            for (const line of lines) {
                if (!(line.startsWith('{') || line.startsWith('['))) {
                    // Ignore non-JSON log lines like "[XERO MCP] ..."
                    continue;
                }
                try {
                    const parsed = JSON.parse(line);
                    if (parsed && parsed.result) {
                        console.log('✅ MCP Server initialized successfully');
                        mcpServerProcess.stdout.removeListener('data', onInitData);
                        resolve(true);
                        return;
                    }
                } catch {
                    // Ignore parse errors and keep listening until timeout
                }
            }
        };

        mcpServerProcess.stderr.on('data', (d) => {
            console.error('[xero mcp:err]', d.toString());
        });
        mcpServerProcess.on('error', (err) => {
            console.error('[xero mcp:error]', err);
        });
        mcpServerProcess.on('exit', (code) => {
            console.error(`[xero mcp] exited with code ${code}`);
        });

        mcpServerProcess.stdout.on('data', onInitData);

        // Send initialization message
        const messageStr = JSON.stringify(initMessage) + '\n';
        mcpServerProcess.stdin.write(messageStr);

        // Timeout after 10 seconds
        setTimeout(() => {
            if (mcpServerProcess) {
                mcpServerProcess.stdout.removeListener('data', onInitData);
            }
            reject(new Error('Timeout during initialization'));
        }, 10000);
    });
}

// Send message to MCP server
function sendMCPMessage(message) {
    return new Promise((resolve, reject) => {
        if (!mcpServerProcess) {
            reject(new Error('MCP server not running'));
            return;
        }

        try {
            const messageStr = JSON.stringify(message) + '\n';
            mcpServerProcess.stdin.write(messageStr);

            // Set up a one-time listener for the response
            const onData = (data) => {
                const response = data.toString().trim();
                if (response) {
                    mcpServerProcess.stdout.removeListener('data', onData);
                    resolve(JSON.parse(response));
                }
            };

            mcpServerProcess.stdout.on('data', onData);

            // Timeout after 10 seconds
            setTimeout(() => {
                mcpServerProcess.stdout.removeListener('data', onData);
                reject(new Error('Timeout waiting for response'));
            }, 10000);

        } catch (error) {
            reject(error);
        }
    });
}

// (Supabase integration removed in this repository)

// Health check endpoint (non-breaking, asserts Xero init; Supabase eager in background)
app.get('/health', async (req, res) => {
    try {
        await providers.xero.init();
        res.status(200).json({
            status: 'ok',
            ok: true,
            providers: { xero: true },
            mcpServer: mcpServerProcess ? 'running' : 'stopped',
            timestamp: new Date().toISOString(),
            url: `http://localhost:${PORT}`,
        });
    } catch (e) {
        res.status(500).json({
            status: 'error',
            ok: false,
            error: e?.message || 'health check failed',
            mcpServer: mcpServerProcess ? 'running' : 'stopped',
            timestamp: new Date().toISOString(),
            url: `http://localhost:${PORT}`,
        });
    }
});

// List available Xero tools
app.get('/tools', async (_req, res) => {
    try {
        await providers.xero.init();
        const resp = await providers.xero.send({
            jsonrpc: '2.0',
            id: messageId++,
            method: 'tools/list',
            params: {},
        });
        const tools = resp?.result?.tools || [];
        return res.json({ jsonrpc: '2.0', result: { tools } });
    } catch (e) {
        return res
            .status(500)
            .json({ jsonrpc: '2.0', error: { code: -32000, message: e?.message || 'tools error' } });
    }
});

// (Supabase HTTP endpoints removed)

// Call a Xero tool (supports optional prefix stripping like "xero.toolName")
app.post('/tools/:toolName', async (req, res) => {
    const raw = req.params.toolName;
    const args = (req.body && req.body.arguments) || {};

    // Allow namespaced access but always route to Xero
    const resolvedName = raw.includes('.') ? raw.split('.').pop() : raw;

    try {
        await providers.xero.init();
        const id = messageId++;
        console.log(`🔧 [xero] Calling tool: ${resolvedName} with args:`, args);

        const call = {
            jsonrpc: '2.0',
            id,
            method: 'tools/call',
            params: { name: resolvedName, arguments: args },
        };
        const result = await providers.xero.send(call);
        return res.json(result);
    } catch (e) {
        console.error('❌ Tool call error:', e);
        return res
            .status(500)
            .json({ jsonrpc: '2.0', error: { code: -32000, message: e?.message || 'tool call failed' } });
    }
});

// Generic MCP endpoint (Xero-only)
app.post('/mcp', async (req, res) => {
    const msg = (req.body || {});
    const method = msg?.method;

    try {
        if (method === 'tools/call') {
            const name = msg?.params?.name || '';
            if (typeof name === 'string' && name.includes('.')) {
                // Strip any namespace prefix, always route to Xero
                msg.params.name = name.split('.').pop();
            }
        }

        await providers.xero.init();
        const out = await providers.xero.send(msg);
        return res.json(out);
    } catch (e) {
        return res.status(500).json({ jsonrpc: '2.0', error: { code: -32000, message: e?.message || 'mcp error' } });
    }
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down MCP HTTP server...');
    if (mcpServerProcess) {
        mcpServerProcess.terminate();
        mcpServerProcess.wait();
    }
    process.exit(0);
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 MCP HTTP Server running on http://localhost:${PORT}`);
    console.log(`📋 Available endpoints:`);
    console.log(`   GET  /health - Health check`);
    console.log(`   GET  /tools - List available tools`);
    console.log(`   POST /tools/:toolName - Call a specific tool`);
    console.log(`   POST /mcp - Generic MCP endpoint`);
    console.log(`\n💡 You can now make requests from another terminal!`);
}); 
