import React, { useState, useEffect } from 'react';
import PaletteTable from './PaletteTable';
import ConstraintsPanel from './ConstraintsPanel';
import RecipesTable from './RecipesTable';
import tpvColours from '../../../data/rosehill_tpv_21_colours.json';
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
        <h1>Palette Extraction Results</h1>
        <button className="btn btn-secondary" onClick={() => window.location.href = '/'}>
          Upload New Design
        </button>
      </div>

      <div className="card">
        <h2>Extracted Colours</h2>
        <PaletteTable 
          palette={palette}
          selectedTargets={selectedTargets}
          onSelectionChange={setSelectedTargets}
        />
      </div>

      <div className="card">
        <h2>Blend Configuration</h2>
        <ConstraintsPanel 
          constraints={constraints}
          onChange={setConstraints}
          tpvColours={tpvColours as TPVColour[]}
        />
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
            'Generate Blends'
          )}
        </button>
      </div>

      {Object.keys(recipes).length > 0 && (
        <div className="card">
          <h2>Recommended Blends</h2>
          <RecipesTable 
            recipes={recipes}
            palette={palette}
            tpvColours={tpvColours as TPVColour[]}
            mode={constraints.mode}
          />
          <div className="export-buttons">
            <button className="btn btn-secondary" onClick={() => handleExport('csv')}>
              Export CSV
            </button>
            <button className="btn btn-secondary" onClick={() => handleExport('json')}>
              Export JSON
            </button>
            <button className="btn btn-primary" onClick={() => handleExport('pdf')}>
              Export PDF Spec
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

<style>{`
  .results-view {
    max-width: 1400px;
    margin: 0 auto;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .loading-container {
    text-align: center;
    padding: 4rem;
  }

  .loading-container .loading {
    width: 48px;
    height: 48px;
    border-width: 4px;
    margin: 0 auto 1rem;
  }

  .generate-btn {
    margin-top: 1.5rem;
  }

  .generate-btn .loading {
    margin-right: 0.5rem;
  }

  .export-buttons {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  @media (max-width: 768px) {
    .header {
      flex-direction: column;
      gap: 1rem;
    }

    .export-buttons {
      flex-direction: column;
    }
  }
`}</style>