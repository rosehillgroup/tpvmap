import { TPVColour, simulateBlend } from '../colour/blend';
import { Lab, sRGBToLab } from '../colour/convert';
import { deltaE2000 } from '../colour/deltaE';
import { TwoWaySearchCache, BlendResult } from './search2';
import { search3Way, localRefine3Way } from './search3';
import { percentagesToParts, PartsConfig } from '../colour/parts';

export interface SolverConstraints {
  maxComponents: number;
  stepPct: number;
  minPct: number;
  mode: 'percent' | 'parts';
  parts?: PartsConfig;
  forceComponents?: string[];
}

export interface Recipe {
  kind: 'percent' | 'parts';
  weights: Record<string, number>;
  parts?: Record<string, number>;
  total?: number;
  rgb: { R: number; G: number; B: number };
  lab: Lab;
  deltaE: number;
  note?: string;
}

export class BlendSolver {
  private twoWayCache: TwoWaySearchCache;
  
  constructor(
    private colours: TPVColour[],
    private constraints: SolverConstraints
  ) {
    this.twoWayCache = new TwoWaySearchCache(colours, {
      stepPct: constraints.stepPct,
      minPct: constraints.minPct
    });
  }
  
  solve(targetLab: Lab): Recipe[] {
    const results: Recipe[] = [];
    
    const singleComponent = this.findSingleComponent(targetLab);
    if (singleComponent && singleComponent.deltaE < 0.5) {
      results.push(this.createRecipe(singleComponent, 'Single component exact match'));
    }
    
    const twoWayResults = this.twoWayCache.findBestMatches(targetLab, 10);
    let best2Way: BlendResult | undefined;
    
    if (this.constraints.maxComponents >= 2) {
      best2Way = twoWayResults[0];
      if (best2Way) {
        results.push(this.createRecipe(best2Way, '2-component blend'));
      }
    }
    
    if (this.constraints.maxComponents >= 3 && twoWayResults.length > 0) {
      const threeWayResults = search3Way(
        targetLab,
        this.colours,
        this.twoWayCache,
        { stepPct: this.constraints.stepPct, minPct: this.constraints.minPct },
        twoWayResults.slice(0, 5),
        5
      );
      
      if (threeWayResults.length > 0) {
        let best3Way = threeWayResults[0];
        best3Way = localRefine3Way(
          best3Way,
          targetLab,
          this.colours,
          { stepPct: this.constraints.stepPct, minPct: this.constraints.minPct }
        );
        
        if (best3Way.deltaE < (best2Way?.deltaE || Infinity) - 0.5) {
          results.push(this.createRecipe(best3Way, '3-component blend'));
        }
      }
    }
    
    if (this.constraints.forceComponents?.length) {
      const forced = this.solveWithForcedComponents(targetLab);
      if (forced) {
        results.push(this.createRecipe(forced, 'With required components'));
      }
    }
    
    results.sort((a, b) => a.deltaE - b.deltaE);
    return results.slice(0, 3);
  }
  
  private findSingleComponent(target: Lab): BlendResult | null {
    let best: BlendResult | null = null;
    
    for (const colour of this.colours) {
      const colourLab = { L: colour.L, a: colour.a, b: colour.b };
      const deltaE = deltaE2000(target, colourLab);
      
      if (!best || deltaE < best.deltaE) {
        best = {
          weights: { [colour.code]: 1 },
          lab: colourLab,
          deltaE
        };
      }
    }
    
    return best;
  }
  
  private solveWithForcedComponents(target: Lab): BlendResult | null {
    if (!this.constraints.forceComponents?.length) return null;
    
    const forced = this.constraints.forceComponents;
    const forcedColours = this.colours.filter(c => forced.includes(c.code));
    if (forcedColours.length === 0) return null;
    
    let best: BlendResult | null = null;
    const minForced = this.constraints.minPct * forced.length;
    const availableWeight = 1 - minForced;
    
    if (availableWeight < 0) return null;
    
    if (forced.length === 1 && availableWeight > this.constraints.minPct) {
      const forcedCode = forced[0];
      for (const other of this.colours) {
        if (other.code === forcedCode) continue;
        
        for (let p1 = minForced; p1 <= 1 - this.constraints.minPct; p1 += this.constraints.stepPct) {
          const weights = {
            [forcedCode]: p1,
            [other.code]: 1 - p1
          };
          
          const { lab } = simulateBlend(this.colours, weights);
          const deltaE = deltaE2000(target, lab);
          
          if (!best || deltaE < best.deltaE) {
            best = { weights, lab, deltaE };
          }
        }
      }
    }
    
    return best;
  }
  
  private createRecipe(blend: BlendResult, note?: string): Recipe {
    const { lab, rgb } = simulateBlend(this.colours, blend.weights);
    
    const recipe: Recipe = {
      kind: this.constraints.mode,
      weights: blend.weights,
      rgb,
      lab,
      deltaE: blend.deltaE,
      note
    };
    
    if (this.constraints.mode === 'parts' && this.constraints.parts) {
      const partsResult = percentagesToParts(blend.weights, this.constraints.parts);
      if (partsResult) {
        recipe.parts = partsResult.parts;
        recipe.total = partsResult.total;
        
        const { lab: partsLab } = simulateBlend(this.colours, blend.weights);
        const partsDeltaE = deltaE2000(lab, partsLab);
        
        if (partsDeltaE > 1.0) {
          recipe.note = (recipe.note || '') + ' Parts approximation ΔE: ' + partsDeltaE.toFixed(1);
        }
      }
    }
    
    return recipe;
  }
}