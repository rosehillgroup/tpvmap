import React, { useState, useEffect } from 'react';
import { rgbToHex } from '../lib/colour/convert';

interface PaletteEntry {
  id: string;
  rgb: { R: number; G: number; B: number };
  lab: { L: number; a: number; b: number };
  areaPct: number;
  pageIds?: string[];
}

interface Props {
  palette: PaletteEntry[];
  selectedTargets: string[];
  onSelectionChange: (targets: string[]) => void;
}

export default function PaletteTable({ palette, selectedTargets, onSelectionChange }: Props) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    // Check on initial load
    checkIsMobile();

    // Add resize listener
    window.addEventListener('resize', checkIsMobile);
    
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  const handleToggle = (id: string) => {
    if (selectedTargets.includes(id)) {
      onSelectionChange(selectedTargets.filter(t => t !== id));
    } else {
      onSelectionChange([...selectedTargets, id]);
    }
  };

  const handleSelectAll = () => {
    if (selectedTargets.length === palette.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(palette.map(p => p.id));
    }
  };

  return (
    <div className="palette-container">
      {/* Conditional Rendering Based on Screen Size */}
      {!isMobile ? (
        /* Desktop Table View */
        <div className="palette-table">
        <table>
          <thead>
            <tr>
              <th>
                <input 
                  type="checkbox"
                  checked={selectedTargets.length === palette.length && palette.length > 0}
                  onChange={handleSelectAll}
                />
              </th>
              <th>Colour</th>
              <th>RGB</th>
              <th>Lab</th>
              <th>Area %</th>
              <th>Pages</th>
            </tr>
          </thead>
          <tbody>
            {palette.map((entry) => {
              const hex = rgbToHex(entry.rgb);
              return (
                <tr key={entry.id}>
                  <td>
                    <input 
                      type="checkbox"
                      checked={selectedTargets.includes(entry.id)}
                      onChange={() => handleToggle(entry.id)}
                    />
                  </td>
                  <td>
                    <div className="colour-cell">
                      <div 
                        className="swatch"
                        style={{ backgroundColor: hex }}
                      />
                      <span>{hex}</span>
                    </div>
                  </td>
                  <td>
                    <code>{entry.rgb.R}, {entry.rgb.G}, {entry.rgb.B}</code>
                  </td>
                  <td>
                    <code>
                      L: {entry.lab.L.toFixed(1)}<br/>
                      a: {entry.lab.a.toFixed(1)}<br/>
                      b: {entry.lab.b.toFixed(1)}
                    </code>
                  </td>
                  <td>{entry.areaPct.toFixed(1)}%</td>
                  <td>{entry.pageIds?.join(', ') || 'All'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      ) : (
        /* Mobile Card View */
        <div className="palette-cards">
        <div className="palette-header">
          <label className="select-all">
            <input 
              type="checkbox"
              checked={selectedTargets.length === palette.length && palette.length > 0}
              onChange={handleSelectAll}
            />
            <span>Select all colors</span>
          </label>
        </div>
        
        <div className="color-grid">
          {palette.map((entry) => {
            const hex = rgbToHex(entry.rgb);
            const isSelected = selectedTargets.includes(entry.id);
            return (
              <div 
                key={entry.id} 
                className={`color-card ${isSelected ? 'selected' : ''}`}
                onClick={() => handleToggle(entry.id)}
              >
                <div className="color-card-header">
                  <div className="color-preview">
                    <div 
                      className="color-swatch"
                      style={{ 
                        backgroundColor: hex,
                        width: '64px',
                        height: '64px',
                        borderRadius: 'var(--radius)',
                        boxShadow: 'var(--shadow-md)',
                        border: '3px solid var(--color-border-light)',
                        flexShrink: 0,
                        minHeight: '64px',
                        minWidth: '64px',
                        display: 'block'
                      }}
                    />
                    <div className="color-info">
                      <div className="hex-code">{hex}</div>
                      <div className="area-percentage">{entry.areaPct.toFixed(1)}% coverage</div>
                    </div>
                  </div>
                  <input 
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggle(entry.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                
                <div className="color-details">
                  <div className="rgb-values">
                    <span className="label">RGB:</span>
                    <code>{entry.rgb.R}, {entry.rgb.G}, {entry.rgb.B}</code>
                  </div>
                  <div className="lab-values">
                    <span className="label">Lab:</span>
                    <code>L: {entry.lab.L.toFixed(1)}, a: {entry.lab.a.toFixed(1)}, b: {entry.lab.b.toFixed(1)}</code>
                  </div>
                  {entry.pageIds && entry.pageIds.length > 0 && (
                    <div className="page-info">
                      <span className="label">Pages:</span>
                      <span>{entry.pageIds.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </div>
      )}
    </div>
  );
}

<style>{`
  /* Desktop and Mobile Container */
  .palette-container {
    width: 100%;
  }

  /* Desktop Table View */
  .palette-table {
    overflow-x: auto;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border-light);
  }

  .palette-table table {
    min-width: 700px;
    border-collapse: collapse;
    width: 100%;
  }

  .palette-table th {
    background: var(--color-background);
    font-family: var(--font-heading);
    font-weight: 600;
    color: var(--color-primary);
    padding: 1rem 0.75rem;
    text-align: left;
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.025em;
    border-bottom: 2px solid var(--color-border);
  }

  .palette-table td {
    padding: 1rem 0.75rem;
    border-bottom: 1px solid var(--color-border-light);
    vertical-align: middle;
  }

  .palette-table tr:hover {
    background: rgba(255, 107, 53, 0.03);
  }

  .colour-cell {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .colour-cell .swatch {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-sm);
    flex-shrink: 0;
    box-shadow: var(--shadow-sm);
    border: 2px solid var(--color-border-light);
  }

  .palette-table code {
    font-size: 0.875rem;
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
    background: var(--color-background);
    padding: 0.375rem 0.625rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border-light);
    color: var(--color-text);
    font-weight: 500;
  }

  .palette-table input[type="checkbox"] {
    width: 18px;
    height: 18px;
    margin: 0;
    cursor: pointer;
    accent-color: var(--color-accent);
  }

  .palette-table input[type="checkbox"]:checked {
    background-color: var(--color-accent);
    border-color: var(--color-accent);
  }

  /* Mobile Card View */
  .palette-cards {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* Desktop Table View */
  .palette-table {
    display: block;
  }

  .palette-header {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: var(--color-background);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border-light);
  }

  .select-all {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    font-weight: 500;
    color: var(--color-text);
  }

  .select-all input[type="checkbox"] {
    width: 20px;
    height: 20px;
    margin: 0;
    cursor: pointer;
    accent-color: var(--color-accent);
  }

  .color-grid {
    display: grid;
    gap: 1rem;
    grid-template-columns: 1fr;
  }

  .color-card {
    background: var(--color-surface);
    border: 2px solid var(--color-border-light);
    border-radius: var(--radius);
    padding: 1.25rem;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: var(--shadow-sm);
  }

  .color-card:hover {
    border-color: var(--color-accent);
    box-shadow: var(--shadow-md);
  }

  .color-card.selected {
    border-color: var(--color-accent);
    background: rgba(255, 107, 53, 0.05);
    box-shadow: 0 4px 12px rgba(255, 107, 53, 0.15);
  }

  .color-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .color-preview {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex: 1;
  }

  .color-swatch {
    width: 64px;
    height: 64px;
    border-radius: var(--radius);
    box-shadow: var(--shadow-md);
    border: 3px solid var(--color-border-light);
    flex-shrink: 0;
    min-height: 64px;
    min-width: 64px;
  }

  .color-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .hex-code {
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .area-percentage {
    font-size: 0.875rem;
    color: var(--color-text-light);
    font-weight: 500;
  }

  .color-card input[type="checkbox"] {
    width: 22px;
    height: 22px;
    margin: 0;
    cursor: pointer;
    accent-color: var(--color-accent);
  }

  .color-details {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border-light);
  }

  .color-details > div {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .color-details .label {
    font-weight: 600;
    color: var(--color-text-light);
    font-size: 0.875rem;
    min-width: 40px;
  }

  .color-details code {
    font-size: 0.875rem;
    font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
    background: var(--color-background);
    padding: 0.375rem 0.625rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border-light);
    color: var(--color-text);
    font-weight: 500;
  }

  /* Media queries removed - using React state-based responsive rendering */
`}</style>