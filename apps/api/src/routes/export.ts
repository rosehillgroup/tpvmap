import { Hono } from 'hono';
import { storage } from '../lib/storage.js';

const app = new Hono();

app.get('/', async (c) => {
  const jobId = c.req.query('jobId');
  const format = c.req.query('format') || 'csv';
  const thicknessMm = parseFloat(c.req.query('thickness_mm') || '10');
  const densityKgM3 = parseFloat(c.req.query('density_kg_m3') || '1400');
  const wastagePct = parseFloat(c.req.query('wastage_pct') || '10');
  
  if (!jobId) {
    return c.json({ error: 'Missing jobId parameter' }, 400);
  }
  
  const jobData = await storage.getJobData(jobId);
  if (!jobData) {
    return c.json({ error: 'Job not found' }, 404);
  }
  
  if (format === 'csv') {
    const csv = `Target Colour,Recipe,Area %,ΔE,Predicted kg
Palette 1,"66.7% RH01, 33.3% RH10",25.5,0.8,35.7
Palette 2,"50% RH01, 30% RH10, 20% RH30",18.3,1.2,25.6
Palette 3,"100% RH30",15.2,0.1,21.3`;
    
    c.header('Content-Type', 'text/csv');
    c.header('Content-Disposition', `attachment; filename="tpv-match-${jobId}.csv"`);
    return c.body(csv);
  } else if (format === 'json') {
    const data = {
      jobId,
      exportDate: new Date().toISOString(),
      parameters: { thicknessMm, densityKgM3, wastagePct },
      results: [
        {
          targetColour: 'Palette 1',
          recipe: { 'RH01': 0.667, 'RH10': 0.333 },
          areaPct: 25.5,
          deltaE: 0.8,
          predictedKg: 35.7
        }
      ]
    };
    
    c.header('Content-Type', 'application/json');
    c.header('Content-Disposition', `attachment; filename="tpv-match-${jobId}.json"`);
    return c.json(data);
  } else {
    return c.json({ error: 'Unsupported format. Use csv or json' }, 400);
  }
});

export default app;