import { DataDictionary } from './dataDictionary';

export interface RecommendedKPI {
  name: string;
  column: string;
  aggregation: 'sum' | 'average' | 'count' | 'min' | 'max';
  format: 'number' | 'currency' | 'percentage';
  confidence: number;
  reason: string;
}

export interface RecommendedChart {
  type: 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'stackedBar';
  title: string;
  dimension: string;
  metric: string;
  confidence: number;
  reason: string;
}

export interface RecommendedFilter {
  column: string;
  type: 'multiselect' | 'range' | 'date';
  uniqueValues: number;
  confidence: number;
  reason: string;
}

export interface VisualRecommendation {
  kpis: RecommendedKPI[];
  charts: RecommendedChart[];
  filters: RecommendedFilter[];
  overallConfidence: number;
}

export function generateVisualRecommendations(
  dictionary: DataDictionary,
  headers: string[],
  rows: string[][]
): VisualRecommendation {
  const kpis: RecommendedKPI[] = [];
  const charts: RecommendedChart[] = [];
  const filters: RecommendedFilter[] = [];

  // Recommend KPIs from measures
  dictionary.measures.forEach(col => {
    const lower = col.toLowerCase();
    const idx = headers.indexOf(col);
    const values = rows.map(r => parseFloat(r[idx])).filter(n => !isNaN(n));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const sum = values.reduce((a, b) => a + b, 0);

    let format: 'number' | 'currency' | 'percentage' = 'number';
    let aggregation: 'sum' | 'average' | 'count' | 'min' | 'max' = 'sum';
    let confidence = 85;
    let reason = 'Numeric measure detected';

    if (/amount|total|value|revenue|sales|cost|fee|tax|price|profit/i.test(lower)) {
      format = 'currency';
      aggregation = 'sum';
      confidence = 95;
      reason = 'Financial measure - sum aggregation with currency format';
    } else if (/rate|percentage|ratio|growth|change/i.test(lower)) {
      format = 'percentage';
      aggregation = 'average';
      confidence = 90;
      reason = 'Rate/percentage metric - average aggregation';
    } else if (/count|quantity|qty|number/i.test(lower)) {
      format = 'number';
      aggregation = 'sum';
      confidence = 88;
      reason = 'Count/quantity measure - sum aggregation';
    } else if (/avg|average|mean/i.test(lower)) {
      format = 'currency';
      aggregation = 'average';
      confidence = 85;
      reason = 'Average value metric';
    }

    kpis.push({ name: col, column: col, aggregation, format, confidence, reason });
  });

  // Recommend charts from dimensions + measures
  const timeDims = dictionary.dates;
  const catDims = dictionary.dimensions;

  if (catDims.length > 0 && dictionary.measures.length > 0) {
    const dim = catDims[0];
    const metric = dictionary.measures[0];
    charts.push({
      type: 'bar',
      title: `${metric} by ${dim}`,
      dimension: dim,
      metric,
      confidence: 92,
      reason: 'Bar chart is ideal for comparing a measure across categorical dimensions'
    });
  }

  if (catDims.length > 0 && dictionary.measures.length > 0) {
    const dim = catDims[0];
    const metric = dictionary.measures[0];
    charts.push({
      type: 'donut',
      title: `${dim} Distribution`,
      dimension: dim,
      metric,
      confidence: 85,
      reason: 'Donut chart shows proportional distribution across categories'
    });
  }

  if (timeDims.length > 0 && dictionary.measures.length > 0) {
    const dim = timeDims[0];
    const metric = dictionary.measures[0];
    charts.push({
      type: 'line',
      title: `${metric} Trend`,
      dimension: dim,
      metric,
      confidence: 90,
      reason: 'Line chart visualizes trends over time periods'
    });
    charts.push({
      type: 'area',
      title: `${metric} Over Time`,
      dimension: dim,
      metric,
      confidence: 85,
      reason: 'Area chart emphasizes volume over time'
    });
  }

  if (catDims.length >= 2 && dictionary.measures.length > 0) {
    charts.push({
      type: 'stackedBar',
      title: `${dictionary.measures[0]} by ${catDims[0]} & ${catDims[1]}`,
      dimension: catDims[0],
      metric: dictionary.measures[0],
      confidence: 80,
      reason: 'Stacked bar compares a measure across two dimensions'
    });
  }

  // Recommend filters
  [...catDims, ...timeDims].forEach(col => {
    const idx = headers.indexOf(col);
    const uniqueVals = [...new Set(rows.map(r => r[idx]).filter(Boolean))];
    const isDate = timeDims.includes(col);

    if (uniqueVals.length > 1 && uniqueVals.length <= 100) {
      filters.push({
        column: col,
        type: isDate ? 'date' : 'multiselect',
        uniqueValues: uniqueVals.length,
        confidence: isDate ? 90 : 85,
        reason: isDate
          ? 'Date field - enables time-based filtering and range selection'
          : `Categorical field with ${uniqueVals.length} values - enables segment filtering`
      });
    }
  });

  const allConfidences = [...kpis.map(k => k.confidence), ...charts.map(c => c.confidence), ...filters.map(f => f.confidence)];
  const overallConfidence = allConfidences.length > 0
    ? Math.round(allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length)
    : 0;

  return {
    kpis: kpis.slice(0, 8),
    charts: charts.slice(0, 6),
    filters: filters.slice(0, 8),
    overallConfidence
  };
}
