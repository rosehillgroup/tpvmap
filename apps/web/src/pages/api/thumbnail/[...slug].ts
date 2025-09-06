import { getStore } from '@netlify/blobs';

export const prerender = false;

export async function GET(context: any) {

  try {
    const { params } = context;
    const thumbnailPath = params.slug;
    
    if (!thumbnailPath) {
      return new Response('Thumbnail not found', { status: 404 });
    }
    
    const store = getStore({ name: 'tpv-matcher' });
    const thumbnail = await store.get(`thumbnails/${thumbnailPath}`, { type: 'arrayBuffer' });
    
    if (!thumbnail) {
      return new Response('Thumbnail not found', { status: 404 });
    }
    
    return new Response(thumbnail, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
      }
    });
  } catch (error) {
    console.error('Thumbnail error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}