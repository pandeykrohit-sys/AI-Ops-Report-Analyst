export interface ForecastPoint {
  period: string;
  forecast: number;
  lowerBound: number;
  upperBound: number;
  actual?: number;
}

export interface ForecastResult {
  metric: string;
  threeMonth: ForecastPoint[];
  sixMonth: ForecastPoint[];
  twelveMonth: ForecastPoint[];
  confidenceLevel: number;
  trendDirection: 'up' | 'down' | 'stable';
  trendStrength: number;
  summary: string;
}

// Simple linear regression forecast with confidence intervals
function linearRegression(values: number[]): { slope: number; intercept: number; r2: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] || 0, r2: 0 };

  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) ** 2;
  }

  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;

  // R-squared
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < n; i++) {
    const predicted = slope * i + intercept;
    ssRes += (values[i] - predicted) ** 2;
    ssTot += (values[i] - yMean) ** 2;
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { slope, intercept, r2 };
}

function computeForecast(
  historicalValues: number[],
  periods: number,
  labels: string[],
  startLabelIndex: number
): ForecastPoint[] {
  const { slope, intercept } = linearRegression(historicalValues);

  // Calculate standard error for confidence interval
  const n = historicalValues.length;
  const predictions = historicalValues.map((_, i) => slope * i + intercept);
  const residuals = historicalValues.map((v, i) => v - predictions[i]);
  const stdError = Math.sqrt(residuals.reduce((a, b) => a + b * b, 0) / Math.max(1, n - 2));

  const points: ForecastPoint[] = [];
  for (let i = 0; i < periods; i++) {
    const futureIdx = n + i;
    const forecast = Math.max(0, slope * futureIdx + intercept);
    // Wider confidence interval for further forecasts
    const margin = stdError * (1 + i * 0.15) * 1.96;
    points.push({
      period: labels[startLabelIndex + i] || `Period ${startLabelIndex + i + 1}`,
      forecast: Math.round(forecast * 100) / 100,
      lowerBound: Math.round(Math.max(0, forecast - margin) * 100) / 100,
      upperBound: Math.round((forecast + margin) * 100) / 100
    });
  }

  return points;
}

function generateLabels(count: number, dateValues: string[]): string[] {
  if (dateValues.length > 0) {
    // Try to parse and extend dates
    const lastDate = dateValues[dateValues.length - 1];
    const parsed = Date.parse(lastDate);
    if (!isNaN(parsed)) {
      const labels = [...dateValues];
      const d = new Date(parsed);
      for (let i = 0; i < count; i++) {
        d.setMonth(d.getMonth() + 1);
        labels.push(d.toISOString().slice(0, 7));
      }
      return labels;
    }
  }
  // Fallback: generate period labels
  return Array.from({ length: count }, (_, i) => `Period ${i + 1}`);
}

export function generateForecast(
  headers: string[],
  rows: string[][],
  metricColumn: string
): ForecastResult | null {
  const metricIdx = headers.findIndex(h => h.toLowerCase() === metricColumn.toLowerCase());
  if (metricIdx === -1) return null;

  // Find time dimension
  const dateIdx = headers.findIndex(h => /date|month|year|quarter|period|time/i.test(h));
  const dateValues = dateIdx !== -1 ? rows.map(r => r[dateIdx]).filter(Boolean) : [];

  // Aggregate metric by time period
  let timeSeries: { label: string; value: number }[] = [];

  if (dateIdx !== -1 && dateValues.length > 0) {
    const aggregated: { [key: string]: number[] } = {};
    rows.forEach(row => {
      const dateVal = row[dateIdx];
      const metricVal = parseFloat(row[metricIdx]);
      if (dateVal && !isNaN(metricVal)) {
        if (!aggregated[dateVal]) aggregated[dateVal] = [];
        aggregated[dateVal].push(metricVal);
      }
    });
    timeSeries = Object.entries(aggregated)
      .map(([label, vals]) => ({ label, value: vals.reduce((a, b) => a + b, 0) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  } else {
    // Use row order as time series
    timeSeries = rows.map((row, i) => ({
      label: `Period ${i + 1}`,
      value: parseFloat(row[metricIdx]) || 0
    }));
  }

  if (timeSeries.length < 3) return null;

  const historicalValues = timeSeries.map(t => t.value);
  const dateLabels = timeSeries.map(t => t.label);
  const allLabels = generateLabels(12, dateLabels);

  const threeMonth = computeForecast(historicalValues, 3, allLabels, timeSeries.length);
  const sixMonth = computeForecast(historicalValues, 6, allLabels, timeSeries.length);
  const twelveMonth = computeForecast(historicalValues, 12, allLabels, timeSeries.length);

  const { slope, r2 } = linearRegression(historicalValues);
  const trendDirection: 'up' | 'down' | 'stable' =
    Math.abs(slope) < 0.001 * Math.max(...historicalValues) ? 'stable' : slope > 0 ? 'up' : 'down';
  const trendStrength = Math.round(r2 * 100);
  const confidenceLevel = Math.round(Math.max(50, Math.min(95, r2 * 100)));

  const summary = trendDirection === 'up'
    ? `${metricColumn} is trending upward with ${trendStrength}% trend strength. Forecast projects continued growth over the next 12 months.`
    : trendDirection === 'down'
    ? `${metricColumn} is trending downward with ${trendStrength}% trend strength. Immediate attention recommended to reverse the decline.`
    : `${metricColumn} is stable with no significant trend. Monitor for changes in upcoming periods.`;

  return {
    metric: metricColumn,
    threeMonth,
    sixMonth,
    twelveMonth,
    confidenceLevel,
    trendDirection,
    trendStrength,
    summary
  };
}
