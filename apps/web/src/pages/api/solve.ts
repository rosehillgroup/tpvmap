import { getStore } from '@netlify/blobs';
import { SmartBlendSolver, SmartSolverConstraints, SmartRecipe } from '../../lib/colour/smartSolver';
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
    preferAnchor?: boolean;
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
    
    // Map old constraints format to new smart solver format
    const smartConstraints: SmartSolverConstraints = {
      maxComponents: Math.min(Math.max(constraints.maxComponents, 1), 3) as 1 | 2 | 3,
      stepPct: constraints.stepPct || 0.02,
      minPct: constraints.minPct || 0.10,
      mode: constraints.mode || 'parts',
      parts: constraints.mode === 'parts' && constraints.parts ? {
        enabled: true,
        total: constraints.parts.maxTotal || 12,
        minPer: constraints.parts.minPer || 1
      } : undefined,
      preferAnchor: constraints.preferAnchor || false
    };

    // Initialize the smart blend solver
    const solver = new SmartBlendSolver(tpvColours as TPVColour[], smartConstraints);
    
    // Solve for each target colour
    const recipes: Record<string, SmartRecipe[]> = {};
    
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
      
      // Solve for this target with smart solver
      const smartRecipes = solver.solve(targetLab, 5);
      
      // Convert SmartRecipe format to legacy Recipe format for compatibility
      const legacyRecipes = smartRecipes.map(recipe => ({
        kind: constraints.mode,
        weights: recipe.weights,
        parts: recipe.parts,
        total: recipe.total,
        rgb: recipe.rgb,
        lab: recipe.lab,
        deltaE: recipe.deltaE,
        note: recipe.reasoning || recipe.note
      }));
      
      recipes[targetId] = legacyRecipes;
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