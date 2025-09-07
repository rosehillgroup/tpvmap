import { Lab, linearRGBToSRGB, linearRGBToXYZ, xyzToLab } from './convert';
import { deltaE2000 } from './deltaE';
import { TPVColour } from './blend';
import { 
  EnhancedTPVColour, 
  enhanceTPVColours, 
  mixLinearRGB, 
  normalizeWeights,
  deduplicateRecipes 
} from './smartUtils';
import { evaluateBlendPenalties } from './penalties';
import { findOptimalParts, PartsResult } from './smartParts';

export interface SmartSolverConstraints {
  maxComponents: 1 | 2 | 3;
  stepPct: number;
  minPct: number;
  mode: 'percent' | 'parts';
  parts?: {
    enabled: boolean;
    total?: number;
    minPer?: number;
  };
  preferAnchor?: boolean; // Force main component to be closest single
}

export interface SmartRecipe {
  components: Array<{ code: string; pct: number }>;
  weights: Record<string, number>; // For compatibility
  parts?: Record<string, number>;
  total?: number;
  lab: Lab;
  rgb: { R: number; G: number; B: number };
  deltaE: number;
  baseDeltaE: number; // ΔE without penalties/bonuses
  note?: string;
  reasoning?: string;
}

interface TwoWayBlend {
  i: number;
  j: number;
  p: number;
  lab: Lab;
  deltaE: number;
  adjustedDeltaE: number;
}

export class SmartBlendSolver {
  private enhancedColours: EnhancedTPVColour[];
  private twoWayCache: TwoWayBlend[] = [];
  private singleDistances: number[] = [];
  
  constructor(
    private colours: TPVColour[],
    private constraints: SmartSolverConstraints
  ) {
    this.enhancedColours = enhanceTPVColours(colours);
    this.precomputeTwoWayBlends();
  }
  
  /**
   * Solve for best blends matching target color
   */
  solve(targetLab: Lab, maxResults: number = 5): SmartRecipe[] {
    const results: SmartRecipe[] = [];
    
    // Calculate distances from target to all single colors (for anchor bonus)
    this.singleDistances = this.enhancedColours.map(colour => 
      deltaE2000(targetLab, { L: colour.L, a: colour.a, b: colour.b })
    );
    
    // Phase 1: Single components
    if (this.constraints.maxComponents >= 1) {
      const singleResults = this.solveSingleComponents(targetLab);
      results.push(...singleResults);
    }
    
    // Phase 2: Two-way blends
    if (this.constraints.maxComponents >= 2) {
      const twoWayResults = this.solveTwoWayBlends(targetLab);
      results.push(...twoWayResults);
    }
    
    // Phase 3: Three-way blends (seeded from best two-way)
    if (this.constraints.maxComponents >= 3) {
      const threeWayResults = this.solveThreeWayBlends(targetLab);
      results.push(...threeWayResults);
    }
    
    // Deduplicate and sort by adjusted ΔE
    const uniqueResults = deduplicateRecipes(results, maxResults * 3);
    uniqueResults.sort((a, b) => a.deltaE - b.deltaE);
    
    // Convert to parts if requested
    const finalResults = uniqueResults.slice(0, maxResults).map(recipe => 
      this.convertToPartsIfNeeded(recipe, targetLab)
    );
    
    return finalResults;
  }
  
  /**
   * Precompute all 2-way blends for fast lookup
   */
  private precomputeTwoWayBlends(): void {
    const { stepPct, minPct } = this.constraints;
    const maxPct = 1 - minPct;
    
    for (let i = 0; i < this.enhancedColours.length; i++) {
      for (let j = i + 1; j < this.enhancedColours.length; j++) {
        const c1 = this.enhancedColours[i];
        const c2 = this.enhancedColours[j];
        
        for (let p = minPct; p <= maxPct; p += stepPct) {
          const mixedLinear = mixLinearRGB([
            { color: c1.linearRGB, weight: p },
            { color: c2.linearRGB, weight: 1 - p }
          ]);
          
          const mixedXYZ = linearRGBToXYZ(mixedLinear);
          const lab = xyzToLab(mixedXYZ);
          
          this.twoWayCache.push({
            i, j, p,
            lab,
            deltaE: 0, // Will be calculated per target
            adjustedDeltaE: 0
          });
        }
      }
    }
  }
  
