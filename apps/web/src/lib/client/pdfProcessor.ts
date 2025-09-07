// Client-side PDF processing utilities
// Uses browser's native canvas - no server dependencies

// PDF.js will be loaded dynamically in each function to avoid server-side imports

export interface PDFThumbnailResult {
  thumbnailBlob: Blob;
  width: number;
  height: number;
  renderTime: number;
}

export interface PDFRasterSample {
  page: number;
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
}

/**
 * Generate a thumbnail from the first page of a PDF using browser canvas
 */
export async function generatePDFThumbnail(
  file: File, 
  maxSize: number = 200
): Promise<PDFThumbnailResult | null> {
  const startTime = Date.now();
  
  try {
    console.info('Starting PDF thumbnail generation...');
    
    // Dynamic import to avoid server-side loading
    const pdfjsLib = await import('pdfjs-dist');
    console.info('PDF.js loaded, version:', pdfjsLib.version);
    
    // Disable worker to avoid CORS issues - PDF.js will run in main thread
    pdfjsLib.GlobalWorkerOptions.workerSrc = null;
    console.info('PDF.js worker disabled to avoid CORS issues');
    
    const arrayBuffer = await file.arrayBuffer();
    console.info('PDF file read, size:', arrayBuffer.byteLength);
    
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    console.info('PDF document loaded, pages:', pdf.numPages);
    
    if (pdf.numPages === 0) {
      throw new Error('PDF has no pages');
    }
    
    // Get first page
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.0 });
    console.info('Page viewport:', viewport.width, 'x', viewport.height);
    
    // Calculate scale to fit within maxSize while maintaining aspect ratio
    const scale = Math.min(maxSize / viewport.width, maxSize / viewport.height);
    const scaledViewport = page.getViewport({ scale });
    
    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = scaledViewport.width;
    canvas.height = scaledViewport.height;
    
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not get canvas context');
    }
    
    // Render PDF page to canvas
    const renderContext = {
      canvasContext: context,
      viewport: scaledViewport
    };
    
    await page.render(renderContext).promise;
    
    // Convert canvas to blob
    const thumbnailBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create thumbnail blob'));
        }
      }, 'image/png', 0.8);
    });
    
    return {
      thumbnailBlob,
      width: viewport.width,
      height: viewport.height,
      renderTime: Date.now() - startTime
    };
  } catch (error) {
    console.error('Failed to generate PDF thumbnail:', error);
    return null;
  }
}

/**
 * Extract raster samples from PDF pages for color analysis
 * This provides high-quality color data that complements server-side vector extraction
 */
export async function extractPDFRasterSamples(
  file: File,
  maxPages: number = 5,
  maxPixels: number = 200000
): Promise<PDFRasterSample[]> {
  try {
    // Dynamic import to avoid server-side loading
    const pdfjsLib = await import('pdfjs-dist');
    
    // Disable worker to avoid CORS issues - PDF.js will run in main thread
    pdfjsLib.GlobalWorkerOptions.workerSrc = null;
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    const samples: PDFRasterSample[] = [];
    const pagesToProcess = Math.min(pdf.numPages, maxPages);
    
    for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
      const page = await pdf.getPage(pageNum);
      
      // Render at higher DPI for better color sampling
      const scale = 2.0; // ~150-200 DPI depending on viewport
      const viewport = page.getViewport({ scale });
      
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      const context = canvas.getContext('2d');
      if (!context) {
        console.warn(`Could not get canvas context for page ${pageNum}`);
        continue;
      }
      
      // Render page
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
      
      // Downsample to cap pixels if needed
      const totalPixels = canvas.width * canvas.height;
      let finalCanvas = canvas;
      
      if (totalPixels > maxPixels) {
        const ratio = Math.sqrt(maxPixels / totalPixels);
        const newWidth = Math.max(1, Math.round(canvas.width * ratio));
        const newHeight = Math.max(1, Math.round(canvas.height * ratio));
        
        const resizedCanvas = document.createElement('canvas');
        resizedCanvas.width = newWidth;
        resizedCanvas.height = newHeight;
        
        const resizedContext = resizedCanvas.getContext('2d');
        if (resizedContext) {
          resizedContext.drawImage(canvas, 0, 0, newWidth, newHeight);
          finalCanvas = resizedCanvas;
        }
      }
      
      // Extract image data
      const finalContext = finalCanvas.getContext('2d');
      if (finalContext) {
        const imageData = finalContext.getImageData(0, 0, finalCanvas.width, finalCanvas.height);
        
        samples.push({
          page: pageNum,
          rgba: imageData.data,
          width: finalCanvas.width,
          height: finalCanvas.height
        });
      }
    }
    
    return samples;
  } catch (error) {
    console.error('Failed to extract PDF raster samples:', error);
    return [];
  }
}

