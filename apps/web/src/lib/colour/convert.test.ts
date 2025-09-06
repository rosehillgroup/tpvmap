import { describe, it, expect } from 'vitest';
import { 
  sRGBToLab, 
  labToSRGB, 
  hexToRGB, 
  rgbToHex,
  sRGBToLinearRGB,
  linearRGBToSRGB
} from './convert';

describe('Colour Conversions', () => {
  it('should convert hex to RGB correctly', () => {
    expect(hexToRGB('#FFFFFF')).toEqual({ R: 255, G: 255, B: 255 });
    expect(hexToRGB('#000000')).toEqual({ R: 0, G: 0, B: 0 });
    expect(hexToRGB('#FF0000')).toEqual({ R: 255, G: 0, B: 0 });
    expect(hexToRGB('#00FF00')).toEqual({ R: 0, G: 255, B: 0 });
    expect(hexToRGB('#0000FF')).toEqual({ R: 0, G: 0, B: 255 });
    expect(hexToRGB('#B71E2D')).toEqual({ R: 183, G: 30, B: 45 });
  });

  it('should convert RGB to hex correctly', () => {
    expect(rgbToHex({ R: 255, G: 255, B: 255 })).toBe('#FFFFFF');
    expect(rgbToHex({ R: 0, G: 0, B: 0 })).toBe('#000000');
    expect(rgbToHex({ R: 255, G: 0, B: 0 })).toBe('#FF0000');
    expect(rgbToHex({ R: 183, G: 30, B: 45 })).toBe('#B71E2D');
  });

  it('should handle sRGB gamma correction', () => {
    const srgb = { R: 127, G: 127, B: 127 };
    const linear = sRGBToLinearRGB(srgb);
    const backToSRGB = linearRGBToSRGB(linear);
    
    expect(backToSRGB.R).toBeCloseTo(127, 0);
    expect(backToSRGB.G).toBeCloseTo(127, 0);
    expect(backToSRGB.B).toBeCloseTo(127, 0);
  });

  it('should convert sRGB to Lab for known colours', () => {
    // White
    const whiteLab = sRGBToLab({ R: 255, G: 255, B: 255 });
    expect(whiteLab.L).toBeCloseTo(100, 1);
    expect(whiteLab.a).toBeCloseTo(0, 1);
    expect(whiteLab.b).toBeCloseTo(0, 1);
    
    // Black
    const blackLab = sRGBToLab({ R: 0, G: 0, B: 0 });
    expect(blackLab.L).toBeCloseTo(0, 1);
    
    // Red colour should be in the general expected range
    const redLab = sRGBToLab({ R: 183, G: 30, B: 45 });
    expect(redLab.L).toBeGreaterThan(30);
    expect(redLab.L).toBeLessThan(50);
    expect(redLab.a).toBeGreaterThan(40);
    expect(redLab.b).toBeGreaterThan(15);
  });

  it('should round-trip sRGB to Lab to sRGB', () => {
    const testColours = [
      { R: 183, G: 30, B: 45 },
      { R: 0, G: 107, B: 63 },
      { R: 212, G: 181, B: 133 },
      { R: 127, G: 127, B: 127 }
    ];
    
    for (const colour of testColours) {
      const lab = sRGBToLab(colour);
      const rgb = labToSRGB(lab);
      
      expect(rgb.R).toBeCloseTo(colour.R, 0);
      expect(rgb.G).toBeCloseTo(colour.G, 0);
      expect(rgb.B).toBeCloseTo(colour.B, 0);
    }
  });
});