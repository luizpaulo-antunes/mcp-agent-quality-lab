import { Ajv2020 } from 'ajv/dist/2020.js';
import { expect, test } from '@playwright/test';

import chatResponseSchema from '../../contracts/chat-response.schema.json' with { type: 'json' };

const validateChatResponse = new Ajv2020({ strict: false }).compile(chatResponseSchema);

test('POST /api/chat returns a valid agent response contract and MCP tool trace', async ({ request }) => {
  const response = await request.post('/api/chat', { data: { message: 'Check ORD-1001' } });
  const body = await response.json();

  expect(response).toBeOK();
  expect(validateChatResponse(body), JSON.stringify(validateChatResponse.errors)).toBe(true);
  expect(body.toolCalls).toContainEqual({ name: 'get_order', input: { orderId: 'ORD-1001' } });
  expect(body.safety.blocked).toBe(false);
});

test('POST /api/chat rejects malformed input', async ({ request }) => {
  const response = await request.post('/api/chat', { data: { message: '' } });

  expect(response.status()).toBe(400);
});
