import React from 'react';
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
  );
}

<style>{`
  .palette-table {
    overflow-x: auto;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border-light);
  }

  .palette-table table {
    min-width: 700px;
    border-collapse: collapse;
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

  @media (max-width: 768px) {
    .palette-table th,
    .palette-table td {
      padding: 0.75rem 0.5rem;
    }

    .colour-cell {
      gap: 0.75rem;
    }

    .colour-cell .swatch {
      width: 40px;
      height: 40px;
    }

    .palette-table code {
      font-size: 0.8125rem;
      padding: 0.25rem 0.5rem;
    }
  }
`}</style>