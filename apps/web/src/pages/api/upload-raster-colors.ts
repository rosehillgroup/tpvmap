import { getStore } from '@netlify/blobs';

export const prerender = false;

interface ClientRasterColor {
  rgb: { R: number; G: number; B: number };
  percentage: number;
  page: number;
}

export async function POST(context: any) {
  try {
    console.info("Upload raster colors API called");
    const formData = await context.request.formData();
    const jobId = formData.get('jobId') as string;
    const colorsJson = formData.get('colors') as string;
    
    if (!jobId || !colorsJson) {
      return Response.json({ error: 'Missing jobId or colors data' }, { status: 400 });
    }
    
    const colors: ClientRasterColor[] = JSON.parse(colorsJson);
    console.info(`Received ${colors.length} client raster colors for job ${jobId}`);
    
    // Store client raster colors
    const store = getStore({ name: 'tpv-matcher' });
    await store.set(`client-raster/${jobId}.json`, JSON.stringify({
      colors,
      extractedAt: new Date().toISOString(),
      source: 'client-pdf-raster'
    }));
    
    console.info('Client raster colors stored successfully');
    
    return Response.json({ 
      success: true,
      colorsReceived: colors.length
    });
  } catch (error) {
    console.error('Upload raster colors error:', error);
    return Response.json({ 
      error: 'Failed to upload raster colors', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}