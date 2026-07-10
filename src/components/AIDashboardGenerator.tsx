import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import {
  ChevronRight, LayoutDashboard, BarChart3, FileText,
  Download, Filter, TrendingUp, AlertCircle,
  CheckCircle, Lightbulb, Target, Activity,
  Layers, Table, Maximize2, X, RefreshCw, ArrowUpRight, ArrowDownRight,
  MessageSquare, Sparkles, DollarSign, Users, Settings, UserCheck, Truck,
  Database, BookOpen, ClipboardCheck, Send, Save, Share2,
  AlertTriangle, Zap, Brain, FileSpreadsheet,
  Presentation, FileJson, Target as TargetIcon, TrendingUp as TrendIcon
} from 'lucide-react';
import { ExtractedRequirements, RequirementMapping } from '../utils/requirementsAnalyzer';
import { assessDataQuality, DataQualityResult } from '../utils/dataQuality';
import { buildDataDictionary, DataDictionary } from '../utils/dataDictionary';
import { validateBRD, BRDValidationResult } from '../utils/brdValidation';
import { generateVisualRecommendations, VisualRecommendation } from '../utils/visualRecommendation';
import { generateForecast, ForecastResult } from '../utils/forecasting';
import { generateExecutiveReport, ExecutiveReport } from '../utils/executiveReport';
import { generateChartNarrative, ChartNarrative } from '../utils/narrative';
import { generateAIRecommendations, AIRecommendation } from '../utils/aiRecommendations';
import { processChatQuery, ChatResponse, CHAT_EXAMPLES } from '../utils/chatAssistant';
import { DASHBOARD_TEMPLATES, TemplateType, applyTemplate } from '../utils/dashboardTemplates';
import { exportToPDF, exportToExcel, exportToCSV, exportToJSON, exportToPPTX } from '../utils/exports';
import { saveDashboard, listSavedDashboards, deleteDashboard, generateShareLink, SavedDashboard } from '../utils/supabaseClient';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

interface DashboardData {
  headers: string[];
  rows: string[][];
}

interface KPIConfig {
  name: string;
  column: string;
  aggregation: 'sum' | 'average' | 'count' | 'min' | 'max';
  format: 'number' | 'currency' | 'percentage';
  trend?: number;
  status: 'good' | 'warning' | 'critical';
}

interface ChartConfig {
  id: string;
  type: 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'stackedBar' | 'table';
  title: string;
  dimension: string;
  metric: string;
  stacked?: string;
}

interface FilterConfig {
  column: string;
  values: string[];
  selected: string[];
  type: 'select' | 'multiselect' | 'range';
}

interface AIDashboardGeneratorProps {
  data: DashboardData;
  requirements?: ExtractedRequirements | null;
  mappedKPIs?: { name: string; columns: string[]; aggregation: string; confidence?: number }[];
  mappedDimensions?: { name: string; columns: string[]; confidence?: number }[];
  recommendedCharts?: { type: string; title: string; dimension: string; metric: string; confidence?: number }[];
  requirementMappings?: RequirementMapping[];
  unmappedRequirements?: RequirementMapping[];
  overallMappingConfidence?: number;
}

type DashboardPage =
  | 'executive' | 'detailed' | 'drilldown' | 'insights' | 'export'
  | 'mapping' | 'quality' | 'dictionary' | 'validation' | 'recommendations'
  | 'chat' | 'templates' | 'forecast' | 'narrative' | 'save';

const TEMPLATE_ICONS: { [key: string]: any } = {
  Sparkles, DollarSign, TrendingUp, Settings, Users, UserCheck, Truck
};

