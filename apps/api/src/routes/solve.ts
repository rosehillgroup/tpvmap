import { Hono } from 'hono';
import { storage } from '../lib/storage.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = new Hono();

interface SolveRequest {
  jobId: string;
  targetIds: string[];
  constraints: {
    maxComponents: number;
    stepPct: number;
    minPct: number;
    mode: 'percent' | 'parts';
    parts?: {
      maxTotal: number;
      minPer: number;
    };
    forceComponents?: string[];
  };
}

app.post('/', async (c) => {
  try {
    const body = await c.req.json<SolveRequest>();
    const { jobId, targetIds, constraints } = body;
    
    if (!jobId || !targetIds || !constraints) {
      return c.json({ error: 'Missing required parameters' }, 400);
    }
    
    const jobData = await storage.getJobData(jobId);
    if (!jobData) {
      return c.json({ error: 'Job not found' }, 404);
    }
    
    // For MVP, return mock recipe data
    const mockRecipes: any = {};
    
    for (const targetId of targetIds) {
      mockRecipes[targetId] = [
        {
          kind: constraints.mode,
          weights: { 'RH01': 0.66, 'RH10': 0.34 },
          rgb: { R: 120, G: 55, B: 50 },
          lab: { L: 40.0, a: 25.0, b: 22.0 },
          deltaE: 0.8,
          note: '2-component blend'
        },
        {
          kind: constraints.mode,
          weights: { 'RH01': 0.50, 'RH10': 0.30, 'RH30': 0.20 },
          rgb: { R: 130, G: 70, B: 60 },
          lab: { L: 41.0, a: 20.0, b: 23.0 },
          deltaE: 1.2,
          note: '3-component blend'
        }
      ];
      
      if (constraints.mode === 'parts') {
        mockRecipes[targetId][0].parts = { 'RH01': 2, 'RH10': 1 };
        mockRecipes[targetId][0].total = 3;
        mockRecipes[targetId][1].parts = { 'RH01': 5, 'RH10': 3, 'RH30': 2 };
        mockRecipes[targetId][1].total = 10;
      }
    }
    
    return c.json({ recipes: mockRecipes });
  } catch (error) {
    console.error('Solve error:', error);
    return c.json({ error: 'Solve failed' }, 500);
  }
});

export default app;