import React from 'react';

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
  onAdvancedMode: () => void;
}

const PRESETS = {
  quick: {
    name: 'Quick Match',
    description: 'Fast results with 2-3 colours',
    icon: '⚡',
    constraints: {
      maxComponents: 2,
      stepPct: 0.05,
      minPct: 0.15,
      mode: 'parts' as const,
      parts: { maxTotal: 10, minPer: 2 }
    }
  },
  precise: {
    name: 'Precise Match',
    description: 'More accurate with fine tuning',
    icon: '🎯',
    constraints: {
      maxComponents: 3,
      stepPct: 0.02,
      minPct: 0.10,
      mode: 'parts' as const,
      parts: { maxTotal: 12, minPer: 1 }
    }
  },
  custom: {
    name: 'Custom Settings',
    description: 'Full control over all options',
    icon: '⚙️',
    constraints: null
  }
};

export default function BlendPresets({ constraints, onChange, onAdvancedMode }: Props) {
  const currentPreset = Object.entries(PRESETS).find(([key, preset]) => 
    preset.constraints && 
    JSON.stringify(preset.constraints) === JSON.stringify({
      maxComponents: constraints.maxComponents,
      stepPct: constraints.stepPct,
      minPct: constraints.minPct,
      mode: constraints.mode,
      parts: constraints.parts
    })
  )?.[0] || 'custom';

  const handlePresetSelect = (presetKey: string) => {
    const preset = PRESETS[presetKey as keyof typeof PRESETS];
    if (preset.constraints) {
      onChange({
        ...preset.constraints,
        forceComponents: constraints.forceComponents
      });
    } else {
      onAdvancedMode();
    }
  };

  return (
    <div className="blend-presets">
      <h3>Choose your blend approach</h3>
      <div className="preset-grid">
        {Object.entries(PRESETS).map(([key, preset]) => (
          <button
            key={key}
            className={`preset-card ${currentPreset === key ? 'active' : ''}`}
            onClick={() => handlePresetSelect(key)}
          >
            <div className="preset-icon">{preset.icon}</div>
            <div className="preset-content">
              <h4>{preset.name}</h4>
              <p>{preset.description}</p>
            </div>
          </button>
        ))}
      </div>
      
      {currentPreset !== 'custom' && (
        <div className="preset-summary">
          <h4>Current settings:</h4>
          <div className="settings-grid">
            <div className="setting">
              <span className="label">Max components:</span>
              <span className="value">{constraints.maxComponents}</span>
            </div>
            <div className="setting">
              <span className="label">Output format:</span>
              <span className="value">{constraints.mode === 'parts' ? 'Parts ratio' : 'Percentages'}</span>
            </div>
            <div className="setting">
              <span className="label">Precision:</span>
              <span className="value">{constraints.stepPct === 0.02 ? 'High' : 'Standard'}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

<style>{`
  .blend-presets {
    padding: 0;
  }

  .blend-presets h3 {
    font-family: var(--font-heading);
    color: var(--color-primary);
    margin-bottom: 1.5rem;
    font-size: 1.25rem;
  }

  .preset-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .preset-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1.25rem;
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius);
    cursor: pointer;
    transition: all 0.3s ease;
    text-align: left;
    font-family: var(--font-body);
  }

  .preset-card:hover {
    border-color: var(--color-secondary);
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }

  .preset-card.active {
    border-color: var(--color-accent);
    background: rgba(255, 107, 53, 0.05);
    box-shadow: var(--shadow-md);
  }

  .preset-icon {
    font-size: 2rem;
    flex-shrink: 0;
  }

  .preset-content h4 {
    font-family: var(--font-heading);
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-primary);
    margin-bottom: 0.25rem;
  }

  .preset-content p {
    color: var(--color-text-light);
    font-size: 0.875rem;
    margin: 0;
    line-height: 1.4;
  }

  .preset-summary {
    background: var(--color-background);
    border-radius: var(--radius-sm);
    padding: 1.25rem;
    border-left: 4px solid var(--color-accent);
  }

  .preset-summary h4 {
    font-family: var(--font-heading);
    font-size: 1rem;
    color: var(--color-primary);
    margin-bottom: 1rem;
  }

  .settings-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 0.75rem;
  }

  .setting {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
  }

  .setting .label {
    color: var(--color-text-light);
    font-size: 0.875rem;
  }

  .setting .value {
    color: var(--color-text);
    font-weight: 500;
    font-size: 0.875rem;
  }

  @media (max-width: 768px) {
    .preset-grid {
      grid-template-columns: 1fr;
    }
    
    .settings-grid {
      grid-template-columns: 1fr;
    }
    
    .setting {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.25rem;
    }
  }
`}</style>