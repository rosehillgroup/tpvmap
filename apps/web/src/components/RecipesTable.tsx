import React, { useState } from 'react';
import { rgbToHex } from '../lib/colour/convert';
import { formatParts, formatPercentages } from '../lib/colour/parts';
import VisualRecipe from './VisualRecipe';
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
    <div className="recipes-container">
      {Object.entries(recipes).map(([targetId, targetRecipes]) => {
        const target = palette.find(p => p.id === targetId);
        if (!target) return null;

        const targetHex = rgbToHex(target.rgb);
        const pinnedIndex = pinnedRecipes[targetId] ?? 0;

        // Sort recipes by accuracy (deltaE)
        const sortedRecipes = [...targetRecipes].sort((a, b) => a.deltaE - b.deltaE);

        return (
          <div key={targetId} className="target-group">
            <div className="target-header">
              <div className="target-info">
                <div 
                  className="target-swatch"
                  style={{ backgroundColor: targetHex }}
                />
                <div className="target-details">
                  <h3>Target Colour: {targetHex}</h3>
                  <p>Coverage: {target.areaPct.toFixed(1)}% of design</p>
                </div>
              </div>
              <div className="target-stats">
                <span className="recipe-count">{targetRecipes.length} recipe{targetRecipes.length !== 1 ? 's' : ''}</span>
              </div>
            </div>

            <div className="recipes-grid">
              {sortedRecipes.map((recipe, index) => {
                const originalIndex = targetRecipes.indexOf(recipe);
                const isPinned = pinnedIndex === originalIndex;
                
                return (
                  <VisualRecipe
                    key={originalIndex}
                    recipe={recipe}
                    tpvColours={tpvColours}
                    mode={mode}
                    onPin={() => handlePin(targetId, originalIndex)}
                    isPinned={isPinned}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

<style>{`
  .recipes-container {
    display: flex;
    flex-direction: column;
    gap: 3rem;
  }

  .target-group {
    border-radius: var(--radius);
    overflow: hidden;
    box-shadow: var(--shadow-md);
    background: var(--color-surface);
  }

  .target-header {
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%);
    padding: 2rem;
    color: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .target-info {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .target-swatch {
    width: 72px;
    height: 72px;
    border-radius: var(--radius);
    box-shadow: 0 0 0 4px rgba(255,255,255,0.3);
    flex-shrink: 0;
  }

  .target-details h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.375rem;
    font-family: var(--font-heading);
    font-weight: 600;
    color: white;
  }

  .target-details p {
    margin: 0;
    font-size: 1rem;
    color: rgba(255,255,255,0.9);
    font-weight: 300;
  }

  .target-stats {
    text-align: right;
  }

  .recipe-count {
    background: rgba(255,255,255,0.2);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-size: 0.875rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .recipes-grid {
    padding: 2rem;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
    gap: 1.5rem;
  }

  @media (max-width: 1200px) {
    .recipes-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 768px) {
    .target-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 1.5rem;
      padding: 1.5rem;
    }

    .target-info {
      gap: 1rem;
      width: 100%;
    }

    .target-swatch {
      width: 60px;
      height: 60px;
    }

    .target-details h3 {
      font-size: 1.125rem;
    }

    .target-details p {
      font-size: 0.875rem;
    }

    .target-stats {
      text-align: left;
      width: 100%;
    }

    .recipes-grid {
      padding: 1.5rem;
      grid-template-columns: 1fr;
      gap: 1rem;
    }
  }
`}</style>