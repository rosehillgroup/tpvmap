import { RGB, Lab, sRGBToLinearRGB, linearRGBToSRGB, linearRGBToXYZ, xyzToLab } from './convert';

export interface BlendComponent {
  code: string;
  weight: number;
}

export interface TPVColour {
  code: string;
  name: string;
  hex: string;
  R: number;
  G: number;
  B: number;
  L: number;
  a: number;
  b: number;
}

export function blendLinearRGB(components: Array<{ rgb: RGB; weight: number }>): RGB {
  let R = 0, G = 0, B = 0;
  let totalWeight = 0;
  
  for (const { rgb, weight } of components) {
    R += rgb.R * weight;
    G += rgb.G * weight;
    B += rgb.B * weight;
    totalWeight += weight;
  }
  
  if (totalWeight === 0) return { R: 0, G: 0, B: 0 };
  
  return {
    R: R / totalWeight,
    G: G / totalWeight,
    B: B / totalWeight
  };
}

export function simulateBlend(
  colours: TPVColour[], 
  weights: Record<string, number>
): { rgb: RGB; lab: Lab } {
  const components: Array<{ rgb: RGB; weight: number }> = [];
  
  for (const [code, weight] of Object.entries(weights)) {
    if (weight <= 0) continue;
    
    const colour = colours.find(c => c.code === code);
    if (!colour) continue;
    
    const linearRGB = sRGBToLinearRGB({
      R: colour.R,
      G: colour.G,
      B: colour.B
    });
    
    components.push({ rgb: linearRGB, weight });
  }
  
  const blendedLinear = blendLinearRGB(components);
  const blendedSRGB = linearRGBToSRGB(blendedLinear);
  const xyz = linearRGBToXYZ(blendedLinear);
  const lab = xyzToLab(xyz);
  
  return { rgb: blendedSRGB, lab };
}

export function normalizeWeights(weights: Record<string, number>): Record<string, number> {
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
  if (total === 0) return weights;
  
  const normalized: Record<string, number> = {};
  for (const [key, value] of Object.entries(weights)) {
    normalized[key] = value / total;
  }
  
  return normalized;
}