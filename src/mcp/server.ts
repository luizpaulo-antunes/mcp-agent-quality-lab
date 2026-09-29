import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import { CreateReturnDraftInput, GetOrderInput, SupportTools } from './support-tools.js';

export function createSupportMcpServer(tools = new SupportTools()): McpServer {
  const server = new McpServer({
    name: 'synthetic-order-support',
    version: '0.1.0'
  });

  server.tool('get_order', GetOrderInput.shape, async ({ orderId }) => {
    const order = tools.getOrder({ orderId });

    if (!order) {
      return {
        isError: true,
        content: [{ type: 'text', text: `No synthetic order found for ${orderId}.` }]
      };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(order) }]
    };
  });

  server.tool('create_return_draft', CreateReturnDraftInput.shape, async ({ orderId, reason }) => {
    try {
      const draft = tools.createReturnDraft({ orderId, reason });
      return {
        content: [{ type: 'text', text: JSON.stringify(draft) }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: 'text', text: error instanceof Error ? error.message : 'Unable to create draft.' }]
      };
    }
  });

  return server;
}

