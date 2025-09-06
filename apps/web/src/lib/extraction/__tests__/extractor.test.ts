import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaletteExtractor } from '../extractor';
import type { RGB, Lab } from '../../colour/types';

// Mock the heavy dependencies
vi.mock('canvas', () => ({
  createCanvas: vi.fn(() => ({
    width: 100,
    height: 100,
    getContext: vi.fn(() => ({
      getImageData: vi.fn(() => ({
        data: new Uint8ClampedArray(100 * 100 * 4).fill(128),
        width: 100,
        height: 100
      }))
    }))
  })),
  loadImage: vi.fn()
}));

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 100, height: 100 }),
    resize: vi.fn().mockReturnThis(),
    removeAlpha: vi.fn().mockReturnThis(),
    raw: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue({
      data: new Uint8Array(100 * 100 * 3).fill(128),
      info: { width: 100, height: 100, channels: 3 }
    })
  }))
}));

vi.mock('kmeans-js', () => ({
  default: vi.fn(() => [
    {
      centroid: [128, 128, 128],
      cluster: Array(1000).fill([128, 128, 128])
    },
    {
      centroid: [255, 0, 0],
      cluster: Array(500).fill([255, 0, 0])
    }
  ])
}));

vi.mock('pdfjs-dist', () => ({
  getDocument: vi.fn(() => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: vi.fn(() => Promise.resolve({
        getOperatorList: vi.fn(() => Promise.resolve({
          fnArray: [1, 2], // setFillRGBColor, setStrokeRGBColor
          argsArray: [[1, 0, 0], [0, 1, 0]]
        })),
        getTextContent: vi.fn(() => Promise.resolve({ items: [] }))
      }))
    })
  })),
  version: '3.0.0'
}));

