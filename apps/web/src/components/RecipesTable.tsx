import React, { useState } from 'react';
import { rgbToHex } from '../lib/colour/convert';
import { formatParts, formatPercentages } from '../lib/colour/parts';
import type { TPVColour } from '../lib/colour/blend';

interface Recipe {
  kind: 'percent' | 'parts';
  weights: Record<string, number>;
  parts?: Record<string, number>;
  total?: number;
  rgb: { R: number; G: number; B: number };
  lab: { L: number; a: number; b: number };
  deltaE: number;
  note?: string;
}

interface PaletteEntry {
  id: string;
  rgb: { R: number; G: number; B: number };
  lab: { L: number; a: number; b: number };
  areaPct: number;
}

interface Props {
  recipes: Record<string, Recipe[]>;
  palette: PaletteEntry[];
  tpvColours: TPVColour[];
  mode: 'percent' | 'parts';
}

export default function RecipesTable({ recipes, palette, tpvColours, mode }: Props) {
  const [pinnedRecipes, setPinnedRecipes] = useState<Record<string, number>>({});

  const styles = `
  .recipes-table {
    display: flex;
    flex-direction: column;
    gap: 4rem;
  }

  .target-section {
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius);
    overflow: hidden;
    box-shadow: var(--shadow-md);
  }

  .target-header {
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
    padding: 2rem;
    color: white;
  }

  .target-info {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .target-info .swatch {
    width: 72px;
    height: 72px;
    border-radius: var(--radius);
    box-shadow: 0 0 0 4px rgba(255,255,255,0.3);
    flex-shrink: 0;
  }

  .target-info h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.375rem;
    font-family: var(--font-heading);
    font-weight: 600;
    color: white;
  }

  .target-info p {
    margin: 0;
    font-size: 1rem;
    color: rgba(255,255,255,0.9);
  }

  .target-section table {
    border-collapse: collapse;
    background: var(--color-surface);
  }

  .target-section th {
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

  .target-section td {
    padding: 1.75rem 1rem;
    border-bottom: 1px solid var(--color-border-light);
    vertical-align: middle;
  }

  .target-section tr {
    transition: background-color 0.2s ease;
  }

  .target-section tr:hover {
    background: rgba(255, 107, 53, 0.05);
  }

  .pin-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.25rem;
    padding: 0.5rem;
    border-radius: var(--radius-sm);
    opacity: 0.5;
    transition: all 0.2s ease;
  }

  .pin-btn:hover {
    opacity: 1;
    background: var(--color-background);
  }

  tr.pinned {
    background: rgba(255, 107, 53, 0.08);
    border-left: 4px solid var(--color-accent);
  }

  tr.pinned + tr:not(.pinned) {
    border-top: 2px solid var(--color-border);
  }

  tr.pinned .pin-btn {
    opacity: 1;
    color: var(--color-accent);
  }

  .recipe-text {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    min-width: 200px;
  }

  .recipe-text strong {
    font-family: 'SF Mono', 'Monaco', monospace;
    font-size: 1rem;
    color: var(--color-text);
    background: var(--color-background);
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-sm);
    display: inline-block;
  }

  .recipe-text .approx {
    font-size: 0.875rem;
    color: var(--color-text-light);
    font-family: 'SF Mono', 'Monaco', monospace;
  }

  .components {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    margin-top: 0.75rem;
  }

  .component {
    font-size: 0.75rem;
    background: var(--color-background);
    color: var(--color-text-light);
    padding: 0.375rem 0.625rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border-light);
  }

  .preview-cell {
    display: flex;
    align-items: center;
    gap: 1rem;
    min-width: 140px;
  }

  .preview-cell .swatch {
    width: 56px;
    height: 56px;
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-sm);
    border: 2px solid var(--color-border-light);
    flex-shrink: 0;
  }

  .preview-cell span {
    font-family: 'SF Mono', 'Monaco', monospace;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .delta-e {
    font-weight: 600;
    font-size: 1rem;
    padding: 0.375rem 0.75rem;
    border-radius: var(--radius-sm);
    text-align: center;
    min-width: 70px;
  }

  .delta-e.excellent {
    background: rgba(75, 170, 52, 0.15);
    color: #2D7D32;
    border: 1px solid rgba(75, 170, 52, 0.3);
  }

  .delta-e.good {
    background: rgba(255, 107, 53, 0.15);
    color: #E65100;
    border: 1px solid rgba(255, 107, 53, 0.3);
  }

  .delta-e.fair {
    background: var(--color-background);
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }

  /* Match Quality Legend */
  .match-quality-legend {
    margin-top: 3rem;
    padding: 1.5rem;
    background: var(--color-background);
    border-radius: var(--radius);
    border: 1px solid var(--color-border-light);
  }

  .match-quality-legend h4 {
    font-family: var(--font-heading);
    font-size: 1rem;
    color: var(--color-primary);
    margin: 0 0 0.5rem 0;
  }

  .match-quality-legend > p {
    font-size: 0.875rem;
    color: var(--color-text-light);
    margin: 0 0 1rem 0;
    line-height: 1.4;
  }

  .quality-levels {
    display: grid;
    gap: 0.75rem;
  }

  .quality-level {
    display: grid;
    grid-template-columns: 100px 80px 1fr;
    gap: 1rem;
    align-items: center;
    padding: 0.75rem;
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    border: 1px solid var(--color-border-light);
  }

  .quality-badge {
    font-weight: 600;
    font-size: 0.875rem;
    padding: 0.25rem 0.75rem;
    border-radius: var(--radius-sm);
    text-align: center;
  }

  .quality-level.excellent .quality-badge {
    background: rgba(75, 170, 52, 0.15);
    color: #2D7D32;
    border: 1px solid rgba(75, 170, 52, 0.3);
  }

  .quality-level.good .quality-badge {
    background: rgba(255, 107, 53, 0.15);
    color: #E65100;
    border: 1px solid rgba(255, 107, 53, 0.3);
  }

  .quality-level.fair .quality-badge {
    background: var(--color-background);
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }

  .quality-range {
    font-family: 'SF Mono', 'Monaco', monospace;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--color-text);
  }

  .quality-desc {
    font-size: 0.8125rem;
    color: var(--color-text-light);
    line-height: 1.3;
  }

  @media (max-width: 768px) {
    .target-header {
      padding: 1.5rem;
    }

    .target-info {
      gap: 1rem;
    }

    .target-info .swatch {
      width: 60px;
      height: 60px;
    }

    .target-section th,
    .target-section td {
      padding: 1.25rem 0.75rem;
    }

    .recipe-text {
      min-width: unset;
    }

    .components {
      gap: 0.25rem;
    }

    .component {
      font-size: 0.6875rem;
      padding: 0.25rem 0.5rem;
    }

    .preview-cell {
      gap: 0.75rem;
      min-width: unset;
    }

    .preview-cell .swatch {
      width: 48px;
      height: 48px;
    }

    .quality-level {
      grid-template-columns: 1fr;
      gap: 0.5rem;
      text-align: center;
    }

    .quality-badge {
      width: fit-content;
      margin: 0 auto;
    }
  }
  `;

  const handlePin = (targetId: string, recipeIndex: number) => {
    setPinnedRecipes({
      ...pinnedRecipes,
      [targetId]: recipeIndex
    });
  };

  const getTPVName = (code: string): string => {
    const colour = tpvColours.find(c => c.code === code);
    return colour ? `${code} ${colour.name}` : code;
  };

  return (
    <>
      <style>{styles}</style>
      <div className="recipes-table">
      {Object.entries(recipes).map(([targetId, targetRecipes]) => {
        const target = palette.find(p => p.id === targetId);
        if (!target) return null;

        const targetHex = rgbToHex(target.rgb);
        const pinnedIndex = pinnedRecipes[targetId] ?? 0;

        return (
          <div key={targetId} className="target-section">
            <div className="target-header">
              <div className="target-info">
                <div 
                  className="swatch"
                  style={{ backgroundColor: targetHex }}
                />
                <div>
                  <h3>Target Colour: {targetHex}</h3>
                  <p>Coverage: {target.areaPct.toFixed(1)}% of design</p>
                </div>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Pin</th>
                  <th>Recipe</th>
                  <th>Preview</th>
                  <th title="ΔE2000 colour difference - lower values mean better matches">
                    Match Quality 
                    <span style={{ fontSize: '0.75rem', fontWeight: 'normal', marginLeft: '0.25rem' }}>
                      (ΔE2000)
                    </span>
                  </th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {[...targetRecipes]
                  .sort((a, b) => a.deltaE - b.deltaE)
                  .map((recipe, index) => {
                  const recipeHex = rgbToHex(recipe.rgb);
                  const isPinned = pinnedIndex === index;
                  
                  return (
                    <tr key={index} className={isPinned ? 'pinned' : ''}>
                      <td>
                        <button 
                          className="pin-btn"
                          onClick={() => handlePin(targetId, index)}
                          title={isPinned ? 'Pinned' : 'Pin this recipe'}
                        >
                          {isPinned ? '📌' : '📍'}
                        </button>
                      </td>
                      <td>
                        {mode === 'parts' && recipe.parts ? (
                          <div className="recipe-text">
                            <strong>{formatParts(recipe.parts)}</strong>
                            <span className="approx">≈ {formatPercentages(recipe.weights)}</span>
                          </div>
                        ) : (
                          <div className="recipe-text">
                            <strong>{formatPercentages(recipe.weights)}</strong>
                          </div>
                        )}
                        <div className="components">
                          {Object.entries(recipe.weights)
                            .sort(([,a], [,b]) => b - a) // Sort by weight descending to match parts/percentages order
                            .map(([code, weight]) => (
                            <span key={code} className="component">
                              {getTPVName(code)}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div className="preview-cell">
                          <div 
                            className="swatch"
                            style={{ backgroundColor: recipeHex }}
                          />
                          <span>{recipeHex}</span>
                        </div>
                      </td>
                      <td className={`delta-e ${recipe.deltaE < 1 ? 'excellent' : recipe.deltaE < 2 ? 'good' : 'fair'}`}>
                        {recipe.deltaE.toFixed(2)}
                      </td>
                      <td>{recipe.note || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
      
      {Object.keys(recipes).length > 0 && (
        <div className="match-quality-legend">
          <h4>Understanding Match Quality (ΔE2000)</h4>
          <p>ΔE2000 is the industry standard for measuring colour difference. Lower values mean better matches:</p>
          <div className="quality-levels">
            <div className="quality-level excellent">
              <span className="quality-badge">Excellent</span>
              <span className="quality-range">&lt; 1.0</span>
              <span className="quality-desc">Virtually indistinguishable to the human eye</span>
            </div>
            <div className="quality-level good">
              <span className="quality-badge">Good</span>
              <span className="quality-range">1.0 - 2.0</span>
              <span className="quality-desc">Very close match, minor difference only visible side-by-side</span>
            </div>
            <div className="quality-level fair">
              <span className="quality-badge">Fair</span>
              <span className="quality-range">&gt; 2.0</span>
              <span className="quality-desc">Visible difference, but may be acceptable depending on use</span>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}