# Xero MCP Server

A comprehensive Model Context Protocol (MCP) server implementation for Xero that provides standardized access to Xero's accounting and business features through HTTP endpoints.

## 🏗️ Architecture Overview

The Xero MCP Server consists of two main components:

1. **MCP Core Server** (`dist/index.js`) - Handles MCP protocol communication
2. **HTTP Wrapper** (`mcp-server.js`) - Provides REST API endpoints for client integration

### Server Flow

```
Client Request → HTTP Server → MCP Server → Xero API → Response
     ↓              ↓            ↓           ↓         ↓
  REST API    Express.js    MCP Protocol  Xero SDK   JSON Response
```

## 🚀 Quick Start

### Prerequisites

- Node.js (v18 or higher)
- npm or pnpm
- Xero developer account with API credentials

### Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Set environment variables
export XERO_CLIENT_ID=your_xero_client_id
export XERO_CLIENT_SECRET=your_xero_client_secret

# Start the HTTP server
node mcp-server.js
```

The server will start on `http://localhost:3000` by default.

## 🔗 API Endpoints

### Health Check
```http
GET /health
```
Returns server status and MCP server state.

### List Available Tools
```http
GET /tools
```
Returns all available MCP tools with their schemas.

### Call a Tool
```http
POST /tools/{toolName}
Content-Type: application/json

{
  "arguments": {
    // Tool-specific parameters
  }
}
```

### Generic MCP Endpoint
```http
POST /mcp
Content-Type: application/json

{
  "method": "tools/call",
  "params": {
    "name": "tool-name",
    "arguments": {}
  }
}
```

## 🛠️ Available Tools

### 📋 List Operations

#### Core Business Data
- **`list-contacts`** - Retrieve all contacts (customers/suppliers)
  - Parameters: `page` (optional) - Page number for pagination
- **`list-invoices`** - Retrieve all invoices
  - Parameters: `page`, `status`, `dateFrom`, `dateTo` (all optional)
- **`list-credit-notes`** - Retrieve all credit notes
  - Parameters: `page`, `status`, `dateFrom`, `dateTo` (all optional)
- **`list-payments`** - Retrieve all payments
  - Parameters: `page`, `dateFrom`, `dateTo` (all optional)
- **`list-quotes`** - Retrieve all quotes
  - Parameters: `page`, `status`, `dateFrom`, `dateTo` (all optional)

#### Financial Data
- **`list-accounts`** - Retrieve chart of accounts
  - Parameters: `page` (optional)
- **`list-bank-transactions`** - Retrieve bank transactions
  - Parameters: `page`, `dateFrom`, `dateTo` (all optional)
- **`list-manual-journals`** - Retrieve manual journals
  - Parameters: `page`, `dateFrom`, `dateTo` (all optional)
- **`list-items`** - Retrieve inventory items
  - Parameters: `page` (optional)

#### Reports
- **`list-profit-and-loss`** - Retrieve profit and loss report
  - Parameters: `fromDate`, `toDate`, `periods`, `timeframe` (all optional)
- **`list-report-balance-sheet`** - Retrieve balance sheet report
  - Parameters: `date`, `periods`, `timeframe` (all optional)
- **`list-trial-balance`** - Retrieve trial balance report
  - Parameters: `date` (optional)
- **`list-aged-receivables-by-contact`** - Retrieve aged receivables
  - Parameters: `contactId`, `date` (both optional)
- **`list-aged-payables-by-contact`** - Retrieve aged payables
  - Parameters: `contactId`, `date` (both optional)

#### Organization & Settings
- **`list-organisation-details`** - Retrieve organization information
- **`list-tax-rates`** - Retrieve tax rates
  - Parameters: `page` (optional)
- **`list-contact-groups`** - Retrieve contact groups
  - Parameters: `page` (optional)
- **`list-tracking-categories`** - Retrieve tracking categories
  - Parameters: `page` (optional)

#### Payroll (NZ/UK only)
- **`list-payroll-employees`** - Retrieve payroll employees
  - Parameters: `page` (optional)
- **`list-payroll-timesheets`** - Retrieve payroll timesheets
  - Parameters: `page`, `employeeId`, `dateFrom`, `dateTo` (all optional)
- **`list-payroll-employee-leave`** - Retrieve employee leave records
  - Parameters: `employeeId`, `page` (both optional)
- **`list-payroll-employee-leave-balances`** - Retrieve leave balances
  - Parameters: `employeeId` (optional)
- **`list-payroll-employee-leave-types`** - Retrieve employee leave types
  - Parameters: `employeeId` (optional)
- **`list-payroll-leave-periods`** - Retrieve leave periods
  - Parameters: `employeeId`, `page` (both optional)
- **`list-payroll-leave-types`** - Retrieve all leave types
  - Parameters: `page` (optional)

### ➕ Create Operations

#### Core Business Objects
- **`create-contact`** - Create a new contact
  - Parameters: `name`, `firstName`, `lastName`, `emailAddress`, `isCustomer`, `isSupplier` (all optional except `name`)
- **`create-invoice`** - Create a new invoice
  - Parameters: `contactId`, `lineItems[]`, `type` (ACCREC/ACCPAY), `reference`, `date` (all optional except `contactId` and `lineItems`)
- **`create-credit-note`** - Create a new credit note
  - Parameters: `contactId`, `lineItems[]`, `type`, `reference`, `date` (all optional except `contactId` and `lineItems`)
- **`create-payment`** - Create a new payment
  - Parameters: `invoiceId`, `amount`, `accountId`, `date`, `reference` (all optional except `invoiceId` and `amount`)
- **`create-quote`** - Create a new quote
  - Parameters: `contactId`, `lineItems[]`, `reference`, `date` (all optional except `contactId` and `lineItems`)

