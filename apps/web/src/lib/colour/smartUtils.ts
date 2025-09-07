import { RGB, Lab, sRGBToLinearRGB } from './convert';
import { TPVColour } from './blend';

// Enhanced TPV color with precomputed linear RGB
export interface EnhancedTPVColour extends TPVColour {
  linearRGB: RGB;
}

/**
 * Precompute linear RGB values for all TPV colors for efficient mixing
 */
export function enhanceTPVColours(colours: TPVColour[]): EnhancedTPVColour[] {
  return colours.map(colour => ({
    ...colour,
    linearRGB: sRGBToLinearRGB({
      R: colour.R,
      G: colour.G,
      B: colour.B
    })
  }));
}

/**
 * Mix colors in linear RGB space with weights
 */
export function mixLinearRGB(
  components: Array<{ color: RGB; weight: number }>
): RGB {
  let R = 0, G = 0, B = 0;
  let totalWeight = 0;
  
  for (const { color, weight } of components) {
    R += color.R * weight;
    G += color.G * weight;
    B += color.B * weight;
    totalWeight += weight;
  }
  
  if (totalWeight === 0) {
    return { R: 0, G: 0, B: 0 };
  }
  
  return {
    R: R / totalWeight,
    G: G / totalWeight,
    B: B / totalWeight
  };
}

/**
 * Normalize weights to sum to 1
 */
export function normalizeWeights(weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum === 0) return weights;
  return weights.map(w => w / sum);
}

/**
 * Find greatest common divisor of two numbers
 */
export function gcd(a: number, b: number): number {
  return b === 0 ? Math.abs(a) : gcd(b, a % b);
}

/**
 * Find greatest common divisor of an array of numbers
 */
export function gcdArray(numbers: number[]): number {
  if (numbers.length === 0) return 1;
  if (numbers.length === 1) return Math.abs(numbers[0]);
  return numbers.reduce((result, num) => gcd(result, num), 0) || 1;
}

/**
 * Find index of maximum value in array
 */
