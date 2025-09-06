import { getStore } from '@netlify/blobs';

export const prerender = false;

interface PaletteEntry {
  id: string;
  rgb: { R: number; G: number; B: number };
  lab: { L: number; a: number; b: number };
  areaPct: number;
  pageIds?: string[];
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
      palette = JSON.parse(cachedPaletteStr);
    } else {
      // For MVP, return mock palette data
      // Real palette extraction would be implemented here
      palette = [
        {
          id: 'pal-1',
          rgb: { R: 183, G: 30, B: 45 },
          lab: { L: 39.4, a: 58.5, b: 29.0 },
          areaPct: 25.5,
          pageIds: ['page-1']
        },
        {
          id: 'pal-2',
          rgb: { R: 0, G: 107, B: 63 },
          lab: { L: 40.5, a: -42.2, b: 17.9 },
          areaPct: 18.3,
          pageIds: ['page-1']
        },
        {
          id: 'pal-3',
          rgb: { R: 212, G: 181, B: 133 },
          lab: { L: 75.2, a: 3.8, b: 24.8 },
          areaPct: 15.2,
          pageIds: ['page-1']
        },
        {
          id: 'pal-4',
          rgb: { R: 27, G: 79, B: 156 },
          lab: { L: 36.4, a: 14.2, b: -46.7 },
          areaPct: 12.1,
          pageIds: ['page-1']
        },
        {
          id: 'pal-5',
          rgb: { R: 77, G: 79, B: 83 },
          lab: { L: 34.1, a: -0.4, b: -2.4 },
          areaPct: 8.9,
          pageIds: ['page-1']
        }
      ];
      
      // Cache the palette
      await store.set(`palettes/${jobId}.json`, JSON.stringify(palette));
    }
    
    // Filter by scope if needed
    let filteredPalette = palette;
    if (scope === 'page' && pageId) {
      filteredPalette = palette.filter(entry => 
        entry.pageIds && entry.pageIds.includes(pageId)
      );
    }
    
    return Response.json({ palette: filteredPalette });
  } catch (error) {
    console.error('Palette error:', error);
    return Response.json({ error: 'Failed to get palette' }, { status: 500 });
  }
}