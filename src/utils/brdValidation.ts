import { ExtractedRequirements } from './requirementsAnalyzer';

export interface BRDValidationCheck {
  name: string;
  found: boolean;
  count: number;
  items: string[];
  recommendation?: string;
}

export interface BRDValidationResult {
  completenessScore: number;
  checks: BRDValidationCheck[];
  missingItems: string[];
  summary: string;
}

export function validateBRD(requirements: ExtractedRequirements): BRDValidationResult {
  const checks: BRDValidationCheck[] = [];
  const missingItems: string[] = [];

  // Objectives
  const objectivesFound = requirements.objectives.length > 0;
  checks.push({
    name: 'Objectives',
    found: objectivesFound,
    count: requirements.objectives.length,
    items: requirements.objectives.slice(0, 5),
    recommendation: objectivesFound ? undefined : 'Add clear business objectives describing what the analysis should achieve.'
  });
  if (!objectivesFound) missingItems.push('Objectives');

  // KPIs
  const kpisFound = requirements.kpis.length > 0;
  checks.push({
    name: 'KPIs',
    found: kpisFound,
    count: requirements.kpis.length,
    items: requirements.kpis.slice(0, 8),
    recommendation: kpisFound ? undefined : 'Define Key Performance Indicators (e.g., revenue, growth rate, conversion rate).'
  });
  if (!kpisFound) missingItems.push('KPIs');

  // Metrics
  const metricsFound = requirements.metrics.length > 0;
  checks.push({
    name: 'Metrics',
    found: metricsFound,
    count: requirements.metrics.length,
    items: requirements.metrics.slice(0, 8),
    recommendation: metricsFound ? undefined : 'Specify measurable metrics to track (e.g., count, average, sum).'
  });
  if (!metricsFound) missingItems.push('Metrics');

  // Dimensions
  const dimensionsFound = requirements.dimensions.length > 0;
  checks.push({
    name: 'Dimensions',
    found: dimensionsFound,
    count: requirements.dimensions.length,
    items: requirements.dimensions.slice(0, 8),
    recommendation: dimensionsFound ? undefined : 'List dimensions for analysis (e.g., region, category, segment, time period).'
  });
  if (!dimensionsFound) missingItems.push('Dimensions');

  // Filters
  const filtersFound = requirements.filters.length > 0;
  checks.push({
    name: 'Filters',
    found: filtersFound,
    count: requirements.filters.length,
    items: requirements.filters.slice(0, 5),
    recommendation: filtersFound ? undefined : 'Define filters for narrowing data (e.g., date range, region, status).'
  });
  if (!filtersFound) missingItems.push('Filters');

  // Business Rules
  const rulesFound = requirements.businessRules.length > 0;
  checks.push({
    name: 'Business Rules',
    found: rulesFound,
    count: requirements.businessRules.length,
    items: requirements.businessRules.slice(0, 5),
    recommendation: rulesFound ? undefined : 'Document business rules and constraints (e.g., "exclude cancelled orders").'
  });
  if (!rulesFound) missingItems.push('Business Rules');

  // Target Values
  const targetsFound = requirements.targets.length > 0;
  checks.push({
    name: 'Target Values',
    found: targetsFound,
    count: requirements.targets.length,
    items: requirements.targets.slice(0, 5),
    recommendation: targetsFound ? undefined : 'Set target values or benchmarks for KPIs (e.g., "target revenue: $1M").'
  });
  if (!targetsFound) missingItems.push('Target Values');

  const foundCount = checks.filter(c => c.found).length;
  const completenessScore = Math.round((foundCount / checks.length) * 100);

  const summary = completenessScore >= 80
    ? `BRD is ${completenessScore}% complete with strong coverage across all sections.`
    : completenessScore >= 50
    ? `BRD is ${completenessScore}% complete. Missing: ${missingItems.join(', ')}.`
    : `BRD is only ${completenessScore}% complete. Critical sections missing: ${missingItems.join(', ')}.`;

  return { completenessScore, checks, missingItems, summary };
}
