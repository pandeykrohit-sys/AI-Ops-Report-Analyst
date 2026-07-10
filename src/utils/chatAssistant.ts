import { DataDictionary } from './dataDictionary';

export interface ChatResponse {
  question: string;
  answer: string;
  chartType?: 'bar' | 'line' | 'pie' | 'donut' | 'table';
  chartData?: { name: string; value: number }[];
  insight: string;
}

interface ParsedQuery {
  intent: 'top' | 'compare' | 'trend' | 'predict' | 'summary' | 'filter' | 'correlation' | 'unknown';
  dimension?: string;
  metric?: string;
  limit?: number;
  timeComparison?: boolean;
}

function parseQuery(query: string, dictionary: DataDictionary): ParsedQuery {
  const lower = query.toLowerCase();
  const result: ParsedQuery = { intent: 'unknown' };

  // Detect intent
  if (/top|best|highest|leading|maximum|most/i.test(lower)) {
    result.intent = 'top';
    const match = lower.match(/top\s+(\d+)/);
    result.limit = match ? parseInt(match[1]) : 10;
  } else if (/compare|versus|vs|last month|previous month|previous period|year over year|mom|yoy/i.test(lower)) {
    result.intent = 'compare';
    result.timeComparison = true;
  } else if (/predict|forecast|next|future|projection/i.test(lower)) {
    result.intent = 'predict';
  } else if (/trend|over time|growth|change/i.test(lower)) {
    result.intent = 'trend';
  } else if (/summary|overview|total|sum|overall/i.test(lower)) {
    result.intent = 'summary';
  } else if (/correlation|relationship|impact|affect/i.test(lower)) {
    result.intent = 'correlation';
  } else if (/which|what|where|show|display|list/i.test(lower)) {
    result.intent = 'top';
    result.limit = 10;
  }

  // Detect dimension
  dictionary.dimensions.forEach(dim => {
    if (lower.includes(dim.toLowerCase())) result.dimension = dim;
  });
  dictionary.dates.forEach(d => {
    if (lower.includes(d.toLowerCase())) result.dimension = d;
  });

  // Detect metric
  dictionary.measures.forEach(m => {
    if (lower.includes(m.toLowerCase())) result.metric = m;
  });

  // Fallbacks
  if (!result.metric && dictionary.measures.length > 0) result.metric = dictionary.measures[0];
  if (!result.dimension && dictionary.dimensions.length > 0) result.dimension = dictionary.dimensions[0];

  return result;
}

