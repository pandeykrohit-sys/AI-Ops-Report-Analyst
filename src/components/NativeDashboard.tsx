import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Treemap
} from 'recharts';
import { Download, Filter, TrendingUp, TrendingDown, DollarSign, Users, AlertTriangle, BarChart3, FileSpreadsheet, FileText, ChevronDown, ChevronUp, X } from 'lucide-react';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

interface ChartData {
  name: string;
  value: number;
  category?: string;
}

interface TimeSeriesData {
  date: string;
  revenue?: number;
  customers?: number;
  churn?: number;
  growth?: number;
}

interface RegionData {
  name: string;
  value: number;
  revenue?: number;
  fill?: string;
}

interface NativeDashboardProps {
  data: {
    headers: string[];
    rows: string[][];
  };
  summary: {
    totalRevenue: number;
    revenueChange?: number;
    totalCustomers: number;
    churnRate?: number;
    churnChange?: number;
    topRegion?: string;
    lowestRegion?: string;
    regions: { name: string; count: number; revenue?: number }[];
  };
}

const COLORS = ['#4ade80', '#60a5fa', '#fbbf24', '#f87171', '#c4b5fd', '#fb923c', '#2dd4bf', '#f472b6'];

export function NativeDashboard({ data, summary }: NativeDashboardProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [drillDownData, setDrillDownData] = useState<any[] | null>(null);
  const [drillDownTitle, setDrillDownTitle] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  const processedData = useMemo(() => {
    const { headers, rows } = data;

    const numericColumns: { [key: string]: number[] } = {};
    const textColumns: { [key: string]: string[] } = {};
    const columnIndices: { [key: string]: number } = {};

    headers.forEach((header, idx) => {
      const values = rows.map(row => row[idx]).filter(v => v !== undefined && v !== '');
      const numericValues = values.map(v => parseFloat(v)).filter(n => !isNaN(n));
      columnIndices[header.toLowerCase()] = idx;

      if (numericValues.length > values.length * 0.5) {
        numericColumns[header.toLowerCase()] = numericValues;
      } else {
        textColumns[header.toLowerCase()] = values;
      }
    });

    const revenueKey = Object.keys(numericColumns).find(k => /revenue|sales|income|profit/i.test(k));
    const customerKey = Object.keys(numericColumns).find(k => /customer|client|user/i.test(k) && !/id/i.test(k));
    const churnKey = Object.keys(numericColumns).find(k => /churn|attrition/i.test(k));
    const regionKey = Object.keys(textColumns).find(k => /region|area|zone|territory/i.test(k));
    const dateKey = Object.keys(textColumns).find(k => /date|month|year|period/i.test(k));
    const growthKey = Object.keys(numericColumns).find(k => /growth/i.test(k));
    const costKey = Object.keys(numericColumns).find(k => /cost|expense/i.test(k));

    const timeSeriesData: TimeSeriesData[] = [];
    const dateValues = dateKey ? textColumns[dateKey] : [];

    if (dateValues.length > 0 && revenueKey) {
      const dateMap: { [key: string]: { revenue: number[]; customers: number[]; churn: number[] } } = {};

      rows.forEach(row => {
        const dateVal = row[columnIndices[dateKey!]] || 'Unknown';
        if (!dateMap[dateVal]) dateMap[dateVal] = { revenue: [], customers: [], churn: [] };

        if (revenueKey) {
          const rev = parseFloat(row[columnIndices[revenueKey]]);
          if (!isNaN(rev)) dateMap[dateVal].revenue.push(rev);
        }
        if (customerKey) {
          const cust = parseFloat(row[columnIndices[customerKey]]);
          if (!isNaN(cust)) dateMap[dateVal].customers.push(cust);
        }
        if (churnKey) {
          const ch = parseFloat(row[columnIndices[churnKey]]);
          if (!isNaN(ch)) dateMap[dateVal].churn.push(ch);
        }
      });

      Object.entries(dateMap).forEach(([date, values]) => {
        const avgRevenue = values.revenue.length ? values.revenue.reduce((a, b) => a + b, 0) / values.revenue.length : 0;
        const avgCustomers = values.customers.length ? values.customers.reduce((a, b) => a + b, 0) / values.customers.length : 0;
        const avgChurn = values.churn.length ? values.churn.reduce((a, b) => a + b, 0) / values.churn.length : 0;

        timeSeriesData.push({
          date,
          revenue: avgRevenue,
          customers: avgCustomers,
          churn: avgChurn
        });
      });

      timeSeriesData.slice(0, 12);
    }

    const regionChartData: RegionData[] = [];
    if (regionKey) {
      const regionMap: { [key: string]: { count: number; revenue: number } } = {};

      rows.forEach(row => {
        const regionVal = row[columnIndices[regionKey]] || 'Unknown';
        if (!regionMap[regionVal]) regionMap[regionVal] = { count: 0, revenue: 0 };
        regionMap[regionVal].count++;

        if (revenueKey) {
          const rev = parseFloat(row[columnIndices[revenueKey]]);
          if (!isNaN(rev)) regionMap[regionVal].revenue += rev;
        }
      });

      Object.entries(regionMap).forEach(([name, values], idx) => {
        regionChartData.push({
          name,
          value: values.count,
          revenue: values.revenue,
          fill: COLORS[idx % COLORS.length]
        });
      });

      regionChartData.sort((a, b) => b.revenue - a.revenue);
    }

    const categoryData: ChartData[] = [];
    if (churnKey) {
      const churnValues = numericColumns[churnKey];
      const avg = churnValues.reduce((a, b) => a + b, 0) / churnValues.length;
      categoryData.push({ name: 'Churn Rate', value: avg, category: 'churn' });
    }
    if (growthKey) {
      const growthValues = numericColumns[growthKey];
      const avg = growthValues.reduce((a, b) => a + b, 0) / growthValues.length;
      categoryData.push({ name: 'Growth Rate', value: avg, category: 'growth' });
    }
    if (revenueKey) {
      const total = numericColumns[revenueKey].reduce((a, b) => a + b, 0);
      categoryData.push({ name: 'Total Revenue', value: total, category: 'revenue' });
    }
    if (customerKey) {
      const total = numericColumns[customerKey].reduce((a, b) => a + b, 0);
      categoryData.push({ name: 'Total Customers', value: total, category: 'customers' });
    }

    const distributionData: ChartData[] = [];
    numericColumns && Object.entries(numericColumns).forEach(([key, values]) => {
      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        distributionData.push({
          name: key.charAt(0).toUpperCase() + key.slice(1),
          value: sum,
          category: key
        });
      }
    });

    const radarData = [];
    const metrics = ['Revenue', 'Customers', 'Growth', 'Retention', 'Efficiency'];
    metrics.forEach((metric, idx) => {
      let value = 50;
      if (metric === 'Revenue' && revenueKey) {
        const max = Math.max(...numericColumns[revenueKey]);
        const avg = numericColumns[revenueKey].reduce((a, b) => a + b, 0) / numericColumns[revenueKey].length;
        value = Math.min(100, (avg / max) * 100);
      } else if (metric === 'Customers' && customerKey) {
        const max = Math.max(...numericColumns[customerKey]);
        const avg = numericColumns[customerKey].reduce((a, b) => a + b, 0) / numericColumns[customerKey].length;
        value = Math.min(100, (avg / max) * 100);
      } else if (metric === 'Growth' && growthKey) {
        value = Math.min(100, Math.max(0, numericColumns[growthKey].reduce((a, b) => a + b, 0) / numericColumns[growthKey].length));
      } else if (metric === 'Retention' && churnKey) {
        const avgChurn = numericColumns[churnKey].reduce((a, b) => a + b, 0) / numericColumns[churnKey].length;
        value = Math.max(0, 100 - avgChurn * 10);
      }
      radarData.push({ metric, value, fullMark: 100 });
    });

    const treemapData = regionChartData.map(r => ({
      name: r.name,
      size: r.revenue || r.value,
      revenue: r.revenue
    }));

    return {
      timeSeriesData: timeSeriesData.slice(0, 12),
      regionChartData,
      categoryData,
      distributionData: distributionData.slice(0, 8),
      radarData,
      treemapData,
      numericColumns,
      textColumns,
      columnIndices
    };
  }, [data]);

  const filteredData = useMemo(() => {
    if (!selectedRegion && !dateRange.start && !dateRange.end && !selectedCategory) {
      return processedData;
    }

    const { headers, rows } = data;
    let filteredRows = [...rows];

    if (selectedRegion) {
      const regionIdx = processedData.columnIndices['region'] ||
                       processedData.columnIndices['area'] ||
                       processedData.columnIndices['zone'];
      if (regionIdx !== undefined) {
        filteredRows = filteredRows.filter(row =>
          row[regionIdx]?.toLowerCase().includes(selectedRegion.toLowerCase())
        );
      }
    }

    if (dateRange.start || dateRange.end) {
      const dateIdx = processedData.columnIndices['date'] ||
                     processedData.columnIndices['month'] ||
                     processedData.columnIndices['period'];
      if (dateIdx !== undefined) {
        filteredRows = filteredRows.filter(row => {
          const date = row[dateIdx];
          if (dateRange.start && date < dateRange.start) return false;
          if (dateRange.end && date > dateRange.end) return false;
          return true;
        });
      }
    }

    return { ...processedData, filteredRows };
  }, [processedData, selectedRegion, dateRange, selectedCategory, data]);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(20);
    doc.setTextColor(26, 77, 46);
    doc.text('Data Analytics Report', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 30, { align: 'center' });

    let yPos = 50;

    doc.setFontSize(14);
    doc.setTextColor(26, 77, 46);
    doc.text('Executive Summary', 20, yPos);
    yPos += 10;

    doc.setFontSize(11);
    doc.setTextColor(60, 60, 60);
    doc.text(`Total Revenue: $${summary.totalRevenue.toLocaleString()}`, 20, yPos);
    if (summary.revenueChange !== undefined) {
      yPos += 7;
      doc.text(`Revenue Change: ${summary.revenueChange >= 0 ? '+' : ''}${summary.revenueChange.toFixed(1)}%`, 20, yPos);
    }
    yPos += 7;
    doc.text(`Total Customers: ${summary.totalCustomers.toLocaleString()}`, 20, yPos);
    if (summary.churnRate !== undefined) {
      yPos += 7;
      doc.text(`Churn Rate: ${summary.churnRate.toFixed(1)}%`, 20, yPos);
    }
    if (summary.topRegion) {
      yPos += 7;
      doc.text(`Top Region: ${summary.topRegion}`, 20, yPos);
    }
    if (summary.lowestRegion) {
      yPos += 7;
      doc.text(`Lowest Region: ${summary.lowestRegion}`, 20, yPos);
    }

    yPos += 20;
    doc.setFontSize(14);
    doc.setTextColor(26, 77, 46);
    doc.text('Region Performance', 20, yPos);
    yPos += 10;

    doc.setFontSize(10);
    summary.regions.forEach((region, idx) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(`${idx + 1}. ${region.name}: ${region.count} records${region.revenue ? `, $${region.revenue.toLocaleString()}` : ''}`, 25, yPos);
      yPos += 6;
    });

    yPos += 10;
    doc.setFontSize(14);
    doc.setTextColor(26, 77, 46);
    doc.text('Data Overview', 20, yPos);
    yPos += 10;

    doc.setFontSize(10);
    doc.text(`Total Records: ${data.rows.length}`, 20, yPos);
    yPos += 6;
    doc.text(`Columns: ${data.headers.join(', ')}`, 20, yPos);

    doc.save('analytics-report.pdf');
  };

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    const summaryWsData = [
      ['Data Analytics Report'],
      ['Generated', new Date().toLocaleDateString()],
      [],
      ['Executive Summary'],
      ['Total Revenue', summary.totalRevenue],
      ['Revenue Change', summary.revenueChange ? `${summary.revenueChange.toFixed(1)}%` : 'N/A'],
      ['Total Customers', summary.totalCustomers],
      ['Churn Rate', summary.churnRate ? `${summary.churnRate.toFixed(1)}%` : 'N/A'],
      ['Top Region', summary.topRegion || 'N/A'],
      ['Lowest Region', summary.lowestRegion || 'N/A'],
      [],
      ['Region Performance'],
      ['Region', 'Records', 'Revenue'],
      ...summary.regions.map(r => [r.name, r.count, r.revenue || 'N/A'])
    ];
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryWsData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

    const rawWs = XLSX.utils.aoa_to_sheet([data.headers, ...data.rows]);
    XLSX.utils.book_append_sheet(wb, rawWs, 'Raw Data');

    if (processedData.timeSeriesData.length > 0) {
      const timeSeriesWs = XLSX.utils.json_to_sheet(processedData.timeSeriesData);
      XLSX.utils.book_append_sheet(wb, timeSeriesWs, 'Time Series');
    }

    if (processedData.regionChartData.length > 0) {
      const regionWs = XLSX.utils.json_to_sheet(processedData.regionChartData.map(r => ({
        Region: r.name,
        Count: r.value,
        Revenue: r.revenue || 'N/A'
      })));
      XLSX.utils.book_append_sheet(wb, regionWs, 'Regions');
    }

    XLSX.writeFile(wb, 'analytics-report.xlsx');
  };

  const handleChartClick = (data: any, title: string) => {
    setDrillDownData(data);
    setDrillDownTitle(title);
  };

  const uniqueRegions = useMemo(() => {
    return summary.regions.map(r => r.name);
  }, [summary.regions]);

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-[#4ade80]" />
          <h2 className="text-2xl font-bold">Interactive Dashboard</h2>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 bg-[#2d5a3d] hover:bg-[#3d7a5d] rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <button
            onClick={handleExportPDF}
            className="px-4 py-2 bg-[#f87171]/20 hover:bg-[#f87171]/30 border border-[#f87171] text-[#f87171] rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <FileText className="w-4 h-4" />
            Export PDF
          </button>
          <button
            onClick={handleExportExcel}
            className="px-4 py-2 bg-[#60a5fa]/20 hover:bg-[#60a5fa]/30 border border-[#60a5fa] text-[#60a5fa] rounded-lg font-medium flex items-center gap-2 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Excel
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-[#1a4d2e] rounded-xl p-5 border border-[#3d6b4d]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Filters</h3>
            <button onClick={() => setShowFilters(false)} className="text-[#a7c4bc] hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-[#a7c4bc] block mb-2">Region</label>
              <select
                value={selectedRegion || ''}
                onChange={(e) => setSelectedRegion(e.target.value || null)}
                className="w-full px-3 py-2 bg-[#0d2818] border border-[#3d6b4d] rounded-lg text-white"
              >
                <option value="">All Regions</option>
                {uniqueRegions.map(region => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-[#a7c4bc] block mb-2">Start Date</label>
              <input
                type="text"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                placeholder="e.g., 2024-01"
                className="w-full px-3 py-2 bg-[#0d2818] border border-[#3d6b4d] rounded-lg text-white placeholder-[#6b9a85]"
              />
            </div>
            <div>
              <label className="text-sm text-[#a7c4bc] block mb-2">End Date</label>
              <input
                type="text"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                placeholder="e.g., 2024-12"
                className="w-full px-3 py-2 bg-[#0d2818] border border-[#3d6b4d] rounded-lg text-white placeholder-[#6b9a85]"
              />
            </div>
          </div>
          {(selectedRegion || dateRange.start || dateRange.end) && (
            <button
              onClick={() => {
                setSelectedRegion(null);
                setDateRange({ start: '', end: '' });
              }}
              className="mt-4 text-sm text-[#fbbf24] hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-[#1a4d2e] to-[#2d7a4e] rounded-xl p-5 border border-[#4ade80]/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#a7c4bc] text-sm">Total Revenue</span>
            <DollarSign className="w-5 h-5 text-[#4ade80]" />
          </div>
          <p className="text-2xl font-bold">${summary.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
          {summary.revenueChange !== undefined && (
            <p className={`text-sm mt-2 flex items-center gap-1 ${summary.revenueChange >= 0 ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
              {summary.revenueChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {Math.abs(summary.revenueChange).toFixed(1)}%
            </p>
          )}
        </div>

        <div className="bg-gradient-to-br from-[#1a4d2e] to-[#2563eb] rounded-xl p-5 border border-[#60a5fa]/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#a7c4bc] text-sm">Total Customers</span>
            <Users className="w-5 h-5 text-[#60a5fa]" />
          </div>
          <p className="text-2xl font-bold">{summary.totalCustomers.toLocaleString()}</p>
        </div>

        <div className="bg-gradient-to-br from-[#1a4d2e] to-[#ca8a04] rounded-xl p-5 border border-[#fbbf24]/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#a7c4bc] text-sm">Churn Rate</span>
            <AlertTriangle className="w-5 h-5 text-[#fbbf24]" />
          </div>
          <p className="text-2xl font-bold">{summary.churnRate !== undefined ? `${summary.churnRate.toFixed(1)}%` : 'N/A'}</p>
          {summary.churnChange !== undefined && (
            <p className={`text-sm mt-2 flex items-center gap-1 ${summary.churnChange <= 0 ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
              {summary.churnChange <= 0 ? <TrendingDown className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
              {Math.abs(summary.churnChange).toFixed(1)}%
            </p>
          )}
        </div>

        <div className="bg-gradient-to-br from-[#1a4d2e] to-[#9333ea] rounded-xl p-5 border border-[#c4b5fd]/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#a7c4bc] text-sm">Total Records</span>
            <BarChart3 className="w-5 h-5 text-[#c4b5fd]" />
          </div>
          <p className="text-2xl font-bold">{data.rows.length.toLocaleString()}</p>
        </div>
      </div>

      {/* Region Performance Cards */}
      {(summary.topRegion || summary.lowestRegion) && (
        <div className="grid grid-cols-2 gap-4">
          {summary.topRegion && (
            <div className="bg-[#1a4d2e] rounded-xl p-5 border-2 border-[#4ade80]">
              <p className="text-[#4ade80] text-sm font-medium mb-1">Top Performing Region</p>
              <p className="text-2xl font-bold">{summary.topRegion}</p>
            </div>
          )}
          {summary.lowestRegion && (
            <div className="bg-[#1a4d2e] rounded-xl p-5 border-2 border-[#f87171]">
              <p className="text-[#f87171] text-sm font-medium mb-1">Lowest Performing Region</p>
              <p className="text-2xl font-bold">{summary.lowestRegion}</p>
            </div>
          )}
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Time Series Chart */}
        {processedData.timeSeriesData.length > 0 && (
          <div className="bg-[#0d2818] rounded-xl p-5 border border-[#2d5a3d]">
            <div
              className="flex items-center justify-between mb-4 cursor-pointer"
              onClick={() => handleChartClick(processedData.timeSeriesData, 'Time Series Detail')}
            >
              <h3 className="font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#4ade80]" />
                Revenue Trend
              </h3>
              <ChevronDown className="w-4 h-4 text-[#a7c4bc]" />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={processedData.timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d5a3d" />
                <XAxis dataKey="date" stroke="#a7c4bc" fontSize={10} />
                <YAxis stroke="#a7c4bc" fontSize={10} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a4d2e', border: '1px solid #2d5a3d', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#4ade80" fill="#4ade80" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Region Bar Chart */}
        {processedData.regionChartData.length > 0 && (
          <div className="bg-[#0d2818] rounded-xl p-5 border border-[#2d5a3d]">
            <div
              className="flex items-center justify-between mb-4 cursor-pointer"
              onClick={() => handleChartClick(processedData.regionChartData, 'Region Performance Detail')}
            >
              <h3 className="font-semibold flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-[#60a5fa]" />
                Revenue by Region
              </h3>
              <ChevronDown className="w-4 h-4 text-[#a7c4bc]" />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={processedData.regionChartData.slice(0, 6)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#2d5a3d" />
                <XAxis type="number" stroke="#a7c4bc" fontSize={10} />
                <YAxis type="category" dataKey="name" stroke="#a7c4bc" fontSize={10} width={80} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a4d2e', border: '1px solid #2d5a3d', borderRadius: '8px' }}
                  labelStyle={{ color: '#fff' }}
                />
                <Bar dataKey="revenue" fill="#4ade80" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Pie Chart - Region Distribution */}
        {processedData.regionChartData.length > 0 && (
          <div className="bg-[#0d2818] rounded-xl p-5 border border-[#2d5a3d]">
            <div
              className="flex items-center justify-between mb-4 cursor-pointer"
              onClick={() => handleChartClick(processedData.regionChartData, 'Region Distribution Detail')}
            >
              <h3 className="font-semibold flex items-center gap-2">
                <Users className="w-5 h-5 text-[#fbbf24]" />
                Customer Distribution
              </h3>
              <ChevronDown className="w-4 h-4 text-[#a7c4bc]" />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={processedData.regionChartData.slice(0, 6)}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {processedData.regionChartData.slice(0, 6).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a4d2e', border: '1px solid #2d5a3d', borderRadius: '8px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Line Chart - Multiple Metrics */}
        {processedData.timeSeriesData.length > 1 && (
          <div className="bg-[#0d2818] rounded-xl p-5 border border-[#2d5a3d]">
            <div
              className="flex items-center justify-between mb-4 cursor-pointer"
              onClick={() => handleChartClick(processedData.timeSeriesData, 'Metrics Comparison Detail')}
            >
              <h3 className="font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#c4b5fd]" />
                Metrics Over Time
              </h3>
              <ChevronDown className="w-4 h-4 text-[#a7c4bc]" />
            </div>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={processedData.timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d5a3d" />
                <XAxis dataKey="date" stroke="#a7c4bc" fontSize={10} />
                <YAxis stroke="#a7c4bc" fontSize={10} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a4d2e', border: '1px solid #2d5a3d', borderRadius: '8px' }}
                />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#4ade80" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="customers" stroke="#60a5fa" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="churn" stroke="#f87171" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Radar Chart - Performance Metrics */}
        {processedData.radarData.length > 0 && (
          <div className="bg-[#0d2818] rounded-xl p-5 border border-[#2d5a3d]">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-[#fb923c]" />
              Performance Metrics
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <RadarChart cx="50%" cy="50%" outerRadius="80%" data={processedData.radarData}>
                <PolarGrid stroke="#2d5a3d" />
                <PolarAngleAxis dataKey="metric" stroke="#a7c4bc" fontSize={10} />
                <PolarRadiusAxis stroke="#a7c4bc" fontSize={10} />
                <Radar name="Performance" dataKey="value" stroke="#4ade80" fill="#4ade80" fillOpacity={0.5} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Distribution Bar Chart */}
        {processedData.distributionData.length > 0 && (
          <div className="bg-[#0d2818] rounded-xl p-5 border border-[#2d5a3d]">
            <h3 className="font-semibold flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-[#f472b6]" />
              Metric Distribution
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={processedData.distributionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d5a3d" />
                <XAxis dataKey="name" stroke="#a7c4bc" fontSize={10} interval={0} angle={-45} textAnchor="end" height={60} />
                <YAxis stroke="#a7c4bc" fontSize={10} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1a4d2e', border: '1px solid #2d5a3d', borderRadius: '8px' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {processedData.distributionData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Drill-Down Modal */}
      {drillDownData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0d2818] rounded-2xl p-6 max-w-4xl w-full max-h-[80vh] overflow-auto border border-[#2d5a3d]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">{drillDownTitle}</h3>
              <button
                onClick={() => setDrillDownData(null)}
                className="p-2 bg-[#2d5a3d] hover:bg-[#3d7a5d] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2d5a3d]">
                    {Object.keys(drillDownData[0] || {}).map((key) => (
                      <th key={key} className="px-4 py-3 text-left text-[#a7c4bc] font-medium">
                        {key.charAt(0).toUpperCase() + key.slice(1)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {drillDownData.map((row, idx) => (
                    <tr key={idx} className="border-b border-[#2d5a3d]/50 hover:bg-[#1a4d2e]/50">
                      {Object.values(row).map((value: any, vidx) => (
                        <td key={vidx} className="px-4 py-3 text-[#a7c4bc]">
                          {typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : value}
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
  );
}
