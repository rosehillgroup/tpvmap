import React from 'react';
import type { TPVColour } from '../lib/colour/blend';

interface SolverConstraints {
  maxComponents: number;
  stepPct: number;
  minPct: number;
  mode: 'percent' | 'parts';
  parts: {
    maxTotal: number;
    minPer: number;
  };
  forceComponents?: string[];
}

interface Props {
  constraints: SolverConstraints;
  onChange: (constraints: SolverConstraints) => void;
  tpvColours: TPVColour[];
}

export default function ConstraintsPanel({ constraints, onChange, tpvColours }: Props) {
  const styles = `
    .constraints-panel {
      background: var(--color-surface);
      border-radius: var(--radius);
      padding: 0;
      overflow: hidden;
      border: 1px solid var(--color-border-light);
    }

    .section {
      padding: 1.5rem;
      border-bottom: 1px solid var(--color-border-light);
    }

    .section:last-child {
      border-bottom: none;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .section-title {
      font-family: var(--font-heading);
      font-size: 1rem;
      font-weight: 600;
      color: var(--color-primary);
      margin: 0;
    }

    .section-description {
      font-size: 0.875rem;
      color: var(--color-text-light);
      margin: 0 0 1rem 0;
      line-height: 1.4;
    }

    /* Custom Radio Buttons */
    .radio-group {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .radio-option {
      position: relative;
      cursor: pointer;
    }

    .radio-option input {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
    }

    .radio-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 1rem;
      border: 2px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-background);
      transition: all 0.2s ease;
      text-align: center;
    }

    .radio-option input:checked + .radio-card {
      border-color: var(--color-accent);
      background: rgba(255, 107, 53, 0.08);
    }

    .radio-card:hover {
      border-color: var(--color-secondary);
    }

    .radio-title {
      font-weight: 600;
      color: var(--color-text);
      margin-bottom: 0.25rem;
    }

    .radio-example {
      font-size: 0.75rem;
      color: var(--color-text-light);
      font-family: 'SF Mono', 'Monaco', monospace;
    }

    /* Form Controls */
    .settings-grid {
      display: grid;
      gap: 1rem;
    }

    @media (min-width: 768px) {
      .settings-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    .form-group {
      margin-bottom: 0;
    }

    .form-label {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
      font-weight: 500;
      color: var(--color-text);
    }

    .current-value {
      font-size: 0.875rem;
      color: var(--color-accent);
      font-weight: 600;
    }

    .form-help {
      font-size: 0.75rem;
      color: var(--color-text-light);
      margin-top: 0.25rem;
      line-height: 1.3;
    }

    .slider-container {
      position: relative;
      margin: 0.5rem 0;
    }

    .slider {
      width: 100%;
      height: 6px;
      border-radius: 3px;
      background: var(--color-border-light);
      outline: none;
      appearance: none;
    }

    .slider::-webkit-slider-thumb {
      appearance: none;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--color-accent);
      cursor: pointer;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }

    .slider::-moz-range-thumb {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background: var(--color-accent);
      cursor: pointer;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }

    .slider-labels {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      color: var(--color-text-light);
      margin-top: 0.25rem;
    }

    select {
      width: 100%;
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-background);
      font-size: 0.875rem;
      font-family: inherit;
    }

    select:focus {
      outline: none;
      border-color: var(--color-accent);
      box-shadow: 0 0 0 3px rgba(255, 107, 53, 0.1);
    }

    /* Lock Components */
    .lock-components {
      padding: 1rem;
      background: var(--color-background);
      border-radius: var(--radius-sm);
      margin-top: 1rem;
    }

    .colour-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
      gap: 0.75rem;
      margin-top: 1rem;
    }

    .colour-option {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      cursor: pointer;
      padding: 0.5rem;
      border-radius: var(--radius-sm);
      transition: background-color 0.2s ease;
    }

    .colour-option:hover {
      background: var(--color-border-light);
    }

    .colour-option input {
      width: auto;
      margin: 0;
    }

    .colour-option .swatch {
      width: 28px;
      height: 28px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--color-border);
    }

    .colour-option span {
      font-size: 0.6875rem;
      font-weight: 500;
      text-align: center;
    }

    .expandable-section {
      border-top: 1px solid var(--color-border-light);
    }

    .expand-button {
      width: 100%;
      background: none;
      border: none;
      padding: 1rem 1.5rem;
      text-align: left;
      cursor: pointer;
      font-family: var(--font-heading);
      font-weight: 500;
      color: var(--color-primary);
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: background-color 0.2s ease;
    }

    .expand-button:hover {
      background: var(--color-background);
    }

    .expand-icon {
      transition: transform 0.2s ease;
    }

    .expand-button[aria-expanded="true"] .expand-icon {
      transform: rotate(180deg);
    }
  `;

  const handleChange = (field: keyof SolverConstraints, value: any) => {
    onChange({
      ...constraints,
      [field]: value
    });
  };

  const handlePartsChange = (field: keyof SolverConstraints['parts'], value: number) => {
    onChange({
      ...constraints,
      parts: {
        ...constraints.parts,
        [field]: value
      }
    });
  };

  const handleForceComponentToggle = (code: string) => {
    const current = constraints.forceComponents || [];
    if (current.includes(code)) {
      handleChange('forceComponents', current.filter(c => c !== code));
    } else {
      handleChange('forceComponents', [...current, code]);
    }
  };

  return (
    <>
      <style>{styles}</style>
      <div className="constraints-panel">
        <div className="section">
          <div className="section-header">
            <h3 className="section-title">📊 Output Format</h3>
          </div>
          <p className="section-description">
            Choose how you want your blend recipes displayed
          </p>
          
          <div className="radio-group">
            <label className="radio-option">
              <input 
                type="radio"
                value="percent"
                checked={constraints.mode === 'percent'}
                onChange={(e) => handleChange('mode', e.target.value)}
              />
              <div className="radio-card">
                <div className="radio-title">Percentages</div>
                <div className="radio-example">45% Red + 55% Blue</div>
              </div>
            </label>
            <label className="radio-option">
              <input 
                type="radio"
                value="parts"
                checked={constraints.mode === 'parts'}
                onChange={(e) => handleChange('mode', e.target.value)}
              />
              <div className="radio-card">
                <div className="radio-title">Parts</div>
                <div className="radio-example">9 parts Red + 11 parts Blue</div>
              </div>
            </label>
          </div>
        </div>

        <div className="section">
          <div className="section-header">
            <h3 className="section-title">⚙️ Blend Settings</h3>
          </div>
          <p className="section-description">
            Control how the colour matching algorithm searches for blends
          </p>
          
          <div className="settings-grid">

            <div className="form-group">
              <label className="form-label">
                Max Components
                <span className="current-value">{constraints.maxComponents} colours</span>
              </label>
              <select 
                value={constraints.maxComponents}
                onChange={(e) => handleChange('maxComponents', parseInt(e.target.value))}
              >
                <option value="2">2 components</option>
                <option value="3">3 components</option>
              </select>
              <p className="form-help">Maximum number of TPV colours to mix together</p>
            </div>

            <div className="form-group">
              <label className="form-label">
                Search Precision
                <span className="current-value">{(constraints.stepPct * 100).toFixed(1)}%</span>
              </label>
              <div className="slider-container">
                <input 
                  type="range"
                  className="slider"
                  value={constraints.stepPct * 100}
                  onChange={(e) => handleChange('stepPct', parseFloat(e.target.value) / 100)}
                  min="1"
                  max="10"
                  step="0.5"
                />
                <div className="slider-labels">
                  <span>Fine (1%)</span>
                  <span>Coarse (10%)</span>
                </div>
              </div>
              <p className="form-help">Lower values find more precise matches but take longer</p>
            </div>

            <div className="form-group">
              <label className="form-label">
                Smallest Component
                <span className="current-value">{(constraints.minPct * 100).toFixed(0)}%</span>
              </label>
              <div className="slider-container">
                <input 
                  type="range"
                  className="slider"
                  value={constraints.minPct * 100}
                  onChange={(e) => handleChange('minPct', parseFloat(e.target.value) / 100)}
                  min="5"
                  max="30"
                  step="1"
                />
                <div className="slider-labels">
                  <span>5% min</span>
                  <span>30% min</span>
                </div>
              </div>
              <p className="form-help">Minimum percentage any colour can contribute to a blend</p>
            </div>

            {constraints.mode === 'parts' && (
              <>
                <div className="form-group">
                  <label className="form-label">
                    Max Total Parts
                    <span className="current-value">{constraints.parts.maxTotal} parts</span>
                  </label>
                  <div className="slider-container">
                    <input 
                      type="range"
                      className="slider"
                      value={constraints.parts.maxTotal}
                      onChange={(e) => handlePartsChange('maxTotal', parseInt(e.target.value))}
                      min="3"
                      max="20"
                      step="1"
                    />
                    <div className="slider-labels">
                      <span>3 parts</span>
                      <span>20 parts</span>
                    </div>
                  </div>
                  <p className="form-help">Higher numbers give more precise ratios</p>
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Min Parts per Component
                    <span className="current-value">{constraints.parts.minPer} part{constraints.parts.minPer !== 1 ? 's' : ''}</span>
                  </label>
                  <div className="slider-container">
                    <input 
                      type="range"
                      className="slider"
                      value={constraints.parts.minPer}
                      onChange={(e) => handlePartsChange('minPer', parseInt(e.target.value))}
                      min="1"
                      max="5"
                      step="1"
                    />
                    <div className="slider-labels">
                      <span>1 part</span>
                      <span>5 parts</span>
                    </div>
                  </div>
                  <p className="form-help">Minimum parts any colour must contribute</p>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="expandable-section">
          <button 
            className="expand-button"
            onClick={() => {
              const content = document.getElementById('lock-components-content');
              const isExpanded = content?.style.display !== 'none';
              if (content) {
                content.style.display = isExpanded ? 'none' : 'block';
              }
              const button = document.querySelector('.expand-button');
              button?.setAttribute('aria-expanded', (!isExpanded).toString());
            }}
            aria-expanded="false"
          >
            <span>🔒 Lock Components (Optional)</span>
            <span className="expand-icon">▼</span>
          </button>
          <div id="lock-components-content" style={{ display: 'none' }}>
            <div className="lock-components">
              <p>Force these colours to be included in all blends</p>
              <div className="colour-grid">
                {tpvColours.map((colour) => (
                  <label key={colour.code} className="colour-option">
                    <input 
                      type="checkbox"
                      checked={constraints.forceComponents?.includes(colour.code) || false}
                      onChange={() => handleForceComponentToggle(colour.code)}
                    />
                    <div 
                      className="swatch"
                      style={{ backgroundColor: colour.hex }}
                      title={colour.name}
                    />
                    <span>{colour.code}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

