import { getStore } from '@netlify/blobs';
import { createHash } from 'crypto';

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
  const { default: sharp } = await import('sharp');
  return sharp(buffer)
    .resize(maxWidth, maxHeight, { fit: 'inside' })
    .png()
    .toBuffer();
}

async function getImageInfo(buffer: Buffer): Promise<{ width: number; height: number; format: string }> {
  const { default: sharp } = await import('sharp');
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || 'unknown'
  };
}

async function getPDFDimensions(pdfBuffer: ArrayBuffer): Promise<{ width: number; height: number } | null> {
  try {
    // Just get PDF dimensions without rendering - no canvas needed
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    (pdfjs.GlobalWorkerOptions as any).workerSrc = null;
    
    const pdf = await pdfjs.getDocument({ 
      data: pdfBuffer,
      useSystemFonts: false,
      isEvalSupported: false 
    }).promise;
    
    if (pdf.numPages === 0) {
      throw new Error('PDF has no pages');
    }
    
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.0 });
    
    return {
      width: Math.floor(viewport.width),
      height: Math.floor(viewport.height)
    };
  } catch (error) {
    console.error('Failed to get PDF dimensions:', error);
    return null;
  }
}

export async function POST(context: any) {
  try {
    console.info("Upload API called");
    const formData = await context.request.formData();
    const file = formData.get('file') as File;
    
    if (!file || typeof file === 'string') {
      return Response.json({ error: 'No file uploaded' }, { status: 400 });
    }
    
    console.info(`File received: ${file.name} ${file.type} ${file.size}`);
    
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
    
    console.info('Generated job ID:', jobId);
    
    // Initialize Netlify Blobs store
    const store = getStore({ name: 'tpv-matcher' });
    
    // Store the uploaded file
    await store.set(`uploads/${jobId}.${filename.split('.').pop()}`, buffer);
    console.info('File stored successfully');
    
    const pages: PageInfo[] = [];
    
    if (fileType.startsWith('image/')) {
      // Handle image files
      const info = await getImageInfo(buffer);
      console.info('Image info:', info);
      
      const thumbnail = await generateThumbnail(buffer);
      console.info('Thumbnail generated, size:', thumbnail.length);
      
      // Store thumbnail
      await store.set(`thumbnails/${jobId}-page-1.png`, thumbnail);
      
      pages.push({
        id: 'page-1',
        width: info.width,
        height: info.height,
        previewUrl: `/api/thumbnail/${jobId}-page-1.png`
      });
    } else if (fileType === 'application/pdf') {
      // Get PDF dimensions without rendering (no canvas needed)
      console.info('Getting PDF dimensions...');
      const pdfDimensions = await getPDFDimensions(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
      
      if (pdfDimensions) {
        console.info('PDF dimensions retrieved:', pdfDimensions);
        pages.push({
          id: 'page-1',
          width: pdfDimensions.width,
          height: pdfDimensions.height,
          previewUrl: '/placeholder-pdf.png' // Client will generate thumbnail
        });
      } else {
        console.warn('PDF dimension extraction failed, using default dimensions');
        pages.push({
          id: 'page-1',
          width: 595,
          height: 842,
          previewUrl: '/placeholder-pdf.png'
        });
      }
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
    console.info('Job metadata stored');
    
    return Response.json({
      jobId,
      pages,
      quickPalette: [] // Will be populated by real palette extraction
    });
  } catch (error) {
    console.error('Upload error:', error);
    return Response.json({ 
      error: 'Upload failed', 
      details: error instanceof Error ? error.message : String(error) 
    }, { status: 500 });
  }
}