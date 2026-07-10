import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface ExtractedRequirements {
  objectives: string[];
  kpis: string[];
  measures: string[];
  metrics: string[];
  dimensions: string[];
  filters: string[];
  chartRequirements: string[];
  businessGoals: string[];
  businessRules: string[];
  targets: string[];
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

  // Extract metrics (measurable values)
  const metrics: string[] = [];
  const metricKeywords = ['count', 'sum', 'average', 'total', 'rate', 'percentage', 'ratio', 'median', 'min', 'max', 'standard deviation', 'variance'];
  metricKeywords.forEach(m => {
    if (new RegExp(`\\b${m}\\b`, 'i').test(text)) {
      metrics.push(m.charAt(0).toUpperCase() + m.slice(1));
    }
  });

  // Extract business rules
  const businessRules: string[] = [];
  sentences.forEach(sentence => {
    if (/rule|constraint|condition|must|should|require|exclude|include|only|if\\s+then|unless/i.test(sentence)) {
      if (sentence.length > 15 && sentence.length < 200) {
        businessRules.push(sentence.trim());
      }
    }
  });

  // Extract targets
  const targets: string[] = [];
  sentences.forEach(sentence => {
    if (/target|benchmark|goal|threshold|kpi.*\\d|objective.*\\d/i.test(sentence)) {
      const match = sentence.match(/(target|benchmark|goal|threshold)[:\\s]+([^.;]+)/i);
      if (match) {
        targets.push(match[0].trim());
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
    metrics: [...new Set(metrics)].slice(0, 10),
    dimensions: [...new Set(dimensions)].slice(0, 15),
    filters: [...new Set(filters)].slice(0, 10),
    chartRequirements: [...new Set(chartRequirements)].slice(0, 10),
    businessGoals: [...new Set(businessGoals)].slice(0, 10),
    businessRules: [...new Set(businessRules)].slice(0, 10),
    targets: [...new Set(targets)].slice(0, 10),
    rawText: text,
    confidence
  };
}

export interface RequirementMapping {
  requirementName: string;
  mappedField: string | null;
  confidence: number;
  type: 'KPI' | 'Dimension' | 'Filter' | 'Chart';
  warning?: string;
}

export interface MappingResult {
  mappedKPIs: { name: string; columns: string[]; aggregation: string; confidence: number }[];
  mappedDimensions: { name: string; columns: string[]; confidence: number }[];
  recommendedCharts: { type: string; title: string; dimension: string; metric: string; confidence: number }[];
  requirementMappings: RequirementMapping[];
  unmappedRequirements: RequirementMapping[];
  overallMappingConfidence: number;
}

function calcMappingConfidence(reqName: string, fieldName: string): number {
  const r = reqName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const f = fieldName.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (r === f) return 100;
  if (f.includes(r) || r.includes(f)) return 95;
  const rWords = r.split(/\s+/).filter(w => w.length > 2);
  const fWords = f.split(/\s+/).filter(w => w.length > 2);
  const matched = rWords.filter(rw => fWords.some(fw => fw.includes(rw) || rw.includes(fw)));
  if (rWords.length === 0) return 50;
  return Math.round((matched.length / rWords.length) * 90);
}

export function mapRequirementsToData(
  requirements: ExtractedRequirements,
  headers: string[]
): MappingResult {
  const mappedKPIs: { name: string; columns: string[]; aggregation: string; confidence: number }[] = [];
  const mappedDimensions: { name: string; columns: string[]; confidence: number }[] = [];
  const recommendedCharts: { type: string; title: string; dimension: string; metric: string; confidence: number }[] = [];
  const requirementMappings: RequirementMapping[] = [];
  const unmappedRequirements: RequirementMapping[] = [];

  // Map KPIs to columns
  requirements.kpis.forEach(kpi => {
    const kpiLower = kpi.toLowerCase();
    const matchingColumns = headers.filter(h => {
      const hLower = h.toLowerCase();
      return hLower.includes(kpiLower) || kpiLower.includes(hLower);
    });

    if (matchingColumns.length > 0) {
      const confidence = calcMappingConfidence(kpi, matchingColumns[0]);
      mappedKPIs.push({
        name: kpi,
        columns: matchingColumns,
        aggregation: /rate|percentage|ratio/i.test(kpi) ? 'average' : 'sum',
        confidence
      });
      requirementMappings.push({
        requirementName: kpi,
        mappedField: matchingColumns[0],
        confidence,
        type: 'KPI'
      });
    } else {
      unmappedRequirements.push({
        requirementName: kpi,
        mappedField: null,
        confidence: 0,
        type: 'KPI',
        warning: `No matching data column found for KPI "${kpi}"`
      });
    }
  });

  // Auto-detect numeric columns for additional KPIs
  headers.forEach(header => {
    const hLower = header.toLowerCase();
    if (/amount|total|sum|value|price|cost|fee|tax|profit|revenue|sales/i.test(hLower)) {
      if (!mappedKPIs.find(k => k.columns.includes(header))) {
        mappedKPIs.push({ name: header, columns: [header], aggregation: 'sum', confidence: 85 });
      }
    }
    if (/count|quantity|number|qty/i.test(hLower)) {
      if (!mappedKPIs.find(k => k.columns.includes(header))) {
        mappedKPIs.push({ name: header, columns: [header], aggregation: 'sum', confidence: 80 });
      }
    }
    if (/rate|percentage|ratio|avg|average/i.test(hLower)) {
      if (!mappedKPIs.find(k => k.columns.includes(header))) {
        mappedKPIs.push({ name: header, columns: [header], aggregation: 'average', confidence: 80 });
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
      const confidence = calcMappingConfidence(dim, matchingColumns[0]);
      mappedDimensions.push({ name: dim, columns: matchingColumns, confidence });
      requirementMappings.push({
        requirementName: dim,
        mappedField: matchingColumns[0],
        confidence,
        type: 'Dimension'
      });
    } else {
      unmappedRequirements.push({
        requirementName: dim,
        mappedField: null,
        confidence: 0,
        type: 'Dimension',
        warning: `No matching data column found for dimension "${dim}"`
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
        mappedDimensions.push({ name: header, columns: [header], confidence: 85 });
      }
    }
  });

  // Generate recommended charts
  if (mappedDimensions.length > 0 && mappedKPIs.length > 0) {
    const chartConf = 88;
    // Bar chart for top categories
    recommendedCharts.push({
      type: 'bar',
      title: `${mappedKPIs[0].name} by ${mappedDimensions[0].name}`,
      dimension: mappedDimensions[0].columns[0],
      metric: mappedKPIs[0].columns[0],
      confidence: chartConf
    });
    requirementMappings.push({
      requirementName: `${mappedKPIs[0].name} by ${mappedDimensions[0].name}`,
      mappedField: `${mappedDimensions[0].columns[0]}, ${mappedKPIs[0].columns[0]}`,
      confidence: chartConf,
      type: 'Chart'
    });

    // Pie/Donut for distribution
    if (mappedDimensions.length > 1) {
      recommendedCharts.push({
        type: 'donut',
        title: `${mappedDimensions[1].name} Distribution`,
        dimension: mappedDimensions[1].columns[0],
        metric: mappedKPIs[0].columns[0],
        confidence: chartConf
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
        metric: mappedKPIs[0].columns[0],
        confidence: 90
      });
    }

    // Area chart
    recommendedCharts.push({
      type: 'area',
      title: `${mappedKPIs[0].name} Over Time`,
      dimension: timeDim?.columns[0] || mappedDimensions[0].columns[0],
      metric: mappedKPIs[0].columns[0],
      confidence: 85
    });

    // Stacked bar if multiple dimensions
    if (mappedDimensions.length >= 2) {
      recommendedCharts.push({
        type: 'stackedBar',
        title: `${mappedKPIs[0].name} by ${mappedDimensions[0].name} and ${mappedDimensions[1].name}`,
        dimension: mappedDimensions[0].columns[0],
        metric: mappedKPIs[0].columns[0],
        confidence: 82
      });
    }
  }

  const allConfidences = requirementMappings.map(m => m.confidence).filter(c => c > 0);
  const overallMappingConfidence = allConfidences.length > 0
    ? Math.round(allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length)
    : 0;

  return { mappedKPIs, mappedDimensions, recommendedCharts, requirementMappings, unmappedRequirements, overallMappingConfidence };
}