/**
 * Upload PDF thumbnail to server for storage
 */
export async function uploadPDFThumbnail(
  jobId: string, 
  thumbnailBlob: Blob
): Promise<boolean> {
  try {
    const formData = new FormData();
    formData.append('thumbnail', thumbnailBlob, `${jobId}-page-1.png`);
    formData.append('jobId', jobId);
    
    const response = await fetch('/api/upload-thumbnail', {
      method: 'POST',
      body: formData
    });
    
    return response.ok;
  } catch (error) {
    console.error('Failed to upload PDF thumbnail:', error);
    return false;
  }
}

/**
 * Extract colors from PDF using client-side raster analysis and upload to server
 */
export async function extractAndUploadPDFColors(
  file: File,
  jobId: string
): Promise<boolean> {
  try {
    console.info('Starting PDF color extraction...');
    
    const rasterSamples = await extractPDFRasterSamples(file, 3, 100000); // Process up to 3 pages, max 100k pixels
    
    if (rasterSamples.length === 0) {
      console.warn('No raster samples extracted from PDF');
      return false;
    }
    
    // Simple color quantization on the raster data
    const colorMap = new Map<string, { count: number; rgb: { R: number; G: number; B: number }; page: number }>();
    
    for (const sample of rasterSamples) {
      // Sample pixels to reduce processing time
      const step = Math.max(1, Math.floor(sample.rgba.length / (4 * 2000))); // Sample ~2000 pixels max per page
      
      for (let i = 0; i < sample.rgba.length; i += 4 * step) {
        const r = sample.rgba[i];
        const g = sample.rgba[i + 1]; 
        const b = sample.rgba[i + 2];
        const a = sample.rgba[i + 3];
        
        // Skip transparent pixels
        if (a < 128) continue;
        
        // Quantize to reduce noise (group similar colors)
        const qr = Math.floor(r / 8) * 8;
        const qg = Math.floor(g / 8) * 8; 
        const qb = Math.floor(b / 8) * 8;
        
        const key = `${qr},${qg},${qb}`;
        const existing = colorMap.get(key);
        
        if (existing) {
          existing.count++;
        } else {
          colorMap.set(key, {
            count: 1,
            rgb: { R: qr, G: qg, B: qb },
            page: sample.page
          });
        }
      }
    }
    
    // Convert to percentage-based colors
    const totalPixelsSampled = rasterSamples.reduce((sum, sample) => 
      sum + Math.floor(sample.rgba.length / (4 * Math.max(1, Math.floor(sample.rgba.length / (4 * 2000))))), 0
    );
    
    const colors = Array.from(colorMap.entries())
      .map(([key, data]) => ({
        rgb: data.rgb,
        percentage: (data.count / totalPixelsSampled) * 100,
        page: data.page
      }))
      .filter(c => c.percentage >= 0.5) // Only keep colors that are at least 0.5%
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 20); // Keep top 20 colors
    
    console.info(`Extracted ${colors.length} colors from PDF raster data:`, 
      colors.slice(0, 5).map(c => `RGB(${c.rgb.R},${c.rgb.G},${c.rgb.B}) ${c.percentage.toFixed(1)}%`));
    
    // Upload to server
    const formData = new FormData();
    formData.append('jobId', jobId);
    formData.append('colors', JSON.stringify(colors));
    
    const response = await fetch('/api/upload-raster-colors', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      console.error('Failed to upload raster colors:', response.statusText);
      return false;
    }
    
    console.info('Successfully uploaded PDF raster colors to server');
    return true;
  } catch (error) {
    console.error('Failed to extract and upload PDF colors:', error);
    return false;
  }
}