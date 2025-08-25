import express from 'express';
import { spawn } from 'child_process';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Provider registry (lazy-boot via init on first use)
const providers = {
    xero: {
        init: initMCPServer,
        send: sendMCPMessage,
    },
    supabase: {
        init: initSupabaseServer,
        send: sendSupabaseMessage,
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

// ---------------- Supabase MCP server management ----------------
let supabaseProcess = null;
let supabaseMessageId = 1;

async function initSupabaseServer() {
    if (supabaseProcess) return true;

    return new Promise((resolve, reject) => {
        console.log('🚀 Starting Supabase MCP server...');

        const bin = process.env.SUPABASE_MCP_BIN;
        const rawArgs = process.env.SUPABASE_MCP_ARGS || '';
        let args = rawArgs
            ? (rawArgs.match(/\S+/g) || [])
            : defaultArgs.slice();
        if (/npm(?:\.cmd)?$/i.test(bin) && args[0] !== 'exec') {
            args = ['exec', '--', ...args];
        }
        const hasProjectRef = args.some((a) => a.startsWith('--project-ref'));
        if (!hasProjectRef && process.env.SUPABASE_PROJECT_REF) {
            args.push(`--project-ref=${process.env.SUPABASE_PROJECT_REF}`);
        }
        const hasFeatures = args.some((a) => a.startsWith('--features'));
        if (!hasFeatures && process.env.SUPABASE_FEATURES) {
            args.push(`--features=${process.env.SUPABASE_FEATURES}`);
        }
        const hasReadOnly = args.includes('--read-only');
        if (!hasReadOnly && ['1','true','yes'].includes((process.env.SUPABASE_READ_ONLY||'').toLowerCase())) {
            args.push('--read-only');
        }

        // Log effective spawn command for debugging
        try {
            console.log('[supabase mcp] spawn:', bin, args.join(' '));
        } catch {
            // ignore
        }

        const spawnCommand = process.platform === 'win32' ? 'cmd.exe' : bin;
        const spawnArgs = process.platform === 'win32'
            ? ['/c', bin, ...args]
            : args;

        // On Windows, prefer spawning via cmd.exe to avoid EINVAL on certain argument shapes
        supabaseProcess = spawn(
            process.platform === 'win32' ? 'cmd.exe' : spawnCommand,
            process.platform === 'win32' ? spawnArgs : args,
            {
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: false,
                env: {
                    ...process.env,
                    SUPABASE_ACCESS_TOKEN: process.env.SUPABASE_ACCESS_TOKEN || '',
                    SUPABASE_PROJECT_REF: process.env.SUPABASE_PROJECT_REF || '',
                }
            }
        );

        supabaseProcess.stderr.on('data', (d) => console.error('[supabase mcp:err]', d.toString()));
        supabaseProcess.on('error', (err) => {
            console.error('[supabase mcp:error]', err?.message || err);
            supabaseProcess = null;
        });
        supabaseProcess.on('exit', (code) => {
            console.error(`Supabase MCP exited with code ${code}`);
            supabaseProcess = null;
        });

        const initMessage = {
            jsonrpc: "2.0",
            id: supabaseMessageId++,
            method: "initialize",
            params: {
                protocolVersion: "2024-11-05",
                capabilities: { tools: {} },
                clientInfo: { name: "http-wrapper", version: "1.0.0" }
            }
        };

        let initBuffer = "";
        const onInitData = (data) => {
            try {
                console.log('[supabase:init chunk]', Buffer.byteLength(data), data.toString().slice(0, 200));
            } catch { /* empty */ }
            try {
                initBuffer += data.toString();
                const lines = initBuffer.split('\n');
                initBuffer = lines.pop() ?? "";
                for (const raw of lines) {
                    const line = raw.trim();
                    if (!line || !(line.startsWith('{') || line.startsWith('['))) continue;
                    try {
                        const response = JSON.parse(line);
                        if (response && response.result) {
                            console.log('✅ Supabase MCP server initialized');
                            supabaseProcess.stdout.removeListener('data', onInitData);
                            resolve(true);
                            return;
                        }
                    } catch { /* wait for full frame */ }
                }
            } catch (err) {
                console.warn('[supabase:init parse warn]', err?.message);
            }
        };

        supabaseProcess.stdout.on('data', onInitData);
        supabaseProcess.stdin.write(JSON.stringify(initMessage) + '\n');

        setTimeout(() => {
            if (supabaseProcess) {
                supabaseProcess.stdout.removeListener('data', onInitData);
            }
            reject(new Error('Supabase MCP init timeout'));
        }, 10000);
    });
}

function sendSupabaseMessage(message) {
    return new Promise((resolve, reject) => {
        if (!supabaseProcess) return reject(new Error('Supabase server not running'));
        try {
            const messageStr = JSON.stringify(message) + '\n';
            const expectedId = message.id;
            let callBuffer = "";
            const onData = (data) => {
                try {
                    console.log('[supabase:call chunk]', Buffer.byteLength(data), data.toString().slice(0, 200));
                } catch { /* ignore */ }
                try {
                    callBuffer += data.toString();
                    const lines = callBuffer.split('\n');
                    callBuffer = lines.pop() ?? "";
                    for (const raw of lines) {
                        const line = raw.trim();
                        if (!line || !(line.startsWith('{') || line.startsWith('['))) continue;
                        let parsed;
                        try { parsed = JSON.parse(line); } catch { continue; }
                        if (parsed && (parsed.id === expectedId || expectedId == null)) {
                            supabaseProcess.stdout.removeListener('data', onData);
                            return resolve(parsed);
                        }
                    }
                } catch (err) {
                    supabaseProcess.stdout.removeListener('data', onData);
                    return reject(err);
                }
            };
            supabaseProcess.stdout.on('data', onData);
            supabaseProcess.stdin.write(messageStr);
            setTimeout(() => {
                supabaseProcess.stdout.removeListener('data', onData);
                reject(new Error('Supabase response timeout'));
            }, 10000);
        } catch (err) {
            reject(err);
        }
    });
}

// Health check endpoint (non-breaking, asserts Xero init; Supabase eager in background)
app.get('/health', async (req, res) => {
    try {
        await providers.xero.init();
        // Fire-and-forget Supabase init; do not fail health on Supabase issues
        providers.supabase.init().catch(() => {});

        res.status(200).json({
            status: 'ok',
            ok: true,
            providers: { xero: true, supabase: !!supabaseProcess },
            mcpServer: mcpServerProcess ? 'running' : 'stopped',
            supabaseServer: supabaseProcess ? 'running' : 'stopped',
            timestamp: new Date().toISOString(),
            url: `http://localhost:${PORT}`,
        });
    } catch (e) {
        res.status(500).json({
            status: 'error',
            ok: false,
            error: e?.message || 'health check failed',
            mcpServer: mcpServerProcess ? 'running' : 'stopped',
            supabaseServer: supabaseProcess ? 'running' : 'stopped',
            timestamp: new Date().toISOString(),
            url: `http://localhost:${PORT}`,
        });
    }
});

// List available tools (supports ?provider=xero|supabase|all; default xero)
app.get('/tools', async (req, res) => {
    const provider = (req.query.provider || 'xero').toString().toLowerCase();
    try {
        const lists = [];

        if (provider === 'xero' || provider === 'all') {
            await providers.xero.init();
            const resp = await providers.xero.send({
                jsonrpc: '2.0',
                id: messageId++,
                method: 'tools/list',
                params: {},
            });
            const tools = resp?.result?.tools || [];
            lists.push(
                tools.map((t) => (provider === 'all' ? { ...t, name: `xero.${t.name}` } : t)),
            );
        }

        if (provider === 'supabase' || provider === 'all') {
            await providers.supabase.init();
            const resp = await providers.supabase.send({
                jsonrpc: '2.0',
                id: supabaseMessageId++,
                method: 'tools/list',
                params: {},
            });
            const tools = resp?.result?.tools || [];
            lists.push(
                tools.map((t) => (provider === 'all' ? { ...t, name: `supabase.${t.name}` } : t)),
            );
        }

        const merged = lists.flat();
        return res.json({ jsonrpc: '2.0', result: { tools: merged } });
    } catch (e) {
        return res
            .status(500)
            .json({ jsonrpc: '2.0', error: { code: -32000, message: e?.message || 'tools error' } });
    }
});

// Supabase: List available tools
app.get('/supabase/tools', async (req, res) => {
    try {
        await initSupabaseServer();

        const message = {
            jsonrpc: "2.0",
            id: supabaseMessageId++,
            method: "tools/list"
        };

        const response = await sendSupabaseMessage(message);
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Supabase: Call a tool
app.post('/supabase/tools/:toolName', async (req, res) => {
    try {
        await initSupabaseServer();

        const { toolName } = req.params;
        const toolArguments = req.body.arguments || {};

        console.log(`🔧 [Supabase] Calling tool: ${toolName} with args:`, toolArguments);


        const message = {
            jsonrpc: "2.0",
            id: supabaseMessageId++,
            method: "tools/call",
            params: {
                name: toolName,
                arguments: toolArguments
            }
        };

        const response = await sendSupabaseMessage(message);
        res.json(response);
        console.log(response);
    } catch (error) {
        console.error('❌ [Supabase] Tool call error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Supabase: Generic MCP endpoint
app.post('/supabase/mcp', async (req, res) => {
    try {
        await initSupabaseServer();

        const message = {
            jsonrpc: "2.0",
            id: supabaseMessageId++,
            ...req.body
        };

        const response = await sendSupabaseMessage(message);
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Call a tool with routing rules (namespace prefix > ?provider > default xero)
app.post('/tools/:toolName', async (req, res) => {
    const raw = req.params.toolName;
    const args = (req.body && req.body.arguments) || {};

    // Priority: explicit prefix, then ?provider, then default xero
    let providerKey = 'xero';
    let resolvedName = raw;

    if (raw.includes('.')) {
        const [prefix, ...rest] = raw.split('.');
        providerKey = prefix.toLowerCase();
        resolvedName = rest.join('.');
    } else if (req.query.provider) {
        providerKey = String(req.query.provider).toLowerCase();
    }

    if (providerKey === 'all') {
        return res
            .status(400)
            .json({ jsonrpc: '2.0', error: { code: -32602, message: 'provider=all not supported for tools/call' } });
    }
    if (!providers[providerKey]) {
        return res
            .status(400)
            .json({ jsonrpc: '2.0', error: { code: -32602, message: `Unknown provider: ${providerKey}` } });
    }

    try {
        await providers[providerKey].init();
        const id = providerKey === 'supabase' ? supabaseMessageId++ : messageId++;
        console.log(`🔧 [${providerKey}] Calling tool: ${resolvedName} with args:`, args);

        const call = {
            jsonrpc: '2.0',
            id,
            method: 'tools/call',
            params: { name: resolvedName, arguments: args },
        };
        const result = await providers[providerKey].send(call);
        return res.json(result);
    } catch (e) {
        console.error('❌ Tool call error:', e);
        return res
            .status(500)
            .json({ jsonrpc: '2.0', error: { code: -32000, message: e?.message || 'tool call failed' } });
    }
});

// Generic MCP endpoint with provider-aware routing
app.post('/mcp', async (req, res) => {
    const msg = (req.body || {});
    const method = msg?.method;

    // Default provider = xero (legacy)
    let providerKey = 'xero';

    try {
        if (method === 'tools/call') {
            const name = msg?.params?.name || '';
            if (typeof name === 'string' && name.includes('.')) {
                const [prefix, ...rest] = name.split('.');
                providerKey = prefix.toLowerCase();
                msg.params.name = rest.join('.');
            } else if (msg?.params?.provider) {
                providerKey = String(msg.params.provider).toLowerCase();
            } else if (req.query.provider) {
                providerKey = String(req.query.provider).toLowerCase();
            }
        } else if (method === 'tools/list') {
            const want = (msg?.params?.provider || req.query.provider || 'xero').toString().toLowerCase();
            if (want === 'all') {
                await Promise.all([providers.xero.init(), providers.supabase.init()]);
                const x = await providers.xero.send({ jsonrpc: '2.0', id: messageId++, method: 'tools/list', params: {} });
                const s = await providers.supabase.send({ jsonrpc: '2.0', id: supabaseMessageId++, method: 'tools/list', params: {} });
                const xTools = (x?.result?.tools || []).map((t) => ({ ...t, name: `xero.${t.name}` }));
                const sTools = (s?.result?.tools || []).map((t) => ({ ...t, name: `supabase.${t.name}` }));
                return res.json({ jsonrpc: '2.0', result: { tools: [...xTools, ...sTools] } });
            }
            providerKey = want === 'supabase' ? 'supabase' : 'xero';
        } else {
            // Other methods: allow ?provider override, else default xero
            if (req.query.provider) {
                providerKey = String(req.query.provider).toLowerCase();
            }
        }

        if (!providers[providerKey]) {
            return res.status(400).json({ jsonrpc: '2.0', error: { code: -32602, message: `Unknown provider: ${providerKey}` } });
        }

        await providers[providerKey].init();
        const out = await providers[providerKey].send(msg);
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