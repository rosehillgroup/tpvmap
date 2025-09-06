import { describe, it, expect } from 'vitest';
import { 
  ColourSpaceConverter,
  generateColourId,
  combineColourSources,
  validateFileType,
  estimateExtractionComplexity,
  type PaletteColour
} from '../utils';
import type { RGB, Lab } from '../../colour/types';

describe('ColourSpaceConverter', () => {
  let converter: ColourSpaceConverter;

  beforeEach(() => {
    converter = new ColourSpaceConverter();
  });

  describe('RGB to Hex conversion', () => {
    it('should convert RGB to hex correctly', () => {
      expect(converter.rgbToHex({ R: 255, G: 0, B: 0 })).toBe('#ff0000');
      expect(converter.rgbToHex({ R: 0, G: 255, B: 0 })).toBe('#00ff00');
      expect(converter.rgbToHex({ R: 0, G: 0, B: 255 })).toBe('#0000ff');
      expect(converter.rgbToHex({ R: 128, G: 128, B: 128 })).toBe('#808080');
    });

    it('should handle edge cases', () => {
      expect(converter.rgbToHex({ R: 0, G: 0, B: 0 })).toBe('#000000');
      expect(converter.rgbToHex({ R: 255, G: 255, B: 255 })).toBe('#ffffff');
    });
  });

  describe('Hex to RGB conversion', () => {
    it('should convert hex to RGB correctly', () => {
      expect(converter.hexToRgb('#ff0000')).toEqual({ R: 255, G: 0, B: 0 });
      expect(converter.hexToRgb('#00ff00')).toEqual({ R: 0, G: 255, B: 0 });
      expect(converter.hexToRgb('#0000ff')).toEqual({ R: 0, G: 0, B: 255 });
    });

    it('should handle hex without hash', () => {
      expect(converter.hexToRgb('ff0000')).toEqual({ R: 255, G: 0, B: 0 });
    });

    it('should throw error for invalid hex', () => {
      expect(() => converter.hexToRgb('invalid')).toThrow('Invalid hex color');
    });
  });

  describe('Color deduplication', () => {
    it('should remove similar colors', () => {
      const colors: PaletteColour[] = [
        {
          id: '1',
          rgb: { R: 255, G: 0, B: 0 },
          lab: { L: 50, a: 70, b: 60 },
          areaPct: 30,
          source: 'raster'
        },
        {
          id: '2',
          rgb: { R: 254, G: 1, B: 1 }, // Very similar to first
          lab: { L: 50, a: 69, b: 59 },
          areaPct: 20,
          source: 'raster'
        },
        {
          id: '3',
          rgb: { R: 0, G: 255, B: 0 },
          lab: { L: 80, a: -70, b: 60 },
          areaPct: 25,
          source: 'raster'
        }
      ];

      const deduplicated = converter.deduplicate(colors, 5);
      
      expect(deduplicated.length).toBe(2);
      expect(deduplicated[0].areaPct).toBe(50); // Combined area
    });

    it('should preserve distinct colors', () => {
      const colors: PaletteColour[] = [
        {
          id: '1',
          rgb: { R: 255, G: 0, B: 0 },
          lab: { L: 50, a: 70, b: 60 },
          areaPct: 30,
          source: 'raster'
        },
        {
          id: '2',
          rgb: { R: 0, G: 255, B: 0 },
          lab: { L: 80, a: -70, b: 60 },
          areaPct: 35,
          source: 'raster'
        },
        {
          id: '3',
          rgb: { R: 0, G: 0, B: 255 },
          lab: { L: 30, a: 20, b: -80 },
          areaPct: 35,
          source: 'raster'
        }
      ];

      const deduplicated = converter.deduplicate(colors, 5);
      
      expect(deduplicated.length).toBe(3);
    });
  });

  describe('Area normalization', () => {
    it('should normalize areas to sum to 100%', () => {
      const colors: PaletteColour[] = [
        {
          id: '1',
          rgb: { R: 255, G: 0, B: 0 },
          lab: { L: 50, a: 70, b: 60 },
          areaPct: 30,
          source: 'raster'
        },
        {
          id: '2',
          rgb: { R: 0, G: 255, B: 0 },
          lab: { L: 80, a: -70, b: 60 },
          areaPct: 70,
          source: 'raster'
        }
      ];

      const normalized = converter.normalizeAreas(colors);
      const totalArea = normalized.reduce((sum, c) => sum + c.areaPct, 0);
      
      expect(totalArea).toBeCloseTo(100, 1);
    });

    it('should handle zero total area', () => {
      const colors: PaletteColour[] = [
        {
          id: '1',
          rgb: { R: 255, G: 0, B: 0 },
          lab: { L: 50, a: 70, b: 60 },
          areaPct: 0,
          source: 'raster'
        }
      ];

      const normalized = converter.normalizeAreas(colors);
      
      expect(normalized[0].areaPct).toBe(0);
    });
  });

  describe('Color filtering', () => {
    it('should filter colors below minimum area', () => {
      const colors: PaletteColour[] = [
        {
          id: '1',
          rgb: { R: 255, G: 0, B: 0 },
          lab: { L: 50, a: 70, b: 60 },
          areaPct: 10,
          source: 'raster'
        },
        {
          id: '2',
          rgb: { R: 0, G: 255, B: 0 },
          lab: { L: 80, a: -70, b: 60 },
          areaPct: 0.5,
          source: 'raster'
        }
      ];

      const filtered = converter.filterInsignificant(colors, 1);
      
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('1');
    });

    it('should filter near-white colors', () => {
      const colors: PaletteColour[] = [
        {
          id: '1',
          rgb: { R: 255, G: 255, B: 255 },
          lab: { L: 100, a: 0, b: 0 },
          areaPct: 50,
          source: 'raster'
        },
        {
          id: '2',
          rgb: { R: 255, G: 0, B: 0 },
          lab: { L: 50, a: 70, b: 60 },
          areaPct: 50,
          source: 'raster'
        }
      ];

      const filtered = converter.filterInsignificant(colors, 1, true, false);
      
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('2');
    });

    it('should filter near-black colors', () => {
      const colors: PaletteColour[] = [
        {
          id: '1',
          rgb: { R: 0, G: 0, B: 0 },
          lab: { L: 0, a: 0, b: 0 },
          areaPct: 50,
          source: 'raster'
        },
        {
          id: '2',
          rgb: { R: 255, G: 0, B: 0 },
          lab: { L: 50, a: 70, b: 60 },
          areaPct: 50,
          source: 'raster'
        }
      ];

      const filtered = converter.filterInsignificant(colors, 1, false, true);
      
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('2');
    });
  });

  describe('Color sorting', () => {
    it('should sort by area percentage first', () => {
      const colors: PaletteColour[] = [
        {
          id: '1',
          rgb: { R: 255, G: 0, B: 0 },
          lab: { L: 50, a: 70, b: 60 },
          areaPct: 20,
          source: 'raster'
        },
        {
          id: '2',
          rgb: { R: 0, G: 255, B: 0 },
          lab: { L: 80, a: -70, b: 60 },
          areaPct: 50,
          source: 'raster'
        }
      ];

      const sorted = converter.sortByImportance(colors);
      
      expect(sorted[0].id).toBe('2'); // Higher area percentage
      expect(sorted[1].id).toBe('1');
    });
  });
});

