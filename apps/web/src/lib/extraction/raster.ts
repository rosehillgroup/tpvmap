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
    
    console.info(`K-means input: ${data.length} pixels, requesting ${k} clusters`);
    
    // Sample pixels if we have too many for performance
    const sampleSize = Math.min(data.length, 5000);
    const sampledData = data.length > sampleSize 
      ? this.sampleArray(data, sampleSize) 
      : data;
      
    console.info(`Using ${sampledData.length} sampled pixels`);
    
    // Reduce k if we have fewer unique colors than requested clusters
    const uniqueColors = new Set(sampledData.map(rgb => `${rgb[0]},${rgb[1]},${rgb[2]}`));
    const actualK = Math.min(k, uniqueColors.size, Math.floor(sampledData.length / 10));
    
    console.info(`Unique colors: ${uniqueColors.size}, actualK: ${actualK}`);
    
    if (actualK <= 1) {
      // Handle edge case: single color or no colors
      const avgColor = this.calculateAverageColor(pixels);
      console.info('Single color case, using average:', avgColor);
      return [{
        centroid: [avgColor.R, avgColor.G, avgColor.B],
        cluster: data
      }];
    }

    try {
      // Perform k-means clustering with more robust parameters
      console.info(`Running k-means with k=${actualK}, iterations=${this.options.iterations}`);
      
      const result = kmeans(sampledData, actualK, {
        maxIterations: this.options.iterations,
        tolerance: 2.0
      });
      
      console.info(`K-means result:`, result ? `${result.length} clusters` : 'null result');
      
      if (!result || result.length === 0) {
        throw new Error('K-means returned empty result');
      }
      
      // Map sampled results back to full dataset
      return result.map(cluster => ({
        centroid: cluster.centroid,
        cluster: data.filter(pixel => 
          this.findClosestCluster([pixel], result.map(c => c.centroid)) === cluster.centroid
        )
      }));
      
    } catch (error) {
      console.warn('K-means clustering failed, using fallback method:', error);
      
      // Better fallback: use simple color quantization
      return this.simpleDominantColors(pixels, k);
    }
  }
  
  private sampleArray<T>(array: T[], sampleSize: number): T[] {
    if (array.length <= sampleSize) return array;
    
    const step = array.length / sampleSize;
    const sampled: T[] = [];
    
    for (let i = 0; i < array.length; i += step) {
      sampled.push(array[Math.floor(i)]);
    }
    
    return sampled.slice(0, sampleSize);
  }
  
  private findClosestCluster(pixel: number[][], centroids: number[][]): number[] {
    let minDistance = Infinity;
    let closestCentroid = centroids[0];
    
    for (const centroid of centroids) {
      const distance = Math.sqrt(
        Math.pow(pixel[0][0] - centroid[0], 2) +
        Math.pow(pixel[0][1] - centroid[1], 2) +
        Math.pow(pixel[0][2] - centroid[2], 2)
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        closestCentroid = centroid;
      }
    }
    
    return closestCentroid;
  }
  
  private simpleDominantColors(pixels: RGB[], k: number): any[] {
    // Simple fallback: quantize colors into buckets
    console.info('Using simple color quantization fallback');
    
    const colorCounts = new Map<string, { count: number; rgb: RGB }>();
    
    // Quantize colors to reduce noise (use smaller quantization for better accuracy)
    for (const pixel of pixels) {
      const quantized = {
        R: Math.floor(pixel.R / 8) * 8,
        G: Math.floor(pixel.G / 8) * 8,
        B: Math.floor(pixel.B / 8) * 8
      };
      
      const key = `${quantized.R},${quantized.G},${quantized.B}`;
      const existing = colorCounts.get(key);
      
      if (existing) {
        existing.count++;
      } else {
        colorCounts.set(key, { count: 1, rgb: quantized });
      }
    }
    
    // Get top k colors by frequency
    const sortedColors = Array.from(colorCounts.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, k);
      
    console.info(`Simple quantization found ${sortedColors.length} dominant colors`);
    
    return sortedColors.map(([key, data]) => ({
      centroid: [data.rgb.R, data.rgb.G, data.rgb.B],
      cluster: pixels.filter(p => {
        const quantized = {
          R: Math.floor(p.R / 8) * 8,
          G: Math.floor(p.G / 8) * 8,
          B: Math.floor(p.B / 8) * 8
        };
        return `${quantized.R},${quantized.G},${quantized.B}` === key;
      }).map(p => [p.R, p.G, p.B])
    }));
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
  ): Promise<any | null> {
    try {
      // Dynamic import for server-side rendering
      const { createCanvas } = await import('canvas');
      
      const viewport = pdfPage.getViewport({ scale });
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await pdfPage.render(renderContext).promise;
      return canvas;
    } catch (error) {
      console.error('Failed to render PDF page to canvas:', error);
      return null;
    }
  }
}