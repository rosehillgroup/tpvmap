import { Hono } from 'hono';
import { storage } from '../lib/storage.js';
import { generateThumbnail, getImageInfo } from '../lib/image.js';

const app = new Hono();

app.post('/', async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body['file'];
    
    if (!file || typeof file === 'string') {
      return c.json({ error: 'No file uploaded' }, 400);
    }
    
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name;
    const fileType = file.type;
    
    if (!['application/pdf', 'image/png', 'image/jpeg', 'image/svg+xml'].includes(fileType)) {
      return c.json({ error: 'Invalid file type. Supported: PDF, PNG, JPG, SVG' }, 400);
    }
    
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (buffer.length > maxSize) {
      return c.json({ error: 'File too large. Maximum size: 50MB' }, 400);
    }
    
    const { jobId, fileHash } = await storage.saveFile(buffer, filename);
    
    const pages: any[] = [];
    const quickPalette: any[] = [];
    
    if (fileType.startsWith('image/')) {
      const info = await getImageInfo(buffer);
      const thumbnail = await generateThumbnail(buffer);
      const previewUrl = await storage.saveThumbnail(jobId, 'page-1', thumbnail);
      
      pages.push({
        id: 'page-1',
        width: info.width,
        height: info.height,
        previewUrl
      });
    } else if (fileType === 'application/pdf') {
      pages.push({
        id: 'page-1',
        width: 595,
        height: 842,
        previewUrl: '/placeholder-pdf.png'
      });
    }
    
    const jobData = await storage.getJobData(jobId);
    if (jobData) {
      jobData.pages = pages;
      await storage.saveJobData(jobId, jobData);
    }
    
    return c.json({
      jobId,
      pages,
      quickPalette
    });
  } catch (error) {
    console.error('Upload error:', error);
    return c.json({ error: 'Upload failed' }, 500);
  }
});

export default app;