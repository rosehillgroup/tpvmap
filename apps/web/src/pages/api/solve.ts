import { getStore } from '@netlify/blobs';
import { SmartBlendSolver, SmartSolverConstraints, SmartRecipe } from '../../lib/colour/smartSolver';
import { canonicalParts, canonicalPerc, deduplicateRecipes, mmrSelect, DedupeRecipe } from '../../lib/colour/smartUtils';
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
      
      // Solve for this target with smart solver
      const allSmartRecipes = solver.solve(targetLab, 15); // Get more candidates
      console.log(`[${targetId}] Generated ${allSmartRecipes.length} initial recipes`);
      
      // Convert to DedupeRecipe format for final safety deduplication at API level
      const apiDedupeRecipes = allSmartRecipes.map(recipe => ({
        components: recipe.components,
        mode: constraints.mode as 'percent' | 'parts',
        parts: recipe.parts && recipe.total ? {
          codes: Object.keys(recipe.parts),
          parts: Object.values(recipe.parts),
          total: recipe.total
        } : undefined,
        lab: recipe.lab,
        deltaE: recipe.deltaE,
        weights: recipe.weights
      }));
      
      // Apply final safety deduplication
      const safetyDeduped = deduplicateRecipes(apiDedupeRecipes);
      console.log(`[${targetId}] After safety deduplication: ${safetyDeduped.length} recipes`);
      
      // Apply complexity-based bucketing with canonical keys for proper identification
      const bucketedRecipes = new Map<string, typeof safetyDeduped[0]>();
      const singleComponent: typeof safetyDeduped = [];
      const twoComponent: typeof safetyDeduped = [];
      const threeComponent: typeof safetyDeduped = [];
      
      for (const recipe of safetyDeduped) {
        // Generate canonical key for this recipe
        const canonicalKey = recipe.mode === 'parts' && recipe.parts
          ? canonicalParts(recipe.parts.parts, recipe.parts.codes).key
          : canonicalPerc(recipe.components).key;
        
        // Only add if we haven't seen this canonical recipe before  
        if (!bucketedRecipes.has(canonicalKey)) {
          bucketedRecipes.set(canonicalKey, recipe);
          
          // Bucket by complexity
          const componentCount = recipe.mode === 'parts' && recipe.parts 
            ? recipe.parts.codes.length 
            : recipe.components.length;
            
          if (componentCount === 1) {
            singleComponent.push(recipe);
          } else if (componentCount === 2) {
            twoComponent.push(recipe);
          } else if (componentCount === 3) {
            threeComponent.push(recipe);
          }
        }
      }
      
      // Select balanced representation from each bucket
      const finalSelection = [
        ...singleComponent.slice(0, 1),  // Top 1 single component
        ...twoComponent.slice(0, 3),     // Top 3 two-component  
        ...threeComponent.slice(0, 1)    // Top 1 three-component
      ];
      console.log(`[${targetId}] Bucketed: ${singleComponent.length} single, ${twoComponent.length} two-way, ${threeComponent.length} three-way`);
      
      // Fill remaining slots with best overall candidates if needed
      const usedKeys = new Set(finalSelection.map(recipe => 
        recipe.mode === 'parts' && recipe.parts
          ? canonicalParts(recipe.parts.parts, recipe.parts.codes).key
          : canonicalPerc(recipe.components).key
      ));
      
      const remainingSlots = 5 - finalSelection.length;
      if (remainingSlots > 0) {
        const unused = safetyDeduped.filter(recipe => {
          const key = recipe.mode === 'parts' && recipe.parts
            ? canonicalParts(recipe.parts.parts, recipe.parts.codes).key
            : canonicalPerc(recipe.components).key;
          return !usedKeys.has(key);
        });
        finalSelection.push(...unused.slice(0, remainingSlots));
      }
      
      // Convert DedupeRecipe format back to legacy Recipe format for compatibility
      console.log(`[${targetId}] Final selection: ${finalSelection.length} recipes`);
      
      // Log canonical keys for debugging
      const canonicalKeys = finalSelection.map(recipe => 
        recipe.mode === 'parts' && recipe.parts
          ? canonicalParts(recipe.parts.parts, recipe.parts.codes).key
          : canonicalPerc(recipe.components).key
      );
      console.log(`[${targetId}] Canonical keys:`, canonicalKeys);
      
      const legacyRecipes = finalSelection.slice(0, 5).map(recipe => ({
        kind: constraints.mode as 'percent' | 'parts',
        weights: recipe.weights,
        parts: recipe.parts ? recipe.parts.codes.reduce((obj, code, i) => {
          obj[code] = recipe.parts!.parts[i];
          return obj;
        }, {} as Record<string, number>) : undefined,
        total: recipe.parts?.total,
        rgb: allSmartRecipes.find(sr => sr.deltaE === recipe.deltaE)?.rgb || { R: 128, G: 128, B: 128 },
        lab: recipe.lab,
        deltaE: recipe.deltaE,
        note: finalSelection.length < 5 ? `Showing ${finalSelection.length} unique recipes` : undefined
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