# Xero MCP Server - Client Development Guide

This guide provides comprehensive information for developing client applications that interact with the Xero MCP Server via HTTP endpoints.

## 🏗️ Architecture Overview

The Xero MCP Server exposes a REST API that wraps the MCP (Model Context Protocol) functionality, making it easy to integrate with any client application.

```
Client Application → HTTP API → MCP Server → Xero API
```

## 🚀 Getting Started

### Prerequisites

1. **Xero MCP Server** must be running (see main README.md for setup)
2. **Xero API Credentials** (Client ID and Secret)
3. **HTTP Client Library** for your programming language

### Server Endpoints

The server runs on `http://localhost:3000` by default and provides these endpoints:

- `GET /health` - Health check
- `GET /tools` - List all available tools
- `POST /tools/{toolName}` - Call a specific tool
- `POST /mcp` - Generic MCP endpoint

## 🔐 Authentication Setup

### 1. Xero Developer Account Setup

1. Create a Xero developer account at [developer.xero.com](https://developer.xero.com)
2. Create a new app in the developer portal
3. Configure OAuth2 scopes (see required scopes below)
4. Note your Client ID and Client Secret

### 2. Required OAuth2 Scopes

The following scopes are required for full functionality:

```json
[
  "offline_access",
  "accounting.transactions",
  "accounting.contacts",
  "accounting.settings",
  "accounting.reports.read",
  "payroll.employees",
  "payroll.timesheets",
  "payroll.settings"
]
```

### 3. Environment Configuration

Set these environment variables on the server:

```bash
# For Custom Connections (recommended for development)
export XERO_CLIENT_ID=your_client_id
export XERO_CLIENT_SECRET=your_client_secret

# OR for Bearer Token (for multiple accounts)
export XERO_CLIENT_BEARER_TOKEN=your_bearer_token
```

## 📡 API Communication

### Base URL
```
http://localhost:3000
```

### Request Headers
```http
Content-Type: application/json
Accept: application/json
```

### Response Format
All responses follow this structure:
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Response content here"
      }
    ]
  }
}
```

### Error Response Format
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32603,
    "message": "Error description"
  }
}
```

## 🛠️ Tool Categories and Usage

### 1. List Operations (Read Data)

#### Core Business Data
```javascript
// List all contacts
const response = await fetch('http://localhost:3000/tools/list-contacts', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    arguments: {
      page: 1  // optional
    }
  })
});

// List invoices with filters
const response = await fetch('http://localhost:3000/tools/list-invoices', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    arguments: {
      page: 1,
      status: 'AUTHORISED',
      dateFrom: '2024-01-01',
      dateTo: '2024-12-31'
    }
  })
});
```

#### Financial Reports
```javascript
// Get profit and loss report
const response = await fetch('http://localhost:3000/tools/list-profit-and-loss', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    arguments: {
      fromDate: '2024-01-01',
      toDate: '2024-12-31',
      timeframe: 'QUARTER',
      periods: 4
    }
  })
});

// Get balance sheet
const response = await fetch('http://localhost:3000/tools/list-report-balance-sheet', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    arguments: {
      date: '2024-12-31',
      periods: 12,
      timeframe: 'MONTH'
    }
  })
});
```

### 2. Create Operations

#### Create Invoice
```javascript
const response = await fetch('http://localhost:3000/tools/create-invoice', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    arguments: {
      contactId: 'CONTACT_ID_HERE',
      lineItems: [
        {
          description: 'Consulting Services',
          quantity: 10,
          unitAmount: 100.00,
          accountCode: '200',
          taxType: 'OUTPUT'
        }
      ],
      type: 'ACCREC',  // ACCREC for sales, ACCPAY for purchases
      reference: 'INV-001',
      date: '2024-01-15'
    }
  })
});
```

#### Create Contact
```javascript
const response = await fetch('http://localhost:3000/tools/create-contact', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    arguments: {
      name: 'John Doe Company',
      firstName: 'John',
      lastName: 'Doe',
      emailAddress: 'john@example.com',
      isCustomer: true,
      isSupplier: false
    }
  })
});
```

### 3. Update Operations

#### Update Invoice
```javascript
const response = await fetch('http://localhost:3000/tools/update-invoice', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    arguments: {
      invoiceId: 'INVOICE_ID_HERE',
      lineItems: [
        {
          description: 'Updated Consulting Services',
          quantity: 15,
          unitAmount: 120.00,
          accountCode: '200',
          taxType: 'OUTPUT'
        }
      ],
      reference: 'INV-001-REV',
      date: '2024-01-20'
    }
  })
});
```

