import { getStore } from '@netlify/blobs';

export const prerender = false;

export async function GET(context: any) {
  try {
    const url = new URL(context.request.url);
    const jobId = url.searchParams.get('jobId');
    
    if (!jobId) {
      return Response.json({ error: 'Missing jobId parameter' }, { status: 400 });
    }
    
    const store = getStore({ name: 'tpv-matcher' });
    
    // Get job data
    const jobDataStr = await store.get(`jobs/${jobId}.json`, { type: 'text' });
    if (!jobDataStr) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }
    
    const jobData = JSON.parse(jobDataStr);
    
    return Response.json(jobData);
  } catch (error) {
    console.error('Job API error:', error);
    return Response.json({ error: 'Failed to fetch job data' }, { status: 500 });
  }
}