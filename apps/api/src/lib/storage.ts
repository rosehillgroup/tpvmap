import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STORAGE_DIR = path.join(__dirname, '../../storage');
const CACHE_EXPIRY_DAYS = 7;

export interface JobData {
  id: string;
  fileName: string;
  fileHash: string;
  uploadedAt: Date;
  pages?: PageInfo[];
  palette?: PaletteEntry[];
}

export interface PageInfo {
  id: string;
  width: number;
  height: number;
  previewUrl: string;
}

export interface PaletteEntry {
  id: string;
  rgb: { R: number; G: number; B: number };
  lab: { L: number; a: number; b: number };
  areaPct: number;
  pageIds?: string[];
}

export class Storage {
  constructor() {
    this.ensureStorageDir();
  }
  
  private async ensureStorageDir(): Promise<void> {
    try {
      await fs.mkdir(STORAGE_DIR, { recursive: true });
      await fs.mkdir(path.join(STORAGE_DIR, 'uploads'), { recursive: true });
      await fs.mkdir(path.join(STORAGE_DIR, 'thumbnails'), { recursive: true });
      await fs.mkdir(path.join(STORAGE_DIR, 'cache'), { recursive: true });
    } catch (error) {
      console.error('Failed to create storage directories:', error);
    }
  }
  
  async saveFile(buffer: Buffer, filename: string): Promise<{ jobId: string; fileHash: string }> {
    const hash = createHash('sha256').update(buffer).digest('hex');
    const jobId = `${Date.now()}-${hash.slice(0, 8)}`;
    
    const filePath = path.join(STORAGE_DIR, 'uploads', `${jobId}-${filename}`);
    await fs.writeFile(filePath, buffer);
    
    const jobData: JobData = {
      id: jobId,
      fileName: filename,
      fileHash: hash,
      uploadedAt: new Date()
    };
    
    await this.saveJobData(jobId, jobData);
    
    return { jobId, fileHash: hash };
  }
  
  async getFile(jobId: string): Promise<{ buffer: Buffer; filename: string } | null> {
    const jobData = await this.getJobData(jobId);
    if (!jobData) return null;
    
    const files = await fs.readdir(path.join(STORAGE_DIR, 'uploads'));
    const file = files.find(f => f.startsWith(jobId));
    if (!file) return null;
    
    const filePath = path.join(STORAGE_DIR, 'uploads', file);
    const buffer = await fs.readFile(filePath);
    
    return { buffer, filename: jobData.fileName };
  }
  
  async saveJobData(jobId: string, data: JobData): Promise<void> {
    const dataPath = path.join(STORAGE_DIR, 'cache', `${jobId}.json`);
    await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
  }
  
  async getJobData(jobId: string): Promise<JobData | null> {
    try {
      const dataPath = path.join(STORAGE_DIR, 'cache', `${jobId}.json`);
      const content = await fs.readFile(dataPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
  
  async saveThumbnail(jobId: string, pageId: string, buffer: Buffer): Promise<string> {
    const filename = `${jobId}-${pageId}.png`;
    const filePath = path.join(STORAGE_DIR, 'thumbnails', filename);
    await fs.writeFile(filePath, buffer);
    return `/thumbnails/${filename}`;
  }
  
  async cleanExpiredJobs(): Promise<void> {
    const now = Date.now();
    const expiryTime = CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    
    try {
      const cacheFiles = await fs.readdir(path.join(STORAGE_DIR, 'cache'));
      
      for (const file of cacheFiles) {
        if (!file.endsWith('.json')) continue;
        
        const dataPath = path.join(STORAGE_DIR, 'cache', file);
        const content = await fs.readFile(dataPath, 'utf-8');
        const data: JobData = JSON.parse(content);
        
        const uploadTime = new Date(data.uploadedAt).getTime();
        if (now - uploadTime > expiryTime) {
          const jobId = path.basename(file, '.json');
          await this.deleteJob(jobId);
        }
      }
    } catch (error) {
      console.error('Failed to clean expired jobs:', error);
    }
  }
  
  private async deleteJob(jobId: string): Promise<void> {
    const dirs = ['uploads', 'thumbnails', 'cache'];
    
    for (const dir of dirs) {
      const dirPath = path.join(STORAGE_DIR, dir);
      const files = await fs.readdir(dirPath);
      
      for (const file of files) {
        if (file.startsWith(jobId)) {
          await fs.unlink(path.join(dirPath, file));
        }
      }
    }
  }
}

export const storage = new Storage();