export function processChatQuery(
  query: string,
  headers: string[],
  rows: string[][],
  dictionary: DataDictionary
): ChatResponse {
  const parsed = parseQuery(query, dictionary);
  const dimIdx = parsed.dimension ? headers.indexOf(parsed.dimension) : -1;
  const metricIdx = parsed.metric ? headers.indexOf(parsed.metric) : -1;

  if (parsed.intent === 'top' && dimIdx !== -1 && metricIdx !== -1) {
    const limit = parsed.limit || 10;
    const aggregated: { [key: string]: number } = {};

    rows.forEach(row => {
      const dimVal = row[dimIdx] || 'Unknown';
      const metricVal = parseFloat(row[metricIdx]);
      if (!isNaN(metricVal)) {
        aggregated[dimVal] = (aggregated[dimVal] || 0) + metricVal;
      }
    });

    const sorted = Object.entries(aggregated)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);

    const answer = `Top ${limit} ${parsed.dimension} by ${parsed.metric}:\n${sorted.map((s, i) => `${i + 1}. ${s.name}: ${s.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`).join('\n')}`;
    const insight = sorted[0]
      ? `${sorted[0].name} leads with ${sorted[0].value.toLocaleString(undefined, { maximumFractionDigits: 0 })}, which is ${sorted.length > 1 ? `${((sorted[0].value / sorted[1].value - 1) * 100).toFixed(1)}% higher than ${sorted[1].name}` : 'the top performer'}.`
      : 'No data available.';

    return { question: query, answer, chartType: 'bar', chartData: sorted, insight };
  }

  if (parsed.intent === 'compare' && metricIdx !== -1) {
    const dateIdx = headers.findIndex(h => /date|month|year|period|time/i.test(h));
    if (dateIdx !== -1) {
      const periodData: { [key: string]: number[] } = {};
      rows.forEach(row => {
        const dateVal = row[dateIdx];
        const metricVal = parseFloat(row[metricIdx]);
        if (dateVal && !isNaN(metricVal)) {
          if (!periodData[dateVal]) periodData[dateVal] = [];
          periodData[dateVal].push(metricVal);
        }
      });

      const periods = Object.keys(periodData).sort();
      if (periods.length >= 2) {
        const lastPeriod = periods[periods.length - 1];
        const prevPeriod = periods[periods.length - 2];
        const lastVal = periodData[lastPeriod].reduce((a, b) => a + b, 0);
        const prevVal = periodData[prevPeriod].reduce((a, b) => a + b, 0);
        const change = prevVal !== 0 ? ((lastVal - prevVal) / Math.abs(prevVal)) * 100 : 0;

        const chartData = periods.slice(-6).map(p => ({
          name: p,
          value: periodData[p].reduce((a, b) => a + b, 0)
        }));

        const answer = `Comparison of ${parsed.metric}:\n${prevPeriod}: ${prevVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}\n${lastPeriod}: ${lastVal.toLocaleString(undefined, { maximumFractionDigits: 0 })}\nChange: ${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
        const insight = change >= 0
          ? `${parsed.metric} increased by ${change.toFixed(1)}% from ${prevPeriod} to ${lastPeriod}. Positive momentum.`
          : `${parsed.metric} decreased by ${Math.abs(change).toFixed(1)}% from ${prevPeriod} to ${lastPeriod}. Attention needed.`;

        return { question: query, answer, chartType: 'line', chartData, insight };
      }
    }
  }

  if (parsed.intent === 'trend' && metricIdx !== -1) {
    const dateIdx = headers.findIndex(h => /date|month|year|period|time/i.test(h));
    if (dateIdx !== -1) {
      const periodData: { [key: string]: number[] } = {};
      rows.forEach(row => {
        const dateVal = row[dateIdx];
        const metricVal = parseFloat(row[metricIdx]);
        if (dateVal && !isNaN(metricVal)) {
          if (!periodData[dateVal]) periodData[dateVal] = [];
          periodData[dateVal].push(metricVal);
        }
      });

      const chartData = Object.entries(periodData)
        .map(([name, vals]) => ({ name, value: vals.reduce((a, b) => a + b, 0) }))
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(-12);

      if (chartData.length >= 2) {
        const first = chartData[0].value;
        const last = chartData[chartData.length - 1].value;
        const change = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;

        const answer = `Trend analysis for ${parsed.metric}:\n${chartData.map(c => `${c.name}: ${c.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`).join('\n')}\nOverall change: ${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
        const insight = `${parsed.metric} has ${change >= 0 ? 'increased' : 'decreased'} by ${Math.abs(change).toFixed(1)}% over the analyzed period.`;

        return { question: query, answer, chartType: 'line', chartData, insight };
      }
    }
  }

  if (parsed.intent === 'predict' && metricIdx !== -1) {
    const dateIdx = headers.findIndex(h => /date|month|year|period|time/i.test(h));
    if (dateIdx !== -1) {
      const periodData: { [key: string]: number[] } = {};
      rows.forEach(row => {
        const dateVal = row[dateIdx];
        const metricVal = parseFloat(row[metricIdx]);
        if (dateVal && !isNaN(metricVal)) {
          if (!periodData[dateVal]) periodData[dateVal] = [];
          periodData[dateVal].push(metricVal);
        }
      });

      const historical = Object.entries(periodData)
        .map(([name, vals]) => ({ name, value: vals.reduce((a, b) => a + b, 0) }))
        .sort((a, b) => a.name.localeCompare(b.name));

      if (historical.length >= 3) {
        const values = historical.map(h => h.value);
        const n = values.length;
        const xMean = (n - 1) / 2;
        const yMean = values.reduce((a, b) => a + b, 0) / n;
        let num = 0, den = 0;
        for (let i = 0; i < n; i++) {
          num += (i - xMean) * (values[i] - yMean);
          den += (i - xMean) ** 2;
        }
        const slope = den === 0 ? 0 : num / den;
        const intercept = yMean - slope * xMean;

        const forecast = [];
        for (let i = 0; i < 4; i++) {
          const futureVal = Math.max(0, slope * (n + i) + intercept);
          forecast.push({ name: `Forecast +${i + 1}`, value: Math.round(futureVal) });
        }

        const nextVal = forecast[0].value;
        const lastActual = values[values.length - 1];
        const change = lastActual !== 0 ? ((nextVal - lastActual) / Math.abs(lastActual)) * 100 : 0;

        const answer = `Forecast for ${parsed.metric} (next quarter):\n${forecast.map(f => `${f.name}: ${f.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`).join('\n')}\nProjected change: ${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
        const insight = `Based on historical trends, ${parsed.metric} is projected to ${change >= 0 ? 'increase' : 'decrease'} by ${Math.abs(change).toFixed(1)}% in the next period. Confidence depends on data consistency.`;

        return { question: query, answer, chartType: 'line', chartData: forecast, insight };
      }
    }
  }

  if (parsed.intent === 'summary') {
    const summaryParts: string[] = [];
    dictionary.measures.slice(0, 5).forEach(m => {
      const idx = headers.indexOf(m);
      const values = rows.map(r => parseFloat(r[idx])).filter(n => !isNaN(n));
      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        summaryParts.push(`${m}: Total ${sum.toLocaleString(undefined, { maximumFractionDigits: 0 })}, Avg ${avg.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
      }
    });

    const answer = `Data Summary:\nTotal Records: ${rows.length}\nTotal Columns: ${headers.length}\n\n${summaryParts.join('\n')}`;
    return { question: query, answer, chartType: 'table', insight: `Dataset contains ${rows.length} records with ${headers.length} columns. ${dictionary.measures.length} measures and ${dictionary.dimensions.length} dimensions detected.` };
  }

  // Fallback
  return {
    question: query,
    answer: `I couldn't fully understand your query. Try asking things like:\n- "Show top 10 categories"\n- "Which state generates highest amount"\n- "Compare last month with previous month"\n- "Predict next quarter performance"`,
    insight: 'Try rephrasing your question using column names from your data.'
  };
}

export const CHAT_EXAMPLES = [
  'Show top 10 categories',
  'Which state generates highest amount',
  'Compare last month with previous month',
  'Predict next quarter performance',
  'What is the total revenue by region',
  'Show trend over time',
];
