import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3100);
const app = createApp();

app.listen(port, '127.0.0.1', () => {
  console.log(`MCP Agent Quality Lab running at http://127.0.0.1:${port}`);
});

