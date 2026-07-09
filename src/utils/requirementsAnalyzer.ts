import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface ExtractedRequirements {
  objectives: string[];
  kpis: string[];
  measures: string[];
  dimensions: string[];
  filters: string[];
  chartRequirements: string[];
  businessGoals: string[];
  rawText: string;
  confidence: number;
}

const KPI_PATTERNS = [
  /revenue|sales|profit|margin|growth|churn|retention|conversion|engagement|satisfaction/i,
  /kpi|key performance indicator|metric|measure|indicator/i,
  /total|average|sum|count|rate|percentage|ratio/i,
  /roi|return on investment|yield|efficiency/i,
  /cost|expense|budget|spend|overhead/i,
  /customer|client|user|subscriber|member/i,
  /transaction|order|purchase|sale|deal/i,
  /target|goal|objective|benchmark|threshold/i,
  /yoy|mom|qoq|annual|monthly|quarterly/i,
  /volume|quantity|amount|value|size/i
];

const DIMENSION_PATTERNS = [
  /region|area|zone|territory|location|country|city|state/i,
  /category|segment|group|type|class|classification/i,
  /product|item|sku|offering|service/i,
  /channel|platform|source|medium/i,
  /time|date|month|year|quarter|week|day|period/i,
  /department|division|team|unit|branch/i,
  /status|stage|phase|state|condition/i,
  /age|gender|occupation|role|position/i
];

const FILTER_PATTERNS = [
  /filter|where|when|range|between|from|to|after|before/i,
  /include|exclude|show|hide|display/i,
  /select|choose|pick|limit/i
];

const CHART_PATTERNS = [
  /chart|graph|visual|visualization|plot|diagram/i,
  /bar|line|pie|donut|area|scatter|bubble|heatmap/i,
  /trend|comparison|distribution|breakdown|overview/i,
  /dashboard|report|summary|view|display/i
];

const OBJECTIVE_PATTERNS = [
  /objective|goal|aim|target|purpose|mission/i,
  /analyze|understand|identify|determine|evaluate/i,
  /improve|increase|decrease|reduce|optimize|enhance/i,
  /track|monitor|measure|assess|review/i,
  /support|enable|facilitate|drive|achieve/i
];

export async function parseRequirementsDocument(file: File): Promise<string> {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'txt') {
    return await file.text();
  }

  if (extension === 'docx') {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  }

  if (extension === 'pdf') {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    return fullText;
  }

  return await file.text();
}

