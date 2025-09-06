import { TPVColour, simulateBlend } from '../colour/blend';
import { Lab } from '../colour/convert';
import { deltaE2000 } from '../colour/deltaE';
import { TwoWaySearchCache, SearchConstraints, BlendResult } from './search2';

export function search3Way(
  target: Lab,
  colours: TPVColour[],
  twoWayCache: TwoWaySearchCache,
  constraints: SearchConstraints,
  seeds: BlendResult[],
  topK: number = 3
): BlendResult[] {
  const { stepPct, minPct } = constraints;
  const results: BlendResult[] = [];
  const tested = new Set<string>();
  
  for (const seed of seeds) {
    const seedCodes = Object.keys(seed.weights);
    if (seedCodes.length !== 2) continue;
    
    const [code1, code2] = seedCodes;
    const baseP1 = seed.weights[code1];
    const baseP2 = seed.weights[code2];
    
    for (const colour of colours) {
      if (colour.code === code1 || colour.code === code2) continue;
      
      for (let p3 = minPct; p3 <= 1 - 2 * minPct; p3 += stepPct) {
        const remaining = 1 - p3;
        const scale = remaining / (baseP1 + baseP2);
        const p1 = baseP1 * scale;
        const p2 = baseP2 * scale;
        
        if (p1 < minPct || p2 < minPct) continue;
        
        const weights = {
          [code1]: p1,
          [code2]: p2,
          [colour.code]: p3
        };
        
        const key = Object.keys(weights).sort().join(':') + 
                   ':' + Object.values(weights).map(w => w.toFixed(4)).join(':');
        
        if (tested.has(key)) continue;
        tested.add(key);
        
        const { lab } = simulateBlend(colours, weights);
        const deltaE = deltaE2000(target, lab);
        
        results.push({ weights, lab, deltaE });
      }
    }
  }
  
  results.sort((a, b) => a.deltaE - b.deltaE);
  return results.slice(0, topK);
}

export function localRefine3Way(
  initial: BlendResult,
  target: Lab,
  colours: TPVColour[],
  constraints: SearchConstraints,
  iterations: number = 10
): BlendResult {
  const { stepPct, minPct } = constraints;
  let best = { ...initial };
  
  for (let iter = 0; iter < iterations; iter++) {
    let improved = false;
    const codes = Object.keys(best.weights);
    
    for (const code of codes) {
      const oldWeight = best.weights[code];
      
      for (const delta of [-stepPct, stepPct]) {
        const newWeight = oldWeight + delta;
        if (newWeight < minPct || newWeight > 1 - (codes.length - 1) * minPct) continue;
        
        const adjustment = -delta / (codes.length - 1);
        const newWeights: Record<string, number> = {};
        let valid = true;
        
        for (const c of codes) {
          if (c === code) {
            newWeights[c] = newWeight;
          } else {
            newWeights[c] = best.weights[c] + adjustment;
            if (newWeights[c] < minPct) {
              valid = false;
              break;
            }
          }
        }
        
        if (!valid) continue;
        
        const { lab } = simulateBlend(colours, newWeights);
        const deltaE = deltaE2000(target, lab);
        
        if (deltaE < best.deltaE) {
          best = { weights: newWeights, lab, deltaE };
          improved = true;
        }
      }
    }
    
    if (!improved) break;
  }
  
  return best;
}