  /**
   * Find best single component matches
   */
  private solveSingleComponents(targetLab: Lab): SmartRecipe[] {
    const results: SmartRecipe[] = [];
    
    for (let i = 0; i < this.enhancedColours.length; i++) {
      const colour = this.enhancedColours[i];
      const colourLab = { L: colour.L, a: colour.a, b: colour.b };
      const deltaE = deltaE2000(targetLab, colourLab);
      
      results.push({
        components: [{ code: colour.code, pct: 1 }],
        weights: { [colour.code]: 1 },
        lab: colourLab,
        rgb: { R: colour.R, G: colour.G, B: colour.B },
        deltaE,
        baseDeltaE: deltaE,
        note: 'Single component',
        reasoning: `Direct match with ${colour.name}`
      });
    }
    
    return results.sort((a, b) => a.deltaE - b.deltaE).slice(0, 2);
  }
  
  /**
   * Find best two-way blends with smart penalties
   */
  private solveTwoWayBlends(targetLab: Lab): SmartRecipe[] {
    // Score all cached blends for this target
    for (const blend of this.twoWayCache) {
      blend.deltaE = deltaE2000(targetLab, blend.lab);
      
      // Apply smart penalties
      const c1 = this.enhancedColours[blend.i];
      const c2 = this.enhancedColours[blend.j];
      
      const penalty = evaluateBlendPenalties(
        [
          { lab: { L: c1.L, a: c1.a, b: c1.b }, weight: blend.p },
          { lab: { L: c2.L, a: c2.a, b: c2.b }, weight: 1 - blend.p }
        ],
        targetLab,
        this.singleDistances
      );
      
      blend.adjustedDeltaE = blend.deltaE + penalty;
    }
    
    // Get top candidates
    const sorted = this.twoWayCache
      .slice() // Don't modify original
      .sort((a, b) => a.adjustedDeltaE - b.adjustedDeltaE)
      .slice(0, 10);
    
    return sorted.map(blend => {
      const c1 = this.enhancedColours[blend.i];
      const c2 = this.enhancedColours[blend.j];
      
      // Create intuitive reasoning
      const dominant = blend.p >= 0.6 ? c1 : (blend.p <= 0.4 ? c2 : null);
      const reasoning = dominant 
        ? `Anchor ${dominant.name} with ${dominant === c1 ? c2.name : c1.name} adjustment`
        : `Balanced mix of ${c1.name} and ${c2.name}`;
      
      return {
        components: [
          { code: c1.code, pct: blend.p },
          { code: c2.code, pct: 1 - blend.p }
        ],
        weights: { [c1.code]: blend.p, [c2.code]: 1 - blend.p },
        lab: blend.lab,
        rgb: linearRGBToSRGB(mixLinearRGB([
          { color: c1.linearRGB, weight: blend.p },
          { color: c2.linearRGB, weight: 1 - blend.p }
        ])),
        deltaE: blend.adjustedDeltaE,
        baseDeltaE: blend.deltaE,
        note: '2-component blend',
        reasoning
      };
    });
  }
  