describe('PaletteExtractor', () => {
  let extractor: PaletteExtractor;

  beforeEach(() => {
    extractor = new PaletteExtractor({
      maxColours: 10,
      minAreaPct: 1,
      combineStrategy: 'merge'
    });
  });

  describe('Constructor and Options', () => {
    it('should create extractor with default options', () => {
      const defaultExtractor = new PaletteExtractor();
      expect(defaultExtractor).toBeDefined();
    });

    it('should create extractor with custom options', () => {
      const customExtractor = new PaletteExtractor({
        maxColours: 20,
        minAreaPct: 2,
        combineStrategy: 'prefer-pdf'
      });
      expect(customExtractor).toBeDefined();
    });
  });

  describe('File Type Validation', () => {
    it('should reject unsupported file types', async () => {
      const buffer = new ArrayBuffer(1024);
      
      await expect(
        extractor.extract(buffer, 'test.txt')
      ).rejects.toThrow('Unsupported file type');
    });

    it('should accept PDF files', async () => {
      const buffer = new ArrayBuffer(1024);
      
      // Should not throw for PDF
      await expect(
        extractor.extract(buffer, 'test.pdf')
      ).resolves.toBeDefined();
    });

    it('should accept image files', async () => {
      const buffer = new ArrayBuffer(1024);
      
      await expect(
        extractor.extract(buffer, 'test.png')
      ).resolves.toBeDefined();
      
      await expect(
        extractor.extract(buffer, 'test.jpg')
      ).resolves.toBeDefined();
    });
  });

  describe('PDF Extraction', () => {
    it('should extract colors from PDF', async () => {
      const buffer = new ArrayBuffer(1024);
      
      const result = await extractor.extract(buffer, 'test.pdf');
      
      expect(result.palette).toBeDefined();
      expect(result.palette.length).toBeGreaterThan(0);
      expect(result.metadata.fileType).toBe('pdf');
      expect(result.metadata.sources).toContain('pdf');
    });

    it('should handle PDF extraction errors gracefully', async () => {
      vi.mocked(require('pdfjs-dist').getDocument).mockImplementationOnce(() => ({
        promise: Promise.reject(new Error('PDF parse error'))
      }));

      const buffer = new ArrayBuffer(1024);
      
      const result = await extractor.extract(buffer, 'test.pdf');
      
      // Should still return a result with fallback
      expect(result.palette).toBeDefined();
      expect(result.warnings).toBeDefined();
      expect(result.warnings).toContain('PDF extraction failed: PDF parse error');
    });
  });

  describe('Raster Image Extraction', () => {
    it('should extract colors from PNG image', async () => {
      const buffer = new ArrayBuffer(1024);
      
      const result = await extractor.extract(buffer, 'test.png');
      
      expect(result.palette).toBeDefined();
      expect(result.palette.length).toBeGreaterThan(0);
      expect(result.metadata.fileType).toBe('image');
      expect(result.metadata.sources).toContain('raster');
    });

    it('should extract colors from JPEG image', async () => {
      const buffer = new ArrayBuffer(1024);
      
      const result = await extractor.extract(buffer, 'test.jpg');
      
      expect(result.palette).toBeDefined();
      expect(result.palette.length).toBeGreaterThan(0);
      expect(result.metadata.fileType).toBe('image');
    });
  });

  describe('Color Processing', () => {
    it('should limit colors to maxColours setting', async () => {
      const limitedExtractor = new PaletteExtractor({ maxColours: 3 });
      const buffer = new ArrayBuffer(1024);
      
      const result = await limitedExtractor.extract(buffer, 'test.png');
      
      expect(result.palette.length).toBeLessThanOrEqual(3);
    });

    it('should filter colors below minAreaPct', async () => {
      const strictExtractor = new PaletteExtractor({ minAreaPct: 10 });
      const buffer = new ArrayBuffer(1024);
      
      const result = await strictExtractor.extract(buffer, 'test.png');
      
      result.palette.forEach(color => {
        expect(color.areaPct).toBeGreaterThanOrEqual(10);
      });
    });

    it('should return colors with proper structure', async () => {
      const buffer = new ArrayBuffer(1024);
      
      const result = await extractor.extract(buffer, 'test.png');
      
      expect(result.palette[0]).toMatchObject({
        id: expect.any(String),
        rgb: expect.objectContaining({
          R: expect.any(Number),
          G: expect.any(Number),
          B: expect.any(Number)
        }),
        lab: expect.objectContaining({
          L: expect.any(Number),
          a: expect.any(Number),
          b: expect.any(Number)
        }),
        areaPct: expect.any(Number),
        source: expect.stringMatching(/^(pdf|raster)$/)
      });
    });
  });

  describe('Caching', () => {
    it('should cache extraction results', async () => {
      const buffer = new ArrayBuffer(1024);
      const filename = 'test-cache.png';
      
      // First extraction
      const result1 = await extractor.extract(buffer, filename);
      
      // Second extraction should be cached (same file)
      const result2 = await extractor.extract(buffer, filename);
      
      expect(result1.palette).toEqual(result2.palette);
    });
  });

  describe('Error Handling', () => {
    it('should provide fallback colors when extraction fails', async () => {
      // Mock all extraction methods to fail
      vi.mocked(require('sharp').default).mockImplementationOnce(() => {
        throw new Error('Sharp processing failed');
      });
      
      const buffer = new ArrayBuffer(1024);
      
      const result = await extractor.extract(buffer, 'test.png');
      
      expect(result.palette).toBeDefined();
      expect(result.palette.length).toBeGreaterThan(0);
      expect(result.warnings).toBeDefined();
    });

    it('should handle empty results gracefully', async () => {
      // Mock kmeans to return empty results
      vi.mocked(require('kmeans-js').default).mockImplementationOnce(() => []);
      
      const buffer = new ArrayBuffer(1024);
      
      const result = await extractor.extract(buffer, 'test.png');
      
      expect(result.palette).toBeDefined();
      expect(result.palette.length).toBeGreaterThan(0); // Should provide fallback
    });
  });

  describe('Metadata', () => {
    it('should return extraction metadata', async () => {
      const buffer = new ArrayBuffer(1024);
      
      const result = await extractor.extract(buffer, 'test.pdf');
      
      expect(result.metadata).toMatchObject({
        filename: 'test.pdf',
        fileSize: 1024,
        fileType: 'pdf',
        extractionTime: expect.any(Number),
        complexity: expect.stringMatching(/^(low|medium|high)$/),
        sources: expect.any(Array),
        totalColours: expect.objectContaining({
          combined: expect.any(Number)
        })
      });
    });

    it('should measure extraction time accurately', async () => {
      const buffer = new ArrayBuffer(1024);
      
      const startTime = Date.now();
      const result = await extractor.extract(buffer, 'test.png');
      const endTime = Date.now();
      
      expect(result.metadata.extractionTime).toBeGreaterThanOrEqual(0);
      expect(result.metadata.extractionTime).toBeLessThanOrEqual(endTime - startTime + 100);
    });
  });

  describe('Progressive Loading', () => {
    it('should call progress callback during extraction', async () => {
      const progressCallback = vi.fn();
      const mockLoader = {
        updateProgress: progressCallback,
        complete: vi.fn()
      };
      
      const buffer = new ArrayBuffer(1024);
      
      await extractor.extract(buffer, 'test.png', mockLoader as any);
      
      expect(progressCallback).toHaveBeenCalled();
      expect(mockLoader.complete).toHaveBeenCalled();
    });
  });
});

describe('Color Space Utilities', () => {
  it('should generate consistent color IDs', () => {
    const { generateColourId } = require('../utils');
    
    const rgb: RGB = { R: 255, G: 0, B: 0 };
    const id1 = generateColourId(rgb, 'test');
    const id2 = generateColourId(rgb, 'test');
    
    expect(id1).toBe(id2);
    expect(id1).toMatch(/^test_/);
  });

  it('should validate file types correctly', () => {
    const { validateFileType } = require('../utils');
    
    expect(validateFileType('test.pdf')).toEqual({
      isValid: true,
      type: 'pdf',
      format: 'pdf'
    });
    
    expect(validateFileType('test.png')).toEqual({
      isValid: true,
      type: 'image',
      format: 'png'
    });
    
    expect(validateFileType('test.txt')).toEqual({
      isValid: false,
      type: null
    });
  });

  it('should estimate complexity correctly', () => {
    const { estimateExtractionComplexity } = require('../utils');
    
    const MB = 1024 * 1024;
    
    expect(estimateExtractionComplexity(1 * MB, 'pdf')).toBe('low');
    expect(estimateExtractionComplexity(5 * MB, 'pdf')).toBe('medium');
    expect(estimateExtractionComplexity(15 * MB, 'pdf')).toBe('high');
    
    expect(estimateExtractionComplexity(0.5 * MB, 'image')).toBe('low');
    expect(estimateExtractionComplexity(3 * MB, 'image')).toBe('medium');
    expect(estimateExtractionComplexity(10 * MB, 'image')).toBe('high');
  });
});