### 4. Payroll Operations (NZ/UK only)

#### Create Timesheet
```javascript
const response = await fetch('http://localhost:3000/tools/create-payroll-timesheet', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    arguments: {
      employeeId: 'EMPLOYEE_ID_HERE',
      startDate: '2024-01-15',
      endDate: '2024-01-21',
      timesheetLines: [
        {
          date: '2024-01-15',
          earningsRateId: 'EARNINGS_RATE_ID',
          numberOfUnits: 8
        }
      ]
    }
  })
});
```

## 🔧 Client Implementation Examples

### JavaScript/Node.js Client

```javascript
class XeroMCPClient {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  async healthCheck() {
    const response = await fetch(`${this.baseUrl}/health`);
    return response.json();
  }

  async listTools() {
    const response = await fetch(`${this.baseUrl}/tools`);
    return response.json();
  }

  async callTool(toolName, arguments = {}) {
    const response = await fetch(`${this.baseUrl}/tools/${toolName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ arguments })
    });
    return response.json();
  }

  async listContacts(page = 1) {
    return this.callTool('list-contacts', { page });
  }

  async createInvoice(invoiceData) {
    return this.callTool('create-invoice', invoiceData);
  }
}

// Usage
const client = new XeroMCPClient();

// Check server health
const health = await client.healthCheck();
console.log('Server status:', health.status);

// List all tools
const tools = await client.listTools();
console.log('Available tools:', tools.result.tools.map(t => t.name));

// Create an invoice
const invoiceResult = await client.createInvoice({
  contactId: 'CONTACT_ID',
  lineItems: [{
    description: 'Services',
    quantity: 1,
    unitAmount: 100,
    accountCode: '200',
    taxType: 'OUTPUT'
  }],
  type: 'ACCREC'
});
```

### Python Client

```python
import requests
import json

class XeroMCPClient:
    def __init__(self, base_url='http://localhost:3000'):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})

    def health_check(self):
        response = self.session.get(f'{self.base_url}/health')
        return response.json()

    def list_tools(self):
        response = self.session.get(f'{self.base_url}/tools')
        return response.json()

    def call_tool(self, tool_name, arguments=None):
        if arguments is None:
            arguments = {}
        
        response = self.session.post(
            f'{self.base_url}/tools/{tool_name}',
            json={'arguments': arguments}
        )
        return response.json()

    def list_contacts(self, page=1):
        return self.call_tool('list-contacts', {'page': page})

    def create_invoice(self, invoice_data):
        return self.call_tool('create-invoice', invoice_data)

# Usage
client = XeroMCPClient()

# Check server health
health = client.health_check()
print(f"Server status: {health['status']}")

# List all tools
tools = client.list_tools()
tool_names = [tool['name'] for tool in tools['result']['tools']]
print(f"Available tools: {tool_names}")

# Create an invoice
invoice_result = client.create_invoice({
    'contactId': 'CONTACT_ID',
    'lineItems': [{
        'description': 'Services',
        'quantity': 1,
        'unitAmount': 100,
        'accountCode': '200',
        'taxType': 'OUTPUT'
    }],
    'type': 'ACCREC'
})
```

### cURL Examples

```bash
# Health check
curl -X GET http://localhost:3000/health

# List all tools
curl -X GET http://localhost:3000/tools

# List contacts
curl -X POST http://localhost:3000/tools/list-contacts \
  -H "Content-Type: application/json" \
  -d '{"arguments": {"page": 1}}'

# Create invoice
curl -X POST http://localhost:3000/tools/create-invoice \
  -H "Content-Type: application/json" \
  -d '{
    "arguments": {
      "contactId": "CONTACT_ID",
      "lineItems": [
        {
          "description": "Services",
          "quantity": 1,
          "unitAmount": 100,
          "accountCode": "200",
          "taxType": "OUTPUT"
        }
      ],
      "type": "ACCREC"
    }
  }'
```

## 🔍 Data Discovery Workflow

### 1. Get Available Tools
First, discover what tools are available:
```javascript
const tools = await client.listTools();
console.log('Available tools:', tools.result.tools);
```

### 2. Get Tool Schema
Each tool has a schema defining its parameters:
```javascript
const toolSchema = tools.result.tools.find(t => t.name === 'create-invoice');
console.log('Tool schema:', toolSchema.inputSchema);
```

### 3. Get Reference Data
Before creating objects, get reference data:
```javascript
// Get contacts for invoice creation
const contacts = await client.callTool('list-contacts');

