import { getStore } from '@netlify/blobs';

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
      
      try {
        // Dynamic import to avoid PDF.js import issues at module level
        const { PaletteExtractor } = await import('../../lib/extraction/extractor');
        
        // Initialize palette extractor with more sensitive settings
        const extractor = new PaletteExtractor({
          maxColours: 15,
          minAreaPct: 0.5,  // Capture colors that are at least 0.5% of image
          rasterOptions: {
            resampleSize: 400,
            iterations: 15,
            minPercentage: 0.5  // Also reduce at raster level
          }
        });
        
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
        
        // For PDFs, also check for client-side raster colors
        if (jobData.fileName.toLowerCase().endsWith('.pdf')) {
          try {
            const clientRasterStr = await store.get(`client-raster/${jobId}.json`, { type: 'text' });
            if (clientRasterStr) {
              const clientRasterData = JSON.parse(clientRasterStr);
              const clientColors = clientRasterData.colors || [];
              
              console.info(`Found ${clientColors.length} client-side raster colors for PDF`);
              
              // Convert client colors to palette format and add them
              const { ColourSpaceConverter } = await import('../../lib/extraction/utils');
              const converter = new ColourSpaceConverter();
              
              const clientPaletteEntries: PaletteEntry[] = clientColors.map((color: any, index: number) => ({
                id: `client-${index}`,
                rgb: color.rgb,
                lab: converter.rgbToLab(color.rgb),
                areaPct: color.percentage,
                pageIds: [color.page],
                source: 'raster' as const,
                metadata: {
                  clientExtracted: true
                }
              }));
              
              // Merge with existing palette, prioritizing client raster colors for PDFs
              // since they often have better color representation than vector data
              palette = [...clientPaletteEntries, ...palette]
                .sort((a, b) => b.areaPct - a.areaPct)
                .slice(0, 15); // Keep top 15 colors total
              
              console.info(`Combined palette now has ${palette.length} colors (${clientPaletteEntries.length} from client raster, ${result.palette.length} from server vector)`);
            }
          } catch (clientRasterError) {
            console.warn('Failed to load client raster colors:', clientRasterError);
          }
        }
        
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