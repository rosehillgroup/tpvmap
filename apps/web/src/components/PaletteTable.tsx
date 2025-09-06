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
  }

  .palette-table table {
    min-width: 600px;
  }

  .colour-cell {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .colour-cell .swatch {
    flex-shrink: 0;
  }

  .palette-table code {
    font-size: 0.875rem;
    background: var(--color-background);
    padding: 0.125rem 0.375rem;
    border-radius: 3px;
  }

  .palette-table input[type="checkbox"] {
    width: auto;
    margin: 0;
  }
`}</style>