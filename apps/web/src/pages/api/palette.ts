import { getStore } from '@netlify/blobs';
import { PaletteExtractor } from '../../lib/extraction/extractor';

export const prerender = false;

interface PaletteEntry {
  id: string;
  rgb: { R: number; G: number; B: number };
  lab: { L: number; a: number; b: number };
  areaPct: number;
  pageIds?: number[];
  source?: 'pdf' | 'raster';
  metadata?: any;
}

interface JobData {
  id: string;
  fileName: string;
  fileHash: string;
  uploadedAt: string;
  pages: any[];
}

export async function onRequest(context: any) {
  if (context.request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const url = new URL(context.request.url);
    const jobId = url.searchParams.get('jobId');
    const scope = url.searchParams.get('scope') || 'overall';
    const pageId = url.searchParams.get('pageId');
    
    if (!jobId) {
      return Response.json({ error: 'Missing jobId parameter' }, { status: 400 });
    }
    
    const store = getStore({ name: 'tpv-matcher' });
    
    // Check if job exists
    const jobDataStr = await store.get(`jobs/${jobId}.json`, { type: 'text' });
    if (!jobDataStr) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }
    
    // Check if we have a cached palette
    let palette: PaletteEntry[];
    const cachedPaletteStr = await store.get(`palettes/${jobId}.json`, { type: 'text' });
    
    if (cachedPaletteStr) {
      const cachedData = JSON.parse(cachedPaletteStr);
      // Handle both old simple cache format and new structured format
      palette = cachedData.palette || cachedData;
    } else {
      // Real palette extraction
      try {
        const jobData: JobData = JSON.parse(jobDataStr);
        
        // Get the original file from storage
        const fileData = await store.get(`uploads/${jobId}.${jobData.fileName.split('.').pop()}`, { type: 'arrayBuffer' });
        
        if (!fileData) {
          return Response.json({ error: 'Uploaded file not found' }, { status: 404 });
        }

        // Initialize the palette extractor with optimized settings for web deployment
        const extractor = new PaletteExtractor({
          maxColours: 15,
          minAreaPct: 1,
          combineStrategy: 'merge',
          rasterFallback: true,
          pdfOptions: {
            minFrequency: 3,
            tolerance: 8,
          },
          rasterOptions: {
            resampleSize: 400,
            iterations: 15,
          }
        });

        // Extract the palette
        const extractionResult = await extractor.extract(fileData, jobData.fileName);
        
        // Convert to our API format
        palette = extractionResult.palette.map(color => ({
          id: color.id,
          rgb: color.rgb,
          lab: color.lab,
          areaPct: color.areaPct,
          pageIds: color.pageIds,
          source: color.source,
          metadata: color.metadata
        }));

        // Cache the palette with extraction metadata
        const cacheData = {
          palette,
          extractionMetadata: extractionResult.metadata,
          warnings: extractionResult.warnings,
          extractedAt: new Date().toISOString()
        };
        
        await store.set(`palettes/${jobId}.json`, JSON.stringify(cacheData));

        // Also cache just the palette for compatibility
        await store.set(`palettes/${jobId}-simple.json`, JSON.stringify(palette));

      } catch (error) {
        console.error('Palette extraction failed:', error);
        
        // Fallback to mock data with warning
        palette = [
          {
            id: 'fallback-1',
            rgb: { R: 128, G: 128, B: 128 },
            lab: { L: 53.4, a: 0, b: 0 },
            areaPct: 100,
            pageIds: [1],
            source: 'raster' as const,
            metadata: { fallback: true, error: error.message }
          }
        ];
        
        // Cache fallback with error info
        const fallbackData = {
          palette,
          extractionMetadata: {
            filename: 'unknown',
            fileSize: 0,
            fileType: 'unknown' as const,
            extractionTime: 0,
            complexity: 'unknown' as const,
            sources: [],
            totalColours: { combined: 1 }
          },
          warnings: [`Extraction failed: ${error.message}`],
          extractedAt: new Date().toISOString(),
          isFallback: true
        };
        
        await store.set(`palettes/${jobId}.json`, JSON.stringify(fallbackData));
      }
    }
    
    // Filter by scope if needed
    let filteredPalette = palette;
    if (scope === 'page' && pageId) {
      const numericPageId = parseInt(pageId, 10);
      filteredPalette = palette.filter(entry => 
        entry.pageIds && entry.pageIds.includes(numericPageId)
      );
    }
    
    return Response.json({ palette: filteredPalette });
  } catch (error) {
    console.error('Palette error:', error);
    return Response.json({ error: 'Failed to get palette' }, { status: 500 });
  }
}