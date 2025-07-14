import express from 'express';
import { spawn } from 'child_process';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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

        // Set up a one-time listener for the initialization response
        const onInitData = (data) => {
            const response = data.toString().trim();
            if (response) {
                mcpServerProcess.stdout.removeListener('data', onInitData);
                try {
                    const parsed = JSON.parse(response);
                    if (parsed && parsed.result) {
                        console.log('✅ MCP Server initialized successfully');
                        resolve(true);
                    } else {
                        console.log('❌ Failed to initialize MCP server');
                        reject(new Error('MCP initialization failed'));
                    }
                } catch (error) {
                    reject(error);
                }
            }
        };

        mcpServerProcess.stdout.on('data', onInitData);

        // Send initialization message
        const messageStr = JSON.stringify(initMessage) + '\n';
        mcpServerProcess.stdin.write(messageStr);

        // Timeout after 10 seconds
        setTimeout(() => {
            mcpServerProcess.stdout.removeListener('data', onInitData);
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

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        mcpServer: mcpServerProcess ? 'running' : 'stopped',
        timestamp: new Date().toISOString(),
        url: `http://localhost:${PORT}`
    });
});

// List available tools
app.get('/tools', async (req, res) => {
    try {
        await initMCPServer();
        
        const message = {
            jsonrpc: "2.0",
            id: messageId++,
            method: "tools/list"
        };

        const response = await sendMCPMessage(message);
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Call a tool
app.post('/tools/:toolName', async (req, res) => {
    try {
        await initMCPServer();
        
        const { toolName } = req.params;
        const toolArguments = req.body.arguments || {};

        console.log(`🔧 Calling tool: ${toolName} with args:`, toolArguments);

        const message = {
            jsonrpc: "2.0",
            id: messageId++,
            method: "tools/call",
            params: {
                name: toolName,
                arguments: toolArguments
            }
        };

        const response = await sendMCPMessage(message);
        res.json(response);
    } catch (error) {
        console.error('❌ Tool call error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Generic MCP endpoint
app.post('/mcp', async (req, res) => {
    try {
        await initMCPServer();
        
        const message = {
            jsonrpc: "2.0",
            id: messageId++,
            ...req.body
        };

        const response = await sendMCPMessage(message);
        res.json(response);
    } catch (error) {
        res.status(500).json({ error: error.message });
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