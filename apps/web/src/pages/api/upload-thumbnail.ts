import { getStore } from '@netlify/blobs';

export const prerender = false;

export async function POST(context: any) {
  try {
    console.info("Upload thumbnail API called");
    const formData = await context.request.formData();
    const thumbnailFile = formData.get('thumbnail') as File;
    const jobId = formData.get('jobId') as string;
    
    if (!thumbnailFile || !jobId) {
      return Response.json({ error: 'Missing thumbnail file or jobId' }, { status: 400 });
    }
    
    console.info(`Thumbnail received for job ${jobId}: ${thumbnailFile.name} ${thumbnailFile.type} ${thumbnailFile.size} bytes`);
    
    // Convert file to buffer
    const buffer = Buffer.from(await thumbnailFile.arrayBuffer());
    
    // Store in Netlify Blobs
    const store = getStore({ name: 'tpv-matcher' });
    await store.set(`thumbnails/${jobId}-page-1.png`, buffer);
    
    console.info('PDF thumbnail stored successfully');
    
    // Update job data to reflect thumbnail is available
    const jobDataStr = await store.get(`jobs/${jobId}.json`, { type: 'text' });
    if (jobDataStr) {
      const jobData = JSON.parse(jobDataStr);
      
      // Update preview URL for first page
      if (jobData.pages && jobData.pages.length > 0) {
        jobData.pages[0].previewUrl = `/api/thumbnail/${jobId}-page-1.png`;
        await store.set(`jobs/${jobId}.json`, JSON.stringify(jobData));
        console.info('Job data updated with thumbnail URL');
      }
    }
    
    return Response.json({ 
      success: true, 
      previewUrl: `/api/thumbnail/${jobId}-page-1.png` 
    });
  } catch (error) {
    console.error('Upload thumbnail error:', error);
    return Response.json({ 
      error: 'Thumbnail upload failed', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}