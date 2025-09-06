import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import uploadRoute from './routes/upload.js';
import paletteRoute from './routes/palette.js';
import solveRoute from './routes/solve.js';
import exportRoute from './routes/export.js';

const app = new Hono();

app.use('/*', cors());

app.get('/', (c) => {
  return c.json({ message: 'TPV Match API' });
});

app.route('/upload', uploadRoute);
app.route('/palette', paletteRoute);
app.route('/solve', solveRoute);
app.route('/export', exportRoute);

const port = 3000;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port
});