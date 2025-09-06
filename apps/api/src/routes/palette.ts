import { Hono } from 'hono';
import { storage } from '../lib/storage.js';

const app = new Hono();

app.get('/', async (c) => {
  const jobId = c.req.query('jobId');
  const scope = c.req.query('scope') || 'overall';
  const pageId = c.req.query('pageId');
  
  if (!jobId) {
    return c.json({ error: 'Missing jobId parameter' }, 400);
  }
  
  const jobData = await storage.getJobData(jobId);
  if (!jobData) {
    return c.json({ error: 'Job not found' }, 404);
  }
  
  // For MVP, return mock palette data
  const mockPalette = [
    {
      id: 'pal-1',
      rgb: { R: 183, G: 30, B: 45 },
      lab: { L: 39.4, a: 58.5, b: 29.0 },
      areaPct: 25.5,
      pageIds: ['page-1']
    },
    {
      id: 'pal-2',
      rgb: { R: 0, G: 107, B: 63 },
      lab: { L: 40.5, a: -42.2, b: 17.9 },
      areaPct: 18.3,
      pageIds: ['page-1']
    },
    {
      id: 'pal-3',
      rgb: { R: 212, G: 181, B: 133 },
      lab: { L: 75.2, a: 3.8, b: 24.8 },
      areaPct: 15.2,
      pageIds: ['page-1']
    }
  ];
  
  return c.json({ palette: mockPalette });
});

export default app;