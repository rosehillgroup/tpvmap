import React, { useState, useEffect } from 'react';

interface JobData {
  id: string;
  fileName: string;
  fileHash: string;
  uploadedAt: string;
  pages: Array<{
    id: string;
    width: number;
    height: number;
    previewUrl: string;
  }>;
}

interface Props {
  jobId: string;
}

export default function DesignPreview({ jobId }: Props) {
  const [jobData, setJobData] = useState<JobData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadJobData();
  }, [jobId]);

  const loadJobData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/job?jobId=${jobId}`);
      if (!response.ok) {
        throw new Error('Failed to load job data');
      }
      
      const data = await response.json();
      setJobData(data);
    } catch (error) {
      console.error('Failed to load job data:', error);
      setError(error instanceof Error ? error.message : 'Failed to load design preview');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="design-preview-loading">
        <div className="loading-spinner"></div>
        <p>Loading design preview...</p>
      </div>
    );
  }

  if (error || !jobData) {
    return (
      <div className="design-preview-error">
        <div className="error-icon">🖼️</div>
        <p>Unable to load design preview</p>
        {error && <p className="error-details">{error}</p>}
      </div>
    );
  }

  const primaryPage = jobData.pages[0];
  if (!primaryPage) {
    return null;
  }

  const isPlaceholder = primaryPage.previewUrl === '/placeholder-pdf.png';
  
  const formatFileSize = (fileName: string) => {
    // We don't have file size in job data, so just show the file type
    const ext = fileName.split('.').pop()?.toUpperCase();
    return ext || 'FILE';
  };

  return (
    <>
      <div className="design-preview">
        <div className="preview-header">
          <h3>Original Design</h3>
          <div className="file-info">
            <span className="file-name">{jobData.fileName}</span>
            <span className="file-type">{formatFileSize(jobData.fileName)}</span>
            <span className="dimensions">
              {primaryPage.width} × {primaryPage.height}px
            </span>
          </div>
        </div>
        
        <div className="preview-container">
          <div className="thumbnail-wrapper" onClick={() => !isPlaceholder && setShowModal(true)}>
            <img
              src={primaryPage.previewUrl}
              alt={`Preview of ${jobData.fileName}`}
              className={`thumbnail ${isPlaceholder ? 'placeholder' : 'clickable'}`}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = '/placeholder-pdf.png';
                target.className = 'thumbnail placeholder';
              }}
            />
            {!isPlaceholder && (
              <div className="thumbnail-overlay">
                <span>🔍 Click to enlarge</span>
              </div>
            )}
          </div>
          
          {isPlaceholder && (
            <div className="placeholder-message">
              <p>📄 PDF thumbnail not available</p>
              <p className="placeholder-note">
                Colour extraction will analyze the PDF content directly
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modal for enlarged view */}
      {showModal && !isPlaceholder && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowModal(false)}>
              ✕
            </button>
            <img
              src={primaryPage.previewUrl}
              alt={`Full preview of ${jobData.fileName}`}
              className="modal-image"
            />
            <div className="modal-info">
              <h4>{jobData.fileName}</h4>
              <p>{primaryPage.width} × {primaryPage.height}px</p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .design-preview {
          background: var(--color-surface);
          border-radius: var(--radius);
          padding: 1.5rem;
          border: 1px solid var(--color-border-light);
          margin-bottom: 2rem;
        }

        .preview-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .preview-header h3 {
          margin: 0;
          font-family: var(--font-heading);
          color: var(--color-primary);
          font-size: 1.125rem;
        }

        .file-info {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.25rem;
          font-size: 0.875rem;
          color: var(--color-text-light);
        }

        .file-name {
          font-weight: 500;
          color: var(--color-text);
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .file-type {
          background: var(--color-accent);
          color: white;
          padding: 0.125rem 0.5rem;
          border-radius: 12px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .preview-container {
          display: flex;
          align-items: flex-start;
          gap: 1.5rem;
        }

        .thumbnail-wrapper {
          position: relative;
          flex-shrink: 0;
        }

        .thumbnail {
          width: 150px;
          height: 150px;
          object-fit: cover;
          border-radius: var(--radius-sm);
          border: 2px solid var(--color-border-light);
          background: var(--color-background);
        }

        .thumbnail.clickable {
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .thumbnail.clickable:hover {
          border-color: var(--color-accent);
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .thumbnail.placeholder {
          opacity: 0.6;
          cursor: default;
        }

        .thumbnail-overlay {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: linear-gradient(transparent, rgba(0,0,0,0.7));
          color: white;
          padding: 0.5rem;
          font-size: 0.75rem;
          text-align: center;
          border-radius: 0 0 var(--radius-sm) var(--radius-sm);
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .thumbnail.clickable:hover .thumbnail-overlay {
          opacity: 1;
        }

        .placeholder-message {
          flex: 1;
          text-align: center;
          padding: 2rem 1rem;
          color: var(--color-text-light);
        }

        .placeholder-message p:first-child {
          font-size: 1rem;
          margin-bottom: 0.5rem;
          color: var(--color-text);
        }

        .placeholder-note {
          font-size: 0.875rem;
          margin: 0;
        }

        .design-preview-loading,
        .design-preview-error {
          background: var(--color-surface);
          border-radius: var(--radius);
          padding: 2rem;
          text-align: center;
          border: 1px solid var(--color-border-light);
          margin-bottom: 2rem;
        }

        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid var(--color-border-light);
          border-top: 3px solid var(--color-accent);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem;
        }

        .error-icon {
          font-size: 3rem;
          margin-bottom: 1rem;
        }

        .error-details {
          font-size: 0.875rem;
          color: var(--color-text-light);
          margin-top: 0.5rem;
        }

        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 2rem;
        }

        .modal-content {
          position: relative;
          background: white;
          border-radius: var(--radius);
          max-width: 90vw;
          max-height: 90vh;
          overflow: hidden;
          box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        }

        .modal-close {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: rgba(0,0,0,0.5);
          color: white;
          border: none;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          cursor: pointer;
          font-size: 1.25rem;
          z-index: 1001;
          transition: background-color 0.2s ease;
        }

        .modal-close:hover {
          background: rgba(0,0,0,0.7);
        }

        .modal-image {
          max-width: 100%;
          max-height: calc(90vh - 80px);
          object-fit: contain;
          display: block;
        }

        .modal-info {
          padding: 1rem;
          background: var(--color-surface);
          border-top: 1px solid var(--color-border-light);
        }

        .modal-info h4 {
          margin: 0 0 0.5rem 0;
          color: var(--color-primary);
        }

        .modal-info p {
          margin: 0;
          color: var(--color-text-light);
          font-size: 0.875rem;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .preview-header {
            flex-direction: column;
            align-items: flex-start;
          }

          .file-info {
            align-items: flex-start;
          }

          .preview-container {
            flex-direction: column;
            align-items: center;
            text-align: center;
          }

          .thumbnail {
            width: 120px;
            height: 120px;
          }

          .modal-overlay {
            padding: 1rem;
          }

          .modal-close {
            top: 0.5rem;
            right: 0.5rem;
          }
        }
      `}</style>
    </>
  );
}