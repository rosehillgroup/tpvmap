import { PDFExtractor } from './pdf';
import { RasterExtractor } from './raster';
import { 
  ColourSpaceConverter,
  generateColourId, 
  combineColourSources,
  validateFileType,
  estimateExtractionComplexity,
  type PaletteColour
} from './utils';
import { getExtractionCache, generateCacheKey, ProgressiveLoader } from './cache';

export interface ExtractionOptions {
  maxColours?: number;
  minAreaPct?: number;
  combineStrategy?: 'prefer-pdf' | 'prefer-raster' | 'merge';
  rasterFallback?: boolean;
  pdfOptions?: {
    minFrequency?: number;
    tolerance?: number;
  };
  rasterOptions?: {
    resampleSize?: number;
    iterations?: number;
  };
}

export interface ExtractionResult {
  palette: PaletteColour[];
  metadata: {
    filename: string;
    fileSize: number;
    fileType: 'pdf' | 'image';
    extractionTime: number;
    complexity: 'low' | 'medium' | 'high';
    sources: ('pdf' | 'raster')[];
    totalColours: {
      pdf?: number;
      raster?: number;
      combined: number;
    };
  };
  warnings?: string[];
}

export class PaletteExtractor {
  private options: Required<ExtractionOptions>;
  private converter: ColourSpaceConverter;
  private pdfExtractor: PDFExtractor;
  private rasterExtractor: RasterExtractor;

  constructor(options: ExtractionOptions = {}) {
    this.options = {
      maxColours: options.maxColours ?? 15,
      minAreaPct: options.minAreaPct ?? 1,
      combineStrategy: options.combineStrategy ?? 'merge',
      rasterFallback: options.rasterFallback ?? true,
      pdfOptions: {
        minFrequency: 3,
        tolerance: 8,
        ...options.pdfOptions
      },
      rasterOptions: {
        resampleSize: 400,
        iterations: 15,
        ...options.rasterOptions
      }
    };

    this.converter = new ColourSpaceConverter();
    this.pdfExtractor = new PDFExtractor(this.options.pdfOptions);
    this.rasterExtractor = new RasterExtractor({
      maxColours: this.options.maxColours,
      minPercentage: this.options.minAreaPct,
      ...this.options.rasterOptions
    });
  }

