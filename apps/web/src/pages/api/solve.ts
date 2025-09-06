import { getStore } from '@netlify/blobs';
import { BlendSolver } from '../../lib/solver/solver';
import tpvColours from '../../data/rosehill_tpv_21_colours.json';
import type { TPVColour } from '../../lib/colour/blend';

export const prerender = false;

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

interface PaletteEntry {
  id: string;
  rgb: { R: number; G: number; B: number };
  lab: { L: number; a: number; b: number };
  areaPct: number;
  pageIds?: string[];
}

export async function POST(context: any) {

  try {
    const body: SolveRequest = await context.request.json();
    const { jobId, targetIds, constraints } = body;
    
    if (!jobId || !targetIds || !constraints) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }
    
    const store = getStore({ name: 'tpv-matcher' });
    
    // Check if job exists
    const jobDataStr = await store.get(`jobs/${jobId}.json`, { type: 'text' });
    if (!jobDataStr) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }
    
    // Get the palette data
    const paletteStr = await store.get(`palettes/${jobId}.json`, { type: 'text' });
    if (!paletteStr) {
      return Response.json({ error: 'Palette not found. Extract palette first.' }, { status: 404 });
    }
    
    const paletteData = JSON.parse(paletteStr);
    // Handle both old simple format and new structured format
    const palette: PaletteEntry[] = paletteData.palette || paletteData;
    
    // Initialize the blend solver
    const solver = new BlendSolver(tpvColours as TPVColour[], constraints);
    
    // Solve for each target colour
    const recipes: Record<string, any[]> = {};
    
    for (const targetId of targetIds) {
      const target = palette.find(p => p.id === targetId);
      if (!target) {
        console.warn(`Target colour ${targetId} not found in palette`);
        continue;
      }
      
      const targetLab = {
        L: target.lab.L,
        a: target.lab.a,
        b: target.lab.b
      };
      
      // Solve for this target
      const targetRecipes = solver.solve(targetLab);
      recipes[targetId] = targetRecipes;
    }
    
    // Cache the results
    const resultsKey = `results/${jobId}-${Date.now()}.json`;
    await store.set(resultsKey, JSON.stringify({ recipes, constraints, timestamp: Date.now() }));
    
    return Response.json({ recipes });
  } catch (error) {
    console.error('Solve error:', error);
    return Response.json({ error: 'Solve failed', details: error.message }, { status: 500 });
  }
}