import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

import { SupportAgent } from './agent/support-agent.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ChatRequest = z.object({ message: z.string().trim().min(1).max(2_000) });

export function createApp(agent = new SupportAgent()) {
  const app = express();
  app.use(express.json());
  app.use(express.static(path.resolve(__dirname, '../public')));

  app.get('/health', (_request, response) => {
    response.json({ status: 'ok', mode: 'deterministic-synthetic-demo' });
  });

  app.post('/api/chat', async (request, response) => {
    const parsed = ChatRequest.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'message must be a non-empty string with at most 2,000 characters.' });
      return;
    }

    const result = await agent.respond(parsed.data.message);
    response.json(result);
  });

  return app;
}

