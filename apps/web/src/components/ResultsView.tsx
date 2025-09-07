import React, { useState, useEffect } from 'react';
import PaletteTable from './PaletteTable';
import ConstraintsPanel from './ConstraintsPanel';
import BlendPresets from './BlendPresets';
import RecipesTable from './RecipesTable';
import tpvColours from '../data/rosehill_tpv_21_colours.json';
import type { TPVColour } from '../lib/colour/blend';

interface Props {
  jobId: string;
}

interface PaletteEntry {
  id: string;
  rgb: { R: number; G: number; B: number };
  lab: { L: number; a: number; b: number };
  areaPct: number;
  pageIds?: string[];
}

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

export default function ResultsView({ jobId }: Props) {
  const [loading, setLoading] = useState(true);
  const [palette, setPalette] = useState<PaletteEntry[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  const [constraints, setConstraints] = useState<SolverConstraints>({
    maxComponents: 3,
    stepPct: 0.02,
    minPct: 0.10,
    mode: 'parts',
    parts: {
      maxTotal: 12,
      minPer: 1
    }
  });
  const [recipes, setRecipes] = useState<Record<string, Recipe[]>>({});
  const [solving, setSolving] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    loadPalette();
  }, [jobId]);

  const loadPalette = async () => {
    try {
      const response = await fetch(`/api/palette?jobId=${jobId}`);
      const data = await response.json();
      setPalette(data.palette || []);
    } catch (error) {
      console.error('Failed to load palette:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSolve = async () => {
    if (selectedTargets.length === 0) return;
    
    setSolving(true);
    try {
      const response = await fetch('/api/solve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          jobId,
          targetIds: selectedTargets,
          constraints
        })
      });
      
      const data = await response.json();
      setRecipes(data.recipes || {});
    } catch (error) {
      console.error('Failed to solve:', error);
    } finally {
      setSolving(false);
    }
  };

  const handleExport = async (format: 'csv' | 'json' | 'pdf') => {
    const params = new URLSearchParams({
      jobId,
      format,
      thickness_mm: '10',
      density_kg_m3: '1400',
      wastage_pct: '10'
    });
    
    window.open(`/api/export?${params}`, '_blank');
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading"></div>
        <p>Loading palette data...</p>
      </div>
    );
  }

  return (
    <div className="results-view">
      <div className="header">
        <div className="header-content">
          <h1>Color Match Results</h1>
          <p className="subtitle">Generated blends for your design colors</p>
        </div>
        <button className="btn btn-secondary" onClick={() => window.location.href = '/'}>
          ← New Design
        </button>
      </div>

      <div className="workflow">
        <div className="workflow-step active">
          <div className="step-header">
            <div className="step-number">1</div>
            <h2>Extracted Colors</h2>
            <span className="step-count">{palette.length} found</span>
          </div>
          <div className="card">
            <PaletteTable 
              palette={palette}
              selectedTargets={selectedTargets}
              onSelectionChange={setSelectedTargets}
            />
          </div>
        </div>

        <div className={`workflow-step ${selectedTargets.length > 0 ? 'active' : 'disabled'}`}>
          <div className="step-header">
            <div className="step-number">2</div>
            <h2>Blend Settings</h2>
            <span className="step-count">{selectedTargets.length} selected</span>
          </div>
          <div className="card">
            {!showAdvanced ? (
              <BlendPresets
                constraints={constraints}
                onChange={setConstraints}
                onAdvancedMode={() => setShowAdvanced(true)}
              />
            ) : (
              <div>
                <div className="advanced-header">
                  <h3>Advanced Settings</h3>
                  <button 
                    className="btn-link"
                    onClick={() => setShowAdvanced(false)}
                  >
                    ← Back to presets
                  </button>
                </div>
                <ConstraintsPanel 
                  constraints={constraints}
                  onChange={setConstraints}
                  tpvColours={tpvColours as TPVColour[]}
                />
              </div>
            )}
            
            <button 
              className="btn btn-primary generate-btn"
              onClick={handleSolve}
              disabled={selectedTargets.length === 0 || solving}
            >
              {solving ? (
                <>
                  <span className="loading"></span>
                  <span>Calculating blends...</span>
                </>
              ) : (
                `Generate ${selectedTargets.length} Blend${selectedTargets.length !== 1 ? 's' : ''}`
              )}
            </button>
          </div>
        </div>

        {Object.keys(recipes).length > 0 && (
          <div className="workflow-step active">
            <div className="step-header">
              <div className="step-number">3</div>
              <h2>Your Blends</h2>
              <span className="step-count">{Object.keys(recipes).length} recipes</span>
            </div>
            <div className="card">
              <RecipesTable 
                recipes={recipes}
                palette={palette}
                tpvColours={tpvColours as TPVColour[]}
                mode={constraints.mode}
              />
              <div className="export-section">
                <h4>Download Results</h4>
                <div className="export-buttons">
                  <button className="btn btn-secondary" onClick={() => handleExport('csv')}>
                    📊 Spreadsheet
                  </button>
                  <button className="btn btn-secondary" onClick={() => handleExport('json')}>
                    🔧 Data File
                  </button>
                  <button className="btn btn-accent" onClick={() => handleExport('pdf')}>
                    📄 Specification Sheet
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

<style>{`
  .results-view {
    max-width: 1400px;
    margin: 0 auto;
    padding: 1rem;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 3rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid var(--color-border-light);
  }

  .header-content h1 {
    margin-bottom: 0.5rem;
  }

  .subtitle {
    color: var(--color-text-light);
    font-size: 1.125rem;
    margin: 0;
  }

  .loading-container {
    text-align: center;
    padding: 6rem 2rem;
  }

  .loading-container .loading {
    width: 48px;
    height: 48px;
    border-width: 4px;
    margin: 0 auto 1.5rem;
  }

  .workflow {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }

  .workflow-step {
    position: relative;
    transition: all 0.3s ease;
  }

  .workflow-step.disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  .step-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .step-number {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: var(--color-accent);
    color: white;
    border-radius: 50%;
    font-family: var(--font-heading);
    font-weight: 600;
    font-size: 1.125rem;
    flex-shrink: 0;
  }

  .workflow-step.disabled .step-number {
    background: var(--color-text-muted);
  }

  .step-header h2 {
    margin: 0;
    font-size: 1.5rem;
  }

  .step-count {
    margin-left: auto;
    background: var(--color-background);
    color: var(--color-text-light);
    padding: 0.25rem 0.75rem;
    border-radius: 20px;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .advanced-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--color-border-light);
  }

  .advanced-header h3 {
    margin: 0;
  }

  .btn-link {
    background: none;
    border: none;
    color: var(--color-secondary);
    cursor: pointer;
    text-decoration: underline;
    font-family: var(--font-body);
    font-size: 0.875rem;
  }

  .btn-link:hover {
    color: var(--color-primary);
  }

  .generate-btn {
    width: 100%;
    margin-top: 2rem;
    font-size: 1.125rem;
    padding: 1rem 2rem;
  }

  .generate-btn .loading {
    margin-right: 0.75rem;
  }

  .export-section {
    margin-top: 2rem;
    padding-top: 2rem;
    border-top: 1px solid var(--color-border-light);
  }

  .export-section h4 {
    font-family: var(--font-heading);
    color: var(--color-primary);
    margin-bottom: 1rem;
    font-size: 1.125rem;
  }

  .export-buttons {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
  }

  .export-buttons .btn {
    justify-content: flex-start;
    gap: 0.5rem;
  }

  @media (max-width: 768px) {
    .results-view {
      padding: 0.5rem;
    }

    .header {
      flex-direction: column;
      align-items: stretch;
      gap: 1.5rem;
    }

    .step-header {
      flex-wrap: wrap;
    }

    .step-count {
      margin-left: 0;
      order: -1;
      margin-left: 51px;
    }

    .export-buttons {
      grid-template-columns: 1fr;
    }

    .advanced-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }
  }
`}</style>