import { getStore } from '@netlify/blobs';

export const prerender = false;

interface PaletteEntry {
  id: string;
  rgb: { R: number; G: number; B: number };
  lab: { L: number; a: number; b: number };
  areaPct: number;
  pageIds?: string[];
}

interface Recipe {
  kind: 'percent' | 'parts';
  weights: Record<string, number>;
  parts?: Record<string, number>;
  total?: number;
  rgb: { R: number; G: number; B: number };
  lab: { L: number; a: number; b: number };
  deltaE: number;
  note?: string;
}

function calculateBoM(areaPct: number, thicknessMm: number, densityKgM3: number, wastagePct: number, designAreaM2: number = 1): number {
  // Calculate material needed in kg
  const volumeM3 = designAreaM2 * (thicknessMm / 1000); // Convert mm to m
  const baseWeight = volumeM3 * densityKgM3;
  const areaFraction = areaPct / 100;
  const withWastage = baseWeight * (1 + wastagePct / 100);
  return baseWeight * areaFraction * withWastage;
}

function formatRecipe(weights: Record<string, number>, parts?: Record<string, number>): string {
  if (parts) {
    const partsArray = Object.entries(parts).map(([code, value]) => `${value} parts ${code}`);
    return partsArray.join(', ');
  } else {
    const percentArray = Object.entries(weights).map(([code, value]) => `${(value * 100).toFixed(1)}% ${code}`);
    return percentArray.join(', ');
  }
}

export async function GET(context: any) {

  try {
    const url = new URL(context.request.url);
    const jobId = url.searchParams.get('jobId');
    const format = url.searchParams.get('format') || 'csv';
    const thicknessMm = parseFloat(url.searchParams.get('thickness_mm') || '10');
    const densityKgM3 = parseFloat(url.searchParams.get('density_kg_m3') || '1400');
    const wastagePct = parseFloat(url.searchParams.get('wastage_pct') || '10');
    
    if (!jobId) {
      return Response.json({ error: 'Missing jobId parameter' }, { status: 400 });
    }
    
    const store = getStore({ name: 'tpv-matcher' });
    
    // Get job data
    const jobDataStr = await store.get(`jobs/${jobId}.json`, { type: 'text' });
    if (!jobDataStr) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }
    
    // Get palette data
    const paletteStr = await store.get(`palettes/${jobId}.json`, { type: 'text' });
    if (!paletteStr) {
      return Response.json({ error: 'Palette not found' }, { status: 404 });
    }
    
    const palette: PaletteEntry[] = JSON.parse(paletteStr);
    
    // Find the latest results for this job
    const allKeys = await store.list({ prefix: `results/${jobId}-` });
    if (allKeys.blobs.length === 0) {
      return Response.json({ error: 'No recipes found. Generate blends first.' }, { status: 404 });
    }
    
    // Get the latest results
    const latestKey = allKeys.blobs.sort((a, b) => b.key.localeCompare(a.key))[0].key;
    const resultsStr = await store.get(latestKey, { type: 'text' });
    const results = JSON.parse(resultsStr!);
    const recipes: Record<string, Recipe[]> = results.recipes;
    
    if (format === 'csv') {
      const rows = ['Target Colour,Recipe,Area %,ΔE2000,Predicted kg'];
      
      for (const [targetId, targetRecipes] of Object.entries(recipes)) {
        const target = palette.find(p => p.id === targetId);
        if (!target || targetRecipes.length === 0) continue;
        
        // Use the first (best) recipe for each target
        const recipe = targetRecipes[0];
        const targetHex = `#${target.rgb.R.toString(16).padStart(2, '0')}${target.rgb.G.toString(16).padStart(2, '0')}${target.rgb.B.toString(16).padStart(2, '0')}`.toUpperCase();
        const recipeText = formatRecipe(recipe.weights, recipe.parts);
        const predictedKg = calculateBoM(target.areaPct, thicknessMm, densityKgM3, wastagePct);
        
        rows.push(`"${targetHex}","${recipeText}",${target.areaPct.toFixed(1)},${recipe.deltaE.toFixed(2)},${predictedKg.toFixed(2)}`);
      }
      
      const csv = rows.join('\n');
      
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="tpv-match-${jobId}.csv"`
        }
      });
    } else if (format === 'json') {
      const exportData = {
        jobId,
        exportDate: new Date().toISOString(),
        parameters: { thicknessMm, densityKgM3, wastagePct },
        results: []
      };
      
      for (const [targetId, targetRecipes] of Object.entries(recipes)) {
        const target = palette.find(p => p.id === targetId);
        if (!target || targetRecipes.length === 0) continue;
        
        const recipe = targetRecipes[0];
        const targetHex = `#${target.rgb.R.toString(16).padStart(2, '0')}${target.rgb.G.toString(16).padStart(2, '0')}${target.rgb.B.toString(16).padStart(2, '0')}`.toUpperCase();
        const predictedKg = calculateBoM(target.areaPct, thicknessMm, densityKgM3, wastagePct);
        
        exportData.results.push({
          targetColour: targetHex,
          targetRgb: target.rgb,
          targetLab: target.lab,
          recipe: recipe.weights,
          parts: recipe.parts,
          areaPct: target.areaPct,
          deltaE: recipe.deltaE,
          predictedKg,
          note: recipe.note
        });
      }
      
      return Response.json(exportData, {
        status: 200,
        headers: {
          'Content-Disposition': `attachment; filename="tpv-match-${jobId}.json"`
        }
      });
    } else {
      return Response.json({ error: 'Unsupported format. Use csv or json' }, { status: 400 });
    }
  } catch (error) {
    console.error('Export error:', error);
    return Response.json({ error: 'Export failed' }, { status: 500 });
  }
}