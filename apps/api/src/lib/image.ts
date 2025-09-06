import sharp from 'sharp';

export async function generateThumbnail(
  buffer: Buffer,
  maxWidth: number = 200,
  maxHeight: number = 200
): Promise<Buffer> {
  return sharp(buffer)
    .resize(maxWidth, maxHeight, { fit: 'inside' })
    .png()
    .toBuffer();
}

export async function getImageInfo(buffer: Buffer): Promise<{
  width: number;
  height: number;
  format: string;
}> {
  const metadata = await sharp(buffer).metadata();
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || 'unknown'
  };
}

export async function renderToPixels(buffer: Buffer, maxPixels: number = 1000000): Promise<{
  data: Buffer;
  width: number;
  height: number;
}> {
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  
  const totalPixels = width * height;
  let targetWidth = width;
  let targetHeight = height;
  
  if (totalPixels > maxPixels) {
    const scale = Math.sqrt(maxPixels / totalPixels);
    targetWidth = Math.round(width * scale);
    targetHeight = Math.round(height * scale);
  }
  
  const rawData = await sharp(buffer)
    .resize(targetWidth, targetHeight)
    .raw()
    .toBuffer();
  
  return {
    data: rawData,
    width: targetWidth,
    height: targetHeight
  };
}