#### Financial Objects
- **`create-bank-transaction`** - Create a bank transaction
  - Parameters: `contactId`, `lineItems[]`, `date`, `reference` (all optional except `lineItems`)
- **`create-manual-journal`** - Create a manual journal
  - Parameters: `narration`, `journalLines[]`, `date` (all optional except `narration` and `journalLines`)
- **`create-item`** - Create an inventory item
  - Parameters: `name`, `code`, `description`, `purchaseDetails`, `salesDetails` (all optional except `name`)

#### Payroll
- **`create-payroll-timesheet`** - Create a payroll timesheet
  - Parameters: `employeeId`, `startDate`, `endDate`, `timesheetLines[]` (all required)

#### Settings
- **`create-tracking-category`** - Create a tracking category
  - Parameters: `name`, `status` (all optional except `name`)
- **`create-tracking-options`** - Create tracking options
  - Parameters: `trackingCategoryId`, `options[]` (all required)

### ✏️ Update Operations

#### Core Business Objects
- **`update-contact`** - Update an existing contact
  - Parameters: `contactId`, `name`, `firstName`, `lastName`, `emailAddress` (all optional except `contactId`)
- **`update-invoice`** - Update a draft invoice
  - Parameters: `invoiceId`, `lineItems[]`, `reference`, `date` (all optional except `invoiceId`)
- **`update-credit-note`** - Update a draft credit note
  - Parameters: `creditNoteId`, `lineItems[]`, `reference`, `date` (all optional except `creditNoteId`)
- **`update-quote`** - Update a draft quote
  - Parameters: `quoteId`, `lineItems[]`, `reference`, `date` (all optional except `quoteId`)

#### Financial Objects
- **`update-bank-transaction`** - Update a bank transaction
  - Parameters: `bankTransactionId`, `lineItems[]`, `date`, `reference` (all optional except `bankTransactionId`)
- **`update-manual-journal`** - Update a manual journal
  - Parameters: `manualJournalId`, `narration`, `journalLines[]`, `date` (all optional except `manualJournalId`)

#### Payroll
- **`update-payroll-timesheet-add-line`** - Add line to timesheet
  - Parameters: `timesheetId`, `employeeId`, `date`, `earningsRateId`, `numberOfUnits` (all required)
- **`update-payroll-timesheet-update-line`** - Update timesheet line
  - Parameters: `timesheetId`, `timesheetLineId`, `numberOfUnits` (all required)
- **`approve-payroll-timesheet`** - Approve a timesheet
  - Parameters: `timesheetId` (required)
- **`revert-payroll-timesheet`** - Revert an approved timesheet
  - Parameters: `timesheetId` (required)

#### Settings
- **`update-tracking-category`** - Update tracking category
  - Parameters: `trackingCategoryId`, `name`, `status` (all optional except `trackingCategoryId`)
- **`update-tracking-options`** - Update tracking options
  - Parameters: `trackingCategoryId`, `options[]` (all required)

### 🗑️ Delete Operations

#### Payroll
- **`delete-payroll-timesheet`** - Delete a timesheet
  - Parameters: `timesheetId` (required)

### 📖 Get Operations

#### Payroll
- **`get-payroll-timesheet`** - Get a specific timesheet
  - Parameters: `timesheetId` (required)

## 🔐 Authentication

The server supports two authentication modes:

### 1. Custom Connections (Recommended for Development)
Set environment variables:
```bash
export XERO_CLIENT_ID=your_client_id
export XERO_CLIENT_SECRET=your_client_secret
```

### 2. Bearer Token (For Multiple Accounts)
Set environment variable:
```bash
export XERO_CLIENT_BEARER_TOKEN=your_bearer_token
```

## 📝 Usage Examples

### List all contacts
```bash
curl -X GET http://localhost:3000/tools
```

### Create an invoice
```bash
curl -X POST http://localhost:3000/tools/create-invoice \
  -H "Content-Type: application/json" \
  -d '{
    "arguments": {
      "contactId": "CONTACT_ID",
      "lineItems": [
        {
          "description": "Consulting Services",
          "quantity": 10,
          "unitAmount": 100.00,
          "accountCode": "200",
          "taxType": "OUTPUT"
        }
      ],
      "type": "ACCREC",
      "reference": "INV-001"
    }
  }'
```

### Get profit and loss report
```bash
curl -X POST http://localhost:3000/tools/list-profit-and-loss \
  -H "Content-Type: application/json" \
  -d '{
    "arguments": {
      "fromDate": "2024-01-01",
      "toDate": "2024-12-31",
      "timeframe": "QUARTER"
    }
  }'
```

## 🏗️ Development

### Project Structure
```
src/
├── clients/          # Xero API client
├── handlers/         # Business logic handlers
├── helpers/          # Utility functions
├── server/           # MCP server implementation
├── tools/            # Tool definitions
│   ├── create/       # Create operations
│   ├── delete/       # Delete operations
│   ├── get/          # Get operations
│   ├── list/         # List operations
│   └── update/       # Update operations
└── types/            # TypeScript type definitions
```

### Building
```bash
npm run build
```

### Development Mode
```bash
npm run watch
```

## 📚 Documentation Links

- [Xero Public API Documentation](https://developer.xero.com/documentation/api/)
- [Xero API Explorer](https://api-explorer.xero.com/)
- [Xero OpenAPI Specs](https://github.com/XeroAPI/Xero-OpenAPI)
- [Xero-Node SDK Documentation](https://xeroapi.github.io/xero-node/accounting)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)

## 🔒 Security

- Never commit `.env` files or sensitive credentials
- Use environment variables for all sensitive data
- The server runs locally by default for security

## 📄 License

MIT License - see LICENSE file for details.
