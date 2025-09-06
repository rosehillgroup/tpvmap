import { describe, it, expect } from 'vitest';
import { deltaE2000, deltaE76 } from './deltaE';

describe('Delta E Calculations', () => {
  it('should calculate ΔE76 correctly', () => {
    const lab1 = { L: 50, a: 0, b: 0 };
    const lab2 = { L: 50, a: 0, b: 0 };
    expect(deltaE76(lab1, lab2)).toBe(0);
    
    const lab3 = { L: 50, a: 0, b: 0 };
    const lab4 = { L: 60, a: 0, b: 0 };
    expect(deltaE76(lab3, lab4)).toBe(10);
    
    const lab5 = { L: 50, a: 0, b: 0 };
    const lab6 = { L: 50, a: 10, b: 0 };
    expect(deltaE76(lab5, lab6)).toBe(10);
  });

  it('should calculate ΔE2000 for identical colours', () => {
    const lab = { L: 50, a: 20, b: -30 };
    expect(deltaE2000(lab, lab)).toBeCloseTo(0, 5);
  });

  it('should match known ΔE2000 test cases', () => {
    // Test cases from Sharma et al. (2005)
    const testCases = [
      {
        lab1: { L: 50.0000, a: 2.6772, b: -79.7751 },
        lab2: { L: 50.0000, a: 0.0000, b: -82.7485 },
        expected: 2.0425
      },
      {
        lab1: { L: 50.0000, a: 3.1571, b: -77.2803 },
        lab2: { L: 50.0000, a: 0.0000, b: -82.7485 },
        expected: 2.8615
      },
      {
        lab1: { L: 50.0000, a: 2.8361, b: -74.0200 },
        lab2: { L: 50.0000, a: 0.0000, b: -82.7485 },
        expected: 3.4412
      },
      {
        lab1: { L: 50.0000, a: -1.3802, b: -84.2814 },
        lab2: { L: 50.0000, a: 0.0000, b: -82.7485 },
        expected: 1.0000
      },
      {
        lab1: { L: 50.0000, a: -1.1848, b: -84.8006 },
        lab2: { L: 50.0000, a: 0.0000, b: -82.7485 },
        expected: 1.0000
      }
    ];
    
    for (const { lab1, lab2, expected } of testCases) {
      const result = deltaE2000(lab1, lab2);
      expect(result).toBeCloseTo(expected, 3);
    }
  });

  it('should be symmetric', () => {
    const lab1 = { L: 39.4, a: 58.5, b: 29.0 };
    const lab2 = { L: 40.5, a: -42.2, b: 17.9 };
    
    const delta1 = deltaE2000(lab1, lab2);
    const delta2 = deltaE2000(lab2, lab1);
    
    expect(delta1).toBeCloseTo(delta2, 5);
  });

  it('should handle neutral colours correctly', () => {
    const grey1 = { L: 50, a: 0, b: 0 };
    const grey2 = { L: 60, a: 0, b: 0 };
    
    const delta = deltaE2000(grey1, grey2);
    expect(delta).toBeGreaterThan(0);
    expect(delta).toBeLessThan(deltaE76(grey1, grey2)); // ΔE2000 should be less than ΔE76
  });
});