// Get accounts for line items
const accounts = await client.callTool('list-accounts');

// Get tax rates
const taxRates = await client.callTool('list-tax-rates');
```

### 4. Create Objects
Use the reference data to create new objects:
```javascript
const invoice = await client.createInvoice({
  contactId: contacts.result.contacts[0].contactID,
  lineItems: [{
    description: 'Services',
    quantity: 1,
    unitAmount: 100,
    accountCode: accounts.result.accounts[0].code,
    taxType: taxRates.result.taxRates[0].taxType
  }],
  type: 'ACCREC'
});
```

## 🚨 Error Handling

### Common Error Codes
- `-32603` - Internal error (server error)
- `-32602` - Invalid params
- `-32601` - Method not found
- `-32700` - Parse error

### Error Handling Example
```javascript
async function safeToolCall(toolName, arguments) {
  try {
    const response = await client.callTool(toolName, arguments);
    
    if (response.error) {
      console.error(`Tool call failed: ${response.error.message}`);
      return null;
    }
    
    return response.result;
  } catch (error) {
    console.error(`Network error: ${error.message}`);
    return null;
  }
}
```

## 🔄 Pagination

Many list operations support pagination:
```javascript
async function getAllContacts() {
  const allContacts = [];
  let page = 1;
  
  while (true) {
    const response = await client.callTool('list-contacts', { page });
    const contacts = response.result.contacts || [];
    
    if (contacts.length === 0) break;
    
    allContacts.push(...contacts);
    page++;
  }
  
  return allContacts;
}
```

## 📊 Response Processing

### Text Response
Most tools return text responses that need parsing:
```javascript
function parseContactResponse(response) {
  const text = response.result.content[0].text;
  // Parse the text response to extract structured data
  const lines = text.split('\n');
  const contact = {};
  
  lines.forEach(line => {
    if (line.startsWith('Contact: ')) {
      contact.name = line.replace('Contact: ', '');
    } else if (line.startsWith('ID: ')) {
      contact.id = line.replace('ID: ', '');
    }
    // ... parse other fields
  });
  
  return contact;
}
```

### Deep Links
Some operations return deep links to Xero:
```javascript
function extractDeepLink(response) {
  const text = response.result.content[0].text;
  const linkMatch = text.match(/Link to view: (https?:\/\/[^\s]+)/);
  return linkMatch ? linkMatch[1] : null;
}
```

## 🔒 Security Best Practices

1. **Environment Variables**: Store credentials in environment variables
2. **HTTPS**: Use HTTPS in production
3. **Input Validation**: Validate all input parameters
4. **Rate Limiting**: Implement rate limiting for API calls
5. **Error Logging**: Log errors but don't expose sensitive data

## 🧪 Testing

### Unit Tests
```javascript
describe('XeroMCPClient', () => {
  let client;
  
  beforeEach(() => {
    client = new XeroMCPClient('http://localhost:3000');
  });
  
  test('should check server health', async () => {
    const health = await client.healthCheck();
    expect(health.status).toBe('ok');
  });
  
  test('should list tools', async () => {
    const tools = await client.listTools();
    expect(tools.result.tools).toBeDefined();
  });
});
```

### Integration Tests
```javascript
test('should create and retrieve invoice', async () => {
  // Create invoice
  const createResult = await client.createInvoice(invoiceData);
  expect(createResult.result).toBeDefined();
  
  // List invoices to verify creation
  const listResult = await client.callTool('list-invoices');
  const invoices = listResult.result.invoices || [];
  expect(invoices.length).toBeGreaterThan(0);
});
```

## 📚 Additional Resources

- [Xero API Documentation](https://developer.xero.com/documentation/api/)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [Xero API Explorer](https://api-explorer.xero.com/)
- [Xero-Node SDK](https://xeroapi.github.io/xero-node/)

## 🆘 Troubleshooting

### Common Issues

1. **Server not running**: Ensure `node mcp-server.js` is running
2. **Authentication errors**: Check environment variables
3. **Tool not found**: Verify tool name with `GET /tools`
4. **Invalid parameters**: Check tool schema for required parameters
5. **Network errors**: Verify server URL and port

### Debug Mode
Enable debug logging by setting environment variable:
```bash
export DEBUG=true
```

### Health Check
Always start with a health check:
```javascript
const health = await client.healthCheck();
if (health.status !== 'ok') {
  console.error('Server is not healthy:', health);
}
``` 