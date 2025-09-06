import { sRGBToLab } from '../colour/convert';
import type { RGB, Lab } from '../colour/types';

export interface PaletteColour {
  id: string;
  rgb: RGB;
  lab: Lab;
  areaPct: number;
  pageIds?: number[];
  source: 'pdf' | 'raster';
  metadata?: {
    frequency?: number;
    pixels?: number;
    percentage?: number;
  };
}

export interface ColourSpaceConversionOptions {
  whitePoint?: 'D50' | 'D65';
  gamma?: number;
}

export class ColourSpaceConverter {
  private options: Required<ColourSpaceConversionOptions>;

  constructor(options: ColourSpaceConversionOptions = {}) {
    this.options = {
      whitePoint: options.whitePoint ?? 'D65',
      gamma: options.gamma ?? 2.4
    };
  }

  rgbToLab(rgb: RGB): Lab {
    return sRGBToLab(rgb);
  }

  rgbToHex(rgb: RGB): string {
    const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, '0');
    
    return `#${toHex(rgb.R)}${toHex(rgb.G)}${toHex(rgb.B)}`;
  }

  hexToRgb(hex: string): RGB {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
      throw new Error(`Invalid hex color: ${hex}`);
    }
    
    return {
      R: parseInt(result[1], 16),
      G: parseInt(result[2], 16),
      B: parseInt(result[3], 16)
    };
  }

  /**
   * Calculate perceptual color difference using CIEDE2000
   */
  calculateDeltaE(lab1: Lab, lab2: Lab): number {
    // This is a simplified version - the full implementation is in deltaE.ts
    const dL = lab1.L - lab2.L;
    const da = lab1.a - lab2.a;
    const db = lab1.b - lab2.b;
    
    return Math.sqrt(dL * dL + da * da + db * db);
  }

  /**
   * Remove similar colors within tolerance
   */
  deduplicate(colours: PaletteColour[], tolerance: number = 5): PaletteColour[] {
    const result: PaletteColour[] = [];
    
    for (const color of colours) {
      const isSimilar = result.some(existing => 
        this.calculateDeltaE(existing.lab, color.lab) < tolerance
      );
      
      if (!isSimilar) {
        result.push(color);
      } else {
        // Merge with similar existing color (combine area percentages)
        const similar = result.find(existing => 
          this.calculateDeltaE(existing.lab, color.lab) < tolerance
        );
        if (similar) {
          similar.areaPct += color.areaPct;
          if (similar.pageIds && color.pageIds) {
            similar.pageIds = [...new Set([...similar.pageIds, ...color.pageIds])];
          }
        }
      }
    }
    
    return result;
  }

  /**
   * Normalize area percentages to sum to 100%
   */
  normalizeAreas(colours: PaletteColour[]): PaletteColour[] {
    const totalArea = colours.reduce((sum, c) => sum + c.areaPct, 0);
    
    if (totalArea === 0) {
      return colours;
    }
    
    return colours.map(color => ({
      ...color,
      areaPct: (color.areaPct / totalArea) * 100
    }));
  }

  /**
   * Filter out colors that are too small or too similar to white/black
   */
  filterInsignificant(
    colours: PaletteColour[], 
    minAreaPct: number = 1,
    excludeNearWhite: boolean = true,
    excludeNearBlack: boolean = true
  ): PaletteColour[] {
    return colours.filter(color => {
      // Filter by area
      if (color.areaPct < minAreaPct) {
        return false;
      }
      
      // Filter near-white colors (L > 95)
      if (excludeNearWhite && color.lab.L > 95) {
        return false;
      }
      
      // Filter near-black colors (L < 5)
      if (excludeNearBlack && color.lab.L < 5) {
        return false;
      }
      
      return true;
    });
  }

  /**
   * Sort colors by perceptual importance (area + distinctiveness)
   */
  sortByImportance(colours: PaletteColour[]): PaletteColour[] {
    return colours.sort((a, b) => {
      // Primary sort by area percentage
      if (Math.abs(a.areaPct - b.areaPct) > 1) {
        return b.areaPct - a.areaPct;
      }
      
      // Secondary sort by saturation (distance from neutral)
      const aSaturation = Math.sqrt(a.lab.a * a.lab.a + a.lab.b * a.lab.b);
      const bSaturation = Math.sqrt(b.lab.a * b.lab.a + b.lab.b * b.lab.b);
      
      return bSaturation - aSaturation;
    });
  }
}

export function generateColourId(rgb: RGB, source: string): string {
  const hex = new ColourSpaceConverter().rgbToHex(rgb);
  const hash = Array.from(hex).reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  
  return `${source}_${Math.abs(hash).toString(36)}`;
}

export function combineColourSources(
  pdfColours: PaletteColour[],
  rasterColours: PaletteColour[],
  combineStrategy: 'prefer-pdf' | 'prefer-raster' | 'merge' = 'merge'
): PaletteColour[] {
  const converter = new ColourSpaceConverter();
  
  switch (combineStrategy) {
    case 'prefer-pdf':
      return pdfColours.length > 0 ? pdfColours : rasterColours;
      
    case 'prefer-raster':
      return rasterColours.length > 0 ? rasterColours : pdfColours;
      
    case 'merge':
    default:
      const combined = [...pdfColours, ...rasterColours];
      
      // Deduplicate similar colors
      const deduplicated = converter.deduplicate(combined, 8);
      
      // Normalize areas and sort
      const normalized = converter.normalizeAreas(deduplicated);
      const sorted = converter.sortByImportance(normalized);
      
      return sorted;
  }
}

export function validateFileType(filename: string): {
  isValid: boolean;
  type: 'pdf' | 'image' | null;
  format?: string;
} {
  const ext = filename.toLowerCase().split('.').pop();
  
  if (!ext) {
    return { isValid: false, type: null };
  }
  
  const imageFormats = ['png', 'jpg', 'jpeg', 'svg', 'webp'];
  const pdfFormats = ['pdf'];
  
  if (pdfFormats.includes(ext)) {
    return { isValid: true, type: 'pdf', format: ext };
  }
  
  if (imageFormats.includes(ext)) {
    return { isValid: true, type: 'image', format: ext };
  }
  
  return { isValid: false, type: null };
}

export function estimateExtractionComplexity(
  fileSize: number,
  fileType: 'pdf' | 'image'
): 'low' | 'medium' | 'high' {
  const MB = 1024 * 1024;
  
  if (fileType === 'pdf') {
    if (fileSize < 2 * MB) return 'low';
    if (fileSize < 10 * MB) return 'medium';
    return 'high';
  }
  
  // Image files
  if (fileSize < 1 * MB) return 'low';
  if (fileSize < 5 * MB) return 'medium';
  return 'high';
}