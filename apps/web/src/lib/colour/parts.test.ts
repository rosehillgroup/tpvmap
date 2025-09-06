import { describe, it, expect } from 'vitest';
import { 
  percentagesToParts, 
  partsToPercentages, 
  snapToRatioGrid,
  formatParts,
  formatPercentages
} from './parts';

describe('Parts Conversion', () => {
  it('should convert simple percentages to parts', () => {
    const percentages = { 'RH01': 0.5, 'RH10': 0.5 };
    const config = { maxTotal: 12, minPer: 1 };
    
    const result = percentagesToParts(percentages, config);
    expect(result).toBeTruthy();
    expect(result!.parts).toEqual({ 'RH01': 1, 'RH10': 1 });
    expect(result!.total).toBe(2);
  });

  it('should handle unequal percentages', () => {
    const percentages = { 'RH01': 0.75, 'RH10': 0.25 };
    const config = { maxTotal: 12, minPer: 1 };
    
    const result = percentagesToParts(percentages, config);
    expect(result).toBeTruthy();
    expect(result!.parts['RH01']).toBeGreaterThan(result!.parts['RH10']);
    expect(Object.values(result!.parts).reduce((a, b) => a + b, 0)).toBe(result!.total);
  });

  it('should respect minimum parts constraint', () => {
    const percentages = { 'RH01': 0.95, 'RH10': 0.05 };
    const config = { maxTotal: 12, minPer: 1 };
    
    const result = percentagesToParts(percentages, config);
    expect(result).toBeTruthy();
    expect(result!.parts['RH10']).toBeGreaterThanOrEqual(1);
  });

  it('should convert parts back to percentages', () => {
    const parts = { 'RH01': 2, 'RH10': 1 };
    const percentages = partsToPercentages(parts);
    
    expect(percentages['RH01']).toBeCloseTo(2/3, 5);
    expect(percentages['RH10']).toBeCloseTo(1/3, 5);
  });

  it('should snap values to ratio grid', () => {
    expect(snapToRatioGrid(0.33, 0.02)).toBeCloseTo(0.34);
    expect(snapToRatioGrid(0.34, 0.02)).toBeCloseTo(0.34);
    expect(snapToRatioGrid(0.335, 0.02)).toBeCloseTo(0.34);
  });

  it('should format parts correctly', () => {
    expect(formatParts({ 'RH01': 2, 'RH10': 1 })).toContain('2 parts RH01');
    expect(formatParts({ 'RH01': 1 })).toContain('RH01 (100%)');
    expect(formatParts({})).toBe('');
  });

  it('should format percentages correctly', () => {
    expect(formatPercentages({ 'RH01': 0.667, 'RH10': 0.333 })).toContain('66.7% RH01');
    expect(formatPercentages({ 'RH01': 0.001 })).toBe(''); // Below threshold
  });

  it('should return null for invalid percentages', () => {
    const config = { maxTotal: 12, minPer: 1 };
    
    // Sum not equal to 1
    expect(percentagesToParts({ 'RH01': 0.6, 'RH10': 0.3 }, config)).toBeNull();
    
    // Empty input
    expect(percentagesToParts({}, config)).toBeNull();
    
    // Impossible constraints
    expect(percentagesToParts({ 'RH01': 0.1, 'RH10': 0.1, 'RH20': 0.8 }, { maxTotal: 2, minPer: 1 })).toBeNull();
  });
});