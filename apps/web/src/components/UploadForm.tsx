import React, { useState, useCallback } from 'react';
import type { ChangeEvent, DragEvent } from 'react';

interface UploadResponse {
  jobId: string;
  pages: Array<{
    id: string;
    width: number;
    height: number;
    previewUrl: string;
  }>;
  quickPalette: Array<{
    rgb: { R: number; G: number; B: number };
    lab: { L: number; a: number; b: number };
    areaPct: number;
  }>;
}

interface ProgressState {
  stage: 'uploading' | 'processing' | 'extracting' | 'caching' | 'complete' | 'error';
  progress: number;
  message: string;
}

export default function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);

  const handleDrag = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload a PDF, PNG, JPG, or SVG file');
      return;
    }
    
    if (file.size > 50 * 1024 * 1024) {
      setError('File size must be less than 50MB');
      return;
    }
    
    setFile(file);
    setError(null);
  };

  const simulateProgress = async (jobId: string) => {
    // Simulate progressive loading stages
    const stages = [
      { stage: 'uploading' as const, progress: 20, message: 'File uploaded successfully' },
      { stage: 'processing' as const, progress: 40, message: 'Processing file structure...' },
      { stage: 'extracting' as const, progress: 70, message: 'Extracting colour palette...' },
      { stage: 'caching' as const, progress: 90, message: 'Optimising results...' },
      { stage: 'complete' as const, progress: 100, message: 'Ready to view results!' }
    ];

    for (const stageInfo of stages) {
      setProgress(stageInfo);
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1200));
    }

    // Small delay before navigation
    setTimeout(() => {
      window.location.href = `/results?jobId=${jobId}`;
    }, 500);
  };

  const handleSubmit = async () => {
    if (!file) return;
    
    setLoading(true);
    setError(null);
    setProgress({ stage: 'uploading', progress: 5, message: 'Uploading file...' });
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const data: UploadResponse = await response.json();
      
      // Start progressive loading simulation
      await simulateProgress(data.jobId);
    } catch (err) {
      setError('Failed to upload file. Please try again.');
      setProgress({ stage: 'error', progress: 0, message: 'Upload failed' });
      console.error('Upload error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-form">
      <div 
        className={`drop-zone ${dragActive ? 'active' : ''} ${file ? 'has-file' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-input"
          accept=".pdf,.png,.jpg,.jpeg,.svg"
          onChange={handleChange}
          disabled={loading}
        />
        <label htmlFor="file-input">
          {file ? (
            <div className="file-info">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
              </svg>
              <p className="file-name">{file.name}</p>
              <p className="file-size">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          ) : (
            <>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.35,10.04C18.67,6.59 15.64,4 12,4C9.11,4 6.6,5.64 5.35,8.04C2.34,8.36 0,10.91 0,14A6,6 0 0,0 6,20H19A5,5 0 0,0 24,15C24,12.36 21.95,10.22 19.35,10.04M19,18H6A4,4 0 0,1 2,14C2,11.95 3.53,10.24 5.56,10.03L6.63,9.92L7.13,8.97C8.08,7.14 9.94,6 12,6C14.62,6 16.88,7.86 17.39,10.43L17.69,11.93L19.22,12.04C20.78,12.14 22,13.45 22,15A3,3 0 0,1 19,18M8,13H10.55V16H13.45V13H16L12,9L8,13Z" />
              </svg>
              <p>Drag and drop your design file here</p>
              <p className="or">or</p>
              <span className="browse">Browse files</span>
              <p className="formats">Supported: PDF, PNG, JPG, SVG (max 50MB)</p>
            </>
          )}
        </label>
      </div>
      
      {error && <p className="error">{error}</p>}
      
      {progress && (
        <div className="progress-container">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${progress.progress}%` }}
            />
          </div>
          <div className="progress-info">
            <span className="progress-stage">{progress.stage}</span>
            <span className="progress-message">{progress.message}</span>
          </div>
        </div>
      )}
      
      <button 
        className="btn btn-primary upload-btn"
        onClick={handleSubmit}
        disabled={!file || loading}
      >
        {loading ? (
          <>
            <span className="loading"></span>
            <span>{progress?.message || 'Processing...'}</span>
          </>
        ) : (
          'Extract Palette'
        )}
      </button>
    </div>
  );
}

<style>{`
  .upload-form {
    max-width: 600px;
    margin: 2rem auto;
  }

  .drop-zone {
    position: relative;
    border: 2px dashed var(--color-border);
    border-radius: var(--radius);
    padding: 3rem 2rem;
    text-align: center;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    background: var(--color-surface);
  }

  .drop-zone.active {
    border-color: var(--color-accent);
    background: rgba(255, 107, 53, 0.05);
    transform: scale(1.02);
  }

  .drop-zone.has-file {
    border-style: solid;
    border-color: var(--color-accent);
    background: rgba(255, 107, 53, 0.03);
  }

  .drop-zone input {
    position: absolute;
    opacity: 0;
    width: 100%;
    height: 100%;
    cursor: pointer;
  }

  .drop-zone label {
    cursor: pointer;
    color: var(--color-text-light);
  }

  .drop-zone svg {
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  .drop-zone .or {
    margin: 0.5rem 0;
    font-size: 0.875rem;
  }

  .drop-zone .browse {
    color: var(--color-accent);
    text-decoration: underline;
    font-weight: 500;
  }

  .drop-zone .formats {
    margin-top: 1rem;
    font-size: 0.875rem;
    opacity: 0.7;
  }

  .file-info {
    color: var(--color-text);
  }

  .file-info svg {
    color: var(--color-accent);
    opacity: 1;
  }

  .file-name {
    font-weight: 500;
    margin-bottom: 0.25rem;
  }

  .file-size {
    font-size: 0.875rem;
    color: var(--color-text-light);
  }

  .upload-btn {
    width: 100%;
    margin-top: 1.5rem;
    height: 48px;
    font-size: 1.125rem;
  }

  .upload-btn .loading {
    margin-right: 0.5rem;
  }

  .progress-container {
    margin-top: 1.5rem;
    padding: 1rem;
    background: var(--color-surface);
    border-radius: var(--radius);
    border: 1px solid var(--color-border);
  }

  .progress-bar {
    width: 100%;
    height: 8px;
    background: var(--color-background);
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 0.75rem;
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--color-primary), var(--color-accent));
    transition: width 0.5s ease-in-out;
  }

  .progress-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.875rem;
  }

  .progress-stage {
    text-transform: capitalize;
    font-weight: 500;
    color: var(--color-accent);
  }

  .progress-message {
    color: var(--color-text-light);
  }

  @media (max-width: 600px) {
    .progress-info {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
    }
  }
`}</style>