export function analyzeRequirements(text: string): ExtractedRequirements {
  const lines = text.split('\n').filter(l => l.trim());
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  const words = text.toLowerCase().split(/\s+/);

  const objectives: string[] = [];
  const kpis: string[] = [];
  const measures: string[] = [];
  const dimensions: string[] = [];
  const filters: string[] = [];
  const chartRequirements: string[] = [];
  const businessGoals: string[] = [];

  // Extract objectives
  sentences.forEach(sentence => {
    if (OBJECTIVE_PATTERNS.some(p => p.test(sentence))) {
      objectives.push(sentence.trim());
    }
  });

  // Extract KPIs
  const kpiKeywords = [
    'revenue', 'sales', 'profit', 'growth', 'churn', 'retention',
    'conversion', 'satisfaction', 'engagement', 'cost', 'margin',
    'roi', 'yield', 'efficiency', 'volume', 'count', 'rate',
    'total', 'average', 'sum', 'percentage', 'amount', 'value',
    'transaction', 'order', 'customer', 'user', 'fees', 'tax'
  ];

  kpiKeywords.forEach(kpi => {
    const regex = new RegExp(`\\b${kpi}s?\\b`, 'gi');
    const matches = text.match(regex);
    if (matches) {
      const normalized = kpi.charAt(0).toUpperCase() + kpi.slice(1);
      if (!kpis.includes(normalized)) {
        kpis.push(normalized);
      }
    }
  });

  // Extract dimensions
  const dimensionKeywords = [
    'region', 'area', 'zone', 'country', 'city', 'state', 'location',
    'category', 'segment', 'group', 'type', 'product', 'item',
    'channel', 'platform', 'source', 'department', 'team',
    'status', 'stage', 'age', 'gender', 'occupation', 'role',
    'date', 'month', 'year', 'quarter', 'week', 'day'
  ];

  dimensionKeywords.forEach(dim => {
    const regex = new RegExp(`\\b${dim}s?\\b`, 'gi');
    if (regex.test(text)) {
      const normalized = dim.charAt(0).toUpperCase() + dim.slice(1);
      if (!dimensions.includes(normalized)) {
        dimensions.push(normalized);
      }
    }
  });

  // Extract chart requirements
  sentences.forEach(sentence => {
    if (CHART_PATTERNS.some(p => p.test(sentence))) {
      chartRequirements.push(sentence.trim());
    }
  });

  // Detect specific chart types
  const chartTypes = ['bar', 'line', 'pie', 'donut', 'area', 'scatter', 'bubble', 'heatmap', 'table', 'matrix'];
  chartTypes.forEach(type => {
    if (new RegExp(`\\b${type}\\s*(chart|graph)?\\b`, 'i').test(text)) {
      if (!chartRequirements.includes(`Create ${type} chart`)) {
        chartRequirements.push(`Create ${type} chart`);
      }
    }
  });

  // Extract filters
  sentences.forEach(sentence => {
    if (FILTER_PATTERNS.some(p => p.test(sentence))) {
      filters.push(sentence.trim());
    }
  });

  // Extract measures
  const measureKeywords = ['sum', 'average', 'count', 'min', 'max', 'median', 'percentage', 'ratio'];
  measureKeywords.forEach(measure => {
    if (new RegExp(`\\b${measure}\\b`, 'i').test(text)) {
      measures.push(measure.charAt(0).toUpperCase() + measure.slice(1));
    }
  });

  // Extract business goals
  sentences.forEach(sentence => {
    if (/goal|achieve|target|increase|decrease|improve|reduce|optimize/i.test(sentence)) {
      if (sentence.length > 20 && sentence.length < 200) {
        businessGoals.push(sentence.trim());
      }
    }
  });

  // Calculate confidence based on extracted content
  const confidence = Math.min(100,
    (objectives.length > 0 ? 20 : 0) +
    (kpis.length > 0 ? 20 : 0) +
    (dimensions.length > 0 ? 20 : 0) +
    (chartRequirements.length > 0 ? 20 : 0) +
    (filters.length > 0 ? 10 : 0) +
    (businessGoals.length > 0 ? 10 : 0)
  );

  return {
    objectives: [...new Set(objectives)].slice(0, 10),
    kpis: [...new Set(kpis)].slice(0, 15),
    measures: [...new Set(measures)].slice(0, 10),
    dimensions: [...new Set(dimensions)].slice(0, 15),
    filters: [...new Set(filters)].slice(0, 10),
    chartRequirements: [...new Set(chartRequirements)].slice(0, 10),
    businessGoals: [...new Set(businessGoals)].slice(0, 10),
    rawText: text,
    confidence
  };
}

