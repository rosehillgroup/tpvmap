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
    <div className="constraints-panel">
      <div className="grid grid-2">
        <div className="form-group">
          <label>Mode</label>
          <div className="radio-group">
            <label>
              <input 
                type="radio"
                value="percent"
                checked={constraints.mode === 'percent'}
                onChange={(e) => handleChange('mode', e.target.value)}
              />
              <span>Percentages</span>
            </label>
            <label>
              <input 
                type="radio"
                value="parts"
                checked={constraints.mode === 'parts'}
                onChange={(e) => handleChange('mode', e.target.value)}
              />
              <span>Parts</span>
            </label>
          </div>
        </div>

        <div className="form-group">
          <label>Max Components</label>
          <select 
            value={constraints.maxComponents}
            onChange={(e) => handleChange('maxComponents', parseInt(e.target.value))}
          >
            <option value="2">2 components</option>
            <option value="3">3 components</option>
          </select>
        </div>

        <div className="form-group">
          <label>Ratio Step (%)</label>
          <input 
            type="number"
            value={constraints.stepPct * 100}
            onChange={(e) => handleChange('stepPct', parseFloat(e.target.value) / 100)}
            min="1"
            max="10"
            step="0.5"
          />
        </div>

        <div className="form-group">
          <label>Minimum Share (%)</label>
          <input 
            type="number"
            value={constraints.minPct * 100}
            onChange={(e) => handleChange('minPct', parseFloat(e.target.value) / 100)}
            min="5"
            max="30"
            step="1"
          />
        </div>

        {constraints.mode === 'parts' && (
          <>
            <div className="form-group">
              <label>Max Total Parts</label>
              <input 
                type="number"
                value={constraints.parts.maxTotal}
                onChange={(e) => handlePartsChange('maxTotal', parseInt(e.target.value))}
                min="3"
                max="20"
                step="1"
              />
            </div>

            <div className="form-group">
              <label>Min Parts per Component</label>
              <input 
                type="number"
                value={constraints.parts.minPer}
                onChange={(e) => handlePartsChange('minPer', parseInt(e.target.value))}
                min="1"
                max="5"
                step="1"
              />
            </div>
          </>
        )}
      </div>

      <details>
        <summary>Lock Components (Optional)</summary>
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
      </details>
    </div>
  );
}

<style>{`
  .constraints-panel {
    background: var(--color-background);
    padding: 1.5rem;
    border-radius: var(--radius);
  }

  .radio-group {
    display: flex;
    gap: 1.5rem;
  }

  .radio-group label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: normal;
  }

  .radio-group input {
    width: auto;
  }

  details {
    margin-top: 1.5rem;
  }

  summary {
    cursor: pointer;
    font-weight: 500;
    padding: 0.5rem 0;
  }

  .lock-components {
    margin-top: 1rem;
  }

  .lock-components p {
    font-size: 0.875rem;
    margin-bottom: 0.75rem;
  }

  .colour-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
    gap: 0.75rem;
  }

  .colour-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    cursor: pointer;
    font-weight: normal;
  }

  .colour-option input {
    width: auto;
    margin: 0;
  }

  .colour-option .swatch {
    width: 32px;
    height: 32px;
  }

  .colour-option span {
    font-size: 0.75rem;
  }
`}</style>