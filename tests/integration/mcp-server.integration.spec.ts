import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

function textContent(result: unknown): string {
  if (typeof result !== 'object' || result === null || !('content' in result))
    return '';

  const { content } = result;
  if (!Array.isArray(content))
    return '';

  return content
    .filter((block): block is { type: 'text'; text: string } => {
      if (typeof block !== 'object' || block === null)
        return false;
      return 'type' in block && block.type === 'text' && 'text' in block && typeof block.text === 'string';
    })
    .map((block) => block.text)
    .join('\n');
}

describe('MCP stdio server', () => {
  const projectRoot = fileURLToPath(new URL('../..', import.meta.url));
  const client = new Client({ name: 'mcp-agent-quality-lab-tests', version: '0.1.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ['--import', 'tsx', 'src/mcp/stdio-server.ts'],
    cwd: projectRoot
  });

  beforeAll(async () => {
    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
  });

  it('discovers the support tools through the MCP protocol', async () => {
    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name).sort()).toEqual(['create_return_draft', 'get_order']);
    expect(tools).toEqual(expect.arrayContaining([
      expect.objectContaining({
        name: 'get_order',
        inputSchema: expect.objectContaining({ required: ['orderId'] })
      }),
      expect.objectContaining({
        name: 'create_return_draft',
        inputSchema: expect.objectContaining({ required: ['orderId', 'reason'] })
      })
    ]));
  });

  it('looks up a synthetic order through MCP', async () => {
    const result = await client.callTool({
      name: 'get_order',
      arguments: { orderId: 'ORD-1001' }
    });

    expect(result.isError).not.toBe(true);
    expect(JSON.parse(textContent(result))).toMatchObject({
      orderId: 'ORD-1001',
      status: 'SHIPPED',
      customerLabel: 'Synthetic customer A'
    });
  });

  it('returns a draft requiring human approval through MCP', async () => {
    const result = await client.callTool({
      name: 'create_return_draft',
      arguments: {
        orderId: 'ORD-1002',
        reason: 'Package is no longer needed.'
      }
    });

    expect(result.isError).not.toBe(true);
    expect(JSON.parse(textContent(result))).toMatchObject({
      orderId: 'ORD-1002',
      requiresHumanApproval: true
    });
  });

  it('returns an MCP error for an unknown synthetic order', async () => {
    const result = await client.callTool({
      name: 'get_order',
      arguments: { orderId: 'ORD-9999' }
    });

    expect(result.isError).toBe(true);
    expect(textContent(result)).toContain('No synthetic order found for ORD-9999.');
  });

  it('rejects invalid arguments at the MCP input boundary', async () => {
    const result = await client.callTool({
      name: 'create_return_draft',
      arguments: {
        orderId: 'invalid-order',
        reason: 'no'
      }
    });

    expect(result.isError).toBe(true);
    expect(textContent(result)).toContain('Invalid arguments');
  });
});