export function mapRequirementsToData(
  requirements: ExtractedRequirements,
  headers: string[]
): {
  mappedKPIs: { name: string; columns: string[]; aggregation: string }[];
  mappedDimensions: { name: string; columns: string[] };
  recommendedCharts: { type: string; title: string; dimension: string; metric: string }[];
} {
  const mappedKPIs: { name: string; columns: string[]; aggregation: string }[] = [];
  const mappedDimensions: { name: string; columns: string[] }[] = [];
  const recommendedCharts: { type: string; title: string; dimension: string; metric: string }[] = [];

  // Map KPIs to columns
  requirements.kpis.forEach(kpi => {
    const kpiLower = kpi.toLowerCase();
    const matchingColumns = headers.filter(h => {
      const hLower = h.toLowerCase();
      return hLower.includes(kpiLower) || kpiLower.includes(hLower);
    });

    if (matchingColumns.length > 0) {
      mappedKPIs.push({
        name: kpi,
        columns: matchingColumns,
        aggregation: /rate|percentage|ratio/i.test(kpi) ? 'average' : 'sum'
      });
    }
  });

  // Auto-detect numeric columns for additional KPIs
  headers.forEach(header => {
    const hLower = header.toLowerCase();
    if (/amount|total|sum|value|price|cost|fee|tax|profit|revenue|sales/i.test(hLower)) {
      if (!mappedKPIs.find(k => k.columns.includes(header))) {
        mappedKPIs.push({
          name: header,
          columns: [header],
          aggregation: 'sum'
        });
      }
    }
    if (/count|quantity|number|qty/i.test(hLower)) {
      if (!mappedKPIs.find(k => k.columns.includes(header))) {
        mappedKPIs.push({
          name: header,
          columns: [header],
          aggregation: 'sum'
        });
      }
    }
    if (/rate|percentage|ratio|avg|average/i.test(hLower)) {
      if (!mappedKPIs.find(k => k.columns.includes(header))) {
        mappedKPIs.push({
          name: header,
          columns: [header],
          aggregation: 'average'
        });
      }
    }
  });

  // Map dimensions
  requirements.dimensions.forEach(dim => {
    const dimLower = dim.toLowerCase();
    const matchingColumns = headers.filter(h => {
      const hLower = h.toLowerCase();
      return hLower.includes(dimLower) || dimLower.includes(hLower);
    });

    if (matchingColumns.length > 0) {
      mappedDimensions.push({
        name: dim,
        columns: matchingColumns
      });
    }
  });

  // Auto-detect dimension columns
  headers.forEach(header => {
    const hLower = header.toLowerCase();
    if (/region|area|zone|country|city|state|location/i.test(hLower) ||
        /category|segment|group|type|class/i.test(hLower) ||
        /status|stage|state|condition/i.test(hLower) ||
        /product|item|sku|name/i.test(hLower) ||
        /channel|platform|source/i.test(hLower) ||
        /year|month|quarter|week|day|date/i.test(hLower)) {
      if (!mappedDimensions.find(d => d.columns.includes(header))) {
        mappedDimensions.push({
          name: header,
          columns: [header]
        });
      }
    }
  });

  // Generate recommended charts
  if (mappedDimensions.length > 0 && mappedKPIs.length > 0) {
    // Bar chart for top categories
    recommendedCharts.push({
      type: 'bar',
      title: `${mappedKPIs[0].name} by ${mappedDimensions[0].name}`,
      dimension: mappedDimensions[0].columns[0],
      metric: mappedKPIs[0].columns[0]
    });

    // Pie/Donut for distribution
    if (mappedDimensions.length > 1) {
      recommendedCharts.push({
        type: 'donut',
        title: `${mappedDimensions[1].name} Distribution`,
        dimension: mappedDimensions[1].columns[0],
        metric: mappedKPIs[0].columns[0]
      });
    }

    // Line chart for trends
    const timeDim = mappedDimensions.find(d =>
      /date|month|year|quarter|period|time/i.test(d.name)
    );
    if (timeDim) {
      recommendedCharts.push({
        type: 'line',
        title: `${mappedKPIs[0].name} Trend`,
        dimension: timeDim.columns[0],
        metric: mappedKPIs[0].columns[0]
      });
    }

    // Area chart
    recommendedCharts.push({
      type: 'area',
      title: `${mappedKPIs[0].name} Over Time`,
      dimension: timeDim?.columns[0] || mappedDimensions[0].columns[0],
      metric: mappedKPIs[0].columns[0]
    });

    // Stacked bar if multiple dimensions
    if (mappedDimensions.length >= 2) {
      recommendedCharts.push({
        type: 'stackedBar',
        title: `${mappedKPIs[0].name} by ${mappedDimensions[0].name} and ${mappedDimensions[1].name}`,
        dimension: mappedDimensions[0].columns[0],
        metric: mappedKPIs[0].columns[0]
      });
    }
  }

  return { mappedKPIs, mappedDimensions, recommendedCharts };
}
