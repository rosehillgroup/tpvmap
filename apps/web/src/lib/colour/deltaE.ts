import { Lab } from './convert';

export function deltaE2000(lab1: Lab, lab2: Lab): number {
  const { L: L1, a: a1, b: b1 } = lab1;
  const { L: L2, a: a2, b: b2 } = lab2;
  
  const kL = 1.0;
  const kC = 1.0;
  const kH = 1.0;
  
  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const Cbar = (C1 + C2) / 2;
  
  const G = 0.5 * (1 - Math.sqrt(Math.pow(Cbar, 7) / (Math.pow(Cbar, 7) + Math.pow(25, 7))));
  
  const a1Prime = (1 + G) * a1;
  const a2Prime = (1 + G) * a2;
  
  const C1Prime = Math.sqrt(a1Prime * a1Prime + b1 * b1);
  const C2Prime = Math.sqrt(a2Prime * a2Prime + b2 * b2);
  
  let h1Prime = Math.atan2(b1, a1Prime) * 180 / Math.PI;
  if (h1Prime < 0) h1Prime += 360;
  
  let h2Prime = Math.atan2(b2, a2Prime) * 180 / Math.PI;
  if (h2Prime < 0) h2Prime += 360;
  
  const deltaLPrime = L2 - L1;
  const deltaCPrime = C2Prime - C1Prime;
  
  let deltahPrime: number;
  if (C1Prime * C2Prime === 0) {
    deltahPrime = 0;
  } else {
    let diff = h2Prime - h1Prime;
    if (Math.abs(diff) <= 180) {
      deltahPrime = diff;
    } else if (diff > 180) {
      deltahPrime = diff - 360;
    } else {
      deltahPrime = diff + 360;
    }
  }
  
  const deltaHPrime = 2 * Math.sqrt(C1Prime * C2Prime) * Math.sin((deltahPrime * Math.PI) / 360);
  
  const LPrimeBar = (L1 + L2) / 2;
  const CPrimeBar = (C1Prime + C2Prime) / 2;
  
  let hPrimeBar: number;
  if (C1Prime * C2Prime === 0) {
    hPrimeBar = h1Prime + h2Prime;
  } else {
    const diff = Math.abs(h1Prime - h2Prime);
    const sum = h1Prime + h2Prime;
    if (diff <= 180) {
      hPrimeBar = sum / 2;
    } else if (sum < 360) {
      hPrimeBar = (sum + 360) / 2;
    } else {
      hPrimeBar = (sum - 360) / 2;
    }
  }
  
  const T = 1 - 0.17 * Math.cos((hPrimeBar - 30) * Math.PI / 180) +
            0.24 * Math.cos(2 * hPrimeBar * Math.PI / 180) +
            0.32 * Math.cos((3 * hPrimeBar + 6) * Math.PI / 180) -
            0.20 * Math.cos((4 * hPrimeBar - 63) * Math.PI / 180);
  
  const deltaTheta = 30 * Math.exp(-Math.pow((hPrimeBar - 275) / 25, 2));
  
  const RC = 2 * Math.sqrt(Math.pow(CPrimeBar, 7) / (Math.pow(CPrimeBar, 7) + Math.pow(25, 7)));
  
  const SL = 1 + (0.015 * Math.pow(LPrimeBar - 50, 2)) / Math.sqrt(20 + Math.pow(LPrimeBar - 50, 2));
  const SC = 1 + 0.045 * CPrimeBar;
  const SH = 1 + 0.015 * CPrimeBar * T;
  
  const RT = -Math.sin(2 * deltaTheta * Math.PI / 180) * RC;
  
  const deltaE = Math.sqrt(
    Math.pow(deltaLPrime / (kL * SL), 2) +
    Math.pow(deltaCPrime / (kC * SC), 2) +
    Math.pow(deltaHPrime / (kH * SH), 2) +
    RT * (deltaCPrime / (kC * SC)) * (deltaHPrime / (kH * SH))
  );
  
  return deltaE;
}

export function deltaE76(lab1: Lab, lab2: Lab): number {
  const dL = lab2.L - lab1.L;
  const da = lab2.a - lab1.a;
  const db = lab2.b - lab1.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}