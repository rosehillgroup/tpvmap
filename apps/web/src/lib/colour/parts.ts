export interface PartsConfig {
  maxTotal: number;
  minPer: number;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function gcdArray(arr: number[]): number {
  return arr.reduce((acc, val) => gcd(acc, val));
}

export function percentagesToParts(
  percentages: Record<string, number>,
  config: PartsConfig
): { parts: Record<string, number>; total: number } | null {
  const codes = Object.keys(percentages).filter(code => percentages[code] > 0);
  if (codes.length === 0) return null;
  
  const values = codes.map(code => percentages[code]);
  const sum = values.reduce((acc, val) => acc + val, 0);
  if (Math.abs(sum - 1.0) > 0.001) return null;
  
  for (let total = codes.length * config.minPer; total <= config.maxTotal; total++) {
    const parts: Record<string, number> = {};
    let remaining = total;
    let valid = true;
    
    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];
      const isLast = i === codes.length - 1;
      
      if (isLast) {
        parts[code] = remaining;
        if (parts[code] < config.minPer) {
          valid = false;
          break;
        }
      } else {
        const idealPart = Math.round(percentages[code] * total);
        parts[code] = Math.max(config.minPer, idealPart);
        remaining -= parts[code];
        
        if (remaining < config.minPer * (codes.length - i - 1)) {
          valid = false;
          break;
        }
      }
    }
    
    if (!valid) continue;
    
    const partsArray = Object.values(parts);
    const divisor = gcdArray(partsArray);
    
    const reduced: Record<string, number> = {};
    for (const [code, part] of Object.entries(parts)) {
      reduced[code] = part / divisor;
    }
    
    return { parts: reduced, total: total / divisor };
  }
  
  return null;
}

export function partsToPercentages(parts: Record<string, number>): Record<string, number> {
  const total = Object.values(parts).reduce((sum, part) => sum + part, 0);
  if (total === 0) return {};
  
  const percentages: Record<string, number> = {};
  for (const [code, part] of Object.entries(parts)) {
    percentages[code] = part / total;
  }
  
  return percentages;
}

export function snapToRatioGrid(
  value: number,
  step: number,
  min: number = 0,
  max: number = 1
): number {
  const steps = Math.round((value - min) / step);
  const snapped = min + steps * step;
  return Math.max(min, Math.min(max, snapped));
}

export function formatParts(parts: Record<string, number>): string {
  const entries = Object.entries(parts)
    .filter(([_, value]) => value > 0)
    .sort(([, a], [, b]) => b - a);
  
  if (entries.length === 0) return '';
  
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  
  return entries
    .map(([code, value]) => {
      if (entries.length === 1) return `${code} (100%)`;
      return `${value} ${value === 1 ? 'part' : 'parts'} ${code}`;
    })
    .join(', ');
}

export function formatPercentages(percentages: Record<string, number>): string {
  const entries = Object.entries(percentages)
    .filter(([_, value]) => value > 0.001)
    .sort(([, a], [, b]) => b - a);
  
  if (entries.length === 0) return '';
  
  return entries
    .map(([code, value]) => `${(value * 100).toFixed(1)}% ${code}`)
    .join(', ');
}