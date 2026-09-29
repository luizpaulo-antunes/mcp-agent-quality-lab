import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { createSupportMcpServer } from './server.js';

const server = createSupportMcpServer();
const transport = new StdioServerTransport();

await server.connect(transport);

