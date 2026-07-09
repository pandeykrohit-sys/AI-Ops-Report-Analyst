import { useState, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  ComposedChart, Scatter
} from 'recharts';
import {
  ChevronLeft, ChevronRight, LayoutDashboard, BarChart3, FileText,
  Download, Filter, TrendingUp, TrendingDown, AlertCircle,
  CheckCircle, Lightbulb, Target, PieChart as PieChartIcon, Activity,
  Layers, Table, Maximize2, X, RefreshCw, Eye, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { ExtractedRequirements } from '../utils/requirementsAnalyzer';

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
  mappedKPIs?: { name: string; columns: string[]; aggregation: string }[];
  mappedDimensions?: { name: string; columns: string[] }[];
  recommendedCharts?: { type: string; title: string; dimension: string; metric: string }[];
}

type DashboardPage = 'executive' | 'detailed' | 'drilldown' | 'insights' | 'export';

export function AIDashboardGenerator({
  data,
  requirements,
  mappedKPIs = [],
  mappedDimensions = [],
  recommendedCharts = []
}: AIDashboardGeneratorProps) {
  const [currentPage, setCurrentPage] = useState<DashboardPage>('executive');
  const [filters, setFilters] = useState<Map<string, string[]>>(new Map());
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const [drillDownPath, setDrillDownPath] = useState<string[]>([]);
  const [drillDownData, setDrillDownData] = useState<any[] | null>(null);

  const analysis = useMemo(() => {
    const { headers, rows } = data;

    const numericColumns: { [key: string]: { values: number[]; index: number } } = {};
    const textColumns: { [key: string]: { values: string[]; index: number } } = {};

    headers.forEach((header, idx) => {
      const values = rows.map(row => row[idx]).filter(v => v !== undefined && v !== '');
      const numericValues = values.map(v => parseFloat(v)).filter(n => !isNaN(n));

      if (numericValues.length > values.length * 0.5) {
        numericColumns[header.toLowerCase()] = {
          values: numericValues,
          index: idx
        };
      } else {
        textColumns[header.toLowerCase()] = {
          values,
          index: idx
        };
      }
    });

    return { numericColumns, textColumns, headers, rows };
  }, [data]);

  const autoDetectedKPIs = useMemo<KPIConfig[]>(() => {
    const kpis: KPIConfig[] = [];
    const { numericColumns, headers } = analysis;

    // Check mapped KPIs first
    mappedKPIs.forEach(mapped => {
      const col = mapped.columns[0];
      const colLower = col.toLowerCase();
      if (numericColumns[colLower]) {
        const values = numericColumns[colLower].values;
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;

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

    // Auto-detect additional KPIs
    Object.entries(numericColumns).forEach(([col, { values }]) => {
      const colTitle = col.charAt(0).toUpperCase() + col.slice(1);
      const colLower = col.toLowerCase();

      // Skip if already added
      if (kpis.find(k => k.column.toLowerCase() === colLower)) return;

      if (/amount|total|value/i.test(colLower)) {
        kpis.push({
          name: `Total ${colTitle}`,
          column: colTitle,
          aggregation: 'sum',
          format: 'currency',
          status: 'good'
        });
      } else if (/transaction|count|quantity|qty/i.test(colLower)) {
        kpis.push({
          name: `Total ${colTitle}`,
          column: colTitle,
          aggregation: 'sum',
          format: 'number',
          status: 'good'
        });
      } else if (/avg|average/i.test(colLower)) {
        kpis.push({
          name: `Average ${colTitle}`,
          column: colTitle,
          aggregation: 'average',
          format: 'currency',
          status: 'good'
        });
      } else if (/fee|tax|cost|expense/i.test(colLower)) {
        kpis.push({
          name: `Total ${colTitle}`,
          column: colTitle,
          aggregation: 'sum',
          format: 'currency',
          status: 'good'
        });
      } else if (/success|completed|approved/i.test(colLower)) {
        kpis.push({
          name: `${colTitle} Rate`,
          column: colTitle,
          aggregation: 'average',
          format: 'percentage',
          status: 'good'
        });
      } else if (/growth|change|delta/i.test(colLower)) {
        kpis.push({
          name: `${colTitle} %`,
          column: colTitle,
          aggregation: 'average',
          format: 'percentage',
          status: 'good'
        });
      }
    });

    // Ensure at least 6 common KPIs
    if (kpis.length < 6) {
      // Add total amount if any numeric column exists
      const firstNumeric = Object.keys(numericColumns)[0];
      if (firstNumeric && !kpis.find(k => /amount/i.test(k.name))) {
        kpis.push({
          name: 'Total Amount',
          column: firstNumeric,
          aggregation: 'sum',
          format: 'currency',
          status: 'good'
        });
      }

      // Add transaction count
      if (!kpis.find(k => /transaction|count/i.test(k.name))) {
        kpis.push({
          name: 'Total Transactions',
          column: 'Count',
          aggregation: 'count',
          format: 'number',
          status: 'good'
        });
      }

      // Add average
      if (!kpis.find(k => /average|avg/i.test(k.name)) && firstNumeric) {
        kpis.push({
          name: 'Avg Transaction Value',
          column: firstNumeric,
          aggregation: 'average',
          format: 'currency',
          status: 'good'
        });
      }
    }

    return kpis.slice(0, 8);
  }, [analysis, mappedKPIs]);

  const autoDetectedFilters = useMemo<FilterConfig[]>(() => {
    const filterConfigs: FilterConfig[] = [];
    const { textColumns, numericColumns, headers } = analysis;

    // Time-based filters
    const timeFields = headers.filter(h =>
      /date|month|year|quarter|week|period|time/i.test(h)
    );
    timeFields.forEach(h => {
      const idx = headers.indexOf(h);
      const uniqueValues = [...new Set(analysis.rows.map(r => r[idx]).filter(Boolean))].sort();
      filterConfigs.push({
        column: h,
        values: uniqueValues,
        selected: [],
        type: 'multiselect'
      });
    });

    // Category filters
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
        filterConfigs.push({
          column: h,
          values: uniqueValues,
          selected: [],
          type: 'multiselect'
        });
      }
    });

    // Limit to 8 filters
    return filterConfigs.slice(0, 8);
  }, [analysis]);

  const autoDetectedCharts = useMemo<ChartConfig[]>(() => {
    const charts: ChartConfig[] = [];
    const { numericColumns, textColumns, headers } = analysis;

    // Use recommended charts if available
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

    // Auto-generate charts based on detected dimensions and metrics
    if (charts.length < 6) {
      const dimensionCols = Object.keys(textColumns).filter(k =>
        /region|area|category|segment|type|status|channel|month|year/i.test(k)
      );

      const metricCols = Object.keys(numericColumns).filter(k =>
        /amount|total|value|revenue|sales|count|quantity|cost|fee/i.test(k)
      );

      if (dimensionCols.length > 0 && metricCols.length > 0) {
        // Bar chart
        charts.push({
          id: 'auto-bar',
          type: 'bar',
          title: `${metricCols[0].charAt(0).toUpperCase() + metricCols[0].slice(1)} by ${dimensionCols[0].charAt(0).toUpperCase() + dimensionCols[0].slice(1)}`,
          dimension: dimensionCols[0],
          metric: metricCols[0]
        });

        // Donut chart
        if (dimensionCols.length > 1 || charts.length < 2) {
          charts.push({
            id: 'auto-donut',
            type: 'donut',
            title: `${dimensionCols[0]?.charAt(0).toUpperCase() + dimensionCols[0]?.slice(1) || 'Category'} Distribution`,
            dimension: dimensionCols[0] || 'category',
            metric: metricCols[0]
          });
        }

        // Line/area chart if time dimension
        const timeDim = dimensionCols.find(d => /month|year|date|quarter/i.test(d));
        if (timeDim) {
          charts.push({
            id: 'auto-line',
            type: 'line',
            title: `${metricCols[0].charAt(0).toUpperCase() + metricCols[0].slice(1)} Trend`,
            dimension: timeDim,
            metric: metricCols[0]
          });
          charts.push({
            id: 'auto-area',
            type: 'area',
            title: `${metricCols[0].charAt(0).toUpperCase() + metricCols[0].slice(1)} Over Time`,
            dimension: timeDim,
            metric: metricCols[0]
          });
        }

        // Stacked bar if multiple dimensions
        if (dimensionCols.length > 1) {
          charts.push({
            id: 'auto-stacked',
            type: 'stackedBar',
            title: `${metricCols[0].charAt(0).toUpperCase() + metricCols[0].slice(1)} Analysis`,
            dimension: dimensionCols[0],
            metric: metricCols[0],
            stacked: dimensionCols[1]
          });
        }
      }
    }

    return charts.slice(0, 6);
  }, [analysis, recommendedCharts]);

  const filteredRows = useMemo(() => {
    let filtered = [...analysis.rows];

    filters.forEach((selectedValues, column) => {
      if (selectedValues.length > 0) {
        const idx = analysis.headers.findIndex(h =>
          h.toLowerCase() === column.toLowerCase()
        );
        if (idx !== -1) {
          filtered = filtered.filter(row =>
            selectedValues.includes(row[idx])
          );
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
        const idx = analysis.headers.findIndex(h =>
          h.toLowerCase() === colLower
        );
        if (idx !== -1) {
          const values = filteredRows
            .map(r => parseFloat(r[idx]))
            .filter(n => !isNaN(n));

          if (kpi.aggregation === 'sum') {
            value = values.reduce((a, b) => a + b, 0);
          } else if (kpi.aggregation === 'average') {
            value = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
          } else if (kpi.aggregation === 'min') {
            value = Math.min(...values);
          } else if (kpi.aggregation === 'max') {
            value = Math.max(...values);
          }
        }

        // Calculate trend (simple: compare first half vs second half)
        if (values.length >= 4) {
          const mid = Math.floor(values.length / 2);
          const firstHalf = values.slice(0, mid);
          const secondHalf = values.slice(mid);
          const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
          const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
          if (firstAvg !== 0) {
            const trend = ((secondAvg - firstAvg) / Math.abs(firstAvg)) * 100;
            value = secondAvg; // Use recent average
            values[colLower] = { ...values[colLower], trend };
          }
        }
      }

      // Calculate trend from data
      let trend: number | undefined;
      if (colData && colData.values.length >= 4) {
        const mid = Math.floor(colData.values.length / 2);
        const firstHalf = colData.values.slice(0, mid);
        const secondHalf = colData.values.slice(mid);
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        if (firstAvg !== 0) {
          trend = ((secondAvg - firstAvg) / Math.abs(firstAvg)) * 100;
        }
      }

      values[kpi.name] = {
        value,
        trend,
        status: kpi.status
      };
    });

    return values;
  }, [autoDetectedKPIs, analysis, filteredRows]);

  const chartDataMap = useMemo(() => {
    const chartData: { [key: string]: any[] } = {};

    autoDetectedCharts.forEach(chart => {
      const dimIdx = analysis.headers.findIndex(h =>
        h.toLowerCase() === chart.dimension.toLowerCase()
      );
      const metricIdx = analysis.headers.findIndex(h =>
        h.toLowerCase() === chart.metric.toLowerCase()
      );

      if (dimIdx !== -1 && metricIdx !== -1) {
        const aggregated: { [key: string]: { sum: number; count: number; values: number[] } } = {};

        filteredRows.forEach(row => {
          const dimValue = row[dimIdx] || 'Unknown';
          const metricValue = parseFloat(row[metricIdx]);

          if (!aggregated[dimValue]) {
            aggregated[dimValue] = { sum: 0, count: 0, values: [] };
          }

          if (!isNaN(metricValue)) {
            aggregated[dimValue].sum += metricValue;
            aggregated[dimValue].count++;
            aggregated[dimValue].values.push(metricValue);
          }
        });

        chartData[chart.id] = Object.entries(aggregated)
          .map(([name, data]) => ({
            name,
            value: data.sum,
            avg: data.count > 0 ? data.sum / data.count : 0,
            count: data.count
          }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10);
      }
    });

    return chartData;
  }, [autoDetectedCharts, analysis, filteredRows]);

  const insights = useMemo(() => {
    const insightsList: { type: 'finding' | 'trend' | 'risk' | 'opportunity'; title: string; description: string }[] = [];

    // Analyze trends
    Object.entries(kpiValues).forEach(([name, data]) => {
      if (data.trend !== undefined) {
        if (data.trend > 5) {
          insightsList.push({
            type: 'trend',
            title: `${name} Trending Up`,
            description: `${name} has increased by ${data.trend.toFixed(1)}% compared to the previous period. This indicates positive momentum.`
          });
        } else if (data.trend < -5) {
          insightsList.push({
            type: 'risk',
            title: `${name} Declining`,
            description: `${name} has decreased by ${Math.abs(data.trend).toFixed(1)}%. This requires attention and investigation.`
          });
        }
      }
    });

    // Top performers
    Object.entries(chartDataMap).forEach(([chartId, chartData]) => {
      if (chartData.length > 0 && chartData[0]) {
        const chart = autoDetectedCharts.find(c => c.id === chartId);
        if (chart && chartData[0].value > 0) {
          insightsList.push({
            type: 'finding',
            title: `Top ${chart.dimension}`,
            description: `${chartData[0].name} leads with ${chartData[0].value.toLocaleString()} ${chart.metric}.`
          });
        }
        if (chartData.length > 1 && chartData[chartData.length - 1]) {
          insightsList.push({
            type: 'opportunity',
            title: `Growth Opportunity`,
            description: `${chartData[chartData.length - 1].name} shows lower performance. Consider targeted strategies to improve.`
          });
        }
      }
    });

    // Data quality
    const nullCounts = analysis.headers.map((h, idx) =>
      filteredRows.filter(r => !r[idx] || r[idx].trim() === '').length
    );
    const maxNulls = Math.max(...nullCounts);
    const nullCol = analysis.headers[nullCounts.indexOf(maxNulls)];
    if (maxNulls > filteredRows.length * 0.1) {
      insightsList.push({
        type: 'risk',
        title: 'Data Quality Issue',
        description: `${nullCol} has ${((maxNulls / filteredRows.length) * 100).toFixed(1)}% missing values. Consider data cleaning.`
      });
    }

    return insightsList;
  }, [kpiValues, chartDataMap, autoDetectedCharts, analysis, filteredRows]);

  const handleFilterChange = (column: string, values: string[]) => {
    const newFilters = new Map(filters);
    newFilters.set(column, values);
    setFilters(newFilters);
  };

  const clearFilters = () => {
    setFilters(new Map());
  };

  const handleDrillDown = (chartId: string, dimension: string) => {
    const chart = autoDetectedCharts.find(c => c.id === chartId);
    if (chart) {
      setDrillDownPath([dimension]);
      setDrillDownData(chartDataMap[chartId] || null);
      setCurrentPage('drilldown');
    }
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(24);
    doc.setTextColor(37, 99, 235);
    doc.text('AI Dashboard Report', pageWidth / 2, 25, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 35, { align: 'center' });

    let yPos = 55;

    // Executive Summary
    doc.setFontSize(16);
    doc.setTextColor(37, 99, 235);
    doc.text('Executive Summary', 20, yPos);
    yPos += 10;

    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);

    Object.entries(kpiValues).slice(0, 6).forEach(([name, data]) => {
      const formattedValue = autoDetectedKPIs.find(k => k.name === name)?.format === 'currency'
        ? `$${data.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : autoDetectedKPIs.find(k => k.name === name)?.format === 'percentage'
        ? `${data.value.toFixed(1)}%`
        : data.value.toLocaleString(undefined, { maximumFractionDigits: 0 });

      doc.text(`${name}: ${formattedValue}`, 25, yPos);
      if (data.trend !== undefined) {
        yPos += 6;
        doc.text(`  Trend: ${data.trend >= 0 ? '+' : ''}${data.trend.toFixed(1)}%`, 25, yPos);
      }
      yPos += 8;
    });

    // Key Insights
    yPos += 10;
    doc.setFontSize(16);
    doc.setTextColor(37, 99, 235);
    doc.text('Key Insights', 20, yPos);
    yPos += 10;

    doc.setFontSize(10);
    insights.slice(0, 6).forEach((insight) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.setTextColor(
        insight.type === 'risk' ? 239 : insight.type === 'opportunity' ? 16 : 60,
        insight.type === 'risk' ? 68 : insight.type === 'opportunity' ? 185 : 60,
        60
      );
      doc.text(`${insight.title}: ${insight.description}`, 25, yPos, { maxWidth: pageWidth - 50 });
      yPos += 12;
    });

    // Recommendations
    if (requirements?.objectives?.length) {
      yPos += 10;
      doc.setFontSize(16);
      doc.setTextColor(37, 99, 235);
      doc.text('Business Objectives', 20, yPos);
      yPos += 10;

      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      requirements.objectives.slice(0, 5).forEach((obj) => {
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(`• ${obj.substring(0, 100)}${obj.length > 100 ? '...' : ''}`, 25, yPos);
        yPos += 8;
      });
    }

    doc.save('ai-dashboard-report.pdf');
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
      ['AI Dashboard Report'],
      ['Generated', new Date().toLocaleDateString()],
      [],
      ['Key Performance Indicators'],
      ['Metric', 'Value', 'Trend', 'Status'],
      ...Object.entries(kpiValues).map(([name, data]) => [
        name,
        data.value,
        data.trend ? `${data.trend.toFixed(1)}%` : 'N/A',
        data.status
      ]),
      [],
      ['Key Insights'],
      ...insights.map(i => [i.type, i.title, i.description])
    ];
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

    // Raw data sheet
    const rawWs = XLSX.utils.aoa_to_sheet([data.headers, ...filteredRows]);
    XLSX.utils.book_append_sheet(wb, rawWs, 'Data');

    // Chart data sheets
    Object.entries(chartDataMap).forEach(([chartId, chartData]) => {
      const chart = autoDetectedCharts.find(c => c.id === chartId);
      if (chart) {
        const chartWs = XLSX.utils.json_to_sheet(chartData);
        XLSX.utils.book_append_sheet(wb, chartWs, chart.title.substring(0, 31));
      }
    });

    XLSX.writeFile(wb, 'ai-dashboard-report.xlsx');
  };

  const handleExportCSV = () => {
    const csvData = [
      data.headers,
      ...filteredRows
    ];
    const ws = XLSX.utils.aoa_to_sheet(csvData);
    const csv = XLSX.utils.sheet_to_csv(ws);

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dashboard-data.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const jsonData = {
      generated: new Date().toISOString(),
      kpis: kpiValues,
      insights: insights,
      charts: chartDataMap,
      data: filteredRows.map(row =>
        Object.fromEntries(data.headers.map((h, i) => [h, row[i]]))
      )
    };

    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dashboard-data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const containerClass = fullScreen
    ? 'fixed inset-0 z-50 bg-slate-50 overflow-auto'
    : 'bg-slate-50 rounded-2xl shadow-xl border border-slate-200';

  return (
    <div className={containerClass}>
      {/* Navigation */}
      <nav className="bg-[#1e3a5f] text-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <LayoutDashboard className="w-8 h-8" />
            <h1 className="text-xl font-bold">AI Dashboard Generator</h1>
          </div>

          <div className="flex items-center gap-2">
            {(['executive', 'detailed', 'drilldown', 'insights', 'export'] as DashboardPage[]).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  currentPage === page
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                }`}
              >
                {page === 'executive' && <LayoutDashboard className="w-4 h-4 inline mr-2" />}
                {page === 'detailed' && <BarChart3 className="w-4 h-4 inline mr-2" />}
                {page === 'drilldown' && <Layers className="w-4 h-4 inline mr-2" />}
                {page === 'insights' && <Lightbulb className="w-4 h-4 inline mr-2" />}
                {page === 'export' && <Download className="w-4 h-4 inline mr-2" />}
                {page.charAt(0).toUpperCase() + page.slice(1)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFiltersPanel(!showFiltersPanel)}
              className={`px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                showFiltersPanel ? 'bg-blue-600' : 'bg-slate-700 hover:bg-slate-600'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {filters.size > 0 && (
                <span className="bg-green-500 text-xs px-2 py-0.5 rounded-full">
                  {Array.from(filters.values()).filter(v => v.length > 0).length}
                </span>
              )}
            </button>
            <button
              onClick={() => setFullScreen(!fullScreen)}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg"
            >
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
              <button onClick={clearFilters} className="text-sm text-blue-600 hover:underline">
                Clear all
              </button>
            </div>

            <div className="space-y-4">
              {autoDetectedFilters.map((filter) => (
                <div key={filter.column}>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    {filter.column}
                  </label>
                  <select
                    multiple
                    className="w-full h-24 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    value={filters.get(filter.column.toLowerCase()) || []}
                    onChange={(e) => {
                      const values = Array.from(e.target.selectedOptions, opt => opt.value);
                      handleFilterChange(filter.column.toLowerCase(), values);
                    }}
                  >
                    {filter.values.map((val) => (
                      <option key={val} value={val}>{val}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 p-6">
          {/* Page 1: Executive Overview */}
          {currentPage === 'executive' && (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {autoDetectedKPIs.slice(0, 6).map((kpi) => {
                  const value = kpiValues[kpi.name]?.value || 0;
                  const trend = kpiValues[kpi.name]?.trend;

                  return (
                    <div
                      key={kpi.name}
                      className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 hover:shadow-md transition-shadow"
                    >
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
                        <div className={`flex items-center gap-1 mt-2 text-sm ${
                          trend >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {trend >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                          {Math.abs(trend).toFixed(1)}%
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Top Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {autoDetectedCharts.slice(0, 4).map((chart) => {
                  const chartData = chartDataMap[chart.id] || [];

                  return (
                    <div
                      key={chart.id}
                      className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => handleDrillDown(chart.id, chart.dimension)}
                    >
                      <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-blue-600" />
                        {chart.title}
                      </h3>

                      {chartData.length > 0 && (
                        <ResponsiveContainer width="100%" height={200}>
                          {chart.type === 'bar' || chart.type === 'stackedBar' ? (
                            <BarChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                              <YAxis stroke="#64748b" fontSize={11} />
                              <Tooltip
                                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                              />
                              <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          ) : chart.type === 'line' ? (
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                              <YAxis stroke="#64748b" fontSize={11} />
                              <Tooltip
                                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                              />
                              <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} dot={false} />
                            </LineChart>
                          ) : chart.type === 'area' ? (
                            <AreaChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                              <YAxis stroke="#64748b" fontSize={11} />
                              <Tooltip
                                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                              />
                              <Area type="monotone" dataKey="value" stroke="#2563eb" fill="#2563eb" fillOpacity={0.2} />
                            </AreaChart>
                          ) : chart.type === 'donut' || chart.type === 'pie' ? (
                            <PieChart>
                              <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={chart.type === 'donut' ? 40 : 0}
                                outerRadius={70}
                                dataKey="value"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                labelLine={false}
                              >
                                {chartData.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                              />
                            </PieChart>
                          ) : (
                            <BarChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                              <YAxis stroke="#64748b" fontSize={11} />
                              <Tooltip
                                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                              />
                              <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          )}
                        </ResponsiveContainer>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Requirements Analysis Panel */}
              {requirements && (
                <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
                  <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-purple-600" />
                    Requirements Analysis
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-slate-600 mb-2">Business Objectives</h4>
                      <ul className="text-sm text-slate-700 space-y-1">
                        {requirements.objectives.slice(0, 3).map((obj, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>{obj.substring(0, 50)}...</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-slate-600 mb-2">Identified KPIs</h4>
                      <div className="flex flex-wrap gap-2">
                        {requirements.kpis.slice(0, 6).map((kpi, i) => (
                          <span key={i} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                            {kpi}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-slate-600 mb-2">Dimensions</h4>
                      <div className="flex flex-wrap gap-2">
                        {requirements.dimensions.slice(0, 6).map((dim, i) => (
                          <span key={i} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
                            {dim}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium text-slate-600 mb-2">Confidence</h4>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-3 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-green-500"
                            style={{ width: `${requirements.confidence}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-slate-700">
                          {requirements.confidence}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Page 2: Detailed Analysis */}
          {currentPage === 'detailed' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {autoDetectedCharts.map((chart) => {
                  const chartData = chartDataMap[chart.id] || [];

                  return (
                    <div
                      key={chart.id}
                      className="bg-white rounded-xl p-5 shadow-sm border border-slate-200"
                    >
                      <h3 className="font-semibold text-slate-800 mb-4">{chart.title}</h3>

                      {chartData.length > 0 && (
                        <ResponsiveContainer width="100%" height={250}>
                          {chart.type === 'bar' || chart.type === 'stackedBar' ? (
                            <BarChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                              <YAxis stroke="#64748b" fontSize={10} />
                              <Tooltip
                                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                              />
                              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                {chartData.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Bar>
                            </BarChart>
                          ) : chart.type === 'line' ? (
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                              <YAxis stroke="#64748b" fontSize={10} />
                              <Tooltip
                                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                              />
                              <Line type="monotone" dataKey="value" stroke="#2563eb" strokeWidth={2} />
                            </LineChart>
                          ) : chart.type === 'area' ? (
                            <AreaChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                              <XAxis dataKey="name" stroke="#64748b" fontSize={10} />
                              <YAxis stroke="#64748b" fontSize={10} />
                              <Tooltip
                                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                              />
                              <Area type="monotone" dataKey="value" stroke="#2563eb" fill="#2563eb" fillOpacity={0.3} />
                            </AreaChart>
                          ) : (
                            <PieChart>
                              <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={chart.type === 'donut' ? 50 : 0}
                                outerRadius={80}
                                dataKey="value"
                              >
                                {chartData.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          )}
                        </ResponsiveContainer>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Page 3: Drill Down Records */}
          {currentPage === 'drilldown' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200">
              <div className="p-5 border-b border-slate-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800">Drill Down Analysis</h3>
                    {drillDownPath.length > 0 && (
                      <div className="flex items-center gap-2 mt-2 text-sm text-slate-600">
                        <span>Summary</span>
                        {drillDownPath.map((path, i) => (
                          <>
                            <ChevronRight className="w-4 h-4" />
                            <span key={i}>{path}</span>
                          </>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setDrillDownPath([])}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {data.headers.map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredRows.slice(0, 100).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        {row.map((cell, j) => (
                          <td key={j} className="px-4 py-3 text-sm text-slate-700">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredRows.length > 100 && (
                <div className="p-4 bg-slate-50 text-center text-sm text-slate-600">
                  Showing first 100 of {filteredRows.length} records
                </div>
              )}
            </div>
          )}

          {/* Page 4: AI Insights */}
          {currentPage === 'insights' && (
            <div className="space-y-6">
              {/* Executive Summary */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Executive Summary
                </h3>
                <p className="text-slate-700 leading-relaxed">
                  Analysis of {filteredRows.length.toLocaleString()} records reveals key patterns across
                  {autoDetectedFilters.length} dimensions. The data shows{' '}
                  {Object.entries(kpiValues).filter(([_, v]) => v.trend && v.trend > 0).length} metrics trending upward,
                  indicating overall positive momentum.
                </p>
              </div>

              {/* Key Findings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insights.map((insight, i) => (
                  <div
                    key={i}
                    className={`bg-white rounded-xl p-5 shadow-sm border ${
                      insight.type === 'risk' ? 'border-red-200' :
                      insight.type === 'opportunity' ? 'border-green-200' :
                      insight.type === 'trend' ? 'border-blue-200' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {insight.type === 'risk' && <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />}
                      {insight.type === 'opportunity' && <Lightbulb className="w-5 h-5 text-green-500 mt-0.5" />}
                      {insight.type === 'trend' && <TrendingUp className="w-5 h-5 text-blue-500 mt-0.5" />}
                      {insight.type === 'finding' && <Target className="w-5 h-5 text-purple-500 mt-0.5" />}
                      <div>
                        <h4 className="font-medium text-slate-800">{insight.title}</h4>
                        <p className="text-sm text-slate-600 mt-1">{insight.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Recommendations */}
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-4">Recommended Actions</h3>
                <ul className="space-y-3">
                  {insights.filter(i => i.type === 'risk' || i.type === 'opportunity').slice(0, 5).map((insight, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium flex-shrink-0">
                        {i + 1}
                      </span>
                      <div>
                        <p className="font-medium text-slate-800">{insight.title}</p>
                        <p className="text-sm text-slate-600">{insight.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Page 5: Export & Reporting */}
          {currentPage === 'export' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                  <Download className="w-5 h-5 text-blue-600" />
                  Export Dashboard
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <button
                    onClick={handleExportPDF}
                    className="p-6 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl text-center transition-colors"
                  >
                    <FileText className="w-8 h-8 text-red-500 mx-auto mb-2" />
                    <p className="font-medium text-slate-800">Export PDF</p>
                    <p className="text-sm text-slate-500 mt-1">Full report with charts</p>
                  </button>

                  <button
                    onClick={handleExportExcel}
                    className="p-6 bg-green-50 hover:bg-green-100 border border-green-200 rounded-xl text-center transition-colors"
                  >
                    <Table className="w-8 h-8 text-green-500 mx-auto mb-2" />
                    <p className="font-medium text-slate-800">Export Excel</p>
                    <p className="text-sm text-slate-500 mt-1">Multi-sheet workbook</p>
                  </button>

                  <button
                    onClick={handleExportCSV}
                    className="p-6 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl text-center transition-colors"
                  >
                    <PieChartIcon className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                    <p className="font-medium text-slate-800">Export CSV</p>
                    <p className="text-sm text-slate-500 mt-1">Raw filtered data</p>
                  </button>

                  <button
                    onClick={handleExportJSON}
                    className="p-6 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl text-center transition-colors"
                  >
                    <Layers className="w-8 h-8 text-purple-500 mx-auto mb-2" />
                    <p className="font-medium text-slate-800">Export JSON</p>
                    <p className="text-sm text-slate-500 mt-1">Structured data</p>
                  </button>
                </div>
              </div>

              {/* Data Preview */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="p-5 border-b border-slate-200">
                  <h3 className="font-semibold text-slate-800">Data Preview</h3>
                  <p className="text-sm text-slate-600">
                    {filteredRows.length.toLocaleString()} records, {data.headers.length} columns
                  </p>
                </div>

                <div className="overflow-x-auto max-h-96">
                  <table className="w-full">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        {data.headers.map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredRows.slice(0, 50).map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          {row.map((cell, j) => (
                            <td key={j} className="px-4 py-2 text-sm text-slate-700">
                              {cell}
                            </td>
                          ))}
                        </tr>
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

// Helper component
function DollarSign({ className }: { className?: string }) {
  return <span className={className}>$</span>;
}
