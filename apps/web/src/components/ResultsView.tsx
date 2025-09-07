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
          <h1>Colour Match Results</h1>
          <p className="subtitle">Generated blends for your design colours</p>
        </div>
        <button className="btn btn-secondary" onClick={() => window.location.href = '/'}>
          ← New Design
        </button>
      </div>

      <div className="layout-container">
        <aside className="sidebar">
          <div className="sidebar-content">
            <div className="step-nav">
              <div className={`step-nav-item ${palette.length > 0 ? 'active' : 'pending'}`}>
                <div className="step-number">1</div>
                <div className="step-info">
                  <h3>Extract Colours</h3>
                  <span className="step-status">{palette.length} found</span>
                </div>
              </div>
              
              <div className={`step-nav-item ${selectedTargets.length > 0 ? 'active' : 'disabled'}`}>
                <div className="step-number">2</div>
                <div className="step-info">
                  <h3>Blend Settings</h3>
                  <span className="step-status">{selectedTargets.length} selected</span>
                </div>
              </div>
              
              <div className={`step-nav-item ${Object.keys(recipes).length > 0 ? 'active' : 'disabled'}`}>
                <div className="step-number">3</div>
                <div className="step-info">
                  <h3>Your Blends</h3>
                  <span className="step-status">{Object.keys(recipes).length} recipes</span>
                </div>
              </div>
            </div>

            {selectedTargets.length > 0 && (
              <div className="settings-panel">
                <h4>Blend Configuration</h4>
                {!showAdvanced ? (
                  <BlendPresets
                    constraints={constraints}
                    onChange={setConstraints}
                    onAdvancedMode={() => setShowAdvanced(true)}
                  />
                ) : (
                  <div>
                    <div className="advanced-header">
                      <h5>Advanced Settings</h5>
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
            )}
          </div>
        </aside>

        <main className="main-content">
          <section className="content-section">
            <div className="section-header">
              <h2>Extracted Colours</h2>
              <div className="section-badge">{palette.length} colours found</div>
            </div>
            <div className="card">
              <PaletteTable 
                palette={palette}
                selectedTargets={selectedTargets}
                onSelectionChange={setSelectedTargets}
              />
            </div>
          </section>

          {Object.keys(recipes).length > 0 && (
            <section className="content-section">
              <div className="section-header">
                <h2>Your Blend Recipes</h2>
                <div className="section-badge">{Object.keys(recipes).length} recipes generated</div>
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
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

<style>{`
  .results-view {
    max-width: 1600px;
    margin: 0 auto;
    padding: 1rem;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 3rem;
    padding: 2rem;
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
    border-radius: var(--radius);
    color: white;
  }

  .header-content h1 {
    margin-bottom: 0.5rem;
    color: white;
  }

  .subtitle {
    color: rgba(255,255,255,0.9);
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

  .layout-container {
    display: grid;
    grid-template-columns: 350px 1fr;
    gap: 2rem;
    align-items: start;
  }

  .sidebar {
    position: sticky;
    top: 2rem;
  }

  .sidebar-content {
    background: var(--color-surface);
    border-radius: var(--radius);
    box-shadow: var(--shadow-md);
    border: 1px solid var(--color-border-light);
  }

  .step-nav {
    padding: 2rem;
    border-bottom: 1px solid var(--color-border-light);
  }

  .step-nav-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    margin-bottom: 1rem;
    border-radius: var(--radius-sm);
    transition: all 0.3s ease;
  }

  .step-nav-item.active {
    background: rgba(255, 107, 53, 0.1);
    border-left: 4px solid var(--color-accent);
  }

  .step-nav-item.pending {
    background: rgba(27, 79, 156, 0.05);
  }

  .step-nav-item.disabled {
    opacity: 0.5;
  }

  .step-nav-item .step-number {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: var(--color-accent);
    color: white;
    border-radius: 50%;
    font-family: var(--font-heading);
    font-weight: 600;
    font-size: 1rem;
    flex-shrink: 0;
  }

  .step-nav-item.disabled .step-number {
    background: var(--color-text-muted);
  }

  .step-nav-item.pending .step-number {
    background: var(--color-secondary);
  }

  .step-info h3 {
    margin: 0;
    font-size: 1rem;
    color: var(--color-primary);
    font-family: var(--font-heading);
  }

  .step-status {
    font-size: 0.875rem;
    color: var(--color-text-light);
  }

  .settings-panel {
    padding: 2rem;
  }

  .settings-panel h4 {
    font-family: var(--font-heading);
    color: var(--color-primary);
    margin-bottom: 1.5rem;
    font-size: 1.125rem;
  }

  .advanced-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--color-border-light);
  }

  .advanced-header h5 {
    margin: 0;
    font-family: var(--font-heading);
    color: var(--color-primary);
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

  .main-content {
    display: flex;
    flex-direction: column;
    gap: 3.5rem;
  }

  .content-section {
    background: var(--color-surface-tinted);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 2rem 2rem 1rem 2rem;
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border-light);
  }

  .section-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--color-primary);
  }

  .section-badge {
    background: var(--color-accent);
    color: white;
    padding: 0.375rem 0.875rem;
    border-radius: 20px;
    font-size: 0.875rem;
    font-weight: 500;
  }

  .content-section .card {
    margin: 0;
    border-radius: 0;
    border: none;
    box-shadow: none;
    padding: 3rem;
  }

  .export-section {
    margin-top: 3rem;
    padding-top: 3rem;
    border-top: 1px solid var(--color-border-light);
  }

  .export-section h4 {
    font-family: var(--font-heading);
    color: var(--color-primary);
    margin-bottom: 1.5rem;
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

  @media (max-width: 1024px) {
    .layout-container {
      grid-template-columns: 1fr;
      gap: 2rem;
    }

    .sidebar {
      position: static;
      order: -1;
    }

    .main-content {
      gap: 2rem;
    }

    .content-section .card {
      padding: 2rem;
    }
  }

  @media (max-width: 768px) {
    .results-view {
      padding: 0.5rem;
    }

    .header {
      flex-direction: column;
      align-items: stretch;
      gap: 1.5rem;
      padding: 1.5rem;
    }

    .step-nav {
      padding: 1.5rem;
    }

    .settings-panel {
      padding: 1.5rem;
    }

    .section-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 1.5rem;
    }

    .content-section .card {
      padding: 1.5rem;
    }

    .export-section {
      margin-top: 2rem;
      padding-top: 2rem;
    }

    .export-buttons {
      grid-template-columns: 1fr;
    }
  }
`}</style>