export function argmax(arr: number[]): number {
  return arr.reduce((maxIdx, current, idx, array) => 
    current > array[maxIdx] ? idx : maxIdx, 0
  );
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Generate recipe composition key for deduplication
 */
export function getRecipeKey(weights: Record<string, number>): string {
  return Object.entries(weights)
    .filter(([, weight]) => weight > 0.001) // Filter out negligible components
    .sort(([codeA], [codeB]) => codeA.localeCompare(codeB)) // Sort by code
    .map(([code, weight]) => `${code}:${Math.round(weight * 1000)}`) // Round to nearest 0.1%
    .join('|');
}

// Enhanced recipe types for canonical processing
interface CanonicalComponent {
  code: string;
  pct: number;
}

interface CanonicalPartsResult {
  codes: string[];
  parts: number[];
  total: number;
  key: string;
}

interface CanonicalPercResult {
  codes: string[];
  weights: number[];
  key: string;
}

/**
 * Canonicalize parts recipe: reduce with GCD and sort by color code
 */
export function canonicalParts(parts: number[], codes: string[]): CanonicalPartsResult {
  // Reduce with GCD
  const g = gcdArray(parts);
  const reducedParts = parts.map(x => Math.max(1, Math.round(x / g)));
  
  // Sort by code
  const zipped = codes.map((c, i) => ({ c, w: reducedParts[i] }))
                     .sort((a, b) => a.c.localeCompare(b.c));
  const sortedCodes = zipped.map(z => z.c);
  const sortedParts = zipped.map(z => z.w);
  const total = sortedParts.reduce((a, b) => a + b, 0);
  
  const key = `parts:${sortedCodes.map((c, i) => `${c}:${sortedParts[i]}`).join('|')}`;
  
  return { codes: sortedCodes, parts: sortedParts, total, key };
}

/**
 * Canonicalize percentage recipe: quantize to rational grid and reduce
 */
export function canonicalPerc(components: CanonicalComponent[]): CanonicalPercResult {
  const DEN = 2400; // Fine enough to be stable (~0.042% resolution)
  
  // Quantize to rational grid
  const zipped = components.map(({ code, pct }) => ({ 
    c: code, 
    n: Math.round(pct * DEN) 
  })).filter(z => z.n > 0);
  
  // Reduce with GCD
  const g = gcdArray(zipped.map(z => z.n));
  const reduced = zipped.map(z => ({ 
    c: z.c, 
    n: Math.max(1, Math.round(z.n / g)) 
  }));
  
  // Sort by code
  reduced.sort((a, b) => a.c.localeCompare(b.c));
  
  // Create key
  const key = `pct:${reduced.map(z => `${z.c}:${z.n}`).join('|')}`;
  
  // Normalize weights
  const totalN = reduced.reduce((a, b) => a + b.n, 0);
  const weights = reduced.map(z => z.n / totalN);
  const codes = reduced.map(z => z.c);
  
  return { codes, weights, key };
}

/**
 * Create Lab color bucket key for grouping near-identical swatches
 */
export function colourBucketKey(lab: { L: number; a: number; b: number }): string {
  // Bucket to ~ΔE ≈ 0.8–1.0 cells
  const quantize = (x: number, step: number) => Math.round(x / step);
  return `lab:${quantize(lab.L, 0.75)}:${quantize(lab.a, 1.0)}:${quantize(lab.b, 1.0)}`;
}

/**
 * Enhanced recipe interface for deduplication
 */
export interface DedupeRecipe {
  components: CanonicalComponent[];
  mode: 'percent' | 'parts';
  parts?: { codes: string[]; parts: number[]; total: number };
  lab: { L: number; a: number; b: number };
  deltaE: number;
  weights: Record<string, number>;
}

/**
 * Pareto comparison: fewer components → lower parts total → lower ΔE
 */
export function better(a: DedupeRecipe, b: DedupeRecipe): boolean {
  const compA = a.mode === 'parts' && a.parts ? a.parts.codes.length : a.components.length;
  const compB = b.mode === 'parts' && b.parts ? b.parts.codes.length : b.components.length;
  if (compA !== compB) return compA < compB;
  
  const totA = a.mode === 'parts' && a.parts ? a.parts.total : Infinity;
  const totB = b.mode === 'parts' && b.parts ? b.parts.total : Infinity;
  if (totA !== totB) return totA < totB;
  
  return a.deltaE < b.deltaE;
}

/**
 * Stable ranking function for consistent ordering
 */
export function rank(r: DedupeRecipe): number {
  const comp = r.mode === 'parts' && r.parts ? r.parts.codes.length : r.components.length;
  const tot = r.mode === 'parts' && r.parts ? r.parts.total : 9999;
  return (comp * 1000) + tot + r.deltaE; // Small ΔE tie-breaker
}

/**
 * Comprehensive recipe deduplication with 2-phase system
 */
export function deduplicateRecipes(recipes: DedupeRecipe[]): DedupeRecipe[] {
  const byComp = new Map<string, DedupeRecipe>();
  
  // Phase 1: Composition-level deduplication
  for (const r of recipes) {
    const compKey = r.mode === 'parts' && r.parts
      ? canonicalParts(r.parts.parts, r.parts.codes).key
      : canonicalPerc(r.components).key;
    
    const cur = byComp.get(compKey);
    if (!cur || better(r, cur)) {
      byComp.set(compKey, r);
    }
  }
  
  // Phase 2: Color-level deduplication within ΔE buckets
  const byColour = new Map<string, DedupeRecipe[]>();
  for (const r of Array.from(byComp.values())) {
    const colorKey = colourBucketKey(r.lab);
    const arr = byColour.get(colorKey) || [];
    arr.push(r);
    byColour.set(colorKey, arr);
  }
  
  const out: DedupeRecipe[] = [];
  for (const group of Array.from(byColour.values())) {
    group.sort((a, b) => rank(a) - rank(b)); // Better recipes first
    out.push(group[0]); // Keep best representative
  }
  
  // Stable ordering
  return out.sort((a, b) => rank(a) - rank(b));
}

/**
 * MMR (Maximal Marginal Relevance) selection for diversity
 */
export function mmrSelect(candidates: DedupeRecipe[], k: number, lambda: number = 0.75): DedupeRecipe[] {
  const selected: DedupeRecipe[] = [];
  const remaining = [...candidates];
  
  const distance = (x: DedupeRecipe, y: DedupeRecipe): number => {
    return Math.hypot(
      x.lab.L - y.lab.L,
      x.lab.a - y.lab.a,
      x.lab.b - y.lab.b
    );
  };
  
  while (selected.length < k && remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = Infinity;
    
    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      const relevance = candidate.deltaE; // Lower is better
      const diversity = selected.length > 0 
        ? Math.min(...selected.map(s => distance(candidate, s)))
        : 1000; // High diversity for first selection
      
      const score = lambda * relevance - (1 - lambda) * diversity;
      
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    
    selected.push(remaining.splice(bestIdx, 1)[0]);
  }
  
  return selected;
}

/**
 * Legacy deduplication function for backward compatibility
 */
export function deduplicateRecipesLegacy<T extends { weights: Record<string, number>; deltaE: number }>(
  recipes: T[], 
  maxResults: number = 50
): T[] {
  const bestByKey = new Map<string, T>();
  
  for (const recipe of recipes) {
    const key = getRecipeKey(recipe.weights);
    const existing = bestByKey.get(key);
    
    if (!existing || recipe.deltaE < existing.deltaE) {
      bestByKey.set(key, recipe);
    }
  }
  
  return Array.from(bestByKey.values())
    .sort((a, b) => a.deltaE - b.deltaE)
    .slice(0, maxResults);
}