export function AIDashboardGenerator({
  data,
  requirements,
  mappedKPIs = [],
  recommendedCharts = [],
  requirementMappings = [],
  unmappedRequirements = [],
  overallMappingConfidence = 0
}: AIDashboardGeneratorProps) {
  const [currentPage, setCurrentPage] = useState<DashboardPage>('executive');
  const [filters, setFilters] = useState<Map<string, string[]>>(new Map());
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [drillDownPath, setDrillDownPath] = useState<string[]>([]);
  const [drillDownData, setDrillDownData] = useState<any[] | null>(null);
  const [drillDownLevel, setDrillDownLevel] = useState<'summary' | 'visual' | 'detail' | 'record'>('summary');
  const [drillDownRecord, setDrillDownRecord] = useState<any[] | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('auto');
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatResponse[]>([]);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [savedDashboards, setSavedDashboards] = useState<SavedDashboard[]>([]);
  const [shareLink, setShareLink] = useState('');
  const [forecastMetric, setForecastMetric] = useState('');
  const [forecastHorizon, setForecastHorizon] = useState<'3' | '6' | '12'>('12');

  // Core analysis (existing)
  const analysis = useMemo(() => {
    const { headers, rows } = data;
    const numericColumns: { [key: string]: { values: number[]; index: number } } = {};
    const textColumns: { [key: string]: { values: string[]; index: number } } = {};

    headers.forEach((header, idx) => {
      const values = rows.map(row => row[idx]).filter(v => v !== undefined && v !== '');
      const numericValues = values.map(v => parseFloat(v)).filter(n => !isNaN(n));
      if (numericValues.length > values.length * 0.5) {
        numericColumns[header.toLowerCase()] = { values: numericValues, index: idx };
      } else {
        textColumns[header.toLowerCase()] = { values, index: idx };
      }
    });

    return { numericColumns, textColumns, headers, rows };
  }, [data]);

  // Data Quality Assessment
  const qualityResult = useMemo<DataQualityResult>(() => assessDataQuality(data.headers, data.rows), [data]);

  // Data Dictionary
  const dictionary = useMemo<DataDictionary>(() => buildDataDictionary(data.headers, data.rows), [data]);

  // BRD Validation
  const brdValidation = useMemo<BRDValidationResult | null>(() => {
    if (!requirements) return null;
    return validateBRD(requirements);
  }, [requirements]);

  // Visual Recommendations
  const visualRecs = useMemo<VisualRecommendation>(() => generateVisualRecommendations(dictionary, data.headers, data.rows), [dictionary, data]);

  // Auto-detected KPIs (existing logic, enhanced)
  const autoDetectedKPIs = useMemo<KPIConfig[]>(() => {
    const kpis: KPIConfig[] = [];
    const { numericColumns } = analysis;

    mappedKPIs.forEach(mapped => {
      const col = mapped.columns[0];
      const colLower = col.toLowerCase();
      if (numericColumns[colLower]) {
        const values = numericColumns[colLower].values;
        const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
        kpis.push({
          name: mapped.name,
          column: col,
          aggregation: mapped.aggregation as 'sum' | 'average',
          format: /amount|total|value|revenue|sales|cost|fee|tax|price/i.test(col) ? 'currency' :
                  /rate|percentage|ratio|percent/i.test(col) ? 'percentage' : 'number',
          status: avg > 0 ? 'good' : 'warning'
        });
      }
    });

    Object.entries(numericColumns).forEach(([col, { values: _v }]) => {
      const colTitle = col.charAt(0).toUpperCase() + col.slice(1);
      const colLower = col.toLowerCase();
      if (kpis.find(k => k.column.toLowerCase() === colLower)) return;

      if (/amount|total|value/i.test(colLower)) {
        kpis.push({ name: `Total ${colTitle}`, column: colTitle, aggregation: 'sum', format: 'currency', status: 'good' });
      } else if (/transaction|count|quantity|qty/i.test(colLower)) {
        kpis.push({ name: `Total ${colTitle}`, column: colTitle, aggregation: 'sum', format: 'number', status: 'good' });
      } else if (/fee|tax|cost|expense/i.test(colLower)) {
        kpis.push({ name: `Total ${colTitle}`, column: colTitle, aggregation: 'sum', format: 'currency', status: 'good' });
      } else if (/success|completed|approved/i.test(colLower)) {
        kpis.push({ name: `${colTitle} Rate`, column: colTitle, aggregation: 'average', format: 'percentage', status: 'good' });
      }
    });

    if (kpis.length < 6) {
      const firstNumeric = Object.keys(numericColumns)[0];
      if (firstNumeric && !kpis.find(k => /amount/i.test(k.name))) {
        kpis.push({ name: 'Total Amount', column: firstNumeric, aggregation: 'sum', format: 'currency', status: 'good' });
      }
      if (!kpis.find(k => /transaction|count/i.test(k.name))) {
        kpis.push({ name: 'Total Transactions', column: 'Count', aggregation: 'count', format: 'number', status: 'good' });
      }
      if (!kpis.find(k => /average|avg/i.test(k.name)) && firstNumeric) {
        kpis.push({ name: 'Avg Transaction Value', column: firstNumeric, aggregation: 'average', format: 'currency', status: 'good' });
      }
    }

    return kpis.slice(0, 8);
  }, [analysis, mappedKPIs]);

  const autoDetectedFilters = useMemo<FilterConfig[]>(() => {
    const filterConfigs: FilterConfig[] = [];
    const { textColumns: _tc, numericColumns: _nc, headers } = analysis;

    const timeFields = headers.filter(h => /date|month|year|quarter|week|period|time/i.test(h));
    timeFields.forEach(h => {
      const idx = headers.indexOf(h);
      const uniqueValues = [...new Set(analysis.rows.map(r => r[idx]).filter(Boolean))].sort();
      filterConfigs.push({ column: h, values: uniqueValues, selected: [], type: 'multiselect' });
    });

    const categoryFields = headers.filter(h =>
      /region|area|zone|country|city|state|location/i.test(h) ||
      /category|segment|group|type|class/i.test(h) ||
      /status|stage|state|condition/i.test(h) ||
      /occupation|role|position|department/i.test(h) ||
      /channel|platform|source/i.test(h)
    );
    categoryFields.forEach(h => {
      const idx = headers.indexOf(h);
      const uniqueValues = [...new Set(analysis.rows.map(r => r[idx]).filter(Boolean))].sort();
      if (uniqueValues.length > 1 && uniqueValues.length <= 50) {
        filterConfigs.push({ column: h, values: uniqueValues, selected: [], type: 'multiselect' });
      }
    });

    return filterConfigs.slice(0, 8);
  }, [analysis]);

  const autoDetectedCharts = useMemo<ChartConfig[]>(() => {
    const charts: ChartConfig[] = [];
    const { numericColumns, textColumns, headers: _headers } = analysis;

    if (recommendedCharts.length > 0) {
      recommendedCharts.slice(0, 6).forEach((rc, idx) => {
        charts.push({
          id: `chart-${idx}`,
          type: rc.type as ChartConfig['type'],
          title: rc.title,
          dimension: rc.dimension,
          metric: rc.metric
        });
      });
    }

    if (charts.length < 6) {
      const dimensionCols = Object.keys(textColumns).filter(k =>
        /region|area|category|segment|type|status|channel|month|year/i.test(k)
      );
      const metricCols = Object.keys(numericColumns).filter(k =>
        /amount|total|value|revenue|sales|count|quantity|cost|fee/i.test(k)
      );

      if (dimensionCols.length > 0 && metricCols.length > 0) {
        charts.push({ id: 'auto-bar', type: 'bar', title: `${metricCols[0].charAt(0).toUpperCase() + metricCols[0].slice(1)} by ${dimensionCols[0].charAt(0).toUpperCase() + dimensionCols[0].slice(1)}`, dimension: dimensionCols[0], metric: metricCols[0] });
        charts.push({ id: 'auto-donut', type: 'donut', title: `${dimensionCols[0]?.charAt(0).toUpperCase() + dimensionCols[0]?.slice(1) || 'Category'} Distribution`, dimension: dimensionCols[0] || 'category', metric: metricCols[0] });

        const timeDim = dimensionCols.find(d => /month|year|date|quarter/i.test(d));
        if (timeDim) {
          charts.push({ id: 'auto-line', type: 'line', title: `${metricCols[0].charAt(0).toUpperCase() + metricCols[0].slice(1)} Trend`, dimension: timeDim, metric: metricCols[0] });
          charts.push({ id: 'auto-area', type: 'area', title: `${metricCols[0].charAt(0).toUpperCase() + metricCols[0].slice(1)} Over Time`, dimension: timeDim, metric: metricCols[0] });
        }

        if (dimensionCols.length > 1) {
          charts.push({ id: 'auto-stacked', type: 'stackedBar', title: `${metricCols[0].charAt(0).toUpperCase() + metricCols[0].slice(1)} Analysis`, dimension: dimensionCols[0], metric: metricCols[0], stacked: dimensionCols[1] });
        }
      }
    }

    return charts.slice(0, 6);
  }, [analysis, recommendedCharts]);

  const filteredRows = useMemo(() => {
    let filtered = [...analysis.rows];
    filters.forEach((selectedValues, column) => {
      if (selectedValues.length > 0) {
        const idx = analysis.headers.findIndex(h => h.toLowerCase() === column.toLowerCase());
        if (idx !== -1) {
          filtered = filtered.filter(row => selectedValues.includes(row[idx]));
        }
      }
    });
    return filtered;
  }, [analysis, filters]);

  const kpiValues = useMemo(() => {
    const values: { [key: string]: { value: number; trend?: number; status: string } } = {};
    autoDetectedKPIs.forEach(kpi => {
      let value = 0;
      const colLower = kpi.column.toLowerCase();
      const colData = analysis.numericColumns[colLower];

      if (kpi.aggregation === 'count') {
        value = filteredRows.length;
      } else if (colData) {
        const idx = analysis.headers.findIndex(h => h.toLowerCase() === colLower);
        if (idx !== -1) {
          const vals = filteredRows.map(r => parseFloat(r[idx])).filter(n => !isNaN(n));
          if (kpi.aggregation === 'sum') value = vals.reduce((a, b) => a + b, 0);
          else if (kpi.aggregation === 'average') value = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
          else if (kpi.aggregation === 'min') value = Math.min(...vals);
          else if (kpi.aggregation === 'max') value = Math.max(...vals);
        }
      }

      let trend: number | undefined;
      if (colData && colData.values.length >= 4) {
        const mid = Math.floor(colData.values.length / 2);
        const firstHalf = colData.values.slice(0, mid);
        const secondHalf = colData.values.slice(mid);
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        if (firstAvg !== 0) trend = ((secondAvg - firstAvg) / Math.abs(firstAvg)) * 100;
      }

      values[kpi.name] = { value, trend, status: kpi.status };
    });
    return values;
  }, [autoDetectedKPIs, analysis, filteredRows]);

  const chartDataMap = useMemo(() => {
    const chartData: { [key: string]: any[] } = {};
    autoDetectedCharts.forEach(chart => {
      const dimIdx = analysis.headers.findIndex(h => h.toLowerCase() === chart.dimension.toLowerCase());
      const metricIdx = analysis.headers.findIndex(h => h.toLowerCase() === chart.metric.toLowerCase());
      if (dimIdx !== -1 && metricIdx !== -1) {
        const aggregated: { [key: string]: { sum: number; count: number; values: number[] } } = {};
        filteredRows.forEach(row => {
          const dimValue = row[dimIdx] || 'Unknown';
          const metricValue = parseFloat(row[metricIdx]);
          if (!aggregated[dimValue]) aggregated[dimValue] = { sum: 0, count: 0, values: [] };
          if (!isNaN(metricValue)) {
            aggregated[dimValue].sum += metricValue;
            aggregated[dimValue].count++;
            aggregated[dimValue].values.push(metricValue);
          }
        });
        chartData[chart.id] = Object.entries(aggregated)
          .map(([name, d]) => ({ name, value: d.sum, avg: d.count > 0 ? d.sum / d.count : 0, count: d.count }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10);
      }
    });
    return chartData;
  }, [autoDetectedCharts, analysis, filteredRows]);

  const insights = useMemo(() => {
    const insightsList: { type: 'finding' | 'trend' | 'risk' | 'opportunity'; title: string; description: string }[] = [];
    Object.entries(kpiValues).forEach(([name, d]) => {
      if (d.trend !== undefined) {
        if (d.trend > 5) insightsList.push({ type: 'trend', title: `${name} Trending Up`, description: `${name} has increased by ${d.trend.toFixed(1)}% compared to the previous period. This indicates positive momentum.` });
        else if (d.trend < -5) insightsList.push({ type: 'risk', title: `${name} Declining`, description: `${name} has decreased by ${Math.abs(d.trend).toFixed(1)}%. This requires attention and investigation.` });
      }
    });
    Object.entries(chartDataMap).forEach(([chartId, chartData]) => {
      if (chartData.length > 0 && chartData[0]) {
        const chart = autoDetectedCharts.find(c => c.id === chartId);
        if (chart && chartData[0].value > 0) {
          insightsList.push({ type: 'finding', title: `Top ${chart.dimension}`, description: `${chartData[0].name} leads with ${chartData[0].value.toLocaleString()} ${chart.metric}.` });
        }
        if (chartData.length > 1 && chartData[chartData.length - 1]) {
          insightsList.push({ type: 'opportunity', title: `Growth Opportunity`, description: `${chartData[chartData.length - 1].name} shows lower performance. Consider targeted strategies to improve.` });
        }
      }
    });
    return insightsList;
  }, [kpiValues, chartDataMap, autoDetectedCharts]);

  // Executive Report
  const executiveReport = useMemo<ExecutiveReport>(() => {
    const kpiData = autoDetectedKPIs.map(k => ({
      name: k.name,
      value: kpiValues[k.name]?.value || 0,
      trend: kpiValues[k.name]?.trend,
      format: k.format
    }));
    return generateExecutiveReport(kpiData, insights, filteredRows.length, data.headers.length);
  }, [autoDetectedKPIs, kpiValues, insights, filteredRows, data]);

  // AI Recommendations
  const aiRecommendations = useMemo<AIRecommendation>(() => {
    const kpiData = autoDetectedKPIs.map(k => ({
      name: k.name, value: kpiValues[k.name]?.value || 0, trend: kpiValues[k.name]?.trend, format: k.format
    }));
    return generateAIRecommendations(kpiData, chartDataMap, insights, qualityResult.qualityScore);
  }, [autoDetectedKPIs, kpiValues, chartDataMap, insights, qualityResult]);

  // Forecast
  const forecastResult = useMemo<ForecastResult | null>(() => {
    const metric = forecastMetric || dictionary.measures[0] || '';
    if (!metric) return null;
    return generateForecast(data.headers, data.rows, metric);
  }, [forecastMetric, dictionary, data]);

  // Chart Narratives
  const chartNarratives = useMemo<ChartNarrative[]>(() => {
    return autoDetectedCharts.map(chart => {
      const chartData = chartDataMap[chart.id] || [];
      return generateChartNarrative(chart.title, chartData, chart.dimension, chart.metric);
    });
  }, [autoDetectedCharts, chartDataMap]);

  // Handlers
  const handleFilterChange = (column: string, values: string[]) => {
    const newFilters = new Map(filters);
    newFilters.set(column, values);
    setFilters(newFilters);
  };

  const clearFilters = () => setFilters(new Map());

  const handleDrillDown = (chartId: string, dimension: string) => {
    const chart = autoDetectedCharts.find(c => c.id === chartId);
    if (chart) {
      setDrillDownPath([dimension]);
      setDrillDownData(chartDataMap[chartId] || null);
      setDrillDownLevel('visual');
      setCurrentPage('drilldown');
    }
  };

  const handleDrillToDetail = (dimValue: string) => {
    setDrillDownPath([...drillDownPath, dimValue]);
    setDrillDownLevel('detail');
  };

  const handleDrillToRecord = (record: any[]) => {
    setDrillDownRecord(record);
    setDrillDownLevel('record');
  };

  const handleChatSubmit = () => {
    if (!chatInput.trim()) return;
    const response = processChatQuery(chatInput, data.headers, data.rows, dictionary);
    setChatHistory([...chatHistory, response]);
    setChatInput('');
  };

  const handleSave = async () => {
    if (!saveName.trim()) { setSaveStatus('Please enter a dashboard name'); return; }
    setSaveStatus('Saving...');
    const result = await saveDashboard({
      name: saveName,
      description: saveDescription,
      dashboard_config: { kpis: autoDetectedKPIs, charts: autoDetectedCharts, filters: autoDetectedFilters, qualityScore: qualityResult.qualityScore },
      brd_mapping: { requirementMappings, unmappedRequirements, overallMappingConfidence }
    });
    if (result.error) { setSaveStatus(`Error: ${result.error}`); }
    else {
      setSaveStatus('Dashboard saved successfully!');
      if (result.data?.share_token) setShareLink(generateShareLink(result.data.share_token));
    }
  };

  const loadSavedDashboards = async () => {
    const result = await listSavedDashboards();
    if (result.data) setSavedDashboards(result.data);
  };

  const handleExport = (format: 'pdf' | 'pptx' | 'excel' | 'csv' | 'json') => {
    const exportData = {
      kpis: autoDetectedKPIs.map(k => ({ name: k.name, value: kpiValues[k.name]?.value || 0, trend: kpiValues[k.name]?.trend, format: k.format })),
      insights, executiveReport, qualityResult, dictionary,
      headers: data.headers, rows: filteredRows, chartDataMap,
      chartTitles: Object.fromEntries(autoDetectedCharts.map(c => [c.id, c.title]))
    };
    if (format === 'pdf') exportToPDF(exportData);
    else if (format === 'excel') exportToExcel(exportData);
    else if (format === 'csv') exportToCSV(exportData);
    else if (format === 'json') exportToJSON(exportData);
    else if (format === 'pptx') exportToPPTX(exportData);
  };

  const containerClass = fullScreen
    ? 'fixed inset-0 z-50 bg-slate-50 overflow-auto'
    : 'bg-slate-50 rounded-2xl shadow-xl border border-slate-200';

  const navPages: { id: DashboardPage; label: string; icon: any }[] = [
    { id: 'executive', label: 'Executive', icon: LayoutDashboard },
    { id: 'detailed', label: 'Detailed', icon: BarChart3 },
    { id: 'mapping', label: 'Mapping', icon: Target },
    { id: 'quality', label: 'Quality', icon: Database },
    { id: 'dictionary', label: 'Dictionary', icon: BookOpen },
    { id: 'validation', label: 'BRD Check', icon: ClipboardCheck },
    { id: 'recommendations', label: 'AI Recs', icon: Brain },
    { id: 'chat', label: 'AI Chat', icon: MessageSquare },
    { id: 'templates', label: 'Templates', icon: Sparkles },
    { id: 'forecast', label: 'Forecast', icon: TrendIcon },
    { id: 'narrative', label: 'Narratives', icon: FileText },
    { id: 'drilldown', label: 'Drill Down', icon: Layers },
    { id: 'insights', label: 'Insights', icon: Lightbulb },
    { id: 'save', label: 'Save/Share', icon: Save },
    { id: 'export', label: 'Export', icon: Download },
  ];

  const renderChart = (chart: ChartConfig, chartData: any[], height: number) => {
    if (chartData.length === 0) return <div className="text-slate-400 text-sm text-center py-8">No data available</div>;
    return (
      <ResponsiveContainer width="100%" height={height}>
        {chart.type === 'bar' || chart.type === 'stackedBar' ? (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
            <YAxis stroke="#64748b" fontSize={11} />
            <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
            <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : chart.type === 'line' ? (
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
            <YAxis stroke="#64748b" fontSize={11} />
            <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
            <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={false} />
          </LineChart>
        ) : chart.type === 'area' ? (
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
            <YAxis stroke="#64748b" fontSize={11} />
            <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
            <Area type="monotone" dataKey="value" stroke="#2563eb" fill="#2563eb" fillOpacity={0.2} />
          </AreaChart>
        ) : chart.type === 'donut' || chart.type === 'pie' ? (
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" innerRadius={chart.type === 'donut' ? 40 : 0} outerRadius={70} dataKey="value"
              label={({ name, percent }) => `${name} ${(percent ? percent * 100 : 0).toFixed(0)}%`} labelLine={false}>
              {chartData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
          </PieChart>
        ) : (
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
            <YAxis stroke="#64748b" fontSize={11} />
            <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
            <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    );
  };

  return (
    <div className={containerClass}>
      {/* Navigation */}
      <nav className="bg-[#1e3a5f] text-white px-6 py-3 sticky top-0 z-40">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <LayoutDashboard className="w-7 h-7" />
            <h1 className="text-lg font-bold">AI Business Analyst + Dashboard Generator</h1>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {navPages.map((page) => {
              const Icon = page.icon;
              return (
                <button key={page.id} onClick={() => setCurrentPage(page.id)}
                  className={`px-3 py-1.5 rounded-lg font-medium text-sm transition-colors flex items-center gap-1.5 ${
                    currentPage === page.id ? 'bg-blue-600 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                  }`}>
                  <Icon className="w-3.5 h-3.5" />
                  {page.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowFiltersPanel(!showFiltersPanel)}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 text-sm ${showFiltersPanel ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'}`}>
              <Filter className="w-4 h-4" /> Filters
              {filters.size > 0 && <span className="bg-green-500 text-xs px-2 py-0.5 rounded-full">{Array.from(filters.values()).filter(v => v.length > 0).length}</span>}
            </button>
            <button onClick={() => setFullScreen(!fullScreen)} className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg">
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Filters Panel */}
        {showFiltersPanel && (
          <div className="w-72 bg-white border-r border-slate-200 p-4 overflow-auto" style={{ maxHeight: 'calc(100vh - 72px)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">Filters</h3>
              <button onClick={clearFilters} className="text-sm text-blue-600 hover:underline">Clear all</button>
            </div>
            <div className="space-y-4">
              {autoDetectedFilters.map((filter) => (
                <div key={filter.column}>
                  <label className="block text-sm font-medium text-slate-700 mb-2">{filter.column}</label>
                  <select multiple className="w-full h-24 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    value={filters.get(filter.column.toLowerCase()) || []}
                    onChange={(e) => { const vals = Array.from(e.target.selectedOptions, opt => opt.value); handleFilterChange(filter.column.toLowerCase(), vals); }}>
                    {filter.values.map((val) => <option key={val} value={val}>{val}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 p-6">
          {/* Page: Executive Overview */}
          {currentPage === 'executive' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {autoDetectedKPIs.slice(0, 6).map((kpi) => {
                  const value = kpiValues[kpi.name]?.value || 0;
                  const trend = kpiValues[kpi.name]?.trend;
                  return (
                    <div key={kpi.name} className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => { setDrillDownPath([kpi.name]); setDrillDownData([{ name: kpi.name, value }]); setDrillDownLevel('visual'); setCurrentPage('drilldown'); }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-slate-500">{kpi.name}</span>
                        {kpi.format === 'currency' && <DollarSign className="w-4 h-4 text-green-500" />}
                        {kpi.format === 'percentage' && <Activity className="w-4 h-4 text-blue-500" />}
                        {kpi.format === 'number' && <BarChart3 className="w-4 h-4 text-purple-500" />}
                      </div>
                      <div className="text-2xl font-bold text-slate-800">
                        {kpi.format === 'currency' && '$'}
                        {value.toLocaleString(undefined, { maximumFractionDigits: kpi.format === 'percentage' ? 1 : 0 })}
                        {kpi.format === 'percentage' && '%'}
                      </div>
                      {trend !== undefined && (
                        <div className={`flex items-center gap-1 mt-2 text-sm ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {trend >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                          {Math.abs(trend).toFixed(1)}%
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {autoDetectedCharts.slice(0, 4).map((chart) => {
                  const chartData = chartDataMap[chart.id] || [];
                  return (
                    <div key={chart.id} className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => handleDrillDown(chart.id, chart.dimension)}>
                      <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-blue-600" />{chart.title}
                      </h3>
                      {renderChart(chart, chartData, 200)}
                    </div>
                  );
                })}
              </div>

              {requirements && (
                <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                  <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Target className="w-5 h-5 text-purple-600" />Requirements Analysis</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-slate-600 mb-2">Business Objectives</h4>
                      <ul className="text-sm text-slate-700 space-y-1">
                        {requirements.objectives.slice(0, 3).map((obj, i) => (
                          <li key={i} className="flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" /><span>{obj.substring(0, 50)}...</span></li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-slate-600 mb-2">Identified KPIs</h4>
                      <div className="flex flex-wrap gap-2">
                        {requirements.kpis.slice(0, 6).map((kpi, i) => <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">{kpi}</span>)}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-slate-600 mb-2">Dimensions</h4>
                      <div className="flex flex-wrap gap-2">
                        {requirements.dimensions.slice(0, 6).map((dim, i) => <span key={i} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">{dim}</span>)}
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-slate-600 mb-2">Confidence</h4>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-blue-500 to-green-500" style={{ width: `${requirements.confidence}%` }} />
                        </div>
                        <span className="text-sm font-medium text-slate-700">{requirements.confidence}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Page: Detailed Analysis */}
          {currentPage === 'detailed' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {autoDetectedCharts.map((chart) => {
                  const chartData = chartDataMap[chart.id] || [];
                  return (
                    <div key={chart.id} className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                      <h3 className="font-semibold text-slate-800 mb-4">{chart.title}</h3>
                      {renderChart(chart, chartData, 250)}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Page: Requirement-to-Data Mapping */}
          {currentPage === 'mapping' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2"><Target className="w-5 h-5 text-blue-600" />Requirement-to-Data Mapping</h3>
                <p className="text-sm text-slate-600 mb-4">Maps BRD requirements to dataset fields with confidence scores.</p>
                {overallMappingConfidence > 0 && (
                  <div className="mb-4 flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-700">Overall Mapping Confidence:</span>
                    <div className="flex-1 max-w-xs h-3 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-blue-500 to-green-500" style={{ width: `${overallMappingConfidence}%` }} />
                    </div>
                    <span className="text-sm font-bold text-slate-800">{overallMappingConfidence}%</span>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Requirement Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Mapped Dataset Field</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Confidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {requirementMappings.map((m, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-sm text-slate-700 font-medium">{m.requirementName}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{m.mappedField}</td>
                          <td className="px-4 py-3 text-sm"><span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">{m.type}</span></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div className={`h-full ${m.confidence >= 90 ? 'bg-green-500' : m.confidence >= 70 ? 'bg-blue-500' : 'bg-amber-500'}`} style={{ width: `${m.confidence}%` }} />
                              </div>
                              <span className="text-sm font-medium text-slate-700">{m.confidence}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {unmappedRequirements.length > 0 && (
                <div className="bg-red-50 rounded-xl p-6 border border-red-200">
                  <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2"><AlertCircle className="w-5 h-5" />Unmapped Requirements ({unmappedRequirements.length})</h3>
                  <div className="space-y-2">
                    {unmappedRequirements.map((m, i) => (
                      <div key={i} className="flex items-start gap-3 bg-white rounded-lg p-3 border border-red-100">
                        <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-slate-800">{m.requirementName}</p>
                          <p className="text-sm text-slate-600">{m.warning}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Page: Data Quality Assessment */}
          {currentPage === 'quality' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 text-center">
                  <p className="text-sm text-slate-500 mb-1">Quality Score</p>
                  <p className={`text-3xl font-bold ${qualityResult.qualityScore >= 70 ? 'text-green-600' : qualityResult.qualityScore >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{qualityResult.qualityScore}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 text-center">
                  <p className="text-sm text-slate-500 mb-1">Total Rows</p>
                  <p className="text-2xl font-bold text-slate-800">{qualityResult.totalRows.toLocaleString()}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 text-center">
                  <p className="text-sm text-slate-500 mb-1">Total Columns</p>
                  <p className="text-2xl font-bold text-slate-800">{qualityResult.totalColumns}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 text-center">
                  <p className="text-sm text-slate-500 mb-1">Null %</p>
                  <p className="text-2xl font-bold text-amber-500">{qualityResult.nullPercentage}%</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 text-center">
                  <p className="text-sm text-slate-500 mb-1">Duplicates</p>
                  <p className="text-2xl font-bold text-red-500">{qualityResult.duplicateRecords}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 text-center">
                  <p className="text-sm text-slate-500 mb-1">Invalid Values</p>
                  <p className="text-2xl font-bold text-red-500">{qualityResult.invalidValues}</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 text-center">
                  <p className="text-sm text-slate-500 mb-1">Missing Dates</p>
                  <p className="text-2xl font-bold text-amber-500">{qualityResult.missingDates}</p>
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-4">Null Analysis by Column</h3>
                <div className="space-y-2">
                  {qualityResult.nullsByColumn.slice(0, 10).map((col, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-sm text-slate-700 w-40 truncate">{col.column}</span>
                      <div className="flex-1 h-4 bg-slate-200 rounded-full overflow-hidden">
                        <div className={`h-full ${col.nullPercentage > 50 ? 'bg-red-500' : col.nullPercentage > 20 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${col.nullPercentage}%` }} />
                      </div>
                      <span className="text-sm text-slate-600 w-20 text-right">{col.nullPercentage.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Lightbulb className="w-5 h-5 text-amber-500" />Remediation Recommendations</h3>
                <div className="space-y-3">
                  {qualityResult.remediation.map((r, i) => (
                    <div key={i} className={`rounded-lg p-4 border ${r.severity === 'high' ? 'bg-red-50 border-red-200' : r.severity === 'medium' ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                      <div className="flex items-start gap-3">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${r.severity === 'high' ? 'bg-red-200 text-red-800' : r.severity === 'medium' ? 'bg-amber-200 text-amber-800' : 'bg-green-200 text-green-800'}`}>{r.severity.toUpperCase()}</span>
                        <div>
                          <p className="text-sm font-medium text-slate-800">{r.issue}</p>
                          <p className="text-sm text-slate-600 mt-1">{r.recommendation}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Page: Data Dictionary */}
          {currentPage === 'dictionary' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
              <div className="p-5 border-b border-slate-200">
                <h3 className="font-semibold text-slate-800 flex items-center gap-2"><BookOpen className="w-5 h-5 text-blue-600" />Data Dictionary</h3>
                <p className="text-sm text-slate-600 mt-1">Metadata table with detected types, business meanings, and column roles.</p>
              </div>
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Column Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Detected Type</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Business Meaning</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Unique Values</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Null Count</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Sample Values</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {dictionary.entries.map((entry, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-800">{entry.columnName}</td>
                      <td className="px-4 py-3 text-sm"><span className={`px-2 py-1 text-xs rounded-full ${entry.detectedType === 'number' ? 'bg-blue-100 text-blue-700' : entry.detectedType === 'date' ? 'bg-purple-100 text-purple-700' : entry.detectedType === 'boolean' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}`}>{entry.detectedType}</span></td>
                      <td className="px-4 py-3 text-sm text-slate-600">{entry.businessMeaning}</td>
                      <td className="px-4 py-3 text-sm"><span className={`px-2 py-1 text-xs rounded-full font-medium ${entry.role === 'Measure' ? 'bg-green-100 text-green-700' : entry.role === 'Dimension' ? 'bg-blue-100 text-blue-700' : entry.role === 'Date' ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>{entry.role}</span></td>
                      <td className="px-4 py-3 text-sm text-slate-600">{entry.uniqueValues}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{entry.nullCount}</td>
                      <td className="px-4 py-3 text-sm text-slate-500 max-w-xs truncate">{entry.sampleValues.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Page: BRD Validation */}
          {currentPage === 'validation' && brdValidation && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-blue-600" />BRD Completeness Validation</h3>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">Completeness Score</p>
                    <p className={`text-3xl font-bold ${brdValidation.completenessScore >= 80 ? 'text-green-600' : brdValidation.completenessScore >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{brdValidation.completenessScore}%</p>
                  </div>
                </div>
                <p className="text-sm text-slate-600 mb-4">{brdValidation.summary}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {brdValidation.checks.map((check, i) => (
                    <div key={i} className={`rounded-lg p-4 border ${check.found ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        {check.found ? <CheckCircle className="w-5 h-5 text-green-500" /> : <AlertCircle className="w-5 h-5 text-red-500" />}
                        <span className="font-medium text-slate-800">{check.name}</span>
                      </div>
                      <p className="text-sm text-slate-600">{check.found ? `${check.count} items found` : 'Not found'}</p>
                      {check.items.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {check.items.slice(0, 3).map((item, j) => <span key={j} className="px-2 py-0.5 bg-white text-xs text-slate-600 rounded border border-slate-200 truncate max-w-full">{item.substring(0, 30)}</span>)}
                        </div>
                      )}
                      {!check.found && check.recommendation && (
                        <p className="text-xs text-red-600 mt-2">{check.recommendation}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {brdValidation.missingItems.length > 0 && (
                <div className="bg-red-50 rounded-xl p-6 border border-red-200">
                  <h3 className="font-semibold text-red-800 mb-3 flex items-center gap-2"><AlertCircle className="w-5 h-5" />Missing Items</h3>
                  <div className="space-y-2">
                    {brdValidation.missingItems.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 bg-white rounded-lg p-3 border border-red-100">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        <span className="text-sm font-medium text-slate-800">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Page: Visual Recommendations */}
          {currentPage === 'recommendations' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Brain className="w-5 h-5 text-blue-600" />Visual Recommendation Engine</h3>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">Overall Confidence</p>
                    <p className="text-xl font-bold text-blue-600">{visualRecs.overallConfidence}%</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                  <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2"><TargetIcon className="w-4 h-4 text-green-600" />Recommended KPIs</h4>
                  <div className="space-y-2">
                    {visualRecs.kpis.map((kpi, i) => (
                      <div key={i} className="bg-slate-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-slate-800">{kpi.name}</span>
                          <span className="text-xs text-blue-600 font-medium">{kpi.confidence}%</span>
                        </div>
                        <p className="text-xs text-slate-500">{kpi.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                  <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-blue-600" />Recommended Charts</h4>
                  <div className="space-y-2">
                    {visualRecs.charts.map((chart, i) => (
                      <div key={i} className="bg-slate-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-slate-800">{chart.title}</span>
                          <span className="text-xs text-blue-600 font-medium">{chart.confidence}%</span>
                        </div>
                        <p className="text-xs text-slate-500">{chart.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                  <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2"><Filter className="w-4 h-4 text-purple-600" />Recommended Filters</h4>
                  <div className="space-y-2">
                    {visualRecs.filters.map((filter, i) => (
                      <div key={i} className="bg-slate-50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-slate-800">{filter.column}</span>
                          <span className="text-xs text-blue-600 font-medium">{filter.confidence}%</span>
                        </div>
                        <p className="text-xs text-slate-500">{filter.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* AI Recommendations Panel */}
              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Zap className="w-5 h-5 text-amber-500" />AI Recommendation Panel</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-green-700 mb-2">Top Opportunities</h4>
                    {aiRecommendations.topOpportunities.map((o, i) => (
                      <div key={i} className="bg-green-50 rounded-lg p-3 mb-2 border border-green-100">
                        <p className="text-sm font-medium text-slate-800">{o.title}</p>
                        <p className="text-xs text-slate-600 mt-1">{o.description}</p>
                      </div>
                    ))}
                    <h4 className="text-sm font-medium text-blue-700 mb-2 mt-4">Revenue Growth Opportunities</h4>
                    {aiRecommendations.revenueGrowthOpportunities.map((o, i) => (
                      <div key={i} className="bg-blue-50 rounded-lg p-3 mb-2 border border-blue-100">
                        <p className="text-sm font-medium text-slate-800">{o.area}</p>
                        <p className="text-xs text-slate-600 mt-1">{o.description}</p>
                        <p className="text-xs text-blue-600 mt-1">Est. upside: {o.estimatedUpside}</p>
                      </div>
                    ))}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-red-700 mb-2">Top Risks</h4>
                    {aiRecommendations.topRisks.map((r, i) => (
                      <div key={i} className="bg-red-50 rounded-lg p-3 mb-2 border border-red-100">
                        <p className="text-sm font-medium text-slate-800">{r.title}</p>
                        <p className="text-xs text-slate-600 mt-1">{r.description}</p>
                      </div>
                    ))}
                    <h4 className="text-sm font-medium text-amber-700 mb-2 mt-4">Cost Reduction Opportunities</h4>
                    {aiRecommendations.costReductionOpportunities.map((o, i) => (
                      <div key={i} className="bg-amber-50 rounded-lg p-3 mb-2 border border-amber-100">
                        <p className="text-sm font-medium text-slate-800">{o.area}</p>
                        <p className="text-xs text-slate-600 mt-1">{o.description}</p>
                        <p className="text-xs text-amber-600 mt-1">Est. savings: {o.estimatedSavings}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-slate-700 mb-2">Business Recommendations</h4>
                  {aiRecommendations.businessRecommendations.map((r, i) => (
                    <div key={i} className="flex items-start gap-3 mb-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0 ${r.priority === 'high' ? 'bg-red-100 text-red-600' : r.priority === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 text-slate-600'}`}>{i + 1}</span>
                      <div><p className="text-sm font-medium text-slate-800">{r.title}</p><p className="text-xs text-slate-600">{r.description}</p></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Page: AI Chat Assistant */}
          {currentPage === 'chat' && (
            <div className="space-y-4 max-w-4xl">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2"><MessageSquare className="w-5 h-5 text-blue-600" />AI Chat Assistant - Ask Your Data</h3>
                <p className="text-sm text-slate-600 mb-4">Ask questions in natural language and get instant insights and charts.</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {CHAT_EXAMPLES.map((ex, i) => (
                    <button key={i} onClick={() => setChatInput(ex)} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm text-slate-700 transition-colors">{ex}</button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleChatSubmit()}
                    placeholder="Ask a question about your data..."
                    className="flex-1 px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  <button onClick={handleChatSubmit} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2">
                    <Send className="w-4 h-4" /> Ask
                  </button>
                </div>
              </div>

              {chatHistory.map((chat, i) => (
                <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0"><MessageSquare className="w-4 h-4 text-slate-600" /></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-slate-800">{chat.question}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0"><Brain className="w-4 h-4 text-white" /></div>
                    <div className="flex-1">
                      <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans">{chat.answer}</pre>
                      <div className="mt-2 flex items-start gap-2 bg-blue-50 rounded-lg p-3">
                        <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-slate-700">{chat.insight}</p>
                      </div>
                      {chat.chartData && chat.chartData.length > 0 && (
                        <div className="mt-3">
                          <ResponsiveContainer width="100%" height={250}>
                            {chat.chartType === 'line' ? (
                              <LineChart data={chat.chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                                <YAxis stroke="#64748b" fontSize={11} />
                                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                                <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} />
                              </LineChart>
                            ) : chat.chartType === 'pie' || chat.chartType === 'donut' ? (
                              <PieChart>
                                <Pie data={chat.chartData} cx="50%" cy="50%" innerRadius={chat.chartType === 'donut' ? 50 : 0} outerRadius={90} dataKey="value">
                                  {chat.chartData.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
                                </Pie>
                                <Tooltip />
                              </PieChart>
                            ) : (
                              <BarChart data={chat.chartData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                                <YAxis stroke="#64748b" fontSize={11} />
                                <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                                <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            )}
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {chatHistory.length === 0 && <div className="text-center text-slate-400 py-12">Start a conversation by asking a question above</div>}
            </div>
          )}

          {/* Page: Dashboard Templates */}
          {currentPage === 'templates' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-2 flex items-center gap-2"><Sparkles className="w-5 h-5 text-blue-600" />Dashboard Templates</h3>
                <p className="text-sm text-slate-600 mb-4">Select a template to pre-configure your dashboard for a specific business domain.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {DASHBOARD_TEMPLATES.map((tpl) => {
                    const Icon = TEMPLATE_ICONS[tpl.icon] || Sparkles;
                    return (
                      <button key={tpl.id} onClick={() => setSelectedTemplate(tpl.id)}
                        className={`p-5 rounded-xl border-2 text-left transition-all ${selectedTemplate === tpl.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}>
                        <Icon className={`w-8 h-8 mb-3 ${selectedTemplate === tpl.id ? 'text-blue-600' : 'text-slate-400'}`} />
                        <h4 className="font-semibold text-slate-800">{tpl.name}</h4>
                        <p className="text-xs text-slate-500 mt-1">{tpl.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedTemplate !== 'auto' && (() => {
                const tpl = DASHBOARD_TEMPLATES.find(t => t.id === selectedTemplate);
                if (!tpl) return null;
                const applied = applyTemplate(tpl, data.headers);
                return (
                  <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                    <h3 className="font-semibold text-slate-800 mb-4">Template Preview: {tpl.name}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <h4 className="text-sm font-medium text-slate-600 mb-2">Matched KPIs ({applied.selectedKPIs.length})</h4>
                        <div className="flex flex-wrap gap-2">
                          {applied.selectedKPIs.length > 0 ? applied.selectedKPIs.map((k, i) => <span key={i} className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">{k}</span>) : <span className="text-sm text-slate-400">No matches</span>}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-slate-600 mb-2">Matched Dimensions ({applied.selectedDimensions.length})</h4>
                        <div className="flex flex-wrap gap-2">
                          {applied.selectedDimensions.length > 0 ? applied.selectedDimensions.map((d, i) => <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">{d}</span>) : <span className="text-sm text-slate-400">No matches</span>}
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-slate-600 mb-2">Chart Configurations ({applied.chartConfigs.length})</h4>
                        <div className="space-y-1">
                          {applied.chartConfigs.map((c, i) => <span key={i} className="block px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded">{c.title}</span>)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Page: Forecasting */}
          {currentPage === 'forecast' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><TrendIcon className="w-5 h-5 text-blue-600" />Forecasting Engine</h3>
                <div className="flex flex-wrap gap-4 items-center mb-4">
                  <div>
                    <label className="text-sm text-slate-600 block mb-1">Metric to Forecast</label>
                    <select value={forecastMetric} onChange={(e) => setForecastMetric(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
                      <option value="">Auto-detect (first measure)</option>
                      {dictionary.measures.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 block mb-1">Forecast Horizon</label>
                    <div className="flex gap-2">
                      {(['3', '6', '12'] as const).map(h => (
                        <button key={h} onClick={() => setForecastHorizon(h)} className={`px-4 py-2 rounded-lg text-sm font-medium ${forecastHorizon === h ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{h} Month</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {forecastResult ? (
                <>
                  <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="font-semibold text-slate-800">Forecast for {forecastResult.metric}</h4>
                        <p className="text-sm text-slate-600 mt-1">{forecastResult.summary}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-500">Confidence Level</p>
                        <p className="text-2xl font-bold text-blue-600">{forecastResult.confidenceLevel}%</p>
                        <p className="text-sm text-slate-500 mt-1">Trend: {forecastResult.trendDirection} ({forecastResult.trendStrength}% strength)</p>
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={forecastHorizon === '3' ? forecastResult.threeMonth : forecastHorizon === '6' ? forecastResult.sixMonth : forecastResult.twelveMonth}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="period" stroke="#64748b" fontSize={11} />
                        <YAxis stroke="#64748b" fontSize={11} />
                        <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                        <Area type="monotone" dataKey="upperBound" stroke="#93c5fd" fill="#dbeafe" fillOpacity={0.3} name="Upper Bound" />
                        <Area type="monotone" dataKey="forecast" stroke="#2563eb" fill="#2563eb" fillOpacity={0.2} name="Forecast" />
                        <Area type="monotone" dataKey="lowerBound" stroke="#93c5fd" fill="#ffffff" fillOpacity={1} name="Lower Bound" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                    <h4 className="font-semibold text-slate-800 mb-3">Forecast Details ({forecastHorizon} months)</h4>
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Period</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Forecast</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Lower Bound</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Upper Bound</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {(forecastHorizon === '3' ? forecastResult.threeMonth : forecastHorizon === '6' ? forecastResult.sixMonth : forecastResult.twelveMonth).map((p, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="px-4 py-2 text-sm text-slate-700">{p.period}</td>
                            <td className="px-4 py-2 text-sm font-medium text-blue-600">{p.forecast.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td className="px-4 py-2 text-sm text-slate-500">{p.lowerBound.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                            <td className="px-4 py-2 text-sm text-slate-500">{p.upperBound.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200 text-center text-slate-400">No forecastable data found. Need at least 3 time periods with numeric values.</div>
              )}
            </div>
          )}

          {/* Page: Auto Dashboard Narratives */}
          {currentPage === 'narrative' && (
            <div className="space-y-6">
              {chartNarratives.map((narr, i) => (
                <div key={i} className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                  <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-blue-600" />{narr.chartTitle}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                      <h4 className="text-sm font-medium text-blue-700 mb-1 flex items-center gap-2"><Activity className="w-4 h-4" />What Happened</h4>
                      <p className="text-sm text-slate-700">{narr.whatHappened}</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                      <h4 className="text-sm font-medium text-purple-700 mb-1 flex items-center gap-2"><Brain className="w-4 h-4" />Why It Happened</h4>
                      <p className="text-sm text-slate-700">{narr.whyItHappened}</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                      <h4 className="text-sm font-medium text-amber-700 mb-1 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Business Impact</h4>
                      <p className="text-sm text-slate-700">{narr.businessImpact}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                      <h4 className="text-sm font-medium text-green-700 mb-1 flex items-center gap-2"><Lightbulb className="w-4 h-4" />Suggested Action</h4>
                      <p className="text-sm text-slate-700">{narr.suggestedAction}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Page: Drill Down */}
          {currentPage === 'drilldown' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="p-5 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800">Drill Down Analysis</h3>
                    {drillDownPath.length > 0 && (
                      <div className="flex items-center gap-2 mt-2 text-sm text-slate-600">
                        <span>KPI</span>
                        {drillDownPath.map((path, i) => (
                          <span key={i} className="flex items-center gap-2"><ChevronRight className="w-4 h-4" />{path}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-xs">
                      <span className={`px-2 py-1 rounded ${drillDownLevel === 'visual' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Visual</span>
                      <ChevronRight className="w-3 h-3" />
                      <span className={`px-2 py-1 rounded ${drillDownLevel === 'detail' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Detail Table</span>
                      <ChevronRight className="w-3 h-3" />
                      <span className={`px-2 py-1 rounded ${drillDownLevel === 'record' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>Record Level</span>
                    </div>
                  </div>
                  <button onClick={() => { setDrillDownPath([]); setDrillDownLevel('summary'); setDrillDownRecord(null); }} className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm">Reset</button>
                </div>
              </div>

              {drillDownLevel === 'visual' && drillDownData && (
                <div className="p-5">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={drillDownData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }} />
                      <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} onClick={(d: any) => handleDrillToDetail(d.name)} />
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-sm text-slate-500 text-center mt-2">Click a bar to drill into detail records</p>
                </div>
              )}

              {drillDownLevel === 'detail' && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {data.headers.map((h) => <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredRows.filter(row => drillDownPath.length < 2 || row.some(cell => cell === drillDownPath[1])).slice(0, 100).map((row, i) => (
                        <tr key={i} className="hover:bg-blue-50 cursor-pointer" onClick={() => handleDrillToRecord(row)}>
                          {row.map((cell, j) => <td key={j} className="px-4 py-3 text-sm text-slate-700">{cell}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="text-sm text-slate-500 text-center p-3">Click a row to view record-level detail</p>
                </div>
              )}

              {drillDownLevel === 'record' && drillDownRecord && (
                <div className="p-5">
                  <h4 className="font-semibold text-slate-800 mb-4">Record Level Detail</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {data.headers.map((h, i) => (
                      <div key={i} className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 uppercase mb-1">{h}</p>
                        <p className="text-sm font-medium text-slate-800">{drillDownRecord[i]}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {drillDownLevel === 'summary' && (
                <div className="p-8 text-center text-slate-400">Click a KPI card or chart on the Executive page to start drilling down</div>
              )}
            </div>
          )}

          {/* Page: Insights */}
          {currentPage === 'insights' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><FileText className="w-5 h-5 text-blue-600" />Executive Summary</h3>
                <p className="text-slate-700 leading-relaxed">{executiveReport.executiveSummary}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insights.map((insight, i) => (
                  <div key={i} className={`bg-white rounded-xl p-5 shadow-sm border ${insight.type === 'risk' ? 'border-red-200' : insight.type === 'opportunity' ? 'border-green-200' : insight.type === 'trend' ? 'border-blue-200' : 'border-slate-200'}`}>
                    <div className="flex items-start gap-3">
                      {insight.type === 'risk' && <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />}
                      {insight.type === 'opportunity' && <Lightbulb className="w-5 h-5 text-green-500 mt-0.5" />}
                      {insight.type === 'trend' && <TrendingUp className="w-5 h-5 text-blue-500 mt-0.5" />}
                      {insight.type === 'finding' && <Target className="w-5 h-5 text-purple-500 mt-0.5" />}
                      <div><h4 className="font-medium text-slate-800">{insight.title}</h4><p className="text-sm text-slate-600 mt-1">{insight.description}</p></div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-4">Executive Report - Recommendations & Action Plan</h3>
                <div className="space-y-3">
                  {executiveReport.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">{rec.priority}</span>
                      <div><p className="font-medium text-slate-800">{rec.action}</p><p className="text-sm text-slate-600">Impact: {rec.expectedImpact} | Timeline: {rec.timeline}</p></div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 space-y-3">
                  {executiveReport.actionPlan.map((phase, i) => (
                    <div key={i} className="bg-slate-50 rounded-lg p-4">
                      <h4 className="font-medium text-slate-800 mb-2">{phase.phase}</h4>
                      <ul className="space-y-1">{phase.actions.map((a, j) => <li key={j} className="text-sm text-slate-600 flex items-start gap-2"><CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />{a}</li>)}</ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Page: Save & Share */}
          {currentPage === 'save' && (
            <div className="space-y-6 max-w-3xl">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Save className="w-5 h-5 text-blue-600" />Save Dashboard</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-600 block mb-1">Dashboard Name</label>
                    <input type="text" value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="My Q4 Analytics Dashboard"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 block mb-1">Description (optional)</label>
                    <textarea value={saveDescription} onChange={(e) => setSaveDescription(e.target.value)} placeholder="Dashboard for tracking Q4 metrics..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm h-20 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <button onClick={handleSave} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2">
                    <Save className="w-4 h-4" /> Save Dashboard
                  </button>
                  {saveStatus && <p className={`text-sm ${saveStatus.includes('Error') ? 'text-red-600' : 'text-green-600'}`}>{saveStatus}</p>}
                </div>
              </div>

              {shareLink && (
                <div className="bg-white rounded-xl p-6 shadow-sm border border-green-200">
                  <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2"><Share2 className="w-5 h-5 text-green-600" />Shareable Link</h3>
                  <div className="flex items-center gap-2">
                    <input type="text" readOnly value={shareLink} className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm" />
                    <button onClick={() => { navigator.clipboard.writeText(shareLink); }} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">Copy</button>
                  </div>
                </div>
              )}

              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2"><Layers className="w-5 h-5 text-blue-600" />Saved Dashboards</h3>
                  <button onClick={loadSavedDashboards} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4" />Load</button>
                </div>
                {savedDashboards.length > 0 ? (
                  <div className="space-y-2">
                    {savedDashboards.map(d => (
                      <div key={d.id} className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                        <div><p className="text-sm font-medium text-slate-800">{d.name}</p><p className="text-xs text-slate-500">{d.description || 'No description'} - {new Date(d.created_at || '').toLocaleDateString()}</p></div>
                        <div className="flex items-center gap-2">
                          {d.share_token && <button onClick={() => setShareLink(generateShareLink(d.share_token!))} className="p-2 bg-green-100 hover:bg-green-200 rounded-lg"><Share2 className="w-4 h-4 text-green-600" /></button>}
                          <button onClick={async () => { await deleteDashboard(d.id!); loadSavedDashboards(); }} className="p-2 bg-red-100 hover:bg-red-200 rounded-lg"><X className="w-4 h-4 text-red-600" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <p className="text-sm text-slate-400 text-center py-4">No saved dashboards. Click "Load" to refresh or save a dashboard above.</p>}
              </div>
            </div>
          )}

          {/* Page: Export */}
          {currentPage === 'export' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><Download className="w-5 h-5 text-blue-600" />Professional Exports</h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <button onClick={() => handleExport('pdf')} className="p-6 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl text-center transition-colors">
                    <FileText className="w-8 h-8 text-red-500 mx-auto mb-2" /><p className="font-medium text-slate-800">PDF</p><p className="text-sm text-slate-500 mt-1">Full report with charts & executive summary</p>
                  </button>
                  <button onClick={() => handleExport('pptx')} className="p-6 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-xl text-center transition-colors">
                    <Presentation className="w-8 h-8 text-orange-500 mx-auto mb-2" /><p className="font-medium text-slate-800">PPTX</p><p className="text-sm text-slate-500 mt-1">PowerPoint with KPIs & insights</p>
                  </button>
                  <button onClick={() => handleExport('excel')} className="p-6 bg-green-50 hover:bg-green-100 border border-green-200 rounded-xl text-center transition-colors">
                    <FileSpreadsheet className="w-8 h-8 text-green-500 mx-auto mb-2" /><p className="font-medium text-slate-800">Excel</p><p className="text-sm text-slate-500 mt-1">Multi-sheet workbook</p>
                  </button>
                  <button onClick={() => handleExport('csv')} className="p-6 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl text-center transition-colors">
                    <Table className="w-8 h-8 text-blue-500 mx-auto mb-2" /><p className="font-medium text-slate-800">CSV</p><p className="text-sm text-slate-500 mt-1">Raw filtered data</p>
                  </button>
                  <button onClick={() => handleExport('json')} className="p-6 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl text-center transition-colors">
                    <FileJson className="w-8 h-8 text-purple-500 mx-auto mb-2" /><p className="font-medium text-slate-800">JSON</p><p className="text-sm text-slate-500 mt-1">Structured data with metadata</p>
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="p-5 border-b border-slate-200">
                  <h3 className="font-semibold text-slate-800">Data Preview</h3>
                  <p className="text-sm text-slate-600">{filteredRows.length.toLocaleString()} records, {data.headers.length} columns</p>
                </div>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>{data.headers.map((h) => (<th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">{h}</th>))}</tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredRows.slice(0, 50).map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50">{row.map((cell, j) => <td key={j} className="px-4 py-2 text-sm text-slate-700">{cell}</td>)}</tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
