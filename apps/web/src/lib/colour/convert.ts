export interface RGB {
  R: number;
  G: number;
  B: number;
}

export interface Lab {
  L: number;
  a: number;
  b: number;
}

export interface XYZ {
  X: number;
  Y: number;
  Z: number;
}

const D65_REFERENCE = { Xn: 0.95047, Yn: 1.0, Zn: 1.08883 };

const RGB_TO_XYZ_MATRIX = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.0721750],
  [0.0193339, 0.1191920, 0.9503041]
];

const XYZ_TO_RGB_MATRIX = [
  [ 3.2404542, -1.5371385, -0.4985314],
  [-0.9692660,  1.8760108,  0.0415560],
  [ 0.0556434, -0.2040259,  1.0572252]
];

function gammaExpand(value: number): number {
  return value <= 0.04045 
    ? value / 12.92 
    : Math.pow((value + 0.055) / 1.055, 2.4);
}

function gammaCompress(value: number): number {
  return value <= 0.0031308 
    ? value * 12.92 
    : 1.055 * Math.pow(value, 1/2.4) - 0.055;
}

export function sRGBToLinearRGB(rgb: RGB): RGB {
  return {
    R: gammaExpand(rgb.R / 255),
    G: gammaExpand(rgb.G / 255),
    B: gammaExpand(rgb.B / 255)
  };
}

export function linearRGBToSRGB(linear: RGB): RGB {
  return {
    R: Math.round(gammaCompress(linear.R) * 255),
    G: Math.round(gammaCompress(linear.G) * 255),
    B: Math.round(gammaCompress(linear.B) * 255)
  };
}

export function linearRGBToXYZ(rgb: RGB): XYZ {
  const [row0, row1, row2] = RGB_TO_XYZ_MATRIX;
  return {
    X: row0[0] * rgb.R + row0[1] * rgb.G + row0[2] * rgb.B,
    Y: row1[0] * rgb.R + row1[1] * rgb.G + row1[2] * rgb.B,
    Z: row2[0] * rgb.R + row2[1] * rgb.G + row2[2] * rgb.B
  };
}

export function xyzToLinearRGB(xyz: XYZ): RGB {
  const [row0, row1, row2] = XYZ_TO_RGB_MATRIX;
  return {
    R: row0[0] * xyz.X + row0[1] * xyz.Y + row0[2] * xyz.Z,
    G: row1[0] * xyz.X + row1[1] * xyz.Y + row1[2] * xyz.Z,
    B: row2[0] * xyz.X + row2[1] * xyz.Y + row2[2] * xyz.Z
  };
}

function f(t: number): number {
  const delta = 6 / 29;
  return t > Math.pow(delta, 3) 
    ? Math.pow(t, 1/3) 
    : t / (3 * delta * delta) + 4 / 29;
}

function fInv(t: number): number {
  const delta = 6 / 29;
  return t > delta 
    ? Math.pow(t, 3) 
    : 3 * delta * delta * (t - 4 / 29);
}

export function xyzToLab(xyz: XYZ): Lab {
  const fx = f(xyz.X / D65_REFERENCE.Xn);
  const fy = f(xyz.Y / D65_REFERENCE.Yn);
  const fz = f(xyz.Z / D65_REFERENCE.Zn);
  
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz)
  };
}

export function labToXYZ(lab: Lab): XYZ {
  const fy = (lab.L + 16) / 116;
  const fx = lab.a / 500 + fy;
  const fz = fy - lab.b / 200;
  
  return {
    X: D65_REFERENCE.Xn * fInv(fx),
    Y: D65_REFERENCE.Yn * fInv(fy),
    Z: D65_REFERENCE.Zn * fInv(fz)
  };
}

export function sRGBToLab(rgb: RGB): Lab {
  const linear = sRGBToLinearRGB(rgb);
  const xyz = linearRGBToXYZ(linear);
  return xyzToLab(xyz);
}

export function labToSRGB(lab: Lab): RGB {
  const xyz = labToXYZ(lab);
  const linear = xyzToLinearRGB(xyz);
  return linearRGBToSRGB(linear);
}

export function hexToRGB(hex: string): RGB {
  const cleaned = hex.replace('#', '');
  const bigint = parseInt(cleaned, 16);
  return {
    R: (bigint >> 16) & 255,
    G: (bigint >> 8) & 255,
    B: bigint & 255
  };
}

export function rgbToHex(rgb: RGB): string {
  const r = Math.round(Math.max(0, Math.min(255, rgb.R)));
  const g = Math.round(Math.max(0, Math.min(255, rgb.G)));
  const b = Math.round(Math.max(0, Math.min(255, rgb.B)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

export function clampRGB(rgb: RGB): RGB {
  return {
    R: Math.max(0, Math.min(255, Math.round(rgb.R))),
    G: Math.max(0, Math.min(255, Math.round(rgb.G))),
    B: Math.max(0, Math.min(255, Math.round(rgb.B)))
  };
}