  /**
   * Find best three-way blends seeded from two-way results
   */
  private solveThreeWayBlends(targetLab: Lab): SmartRecipe[] {
    const results: SmartRecipe[] = [];
    
    // Use top 2-way blends as seeds
    const seeds = this.twoWayCache
      .slice()
      .sort((a, b) => a.adjustedDeltaE - b.adjustedDeltaE)
      .slice(0, 30); // Limited seed set for performance
    
    for (const seed of seeds) {
      const usedIndices = [seed.i, seed.j];
      
      // Try adding each unused color
      for (let k = 0; k < this.enhancedColours.length; k++) {
        if (usedIndices.includes(k)) continue;
        
        const c3 = this.enhancedColours[k];
        
        // Try different amounts of the third component
        for (let p3 = this.constraints.minPct; 
             p3 <= 1 - 2 * this.constraints.minPct; 
             p3 += this.constraints.stepPct * 2) { // Coarser step for 3-way
          
          const remainingWeight = 1 - p3;
          const p1 = Math.max(this.constraints.minPct, seed.p * remainingWeight);
          const p2 = remainingWeight - p1;
          
          if (p2 < this.constraints.minPct) continue;
          
          // Normalize weights
          const weights = normalizeWeights([p1, p2, p3]);
          const [w1, w2, w3] = weights;
          
          const mixedLinear = mixLinearRGB([
            { color: this.enhancedColours[seed.i].linearRGB, weight: w1 },
            { color: this.enhancedColours[seed.j].linearRGB, weight: w2 },
            { color: c3.linearRGB, weight: w3 }
          ]);
          
          const mixedXYZ = linearRGBToXYZ(mixedLinear);
          const lab = xyzToLab(mixedXYZ);
          const baseDeltaE = deltaE2000(targetLab, lab);
          
          // Apply penalties
          const penalty = evaluateBlendPenalties(
            [
              { lab: { L: this.enhancedColours[seed.i].L, a: this.enhancedColours[seed.i].a, b: this.enhancedColours[seed.i].b }, weight: w1 },
              { lab: { L: this.enhancedColours[seed.j].L, a: this.enhancedColours[seed.j].a, b: this.enhancedColours[seed.j].b }, weight: w2 },
              { lab: { L: c3.L, a: c3.a, b: c3.b }, weight: w3 }
            ],
            targetLab,
            this.singleDistances
          );
          
          const adjustedDeltaE = baseDeltaE + penalty;
          
          results.push({
            components: [
              { code: this.enhancedColours[seed.i].code, pct: w1 },
              { code: this.enhancedColours[seed.j].code, pct: w2 },
              { code: c3.code, pct: w3 }
            ],
            weights: {
              [this.enhancedColours[seed.i].code]: w1,
              [this.enhancedColours[seed.j].code]: w2,
              [c3.code]: w3
            },
            lab,
            rgb: linearRGBToSRGB(mixedLinear),
            deltaE: adjustedDeltaE,
            baseDeltaE,
            note: '3-component blend',
            reasoning: 'Refined blend with three components'
          });
        }
      }
    }
    
    return results.sort((a, b) => a.deltaE - b.deltaE).slice(0, 5);
  }
  
  /**
   * Convert recipe to parts format if requested
   */
  private convertToPartsIfNeeded(recipe: SmartRecipe, targetLab: Lab): SmartRecipe {
    if (this.constraints.mode !== 'parts' || !this.constraints.parts?.enabled) {
      return recipe;
    }
    
    const partsResult = findOptimalParts(
      recipe.weights,
      this.enhancedColours,
      targetLab,
      {
        totals: this.constraints.parts.total ? [this.constraints.parts.total] : [9, 12, 15],
        minPer: this.constraints.parts.minPer || 1
      }
    );
    
    if (partsResult) {
      return {
        ...recipe,
        parts: partsResult.parts,
        total: partsResult.total,
        weights: partsResult.weights, // Updated normalized weights
        lab: partsResult.lab,
        rgb: partsResult.rgb,
        deltaE: partsResult.deltaE,
        note: recipe.note + ` (${partsResult.total} parts total)`,
        reasoning: recipe.reasoning + ` - Snapped to ${partsResult.total} parts with ΔE ${(partsResult.deltaE - recipe.baseDeltaE).toFixed(2)} penalty`
      };
    }
    
    return recipe;
  }
}