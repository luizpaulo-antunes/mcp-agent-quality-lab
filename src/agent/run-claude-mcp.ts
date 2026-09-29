import Anthropic from '@anthropic-ai/sdk';
import { mcpTools, type MCPCallToolResultLike, type MCPClientLike } from '@anthropic-ai/sdk/helpers/beta/mcp';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const apiKey = process.env.ANTHROPIC_API_KEY;
const model = process.env.ANTHROPIC_MODEL;

if (!apiKey || !model) {
  throw new Error('Set ANTHROPIC_API_KEY and ANTHROPIC_MODEL in your environment before running this demo.');
}

const mcpClient = new Client({ name: 'mcp-agent-quality-lab', version: '0.1.0' });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: ['--import', 'tsx', 'src/mcp/stdio-server.ts']
});

await mcpClient.connect(transport);

try {
  const { tools } = await mcpClient.listTools();
  const anthropic = new Anthropic({ apiKey });
  // The MCP SDK permits a task-shaped result in newer protocol versions. The
  // Anthropic helper accepts the subset used by this demo (normal tool calls).
  const mcpToolClient: MCPClientLike = {
    async callTool(params) {
      const result = await mcpClient.callTool(params);
      if (!('content' in result)) {
        throw new Error('This demo expects a completed MCP tool result.');
      }
      return result as MCPCallToolResultLike;
    }
  };
  const finalMessage = await anthropic.beta.messages.toolRunner({
    model,
    max_tokens: 500,
    system: 'You are a safe synthetic order-support demo. Use tools only for ORD-xxxx ids. Never claim to issue a refund.',
    messages: [{ role: 'user', content: 'What is the status of ORD-1001?' }],
    tools: mcpTools(tools, mcpToolClient)
  });

  console.log(finalMessage.content);
} finally {
  await mcpClient.close();
}
