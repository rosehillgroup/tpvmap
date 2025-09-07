import React from 'react';
import { rgbToHex } from '../lib/colour/convert';
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

interface Props {
  recipe: Recipe;
  tpvColours: TPVColour[];
  mode: 'percent' | 'parts';
  onPin?: () => void;
  isPinned?: boolean;
}

export default function VisualRecipe({ recipe, tpvColours, mode, onPin, isPinned }: Props) {
  const getTPVColour = (code: string): TPVColour | undefined => {
    return tpvColours.find(c => c.code === code);
  };

  const resultHex = rgbToHex(recipe.rgb);
  
  const components = Object.entries(recipe.weights).map(([code, weight]) => ({
    code,
    weight,
    colour: getTPVColour(code),
    parts: recipe.parts?.[code]
  }));

  const getAccuracyClass = (deltaE: number) => {
    if (deltaE < 1) return 'excellent';
    if (deltaE < 2) return 'good';
    return 'fair';
  };

  const getAccuracyLabel = (deltaE: number) => {
    if (deltaE < 1) return 'Excellent match';
    if (deltaE < 2) return 'Good match';
    return 'Fair match';
  };

  return (
    <div className={`visual-recipe ${isPinned ? 'pinned' : ''}`}>
      <div className="recipe-header">
        <div className="result-preview">
          <div 
            className="result-swatch"
            style={{ backgroundColor: resultHex }}
          />
          <div className="result-info">
            <span className="result-hex">{resultHex}</span>
            <div className={`accuracy-badge ${getAccuracyClass(recipe.deltaE)}`}>
              ΔE {recipe.deltaE.toFixed(2)} • {getAccuracyLabel(recipe.deltaE)}
            </div>
          </div>
        </div>
        
        {onPin && (
          <button 
            className="pin-btn"
            onClick={onPin}
            title={isPinned ? 'Unpin recipe' : 'Pin recipe'}
          >
            {isPinned ? '📌' : '📍'}
          </button>
        )}
      </div>

      <div className="recipe-formula">
        <div className="components-visual">
          {components.map(({ code, weight, colour, parts }, index) => (
            <div key={code} className="component-item">
              <div className="component-visual">
                <div 
                  className="component-swatch"
                  style={{ backgroundColor: colour?.hex || '#cccccc' }}
                />
                <div className="component-info">
                  <span className="component-code">{code}</span>
                  <span className="component-name">{colour?.name || 'Unknown'}</span>
                </div>
              </div>
              
              <div className="component-amount">
                {mode === 'parts' && parts ? (
                  <div className="parts-display">
                    <span className="parts-value">{parts} part{parts !== 1 ? 's' : ''}</span>
                    <span className="percentage-equiv">≈ {(weight * 100).toFixed(1)}%</span>
                  </div>
                ) : (
                  <span className="percentage-value">{(weight * 100).toFixed(1)}%</span>
                )}
              </div>

              {index < components.length - 1 && <div className="component-separator">+</div>}
            </div>
          ))}
        </div>

        <div className="ratio-bar">
          {components.map(({ code, weight, colour }) => (
            <div 
              key={code}
              className="ratio-segment"
              style={{ 
                width: `${weight * 100}%`,
                backgroundColor: colour?.hex || '#cccccc'
              }}
              title={`${code}: ${(weight * 100).toFixed(1)}%`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

<style>{`
  .visual-recipe {
    background: var(--color-surface);
    border: 1px solid var(--color-border-light);
    border-radius: var(--radius);
    padding: 1.5rem;
    margin-bottom: 1rem;
    transition: all 0.3s ease;
  }

  .visual-recipe:hover {
    box-shadow: var(--shadow-md);
    border-color: var(--color-accent);
    transform: translateY(-2px);
  }

  .visual-recipe.pinned {
    border-color: var(--color-accent);
    background: rgba(255, 107, 53, 0.05);
    box-shadow: var(--shadow-sm);
  }

  .recipe-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .result-preview {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .result-swatch {
    width: 48px;
    height: 48px;
    border-radius: var(--radius-sm);
    border: 2px solid var(--color-border-light);
    box-shadow: var(--shadow-sm);
    flex-shrink: 0;
  }

  .result-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .result-hex {
    font-family: 'SF Mono', 'Monaco', monospace;
    font-weight: 600;
    font-size: 1rem;
    color: var(--color-text);
  }

  .accuracy-badge {
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .accuracy-badge.excellent {
    background: rgba(75, 170, 52, 0.15);
    color: #2D7D32;
    border: 1px solid rgba(75, 170, 52, 0.3);
  }

  .accuracy-badge.good {
    background: rgba(255, 107, 53, 0.15);
    color: #E65100;
    border: 1px solid rgba(255, 107, 53, 0.3);
  }

  .accuracy-badge.fair {
    background: var(--color-background);
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }

  .pin-btn {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 1.25rem;
    padding: 0.5rem;
    border-radius: var(--radius-sm);
    opacity: 0.6;
    transition: all 0.2s ease;
  }

  .pin-btn:hover {
    opacity: 1;
    background: var(--color-background);
  }

  .visual-recipe.pinned .pin-btn {
    opacity: 1;
  }

  .recipe-formula {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .components-visual {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .component-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .component-visual {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background: var(--color-background);
    padding: 0.75rem 1rem;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border-light);
  }

  .component-swatch {
    width: 32px;
    height: 32px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border-light);
    box-shadow: var(--shadow-sm);
    flex-shrink: 0;
  }

  .component-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .component-code {
    font-family: 'SF Mono', 'Monaco', monospace;
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--color-text);
  }

  .component-name {
    font-size: 0.75rem;
    color: var(--color-text-light);
    line-height: 1.2;
  }

  .component-amount {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;
  }

  .parts-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;
  }

  .parts-value {
    font-family: var(--font-heading);
    font-weight: 600;
    font-size: 1rem;
    color: var(--color-primary);
  }

  .percentage-equiv {
    font-size: 0.75rem;
    color: var(--color-text-light);
    font-family: 'SF Mono', 'Monaco', monospace;
  }

  .percentage-value {
    font-family: var(--font-heading);
    font-weight: 600;
    font-size: 1rem;
    color: var(--color-primary);
  }

  .component-separator {
    font-size: 1.125rem;
    color: var(--color-text-light);
    font-weight: 600;
    margin: 0 0.5rem;
  }

  .ratio-bar {
    display: flex;
    height: 8px;
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid var(--color-border-light);
    box-shadow: inset 0 1px 2px rgba(0,0,0,0.1);
  }

  .ratio-segment {
    transition: all 0.3s ease;
  }

  .ratio-segment:hover {
    filter: brightness(1.1);
  }

  @media (max-width: 768px) {
    .visual-recipe {
      padding: 1.25rem;
    }

    .result-preview {
      gap: 0.75rem;
    }

    .result-swatch {
      width: 40px;
      height: 40px;
    }

    .components-visual {
      flex-direction: column;
      align-items: stretch;
      gap: 0.5rem;
    }

    .component-item {
      justify-content: space-between;
      width: 100%;
    }

    .component-visual {
      flex: 1;
    }

    .component-separator {
      display: none;
    }
  }
`}</style>