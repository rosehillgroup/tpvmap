import { TPVColour, simulateBlend } from '../colour/blend';
import { Lab } from '../colour/convert';
import { deltaE2000 } from '../colour/deltaE';

export interface SearchConstraints {
  stepPct: number;
  minPct: number;
}

export interface BlendResult {
  weights: Record<string, number>;
  lab: Lab;
  deltaE: number;
}

interface CachedBlend {
  lab: Lab;
  weights: { [code: string]: number };
}

export class TwoWaySearchCache {
  private cache = new Map<string, CachedBlend>();
  
  constructor(
    private colours: TPVColour[],
    private constraints: SearchConstraints
  ) {
    this.precompute();
  }
  
  private getCacheKey(code1: string, code2: string, p1: number): string {
    const [c1, c2] = code1 < code2 ? [code1, code2] : [code2, code1];
    return `${c1}:${c2}:${p1.toFixed(4)}`;
  }
  
  private precompute(): void {
    const { stepPct, minPct } = this.constraints;
    const maxPct = 1 - minPct;
    
    for (let i = 0; i < this.colours.length; i++) {
      for (let j = i + 1; j < this.colours.length; j++) {
        const c1 = this.colours[i];
        const c2 = this.colours[j];
        
        for (let p1 = minPct; p1 <= maxPct; p1 += stepPct) {
          const p2 = 1 - p1;
          if (p2 < minPct) continue;
          
          const weights = { [c1.code]: p1, [c2.code]: p2 };
          const { lab } = simulateBlend(this.colours, weights);
          
          this.cache.set(this.getCacheKey(c1.code, c2.code, p1), { lab, weights });
        }
      }
    }
  }
  
  findBestMatches(target: Lab, topK: number = 3): BlendResult[] {
    const results: BlendResult[] = [];
    
    for (const cached of this.cache.values()) {
      const deltaE = deltaE2000(target, cached.lab);
      results.push({
        weights: { ...cached.weights },
        lab: cached.lab,
        deltaE
      });
    }
    
    results.sort((a, b) => a.deltaE - b.deltaE);
    return results.slice(0, topK);
  }
  
  getBlend(code1: string, code2: string, p1: number): CachedBlend | null {
    const key = this.getCacheKey(code1, code2, p1);
    return this.cache.get(key) || null;
  }
}