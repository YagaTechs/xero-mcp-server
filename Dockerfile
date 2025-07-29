# Dockerfile for Xero MCP Server
# Handles the dual architecture: HTTP wrapper + MCP core server

ARG NODE_VERSION=18-alpine
FROM node:${NODE_VERSION} AS builder

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install all dependencies (including dev dependencies for building)
RUN npm ci --ignore-scripts

# Copy the rest of the source code
COPY . .

# Build the TypeScript project
RUN npm run build

# Production stage
FROM node:${NODE_VERSION} AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
# Keep node_modules for ES module resolution
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy the HTTP wrapper (mcp-server.js) - this is the main entry point
COPY mcp-server.js ./

# Copy the compiled TypeScript application from builder
COPY --from=builder /app/dist ./dist

# Copy any other necessary files that might be required
COPY .env* ./

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S app -u 1001

# Change ownership of app files to non-root user
RUN chown -R app:nodejs /app
USER app

# Expose the HTTP wrapper port
EXPOSE 3000

# Health check for the HTTP wrapper (not the MCP core)
HEALTHCHECK --interval=30s --timeout=30s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))" || exit 1

# Run the HTTP wrapper, which will spawn the MCP core server
CMD ["node", "mcp-server.js"]