describe('Utility functions', () => {
  describe('generateColourId', () => {
    it('should generate consistent IDs for same RGB', () => {
      const rgb: RGB = { R: 255, G: 0, B: 0 };
      
      const id1 = generateColourId(rgb, 'test');
      const id2 = generateColourId(rgb, 'test');
      
      expect(id1).toBe(id2);
    });

    it('should generate different IDs for different RGB', () => {
      const rgb1: RGB = { R: 255, G: 0, B: 0 };
      const rgb2: RGB = { R: 0, G: 255, B: 0 };
      
      const id1 = generateColourId(rgb1, 'test');
      const id2 = generateColourId(rgb2, 'test');
      
      expect(id1).not.toBe(id2);
    });

    it('should include source in ID', () => {
      const rgb: RGB = { R: 255, G: 0, B: 0 };
      
      const id1 = generateColourId(rgb, 'pdf');
      const id2 = generateColourId(rgb, 'raster');
      
      expect(id1).toMatch(/^pdf_/);
      expect(id2).toMatch(/^raster_/);
    });
  });

  describe('combineColourSources', () => {
    const pdfColors: PaletteColour[] = [
      {
        id: 'pdf_1',
        rgb: { R: 255, G: 0, B: 0 },
        lab: { L: 50, a: 70, b: 60 },
        areaPct: 40,
        source: 'pdf'
      }
    ];

    const rasterColors: PaletteColour[] = [
      {
        id: 'raster_1',
        rgb: { R: 0, G: 255, B: 0 },
        lab: { L: 80, a: -70, b: 60 },
        areaPct: 60,
        source: 'raster'
      }
    ];

    it('should prefer PDF when strategy is prefer-pdf', () => {
      const combined = combineColourSources(pdfColors, rasterColors, 'prefer-pdf');
      
      expect(combined.length).toBe(1);
      expect(combined[0].source).toBe('pdf');
    });

    it('should prefer raster when strategy is prefer-raster', () => {
      const combined = combineColourSources(pdfColors, rasterColors, 'prefer-raster');
      
      expect(combined.length).toBe(1);
      expect(combined[0].source).toBe('raster');
    });

    it('should merge when strategy is merge', () => {
      const combined = combineColourSources(pdfColors, rasterColors, 'merge');
      
      expect(combined.length).toBe(2);
    });

    it('should fallback when preferred source is empty', () => {
      const combined = combineColourSources([], rasterColors, 'prefer-pdf');
      
      expect(combined.length).toBe(1);
      expect(combined[0].source).toBe('raster');
    });
  });

  describe('validateFileType', () => {
    it('should validate PDF files', () => {
      const result = validateFileType('document.pdf');
      
      expect(result).toEqual({
        isValid: true,
        type: 'pdf',
        format: 'pdf'
      });
    });

    it('should validate image files', () => {
      const pngResult = validateFileType('image.png');
      expect(pngResult).toEqual({
        isValid: true,
        type: 'image',
        format: 'png'
      });

      const jpgResult = validateFileType('photo.jpg');
      expect(jpgResult).toEqual({
        isValid: true,
        type: 'image',
        format: 'jpg'
      });

      const jpegResult = validateFileType('photo.jpeg');
      expect(jpegResult).toEqual({
        isValid: true,
        type: 'image',
        format: 'jpeg'
      });

      const svgResult = validateFileType('icon.svg');
      expect(svgResult).toEqual({
        isValid: true,
        type: 'image',
        format: 'svg'
      });
    });

    it('should reject unsupported files', () => {
      const result = validateFileType('document.txt');
      
      expect(result).toEqual({
        isValid: false,
        type: null
      });
    });

    it('should handle files without extensions', () => {
      const result = validateFileType('filename');
      
      expect(result).toEqual({
        isValid: false,
        type: null
      });
    });

    it('should be case insensitive', () => {
      const result = validateFileType('IMAGE.PNG');
      
      expect(result).toEqual({
        isValid: true,
        type: 'image',
        format: 'png'
      });
    });
  });

  describe('estimateExtractionComplexity', () => {
    const MB = 1024 * 1024;

    describe('PDF complexity', () => {
      it('should return low complexity for small PDFs', () => {
        expect(estimateExtractionComplexity(1 * MB, 'pdf')).toBe('low');
      });

      it('should return medium complexity for medium PDFs', () => {
        expect(estimateExtractionComplexity(5 * MB, 'pdf')).toBe('medium');
      });

      it('should return high complexity for large PDFs', () => {
        expect(estimateExtractionComplexity(15 * MB, 'pdf')).toBe('high');
      });
    });

    describe('Image complexity', () => {
      it('should return low complexity for small images', () => {
        expect(estimateExtractionComplexity(0.5 * MB, 'image')).toBe('low');
      });

      it('should return medium complexity for medium images', () => {
        expect(estimateExtractionComplexity(3 * MB, 'image')).toBe('medium');
      });

      it('should return high complexity for large images', () => {
        expect(estimateExtractionComplexity(8 * MB, 'image')).toBe('high');
      });
    });

    it('should handle edge cases', () => {
      expect(estimateExtractionComplexity(0, 'pdf')).toBe('low');
      expect(estimateExtractionComplexity(100 * MB, 'pdf')).toBe('high');
    });
  });
});

describe('Delta E calculation', () => {
  let converter: ColourSpaceConverter;

  beforeEach(() => {
    converter = new ColourSpaceConverter();
  });

  it('should return 0 for identical colors', () => {
    const lab: Lab = { L: 50, a: 20, b: -30 };
    
    expect(converter.calculateDeltaE(lab, lab)).toBe(0);
  });

  it('should return positive values for different colors', () => {
    const lab1: Lab = { L: 50, a: 20, b: -30 };
    const lab2: Lab = { L: 60, a: 10, b: -20 };
    
    expect(converter.calculateDeltaE(lab1, lab2)).toBeGreaterThan(0);
  });

  it('should be symmetric', () => {
    const lab1: Lab = { L: 50, a: 20, b: -30 };
    const lab2: Lab = { L: 60, a: 10, b: -20 };
    
    const deltaE1 = converter.calculateDeltaE(lab1, lab2);
    const deltaE2 = converter.calculateDeltaE(lab2, lab1);
    
    expect(deltaE1).toBe(deltaE2);
  });
});