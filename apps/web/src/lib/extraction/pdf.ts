import { getDocument, version } from 'pdfjs-dist';
import type { RGB } from '../colour/types';

// PDF.js worker configuration for Netlify Functions
if (typeof window === 'undefined') {
  const pdfjs = await import('pdfjs-dist/build/pdf.worker.min.mjs');
  // @ts-ignore
  globalThis.pdfjsWorker = pdfjs;
}

export interface PDFColour {
  rgb: RGB;
  frequency: number;
  area: number;
  pageIds: number[];
}

export interface PDFExtractionResult {
  colours: PDFColour[];
  metadata: {
    pageCount: number;
    totalObjects: number;
    version: string;
  };
}

export interface PDFExtractionOptions {
  minFrequency?: number;
  tolerance?: number;
  maxColours?: number;
}

export class PDFExtractor {
  private options: Required<PDFExtractionOptions>;

  constructor(options: PDFExtractionOptions = {}) {
    this.options = {
      minFrequency: options.minFrequency ?? 5,
      tolerance: options.tolerance ?? 5,
      maxColours: options.maxColours ?? 50
    };
  }

  async extract(pdfBuffer: ArrayBuffer): Promise<PDFExtractionResult> {
    try {
      const pdfDoc = await getDocument({
        data: pdfBuffer,
        useSystemFonts: false,
        isEvalSupported: false,
        useWorkerFetch: false
      }).promise;

      const colourMap = new Map<string, PDFColour>();
      let totalObjects = 0;

      // Process each page
      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const pageColours = await this.extractPageColours(page, pageNum);
        
        totalObjects += pageColours.objectCount;

        // Merge colours with tolerance
        for (const colour of pageColours.colours) {
          const key = this.findSimilarColour(colourMap, colour.rgb);
          if (key) {
            const existing = colourMap.get(key)!;
            existing.frequency += colour.frequency;
            existing.area += colour.area;
            existing.pageIds.push(pageNum);
          } else {
            const colourKey = this.rgbToKey(colour.rgb);
            colourMap.set(colourKey, {
              ...colour,
              pageIds: [pageNum]
            });
          }
        }
      }

      // Filter and sort colours
      const filteredColours = Array.from(colourMap.values())
        .filter(c => c.frequency >= this.options.minFrequency)
        .sort((a, b) => b.area - a.area)
        .slice(0, this.options.maxColours);

      return {
        colours: filteredColours,
        metadata: {
          pageCount: pdfDoc.numPages,
          totalObjects,
          version: version
        }
      };
    } catch (error) {
      throw new Error(`PDF extraction failed: ${error.message}`);
    }
  }

  private async extractPageColours(page: any, pageNum: number) {
    const colours: PDFColour[] = [];
    let objectCount = 0;

    try {
      // Get page content stream
      const textContent = await page.getTextContent();
      const operatorList = await page.getOperatorList();
      
      // Process operator list for colour commands
      for (let i = 0; i < operatorList.fnArray.length; i++) {
        const fn = operatorList.fnArray[i];
        const args = operatorList.argsArray[i];
        
        objectCount++;

        // Handle different colour space operations
        switch (fn) {
          case 1: // OPS.setFillRGBColor
          case 2: // OPS.setStrokeRGBColor
            if (args.length >= 3) {
              const rgb: RGB = {
                R: Math.round(args[0] * 255),
                G: Math.round(args[1] * 255),
                B: Math.round(args[2] * 255)
              };
              colours.push({
                rgb,
                frequency: 1,
                area: this.estimateArea(fn, args),
                pageIds: []
              });
            }
            break;
            
          case 3: // OPS.setFillColorN (for device color spaces)
          case 4: // OPS.setStrokeColorN
            if (args.length >= 3) {
              // Handle DeviceRGB color space
              const rgb: RGB = {
                R: Math.round(args[0] * 255),
                G: Math.round(args[1] * 255),
                B: Math.round(args[2] * 255)
              };
              colours.push({
                rgb,
                frequency: 1,
                area: this.estimateArea(fn, args),
                pageIds: []
              });
            } else if (args.length === 4) {
              // Handle DeviceCMYK color space - convert to RGB approximation
              const [c, m, y, k] = args;
              const rgb = this.cmykToRgb(c, m, y, k);
              colours.push({
                rgb,
                frequency: 1,
                area: this.estimateArea(fn, args),
                pageIds: []
              });
            }
            break;
        }
      }

      return { colours, objectCount };
    } catch (error) {
      console.warn(`Failed to extract colors from page ${pageNum}:`, error);
      return { colours: [], objectCount };
    }
  }

  private estimateArea(operation: number, args: any[]): number {
    // Rough area estimation based on operation type
    // Fill operations typically cover more area than strokes
    switch (operation) {
      case 1: // Fill RGB
      case 3: // Fill ColorN
        return 10; // Assume fills cover more area
      case 2: // Stroke RGB
      case 4: // Stroke ColorN
        return 1; // Strokes typically less area
      default:
        return 1;
    }
  }

  private cmykToRgb(c: number, m: number, y: number, k: number): RGB {
    // Basic CMYK to RGB conversion
    const r = 255 * (1 - c) * (1 - k);
    const g = 255 * (1 - m) * (1 - k);
    const b = 255 * (1 - y) * (1 - k);
    
    return {
      R: Math.round(Math.max(0, Math.min(255, r))),
      G: Math.round(Math.max(0, Math.min(255, g))),
      B: Math.round(Math.max(0, Math.min(255, b)))
    };
  }

  private rgbToKey(rgb: RGB): string {
    return `${rgb.R},${rgb.G},${rgb.B}`;
  }

  private findSimilarColour(colourMap: Map<string, PDFColour>, rgb: RGB): string | null {
    const tolerance = this.options.tolerance;
    
    for (const [key, existingColour] of colourMap) {
      const existing = existingColour.rgb;
      const distance = Math.sqrt(
        Math.pow(existing.R - rgb.R, 2) +
        Math.pow(existing.G - rgb.G, 2) +
        Math.pow(existing.B - rgb.B, 2)
      );
      
      if (distance <= tolerance) {
        return key;
      }
    }
    
    return null;
  }
}