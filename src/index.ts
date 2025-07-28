#!/usr/bin/env node
console.log('[XERO MCP] Starting server...');

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { XeroMcpServer } from "./server/xero-mcp-server.js";
// import { ToolFactory } from "./tools/tool-factory.js";

const main = async () => {
  try {
    console.log('[XERO MCP] Initializing main function...');
    
    // Create an MCP server
    console.log('[XERO MCP] Getting server instance...');
    const server = XeroMcpServer.GetServer();
    console.log('[XERO MCP] Server instance obtained.');

    // console.log('[XERO MCP] Initializing ToolFactory...');
    // ToolFactory(server);
    // console.log('[XERO MCP] ToolFactory initialized.');

    // Start receiving messages on stdin and sending messages on stdout
    console.log('[XERO MCP] Creating StdioServerTransport...');
    const transport = new StdioServerTransport();
    console.log('[XERO MCP] StdioServerTransport created.');

    console.log('[XERO MCP] Connecting server to transport...');
    await server.connect(transport);
    console.log('[XERO MCP] Server connected to transport. Ready and waiting for messages.');

  } catch (error) {
    console.error('[XERO MCP] FATAL ERROR during main execution:', error);
    process.exit(1);
  }
};

console.log('[XERO MCP] Setting up main execution...');
main().catch((error) => {
  console.error('[XERO MCP] FATAL ERROR in main promise chain:', error);
  process.exit(1);
});
