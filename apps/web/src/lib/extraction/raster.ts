import sharp from 'sharp';
import kmeans from 'kmeans-js';
import type { RGB } from '../colour/types';
import { sRGBToLinearRGB, linearRGBToXYZ, xyzToLab, type Lab } from '../colour/convert';

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
    const startTime = Date.now();
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

      // Convert clusters to color results with logging
      const colours: RasterColour[] = clusters
        .map((cluster, index) => {
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

      // Log final palette stats
      const duration = Date.now() - startTime;
      console.info(`Final palette: ${colours.length} colors, top 5 areas: ${colours.slice(0, 5).map(c => c.percentage.toFixed(1) + '%').join(', ')}`);
      console.info(`Extraction completed in ${duration}ms`);

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
    console.info(`K-means input: ${pixels.length} pixels, requesting ${k} clusters`);
    
    // Convert RGB pixels to Lab color space for better clustering
    const labPixels: Lab[] = [];
    let nanCount = 0;
    
    for (const pixel of pixels) {
      try {
        const linearRGB = sRGBToLinearRGB(pixel);
        const xyz = linearRGBToXYZ(linearRGB);
        const lab = xyzToLab(xyz);
        
        // Guard against NaN values
        if (isNaN(lab.L) || isNaN(lab.a) || isNaN(lab.b)) {
          nanCount++;
          continue;
        }
        
        labPixels.push(lab);
      } catch (error) {
        nanCount++;
        continue;
      }
    }
    
    if (nanCount > 0) {
      console.info(`NaN dropped: ${nanCount}`);
    }
    
    if (labPixels.length === 0) {
      console.warn('No valid Lab pixels, using RGB fallback');
      return this.simpleDominantColors(pixels, k);
    }
    
    // Sample pixels if we have too many for performance
    const sampleSize = Math.min(labPixels.length, 5000);
    const sampledLab = labPixels.length > sampleSize 
      ? this.sampleArray(labPixels, sampleSize) 
      : labPixels;
      
    console.info(`Using ${sampledLab.length} sampled pixels`);
    
    // Adaptive k selection based on complexity
    const actualK = this.calculateOptimalK(sampledLab, k);
    console.info(`Adjusted k from ${k} to ${actualK}`);
    
    if (actualK <= 1) {
      const avgColor = this.calculateAverageColor(pixels);
      console.info('Single color case, using average:', avgColor);
      return [{
        centroid: [avgColor.R, avgColor.G, avgColor.B],
        cluster: pixels.map(p => [p.R, p.G, p.B])
      }];
    }

    // Try k-means with retry logic
    const MAX_RETRIES = 3;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        console.info(`K-means attempt ${attempt + 1}/${MAX_RETRIES} with k=${actualK}`);
        
        const labData = sampledLab.map(lab => [lab.L, lab.a, lab.b]);
        
        const result = kmeans(labData, actualK, {
          maxIterations: this.options.iterations,
          tolerance: 1.0,
          seed: Date.now() + attempt * 1000 // Different seed per attempt
        });
        
        if (!result || result.length === 0) {
          throw new Error(`K-means returned empty result on attempt ${attempt + 1}`);
        }
        
        console.info(`K-means attempt ${attempt + 1}: success with ${result.length} clusters`);
        
        // Convert Lab centroids back to RGB and map to full dataset
        return this.convertLabClustersToRGB(result, pixels, labPixels);
        
      } catch (error) {
        console.warn(`K-means attempt ${attempt + 1} failed:`, error.message);
        if (attempt === MAX_RETRIES - 1) {
          console.warn('All k-means attempts failed, using fallback method');
          return this.simpleDominantColors(pixels, actualK);
        }
      }
    }
    
    // This should never be reached, but TypeScript safety
    return this.simpleDominantColors(pixels, actualK);
  }

  /**
   * Calculate optimal k based on image complexity using adaptive formula
   */
  private calculateOptimalK(labPixels: Lab[], requestedK: number): number {
    // Count unique colors in quantized Lab space
    const quantizedSet = new Set<string>();
    for (const lab of labPixels) {
      const quantizedL = Math.round(lab.L / 4) * 4;
      const quantizedA = Math.round(lab.a / 2) * 2;
      const quantizedB = Math.round(lab.b / 2) * 2;
      quantizedSet.add(`${quantizedL},${quantizedA},${quantizedB}`);
    }
    
    const uniqueColors = quantizedSet.size;
    
    // Adaptive k selection
    if (uniqueColors < 64) {
      // Posterized image - use fewer clusters
      return Math.min(uniqueColors, 10, requestedK);
    } else {
      // Complex image - use adaptive formula
      const adaptiveK = Math.round(Math.sqrt(uniqueColors / 2));
      return Math.max(6, Math.min(adaptiveK, 18, requestedK));
    }
  }

  /**
   * Convert Lab clusters back to RGB and map to original pixels
   */
  private convertLabClustersToRGB(labClusters: any[], originalPixels: RGB[], labPixels: Lab[]): any[] {
    const rgbClusters: any[] = [];
    
    for (const cluster of labClusters) {
      const [L, a, b] = cluster.centroid;
      
      try {
        // Convert Lab centroid back to RGB
        const xyz = {
          X: 95.047 * Math.pow((L + 16) / 116 + a / 500, 3) / 100,
          Y: 100.000 * Math.pow((L + 16) / 116, 3) / 100,
          Z: 108.883 * Math.pow((L + 16) / 116 - b / 200, 3) / 100
        };
        
        // Convert XYZ to linear RGB
        const linearR = xyz.X * 3.2406 + xyz.Y * -1.5372 + xyz.Z * -0.4986;
        const linearG = xyz.X * -0.9689 + xyz.Y * 1.8758 + xyz.Z * 0.0415;
        const linearB = xyz.X * 0.0557 + xyz.Y * -0.2040 + xyz.Z * 1.0570;
        
        // Convert to sRGB
        const toSRGB = (c: number) => {
          c = Math.max(0, Math.min(1, c));
          return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
        };
        
        const rgb = {
          R: Math.round(toSRGB(linearR) * 255),
          G: Math.round(toSRGB(linearG) * 255),
          B: Math.round(toSRGB(linearB) * 255)
        };
        
        // Find pixels closest to this Lab centroid
        const clusterPixels: number[][] = [];
        for (let i = 0; i < labPixels.length; i++) {
          const labPixel = labPixels[i];
          const distance = Math.sqrt(
            Math.pow(labPixel.L - L, 2) +
            Math.pow(labPixel.a - a, 2) +
            Math.pow(labPixel.b - b, 2)
          );
          
          // Find original RGB pixel index
          let minDist = Infinity;
          let closestRGBIndex = 0;
          for (let j = 0; j < originalPixels.length; j++) {
            const rgbDist = Math.sqrt(
              Math.pow(originalPixels[j].R - rgb.R, 2) +
              Math.pow(originalPixels[j].G - rgb.G, 2) +
              Math.pow(originalPixels[j].B - rgb.B, 2)
            );
            if (rgbDist < minDist) {
              minDist = rgbDist;
              closestRGBIndex = j;
            }
          }
          
          clusterPixels.push([originalPixels[closestRGBIndex].R, originalPixels[closestRGBIndex].G, originalPixels[closestRGBIndex].B]);
        }
        
        rgbClusters.push({
          centroid: [rgb.R, rgb.G, rgb.B],
          cluster: clusterPixels.length > 0 ? clusterPixels : [[rgb.R, rgb.G, rgb.B]]
        });
        
      } catch (error) {
        console.warn('Failed to convert Lab cluster to RGB:', error);
        // Fallback: use average of original pixels
        const avgColor = this.calculateAverageColor(originalPixels);
        rgbClusters.push({
          centroid: [avgColor.R, avgColor.G, avgColor.B],
          cluster: originalPixels.map(p => [p.R, p.G, p.B])
        });
      }
    }
    
    return rgbClusters;
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
    // Simple fallback: quantize colors into buckets with better merging
    console.info('Using simple color quantization fallback');
    
    const colorCounts = new Map<string, { count: number; rgb: RGB; lab?: Lab }>();
    const totalPixels = pixels.length;
    
    // Quantize colors to reduce noise (finer quantization for better accuracy)
    for (const pixel of pixels) {
      const quantized = {
        R: Math.floor(pixel.R / 6) * 6, // Finer quantization
        G: Math.floor(pixel.G / 6) * 6,
        B: Math.floor(pixel.B / 6) * 6
      };
      
      const key = `${quantized.R},${quantized.G},${quantized.B}`;
      const existing = colorCounts.get(key);
      
      if (existing) {
        existing.count++;
      } else {
        // Pre-compute Lab for merging
        let lab: Lab | undefined;
        try {
          const linearRGB = sRGBToLinearRGB(quantized);
          const xyz = linearRGBToXYZ(linearRGB);
          lab = xyzToLab(xyz);
        } catch (error) {
          // Leave lab undefined if conversion fails
        }
        
        colorCounts.set(key, { count: 1, rgb: quantized, lab });
      }
    }
    
    // Convert to array with percentage calculations
    let clusters = Array.from(colorCounts.entries()).map(([key, data]) => ({
      key,
      rgb: data.rgb,
      lab: data.lab,
      count: data.count,
      percentage: (data.count / totalPixels) * 100
    }));
    
    console.info(`Pre-merge: ${clusters.length} quantized colors`);
    
    // Smart merging with Lab-based distance and area weighting
    clusters = this.mergeNearbyColors(clusters);
    
    // Sort by frequency and take top k
    const finalClusters = clusters
      .sort((a, b) => b.count - a.count)
      .slice(0, k);
      
    console.info(`Post-merge: ${finalClusters.length} final colors`);
    
    // Convert back to kmeans format
    return finalClusters.map(cluster => ({
      centroid: [cluster.rgb.R, cluster.rgb.G, cluster.rgb.B],
      cluster: pixels.filter(p => {
        const quantized = {
          R: Math.floor(p.R / 6) * 6,
          G: Math.floor(p.G / 6) * 6,
          B: Math.floor(p.B / 6) * 6
        };
        return `${quantized.R},${quantized.G},${quantized.B}` === cluster.key;
      }).map(p => [p.R, p.G, p.B])
    }));
  }

  /**
   * Merge nearby colors with improved thresholds and hue boundary protection
   */
  private mergeNearbyColors(clusters: Array<{ key: string; rgb: RGB; lab?: Lab; count: number; percentage: number }>) {
    const MERGE_DE = 1.5; // Lower threshold for vivid artwork
    const MIN_CLUSTER_AREA = 0.75; // 0.75% minimum area
    const MAX_HUE_DIFF = 8; // Prevent merging across hue boundaries
    
    // Sort by area (largest first) for area-weighted merging
    clusters.sort((a, b) => b.percentage - a.percentage);
    
    const kept: typeof clusters = [];
    
    for (const candidate of clusters) {
      let merged = false;
      
      // Only merge small clusters into larger ones
      if (candidate.percentage >= MIN_CLUSTER_AREA) {
        kept.push(candidate);
        continue;
      }
      
      // Try to merge with existing kept clusters
      for (const keeper of kept) {
        if (!candidate.lab || !keeper.lab) {
          // Skip if Lab conversion failed
          continue;
        }
        
        // Calculate Lab deltaE distance
        const deltaE = Math.sqrt(
          Math.pow(candidate.lab.L - keeper.lab.L, 2) +
          Math.pow(candidate.lab.a - keeper.lab.a, 2) +
          Math.pow(candidate.lab.b - keeper.lab.b, 2)
        );
        
        // Check hue boundary protection
        const dA = Math.abs(candidate.lab.a - keeper.lab.a);
        const dB = Math.abs(candidate.lab.b - keeper.lab.b);
        
        if (deltaE <= MERGE_DE && dA <= MAX_HUE_DIFF && dB <= MAX_HUE_DIFF) {
          // Area-weighted merge
          const totalArea = keeper.percentage + candidate.percentage;
          const totalCount = keeper.count + candidate.count;
          
          // Weighted average of RGB values
          keeper.rgb = {
            R: Math.round((keeper.rgb.R * keeper.count + candidate.rgb.R * candidate.count) / totalCount),
            G: Math.round((keeper.rgb.G * keeper.count + candidate.rgb.G * candidate.count) / totalCount),
            B: Math.round((keeper.rgb.B * keeper.count + candidate.rgb.B * candidate.count) / totalCount)
          };
          
          // Weighted average of Lab values
          keeper.lab = {
            L: (keeper.lab.L * keeper.percentage + candidate.lab.L * candidate.percentage) / totalArea,
            a: (keeper.lab.a * keeper.percentage + candidate.lab.a * candidate.percentage) / totalArea,
            b: (keeper.lab.b * keeper.percentage + candidate.lab.b * candidate.percentage) / totalArea
          };
          
          keeper.count = totalCount;
          keeper.percentage = totalArea;
          merged = true;
          break;
        }
      }
      
      if (!merged) {
        kept.push(candidate);
      }
    }
    
    return kept;
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

}