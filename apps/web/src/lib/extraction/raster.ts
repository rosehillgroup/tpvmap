import { createCanvas, loadImage, ImageData } from 'canvas';
import sharp from 'sharp';
import kmeans from 'kmeans-js';
import type { RGB } from '../colour/types';

export interface RasterColour {
  rgb: RGB;
  pixels: number;
  percentage: number;
}

export interface RasterExtractionResult {
  colours: RasterColour[];
  metadata: {
    width: number;
    height: number;
    totalPixels: number;
    format: string;
  };
}

export interface RasterExtractionOptions {
  maxColours?: number;
  minPercentage?: number;
  resampleSize?: number;
  iterations?: number;
}

export class RasterExtractor {
  private options: Required<RasterExtractionOptions>;

  constructor(options: RasterExtractionOptions = {}) {
    this.options = {
      maxColours: options.maxColours ?? 20,
      minPercentage: options.minPercentage ?? 0.5,
      resampleSize: options.resampleSize ?? 400,
      iterations: options.iterations ?? 20
    };
  }

  async extract(imageBuffer: ArrayBuffer, format: string): Promise<RasterExtractionResult> {
    try {
      // Use Sharp for efficient image processing
      const image = sharp(Buffer.from(imageBuffer));
      const metadata = await image.metadata();
      
      if (!metadata.width || !metadata.height) {
        throw new Error('Invalid image dimensions');
      }

      // Resize for performance while maintaining aspect ratio
      const maxDim = Math.max(metadata.width, metadata.height);
      const scaleFactor = maxDim > this.options.resampleSize 
        ? this.options.resampleSize / maxDim 
        : 1;
      
      const resizedWidth = Math.round(metadata.width * scaleFactor);
      const resizedHeight = Math.round(metadata.height * scaleFactor);

      // Convert to RGB and get raw pixel data
      const { data, info } = await image
        .resize(resizedWidth, resizedHeight, { 
          kernel: sharp.kernel.lanczos3,
          fit: 'fill'
        })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Extract pixel colors
      const pixels: RGB[] = [];
      for (let i = 0; i < data.length; i += 3) {
        pixels.push({
          R: data[i],
          G: data[i + 1],
          B: data[i + 2]
        });
      }

      // Perform k-means clustering
      const clusters = this.performKMeans(pixels, this.options.maxColours);
      const totalPixels = pixels.length;

      // Convert clusters to color results
      const colours: RasterColour[] = clusters
        .map(cluster => {
          const centroid = cluster.centroid;
          const rgb: RGB = {
            R: Math.round(Math.max(0, Math.min(255, centroid[0]))),
            G: Math.round(Math.max(0, Math.min(255, centroid[1]))),
            B: Math.round(Math.max(0, Math.min(255, centroid[2])))
          };
          
          const pixels = cluster.cluster.length;
          const percentage = (pixels / totalPixels) * 100;

          return {
            rgb,
            pixels,
            percentage
          };
        })
        .filter(c => c.percentage >= this.options.minPercentage)
        .sort((a, b) => b.percentage - a.percentage);

      return {
        colours,
        metadata: {
          width: metadata.width,
          height: metadata.height,
          totalPixels: metadata.width * metadata.height,
          format: format
        }
      };
    } catch (error) {
      throw new Error(`Raster extraction failed: ${error.message}`);
    }
  }

  async extractFromCanvas(canvas: HTMLCanvasElement): Promise<RasterExtractionResult> {
    try {
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels: RGB[] = [];

      // Extract RGB values from ImageData
      for (let i = 0; i < imageData.data.length; i += 4) {
        pixels.push({
          R: imageData.data[i],
          G: imageData.data[i + 1],
          B: imageData.data[i + 2]
          // Skip alpha channel (i + 3)
        });
      }

      // Perform k-means clustering
      const clusters = this.performKMeans(pixels, this.options.maxColours);
      const totalPixels = pixels.length;

      // Convert clusters to color results
      const colours: RasterColour[] = clusters
        .map(cluster => {
          const centroid = cluster.centroid;
          const rgb: RGB = {
            R: Math.round(Math.max(0, Math.min(255, centroid[0]))),
            G: Math.round(Math.max(0, Math.min(255, centroid[1]))),
            B: Math.round(Math.max(0, Math.min(255, centroid[2])))
          };
          
          const pixelCount = cluster.cluster.length;
          const percentage = (pixelCount / totalPixels) * 100;

          return {
            rgb,
            pixels: pixelCount,
            percentage
          };
        })
        .filter(c => c.percentage >= this.options.minPercentage)
        .sort((a, b) => b.percentage - a.percentage);

      return {
        colours,
        metadata: {
          width: canvas.width,
          height: canvas.height,
          totalPixels,
          format: 'canvas'
        }
      };
    } catch (error) {
      throw new Error(`Canvas extraction failed: ${error.message}`);
    }
  }

  private performKMeans(pixels: RGB[], k: number): any[] {
    // Convert RGB pixels to array format for kmeans-js
    const data = pixels.map(pixel => [pixel.R, pixel.G, pixel.B]);
    
    // Reduce k if we have fewer unique colors than requested clusters
    const uniqueColors = new Set(data.map(rgb => `${rgb[0]},${rgb[1]},${rgb[2]}`));
    const actualK = Math.min(k, uniqueColors.size, data.length);
    
    if (actualK <= 1) {
      // Handle edge case: single color or no colors
      const avgColor = this.calculateAverageColor(pixels);
      return [{
        centroid: [avgColor.R, avgColor.G, avgColor.B],
        cluster: data
      }];
    }

    try {
      // Perform k-means clustering
      const result = kmeans(data, actualK, {
        maxIterations: this.options.iterations,
        tolerance: 1.0
      });
      
      return result || [];
    } catch (error) {
      console.warn('K-means clustering failed, falling back to dominant color:', error);
      
      // Fallback: return single dominant color
      const avgColor = this.calculateAverageColor(pixels);
      return [{
        centroid: [avgColor.R, avgColor.G, avgColor.B],
        cluster: data
      }];
    }
  }

  private calculateAverageColor(pixels: RGB[]): RGB {
    if (pixels.length === 0) {
      return { R: 0, G: 0, B: 0 };
    }

    const sum = pixels.reduce(
      (acc, pixel) => ({
        R: acc.R + pixel.R,
        G: acc.G + pixel.G,
        B: acc.B + pixel.B
      }),
      { R: 0, G: 0, B: 0 }
    );

    return {
      R: Math.round(sum.R / pixels.length),
      G: Math.round(sum.G / pixels.length),
      B: Math.round(sum.B / pixels.length)
    };
  }

  async renderPDFPageToCanvas(
    pdfPage: any,
    scale: number = 1
  ): Promise<HTMLCanvasElement | null> {
    try {
      const viewport = pdfPage.getViewport({ scale });
      
      // Create canvas for server-side rendering
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await pdfPage.render(renderContext).promise;
      return canvas as any; // Type assertion for compatibility
    } catch (error) {
      console.error('Failed to render PDF page to canvas:', error);
      return null;
    }
  }
}