  async extract(
    fileBuffer: ArrayBuffer,
    filename: string,
    progressLoader?: ProgressiveLoader
  ): Promise<ExtractionResult> {
    const startTime = Date.now();
    const fileValidation = validateFileType(filename);
    const complexity = estimateExtractionComplexity(fileBuffer.byteLength, fileValidation.type!);
    const warnings: string[] = [];
    const sources: ('pdf' | 'raster')[] = [];

    if (!fileValidation.isValid) {
      throw new Error(`Unsupported file type: ${filename}`);
    }

    // Check cache first
    const cache = getExtractionCache();
    const cacheKey = generateCacheKey(filename, fileBuffer.byteLength, this.options);
    const cached = cache.get(cacheKey);
    
    if (cached) {
      progressLoader?.updateProgress('complete', 100, 'Using cached result');
      return cached;
    }

    progressLoader?.updateProgress('extracting', 10, 'Starting color extraction...');

    try {
      let pdfColours: PaletteColour[] = [];
      let rasterColours: PaletteColour[] = [];

      // Extract from PDF (vector + text colors)
      if (fileValidation.type === 'pdf') {
        try {
          progressLoader?.updateProgress('extracting', 25, 'Extracting PDF vector colors...');
          const pdfResult = await this.pdfExtractor.extract(fileBuffer);
          
          pdfColours = pdfResult.colours.map((color, index) => ({
            id: generateColourId(color.rgb, 'pdf'),
            rgb: color.rgb,
            lab: this.converter.rgbToLab(color.rgb),
            areaPct: (color.area / pdfResult.colours.reduce((sum, c) => sum + c.area, 0)) * 100,
            pageIds: color.pageIds,
            source: 'pdf' as const,
            metadata: {
              frequency: color.frequency
            }
          }));

          sources.push('pdf');
          
          if (pdfColours.length === 0) {
            warnings.push('No colors found in PDF vector content');
          }
        } catch (error) {
          warnings.push(`PDF extraction failed: ${error.message}`);
          if (!this.options.rasterFallback) {
            throw error;
          }
        }

        // Fallback to raster extraction for PDFs with no vector colors
        if (this.options.rasterFallback && (pdfColours.length === 0 || warnings.length > 0)) {
          try {
            progressLoader?.updateProgress('extracting', 50, 'Fallback to PDF raster analysis...');
            await this.extractRasterFromPDF(fileBuffer, rasterColours, warnings);
            sources.push('raster');
          } catch (error) {
            warnings.push(`PDF raster fallback failed: ${error.message}`);
          }
        }
      }

      // Extract from raster images
      if (fileValidation.type === 'image') {
        try {
          progressLoader?.updateProgress('extracting', 40, 'Analyzing raster image colors...');
          const rasterResult = await this.rasterExtractor.extract(
            fileBuffer, 
            fileValidation.format!
          );

          rasterColours = rasterResult.colours.map(color => ({
            id: generateColourId(color.rgb, 'raster'),
            rgb: color.rgb,
            lab: this.converter.rgbToLab(color.rgb),
            areaPct: color.percentage,
            source: 'raster' as const,
            metadata: {
              pixels: color.pixels,
              percentage: color.percentage
            }
          }));

          sources.push('raster');

          if (rasterColours.length === 0) {
            warnings.push('No significant colors found in raster image');
          }
        } catch (error) {
          throw new Error(`Image extraction failed: ${error.message}`);
        }
      }

      // Combine color sources
      progressLoader?.updateProgress('processing', 70, 'Combining and filtering colors...');
      let palette = combineColourSources(
        pdfColours, 
        rasterColours, 
        this.options.combineStrategy
      );

      // Post-processing
      palette = this.converter.filterInsignificant(
        palette, 
        this.options.minAreaPct
      );
      
      palette = this.converter.sortByImportance(palette);
      
      if (palette.length > this.options.maxColours) {
        palette = palette.slice(0, this.options.maxColours);
        warnings.push(`Truncated to ${this.options.maxColours} most significant colors`);
      }

      // Ensure we have at least one color
      if (palette.length === 0) {
        warnings.push('No colors extracted, using fallback');
        palette = [{
          id: generateColourId({ R: 128, G: 128, B: 128 }, 'fallback'),
          rgb: { R: 128, G: 128, B: 128 },
          lab: this.converter.rgbToLab({ R: 128, G: 128, B: 128 }),
          areaPct: 100,
          source: 'raster' as const
        }];
      }

      const result: ExtractionResult = {
        palette,
        metadata: {
          filename,
          fileSize: fileBuffer.byteLength,
          fileType: fileValidation.type,
          extractionTime: Date.now() - startTime,
          complexity,
          sources,
          totalColours: {
            pdf: pdfColours.length || undefined,
            raster: rasterColours.length || undefined,
            combined: palette.length
          }
        },
        warnings: warnings.length > 0 ? warnings : undefined
      };

      // Cache the result
      progressLoader?.updateProgress('caching', 90, 'Caching extraction result...');
      cache.set(cacheKey, result, 60 * 60 * 1000); // Cache for 1 hour

      progressLoader?.complete();
      return result;
    } catch (error) {
      throw new Error(`Palette extraction failed: ${error.message}`);
    }
  }

  private async extractRasterFromPDF(
    fileBuffer: ArrayBuffer,
    rasterColours: PaletteColour[],
    warnings: string[]
  ): Promise<void> {
    try {
      // Import PDF.js dynamically for server-side rendering
      const pdfjs = await import('pdfjs-dist');
      const pdf = await pdfjs.getDocument({ 
        data: fileBuffer,
        useSystemFonts: false,
        isEvalSupported: false
      }).promise;

      // Process each page as raster
      for (let pageNum = 1; pageNum <= Math.min(pdf.numPages, 5); pageNum++) {
        const page = await pdf.getPage(pageNum);
        const canvas = await this.rasterExtractor.renderPDFPageToCanvas(page, 1.0);
        
        if (canvas) {
          const pageResult = await this.rasterExtractor.extractFromCanvas(canvas);
          
          // Convert page colors to palette colors
          const pageColours = pageResult.colours.map(color => ({
            id: generateColourId(color.rgb, 'raster'),
            rgb: color.rgb,
            lab: this.converter.rgbToLab(color.rgb),
            areaPct: color.percentage / pdf.numPages, // Distribute across pages
            pageIds: [pageNum],
            source: 'raster' as const,
            metadata: {
              pixels: color.pixels,
              percentage: color.percentage
            }
          }));

          rasterColours.push(...pageColours);
        }
      }

      if (pdf.numPages > 5) {
        warnings.push(`Only processed first 5 of ${pdf.numPages} pages for raster analysis`);
      }
    } catch (error) {
      throw new Error(`PDF raster extraction failed: ${error.message}`);
    }
  }
}