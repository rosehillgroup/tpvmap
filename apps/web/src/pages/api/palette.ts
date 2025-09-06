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

export async function GET(context: any) {

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
      // Extract colors from the uploaded file
      const jobData: JobData = JSON.parse(jobDataStr);
      
      // Get the uploaded file from storage
      const fileExtension = jobData.fileName.split('.').pop()?.toLowerCase();
      const uploadedFile = await store.get(`uploads/${jobId}.${fileExtension}`, { type: 'arrayBuffer' });
      
      if (!uploadedFile) {
        return Response.json({ error: 'Uploaded file not found' }, { status: 404 });
      }

      console.info(`Extracting palette for ${jobData.fileName} (${uploadedFile.byteLength} bytes)`);
      
      // Initialize palette extractor
      const extractor = new PaletteExtractor({
        maxColours: 12,
        minAreaPct: 1.0,
        rasterOptions: {
          resampleSize: 400,
          iterations: 15
        }
      });
      
      try {
        const result = await extractor.extract(uploadedFile, jobData.fileName);
        console.info(`Extracted ${result.palette.length} colors in ${result.metadata.extractionTime}ms`);
        
        // Convert to our PaletteEntry format
        palette = result.palette.map(color => ({
          id: color.id,
          rgb: color.rgb,
          lab: color.lab,
          areaPct: color.areaPct,
          pageIds: color.pageIds || [1],
          source: color.source,
          metadata: color.metadata
        }));
        
        // Cache the palette with extraction metadata
        await store.set(`palettes/${jobId}.json`, JSON.stringify({
          palette,
          extractionMetadata: result.metadata,
          warnings: result.warnings,
          extractedAt: new Date().toISOString()
        }));
        
      } catch (error) {
        console.error('Color extraction failed:', error);
        return Response.json({ 
          error: 'Color extraction failed', 
          details: error instanceof Error ? error.message : String(error) 
        }, { status: 500 });
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