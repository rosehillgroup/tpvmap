import type { RGB } from '../colour/types';

// Configure PDF.js for server-side rendering
async function configurePDFJS() {
  // Use legacy build for Node.js environment
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  
  // Disable worker in server environment
  pdfjs.GlobalWorkerOptions.workerSrc = null;
  
  return pdfjs;
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
      const pdfjs = await configurePDFJS();
      
      const pdfDoc = await pdfjs.getDocument({
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
          version: pdfjs.version || 'unknown'
        }
      };
    } catch (error) {
      throw new Error(`PDF extraction failed: ${error.message}`);
    }
  }

  private async extractPageColours(page: any, pageNum: number) {
    const colours: PDFColour[] = [];
    let objectCount = 0;
    let currentFillColor: RGB | null = null;
    let currentStrokeColor: RGB | null = null;

    try {
      const operatorList = await page.getOperatorList();
      const pdfjs = await configurePDFJS();
      const OPS = pdfjs.OPS;
      
      // Debug: Count operation types
      const opCounts = new Map<number, number>();
      for (const fn of operatorList.fnArray) {
        opCounts.set(fn, (opCounts.get(fn) || 0) + 1);
      }
      console.info(`Page ${pageNum} operation counts:`, Array.from(opCounts.entries()).slice(0, 10));
      
      // Process operator list for colour commands
      for (let i = 0; i < operatorList.fnArray.length; i++) {
        const fn = operatorList.fnArray[i];
        const args = operatorList.argsArray[i];
        
        objectCount++;

        // Track current colors and register them when paint operations occur
        switch (fn) {
          // RGB Color Setting Operations
          case OPS.setFillRGBColor:
            if (args.length >= 3) {
              currentFillColor = {
                R: Math.round(args[0] * 255),
                G: Math.round(args[1] * 255),
                B: Math.round(args[2] * 255)
              };
            }
            break;
            
          case OPS.setStrokeRGBColor:
            if (args.length >= 3) {
              currentStrokeColor = {
                R: Math.round(args[0] * 255),
                G: Math.round(args[1] * 255),
                B: Math.round(args[2] * 255)
              };
            }
            break;

          // Grayscale Operations
          case OPS.setFillGray:
            if (args.length >= 1) {
              const gray = Math.round(args[0] * 255);
              currentFillColor = { R: gray, G: gray, B: gray };
            }
            break;
            
          case OPS.setStrokeGray:
            if (args.length >= 1) {
              const gray = Math.round(args[0] * 255);
              currentStrokeColor = { R: gray, G: gray, B: gray };
            }
            break;

          // CMYK Operations
          case OPS.setFillCMYKColor:
            if (args.length >= 4) {
              currentFillColor = this.cmykToRgb(args[0], args[1], args[2], args[3]);
            }
            break;
            
          case OPS.setStrokeCMYKColor:
            if (args.length >= 4) {
              currentStrokeColor = this.cmykToRgb(args[0], args[1], args[2], args[3]);
            }
            break;

          // Generic Color Setting (for complex color spaces)
          case OPS.setFillColorN:
            if (args.length >= 3) {
              currentFillColor = {
                R: Math.round(Math.min(1, Math.max(0, args[0])) * 255),
                G: Math.round(Math.min(1, Math.max(0, args[1])) * 255),
                B: Math.round(Math.min(1, Math.max(0, args[2])) * 255)
              };
            } else if (args.length === 4) {
              // Assume CMYK
              currentFillColor = this.cmykToRgb(args[0], args[1], args[2], args[3]);
            } else if (args.length === 1) {
              // Assume grayscale
              const gray = Math.round(args[0] * 255);
              currentFillColor = { R: gray, G: gray, B: gray };
            }
            break;
            
          case OPS.setStrokeColorN:
            if (args.length >= 3) {
              currentStrokeColor = {
                R: Math.round(Math.min(1, Math.max(0, args[0])) * 255),
                G: Math.round(Math.min(1, Math.max(0, args[1])) * 255),
                B: Math.round(Math.min(1, Math.max(0, args[2])) * 255)
              };
            } else if (args.length === 4) {
              currentStrokeColor = this.cmykToRgb(args[0], args[1], args[2], args[3]);
            } else if (args.length === 1) {
              const gray = Math.round(args[0] * 255);
              currentStrokeColor = { R: gray, G: gray, B: gray };
            }
            break;

          // Paint Operations - record colors when they're actually used
          case OPS.fill:
          case OPS.eoFill:
            if (currentFillColor) {
              colours.push({
                rgb: currentFillColor,
                frequency: 1,
                area: this.estimateAreaFromOperation(fn, args, 'fill'),
                pageIds: []
              });
            }
            break;

          case OPS.stroke:
            if (currentStrokeColor) {
              colours.push({
                rgb: currentStrokeColor,
                frequency: 1,
                area: this.estimateAreaFromOperation(fn, args, 'stroke'),
                pageIds: []
              });
            }
            break;

          case OPS.fillStroke:
          case OPS.eoFillStroke:
            if (currentFillColor) {
              colours.push({
                rgb: currentFillColor,
                frequency: 1,
                area: this.estimateAreaFromOperation(fn, args, 'fill'),
                pageIds: []
              });
            }
            if (currentStrokeColor) {
              colours.push({
                rgb: currentStrokeColor,
                frequency: 1,
                area: this.estimateAreaFromOperation(fn, args, 'stroke'),
                pageIds: []
              });
            }
            break;
        }
      }

      console.info(`Page ${pageNum}: Found ${colours.length} color operations from ${objectCount} total operations`);
      
      // Debug: Log some of the operations we saw
      if (colours.length > 0) {
        console.info(`Page ${pageNum} sample colors:`, colours.slice(0, 3).map(c => 
          `RGB(${c.rgb.R},${c.rgb.G},${c.rgb.B}) area:${c.area}`
        ));
      } else {
        console.warn(`Page ${pageNum}: No colors found - this may indicate the PDF uses unsupported color operations`);
      }
      
      return { colours, objectCount };
    } catch (error) {
      console.warn(`Failed to extract colors from page ${pageNum}:`, error);
      return { colours: [], objectCount };
    }
  }

  private estimateAreaFromOperation(operation: number, args: any[], type: 'fill' | 'stroke'): number {
    // Better area estimation based on paint operation type
    // In a proper implementation, we'd analyze the path data to get actual areas
    // For now, use heuristics based on operation type
    
    switch (type) {
      case 'fill':
        // Fill operations typically cover significant area
        // Scale based on number of path arguments (rough proxy for complexity)
        return Math.max(5, Math.min(50, (args.length || 1) * 10));
      case 'stroke':
        // Stroke operations cover less area (just outlines)
        return Math.max(1, Math.min(10, (args.length || 1) * 2));
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