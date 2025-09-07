import { Lab } from './convert';
import { deltaE2000 } from './deltaE';

/**
 * Opposition penalty: discourage "tug-of-war" mixes where two very different
 * colors are averaged together when neither is close to the target
 */
export function oppositionPenalty(
  colorA: Lab, 
  colorB: Lab, 
  target: Lab,
  thresholds = { separation: 45, closeness: 12, penalty: 2.0 }
): number {
  const separationAB = deltaE2000(colorA, colorB);
  const closenessA = deltaE2000(colorA, target);
  const closenessB = deltaE2000(colorB, target);
  
  // If colors are far apart AND neither is close to target, penalize
  if (separationAB > thresholds.separation && 
      Math.min(closenessA, closenessB) > thresholds.closeness) {
    return thresholds.penalty;
  }
  
  return 0;
}

/**
 * Sparsity bonus: favor blends where one component dominates with small adjusters
 * This encourages "anchor + tweak" style blends that feel more intuitive
 */
export function sparsityBonus(
  weights: number[],
  thresholds = { dominant: 0.7, adjuster: 0.25, dominantBonus: -0.3, adjusterBonus: -0.2 }
): number {
  const sortedWeights = [...weights].sort((a, b) => b - a);
  let bonus = 0;
  
  // Bonus for having a strong dominant component (≥70%)
  if (sortedWeights[0] >= thresholds.dominant) {
    bonus += thresholds.dominantBonus;
  }
  
  // Bonus for having small adjuster components (≤25%)
  if (sortedWeights.length > 1 && sortedWeights[1] <= thresholds.adjuster) {
    bonus += thresholds.adjusterBonus;
  }
  
  return bonus;
}

/**
 * Anchor preference: boost scores when the main component is one of the 
 * closest single colors to the target
 */
export function anchorBonus(
  mainComponentLab: Lab,
  target: Lab,
  mainWeight: number,
  allSingleDistances: number[],
  thresholds = { topN: 6, minWeight: 0.6, bonus: -0.5 }
): number {
  const mainDistance = deltaE2000(mainComponentLab, target);
  
  // Check if main component is in top N closest singles
  const sortedDistances = [...allSingleDistances].sort((a, b) => a - b);
  const isTopAnchor = mainDistance <= sortedDistances[thresholds.topN - 1];
  
  // Apply bonus if main component is a top anchor with sufficient weight
  if (isTopAnchor && mainWeight >= thresholds.minWeight) {
    return thresholds.bonus;
  }
  
  return 0;
}

/**
 * Combined penalty system for evaluating blend quality
 */
export function evaluateBlendPenalties(
  components: { lab: Lab; weight: number }[],
  target: Lab,
  allSingleDistances: number[]
): number {
  let totalPenalty = 0;
  
  // Opposition penalty for 2+ component blends
  if (components.length >= 2) {
    for (let i = 0; i < components.length; i++) {
      for (let j = i + 1; j < components.length; j++) {
        const penalty = oppositionPenalty(
          components[i].lab, 
          components[j].lab, 
          target
        );
        // Reduce penalty for 3-way blends (diluted effect)
        totalPenalty += components.length === 3 ? penalty * 0.5 : penalty;
      }
    }
  }
  
  // Sparsity bonus
  const weights = components.map(c => c.weight);
  totalPenalty += sparsityBonus(weights);
  
  // Anchor bonus for main component
  if (components.length > 0) {
    const mainComponent = components.reduce((prev, current) => 
      current.weight > prev.weight ? current : prev
    );
    totalPenalty += anchorBonus(
      mainComponent.lab,
      target,
      mainComponent.weight,
      allSingleDistances
    );
  }
  
  return totalPenalty;
}