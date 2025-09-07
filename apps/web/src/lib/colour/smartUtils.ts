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
 * Find greatest common divisor of an array of numbers
 */
export function gcd(numbers: number[]): number {
  if (numbers.length === 0) return 1;
  if (numbers.length === 1) return numbers[0];
  
  const gcdTwo = (a: number, b: number): number => {
    return b === 0 ? a : gcdTwo(b, a % b);
  };
  
  return numbers.reduce((result, num) => gcdTwo(result, num));
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

/**
 * Deduplicate recipes by composition, keeping only the best ΔE for each unique blend
 */
export function deduplicateRecipes<T extends { weights: Record<string, number>; deltaE: number }>(
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