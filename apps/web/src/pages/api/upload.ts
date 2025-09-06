import { getStore } from '@netlify/blobs';
import { createHash } from 'crypto';
import sharp from 'sharp';

export const prerender = false;

interface PageInfo {
  id: string;
  width: number;
  height: number;
  previewUrl: string;
}

interface JobData {
  id: string;
  fileName: string;
  fileHash: string;
  uploadedAt: string;
  pages: PageInfo[];
}

async function generateThumbnail(buffer: Buffer, maxWidth: number = 200, maxHeight: number = 200): Promise<Buffer> {
  return sharp(buffer)
    .resize(maxWidth, maxHeight, { fit: 'inside' })
    .png()
    .toBuffer();
}

async function getImageInfo(buffer: Buffer): Promise<{ width: number; height: number; format: string }> {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || 'unknown'
  };
}

export async function onRequest(context: any) {
  if (context.request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const formData = await context.request.formData();
    const file = formData.get('file') as File;
    
    if (!file || typeof file === 'string') {
      return Response.json({ error: 'No file uploaded' }, { status: 400 });
    }
    
    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name;
    const fileType = file.type;
    
    // Validate file type
    if (!['application/pdf', 'image/png', 'image/jpeg', 'image/svg+xml'].includes(fileType)) {
      return Response.json({ error: 'Invalid file type. Supported: PDF, PNG, JPG, SVG' }, { status: 400 });
    }
    
    // Check file size (50MB limit)
    const maxSize = 50 * 1024 * 1024;
    if (buffer.length > maxSize) {
      return Response.json({ error: 'File too large. Maximum size: 50MB' }, { status: 400 });
    }
    
    // Generate job ID from file hash
    const fileHash = createHash('sha256').update(buffer).digest('hex');
    const jobId = `${Date.now()}-${fileHash.slice(0, 8)}`;
    
    // Initialize Netlify Blobs store
    const store = getStore({ name: 'tpv-matcher' });
    
    // Store the uploaded file
    await store.set(`uploads/${jobId}.${filename.split('.').pop()}`, new Uint8Array(buffer));
    
    const pages: PageInfo[] = [];
    
    if (fileType.startsWith('image/')) {
      // Handle image files
      const info = await getImageInfo(buffer);
      const thumbnail = await generateThumbnail(buffer);
      
      // Store thumbnail
      await store.set(`thumbnails/${jobId}-page-1.png`, new Uint8Array(thumbnail));
      
      pages.push({
        id: 'page-1',
        width: info.width,
        height: info.height,
        previewUrl: `/api/thumbnail/${jobId}-page-1.png`
      });
    } else if (fileType === 'application/pdf') {
      // For PDF files, create placeholder page info
      // Real PDF processing would be implemented here
      pages.push({
        id: 'page-1',
        width: 595,
        height: 842,
        previewUrl: '/placeholder-pdf.png'
      });
    }
    
    // Store job metadata
    const jobData: JobData = {
      id: jobId,
      fileName: filename,
      fileHash,
      uploadedAt: new Date().toISOString(),
      pages
    };
    
    await store.set(`jobs/${jobId}.json`, JSON.stringify(jobData));
    
    return Response.json({
      jobId,
      pages,
      quickPalette: [] // Will be populated by real palette extraction
    });
  } catch (error) {
    console.error('Upload error:', error);
    return Response.json({ error: 'Upload failed' }, { status: 500 });
  }
}