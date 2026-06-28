import { useState, useCallback } from 'react';
import { Upload, FileText, AlertCircle, CheckCircle, LayoutDashboard, FileSpreadsheet, Download, Loader2 } from 'lucide-react';

type AnalysisResult = {
  headline: string;
  summary: string;
  keyNumbers: string[];
  trends: string[];
  metrics: string[];
  issues: string[];
  actions: string[];
  topRegion?: string;
  lowestRegion?: string;
};

type DashboardData = {
  totalRevenue: number;
  revenueChange?: number;
  totalCustomers: number;
  churnRate?: number;
  churnChange?: number;
  regions: { name: string; count: number; revenue?: number }[];
  topRegion?: string;
  lowestRegion?: string;
  metrics: { label: string; value: string }[];
};

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>('');
  const [analyzing, setAnalyzing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [rawData, setRawData] = useState<string>('');
  const [customRequirement, setCustomRequirement] = useState<string>('');
  const [viewMode, setViewMode] = useState<'report' | 'dashboard'>('report');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [parsedData, setParsedData] = useState<{ headers: string[]; rows: string[][] } | null>(null);

  const allowedTypes = [
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ];

  const allowedExtensions = ['.csv', '.xlsx', '.txt'];

  const validateFile = (file: File): string | null => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(extension)) {
      return 'Unsupported file type. Please upload CSV, Excel (.xlsx), or TXT files only.';
    }

    if (file.size > 10 * 1024 * 1024) {
      return 'File size exceeds 10MB limit.';
    }

    return null;
  };

  const parseFileContent = async (file: File): Promise<string> => {
    const extension = file.name.split('.').pop()?.toLowerCase();

    if (extension === 'txt' || file.type === 'text/plain') {
      return await file.text();
    }

    if (extension === 'csv' || file.type === 'text/csv') {
      return await file.text();
    }

    if (extension === 'xlsx') {
      const { read, utils } = await import('xlsx');
      const arrayBuffer = await file.arrayBuffer();
      const workbook = read(arrayBuffer, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const csv = utils.sheet_to_csv(worksheet);
      return csv;
    }

    return await file.text();
  };

  const parseDataStructure = (data: string): { headers: string[]; rows: string[][] } => {
    const lines = data.trim().split('\n').filter(line => line.trim());
    const headers = lines[0]?.split(/[,\t|;]/).map(h => h.trim().replace(/"/g, '')) || [];
    const rows = lines.slice(1).map(line =>
      line.split(/[,\t|;]/).map(cell => cell.trim().replace(/"/g, ''))
    );
    return { headers, rows };
  };

  const analyzeDataWithRequirement = (data: string, requirement?: string): AnalysisResult => {
    const { headers, rows } = parseDataStructure(data);

    const numericColumns: { [key: string]: number[] } = {};
    const textColumns: { [key: string]: string[] } = {};

    headers.forEach((header, idx) => {
      const values = rows.map(row => row[idx]).filter(v => v !== undefined && v !== '');
      const numericValues = values.map(v => parseFloat(v)).filter(n => !isNaN(n));

      if (numericValues.length > values.length * 0.5) {
        numericColumns[header] = numericValues;
      } else {
        textColumns[header] = values;
      }
    });

    let focusArea = '';
    if (requirement) {
      const reqLower = requirement.toLowerCase();
      if (/churn|attrition|retention/i.test(reqLower)) focusArea = 'churn';
      else if (/revenue|sales|income/i.test(reqLower)) focusArea = 'revenue';
      else if (/region|area|zone|location/i.test(reqLower)) focusArea = 'region';
      else if (/growth|trend/i.test(reqLower)) focusArea = 'growth';
      else if (/cost|expense|spend/i.test(reqLower)) focusArea = 'cost';
    }

    const trends: string[] = [];
    const metrics: string[] = [];
    const issues: string[] = [];
    const actions: string[] = [];
    const keyNumbers: string[] = [];

    Object.entries(numericColumns).forEach(([col, values]) => {
      if (values.length < 1) return;

      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const max = Math.max(...values);
      const min = Math.min(...values);

      if (/revenue|sales|income|profit/i.test(col)) {
        keyNumbers.push(`Total ${col}: ${sum.toLocaleString(undefined, {maximumFractionDigits: 0})}`);
        metrics.push(`${col}: Total ${sum.toLocaleString(undefined, {maximumFractionDigits: 0})}`);

        if (values.length >= 4) {
          const recent = values.slice(-Math.max(1, Math.ceil(values.length / 4)));
          const earlier = values.slice(0, Math.max(1, Math.ceil(values.length / 4)));
          const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
          const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;

          if (earlierAvg !== 0) {
            const change = ((recentAvg - earlierAvg) / Math.abs(earlierAvg)) * 100;
            trends.push(`${col} ${change > 0 ? 'up' : 'down'} ${Math.abs(change).toFixed(1)}%`);
          }
        }
      } else if (/customer|client|user/i.test(col)) {
        keyNumbers.push(`Total ${col}: ${sum.toLocaleString(undefined, {maximumFractionDigits: 0})}`);
        metrics.push(`${col}: ${sum.toLocaleString(undefined, {maximumFractionDigits: 0})}`);
      } else if (/churn|attrition/i.test(col)) {
        keyNumbers.push(`Avg ${col}: ${avg.toFixed(1)}%`);
        metrics.push(`${col}: ${avg.toFixed(1)}% avg`);
        if (avg > 5) issues.push(`Churn elevated at ${avg.toFixed(1)}%`);
      } else if (/cost|expense/i.test(col)) {
        metrics.push(`${col}: ${sum.toLocaleString(undefined, {maximumFractionDigits: 0})} total`);
      } else if (/growth/i.test(col)) {
        keyNumbers.push(`${col}: ${avg.toFixed(1)}%`);
        metrics.push(`${col}: ${avg.toFixed(1)}% avg`);
      }
    });

    let topRegion: string | undefined;
    let lowestRegion: string | undefined;

    Object.entries(textColumns).forEach(([col, values]) => {
      if (/region|area|zone/i.test(col)) {
        const counts: { [key: string]: number } = {};
        values.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        if (sorted[0]) {
          metrics.push(`Top region: ${sorted[0][0]} (${sorted[0][1]})`);
          topRegion = sorted[0][0];
          if (sorted.length >= 2) {
            lowestRegion = sorted[sorted.length - 1][0];
          }
        }
      }
    });

    if (trends.length === 0) trends.push('Stable performance across periods');
    if (issues.length === 0) issues.push('No critical issues identified');
    if (metrics.length === 0) metrics.push('Metrics extracted from available data');

    const actionPool = [
      focusArea === 'churn' ? 'Implement retention campaign for at-risk segments' : null,
      focusArea === 'revenue' ? 'Conduct revenue optimization analysis by segment' : null,
      focusArea === 'cost' ? 'Review cost structure for optimization opportunities' : null,
      'Develop action plan for underperforming areas',
      'Set up monitoring for key metrics',
      'Investigate root causes of flagged issues',
      'Align resources to address performance gaps'
    ].filter(Boolean) as string[];

    const headline = focusArea
      ? `Focused Analysis: ${requirement}`
      : `Operations Report: ${trends[0] || 'Analysis Complete'}`;

    const summary = `${trends.slice(0, 2).join(', ')}. ${issues[0] || 'Stable operations'}.`;

    return {
      headline,
      summary,
      keyNumbers: keyNumbers.slice(0, 3),
      trends: trends.slice(0, 2),
      metrics: metrics.slice(0, 4),
      issues: issues.slice(0, 2),
      actions: actionPool.slice(0, 3),
      topRegion,
      lowestRegion
    };
  };

  const generateDashboardData = (data: string, { headers, rows }: { headers: string[]; rows: string[][] }): DashboardData => {
    let totalRevenue = 0;
    let revenueChange: number | undefined;
    let totalCustomers = 0;
    let churnRate: number | undefined;
    let churnChange: number | undefined;
    const regions: { name: string; count: number; revenue?: number }[] = [];
    const regionMap: { [key: string]: { count: number; revenue: number; values: number[] } } = {};

    headers.forEach((header, idx) => {
      const colLower = header.toLowerCase();
      const values = rows.map(row => row[idx]).filter(v => v !== undefined && v !== '');

      if (/revenue|sales|income/i.test(colLower)) {
        const nums = values.map(v => parseFloat(v)).filter(n => !isNaN(n));
        totalRevenue = nums.reduce((a, b) => a + b, 0);

        if (nums.length >= 4) {
          const mid = Math.floor(nums.length / 2);
          const firstHalf = nums.slice(0, mid);
          const secondHalf = nums.slice(mid);
          const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
          const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
          if (firstAvg !== 0) {
            revenueChange = ((secondAvg - firstAvg) / Math.abs(firstAvg)) * 100;
          }
        }
      }

      if (/churn|attrition/i.test(colLower)) {
        const nums = values.map(v => parseFloat(v)).filter(n => !isNaN(n));
        if (nums.length > 0) {
          churnRate = nums.reduce((a, b) => a + b, 0) / nums.length;

          if (nums.length >= 4) {
            const mid = Math.floor(nums.length / 2);
            const firstHalf = nums.slice(0, mid);
            const secondHalf = nums.slice(mid);
            const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
            const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
            if (firstAvg !== 0) {
              churnChange = ((secondAvg - firstAvg) / Math.abs(firstAvg)) * 100;
            }
          }
        }
      }

      if (/customer|client|user|count/i.test(colLower) && !/id/i.test(colLower)) {
        const nums = values.map(v => parseFloat(v)).filter(n => !isNaN(n));
        if (nums.length > 0) {
          totalCustomers = nums.reduce((a, b) => a + b, 0);
        }
      }

      if (/region|area|zone|territory/i.test(colLower)) {
        const revenueIdx = headers.findIndex(h => /revenue|sales|income/i.test(h.toLowerCase()));
        values.forEach((v, rowIdx) => {
          if (!regionMap[v]) regionMap[v] = { count: 0, revenue: 0, values: [] };
          regionMap[v].count++;
          if (revenueIdx !== -1 && rows[rowIdx]) {
            const rev = parseFloat(rows[rowIdx][revenueIdx]);
            if (!isNaN(rev)) {
              regionMap[v].revenue += rev;
              regionMap[v].values.push(rev);
            }
          }
        });
      }
    });

    const regionList = Object.entries(regionMap).map(([name, data]) => ({
      name,
      count: data.count,
      revenue: data.revenue > 0 ? data.revenue : undefined
    })).sort((a, b) => (b.revenue || b.count) - (a.revenue || a.count));

    let topRegion: string | undefined;
    let lowestRegion: string | undefined;

    if (regionList.length >= 2) {
      topRegion = regionList[0]?.name;
      lowestRegion = regionList[regionList.length - 1]?.name;
    } else if (regionList.length === 1) {
      topRegion = regionList[0]?.name;
    }

    if (totalCustomers === 0 && rows.length > 0) {
      totalCustomers = rows.length;
    }

    return {
      totalRevenue,
      revenueChange,
      totalCustomers,
      churnRate,
      churnChange,
      regions: regionList.length > 0 ? regionList.slice(0, 5) : [{ name: 'N/A', count: 0 }],
      topRegion,
      lowestRegion,
      metrics: [
        { label: 'Total Records', value: rows.length.toString() },
        { label: 'Data Columns', value: headers.length.toString() }
      ]
    };
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    setError('');
    setResult(null);
    setRawData('');
    setParsedData(null);
    setDashboardData(null);
    setLoadingMessage('');

    if (!uploadedFile) return;

    const validationError = validateFile(uploadedFile);
    if (validationError) {
      setError(validationError);
      setFile(null);
      return;
    }

    setFile(uploadedFile);
  }, []);

  const handleAnalyze = async () => {
    if (!file) {
      setError('Please upload a file first.');
      return;
    }

    setAnalyzing(true);
    setLoadingMessage('Processing data...');
    setError('');

    try {
      const data = await parseFileContent(file);
      setRawData(data);
      const parsed = parseDataStructure(data);
      setParsedData(parsed);

      setLoadingMessage('Generating insights...');

      await new Promise(resolve => setTimeout(resolve, 600));

      const analysis = analyzeDataWithRequirement(data);
      const dashboard = generateDashboardData(data, parsed);
      setResult(analysis);
      setDashboardData(dashboard);
    } catch (err) {
      setError('Failed to analyze file. Please ensure the file is not corrupted.');
      console.error(err);
    } finally {
      setAnalyzing(false);
      setLoadingMessage('');
    }
  };

  const handleCustomReport = async () => {
    if (!file) {
      setError('Please upload a file first.');
      return;
    }

    if (!customRequirement.trim()) {
      setError('Please enter a custom requirement.');
      return;
    }

    setAnalyzing(true);
    setLoadingMessage('Processing data...');
    setError('');

    try {
      let data = rawData;
      if (!data) {
        data = await parseFileContent(file);
        setRawData(data);
        const parsed = parseDataStructure(data);
        setParsedData(parsed);
      }

      setLoadingMessage('Generating insights...');

      await new Promise(resolve => setTimeout(resolve, 600));

      const analysis = analyzeDataWithRequirement(data, customRequirement);

      if (!dashboardData) {
        const parsed = parseDataStructure(data);
        const dashboard = generateDashboardData(data, parsed);
        setDashboardData(dashboard);
      }

      setResult(analysis);
    } catch (err) {
      setError('Failed to generate custom report.');
      console.error(err);
    } finally {
      setAnalyzing(false);
      setLoadingMessage('');
    }
  };

  const handleDownload = (format: 'txt' | 'csv') => {
    if (!result) return;

    let content = '';
    let filename = '';
    let mimeType = '';

    if (format === 'txt') {
      content = formatReport(result, dashboardData);
      filename = 'operations-report.txt';
      mimeType = 'text/plain';
    } else {
      content = generateCSVReport(result, dashboardData);
      filename = 'operations-report.csv';
      mimeType = 'text/csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const generateCSVReport = (result: AnalysisResult, dashboardData?: DashboardData | null): string => {
    let csv = 'Section,Content\n';
    csv += `"EXECUTIVE SUMMARY","${result.summary}"\n`;
    result.keyNumbers.forEach((n, i) => csv += `"KEY INSIGHT ${i + 1}","${n}"\n`);
    result.trends.forEach((t, i) => csv += `"TREND ${i + 1}","${t}"\n`);
    result.metrics.forEach((m, i) => csv += `"METRIC ${i + 1}","${m}"\n`);
    if (result.topRegion || dashboardData?.topRegion) {
      csv += `"TOP PERFORMING REGION","${result.topRegion || dashboardData?.topRegion}"\n`;
    }
    if (result.lowestRegion || dashboardData?.lowestRegion) {
      csv += `"LOWEST PERFORMING REGION","${result.lowestRegion || dashboardData?.lowestRegion}"\n`;
    }
    result.issues.forEach((issue, i) => csv += `"ISSUE ${i + 1}","${issue}"\n`);
    result.actions.forEach((a, i) => csv += `"ACTION ${i + 1}","${a}"\n`);
    return csv;
  };

  const formatReport = (result: AnalysisResult, dashboardData?: DashboardData | null): string => {
    let report = '';

    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `        OPERATIONS ANALYSIS REPORT\n`;
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    report += `\n${'─'.repeat(40)}\n`;
    report += `EXECUTIVE SUMMARY\n`;
    report += `${'─'.repeat(40)}\n\n`;
    report += `${result.summary}\n`;

    if (result.keyNumbers.length > 0) {
      report += `\n\n${'─'.repeat(40)}\n`;
      report += `KEY INSIGHTS\n`;
      report += `${'─'.repeat(40)}\n\n`;
      result.keyNumbers.forEach((n, i) => {
        report += `    ${i + 1}. ${n}\n`;
      });
    }

    if (result.trends.length > 0) {
      report += `\n${'─'.repeat(40)}\n`;
      report += `TRENDS\n`;
      report += `${'─'.repeat(40)}\n\n`;
      result.trends.forEach((t, i) => {
        report += `    ${i + 1}. ${t}\n`;
      });
    }

    if (result.metrics.length > 0) {
      report += `\n${'─'.repeat(40)}\n`;
      report += `METRICS\n`;
      report += `${'─'.repeat(40)}\n\n`;
      result.metrics.forEach((m, i) => {
        report += `    ${i + 1}. ${m}\n`;
      });
    }

    const topRegion = result.topRegion || dashboardData?.topRegion;
    const lowestRegion = result.lowestRegion || dashboardData?.lowestRegion;

    if (topRegion || lowestRegion) {
      report += `\n${'─'.repeat(40)}\n`;
      report += `REGION PERFORMANCE\n`;
      report += `${'─'.repeat(40)}\n\n`;
      if (topRegion) report += `    Top Performing Region: ${topRegion}\n`;
      if (lowestRegion) report += `    Lowest Performing Region: ${lowestRegion}\n`;
    }

    if (result.issues.length > 0) {
      report += `\n${'─'.repeat(40)}\n`;
      report += `ISSUES\n`;
      report += `${'─'.repeat(40)}\n\n`;
      result.issues.forEach((issue, i) => {
        report += `    ${i + 1}. ${issue}\n`;
      });
    }

    if (result.actions.length > 0) {
      report += `\n${'─'.repeat(40)}\n`;
      report += `RECOMMENDED ACTIONS\n`;
      report += `${'─'.repeat(40)}\n\n`;
      result.actions.forEach((a, i) => {
        report += `    ${i + 1}. ${a}\n`;
      });
    }

    report += `\n${'━'.repeat(40)}\n`;
    report += `        END OF REPORT\n`;
    report += `${'━'.repeat(40)}\n`;

    return report;
  };

  return (
    <div className="min-h-screen bg-[#1a4d2e] text-white">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <header className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <FileText className="w-10 h-10" />
            <h1 className="text-4xl font-bold tracking-tight">AI Ops Report Analyst</h1>
          </div>
          <p className="text-[#a7c4bc] text-lg">
            Upload your business data files and get instant professional analysis
          </p>
        </header>

        <main className="space-y-8">
          <section className="bg-[#0d2818] rounded-2xl p-8 shadow-xl border border-[#2d5a3d]">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Your Data
            </h2>

            <div className="space-y-6">
              <div className="relative">
                <input
                  type="file"
                  accept=".csv,.xlsx,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="flex items-center justify-center w-full h-32 border-2 border-dashed border-[#3d6b4d] rounded-xl cursor-pointer hover:border-[#5a9a6f] hover:bg-[#1a5a35] transition-all duration-200"
                >
                  <div className="text-center">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-[#5a9a6f]" />
                    <p className="text-[#a7c4bc]">
                      {file ? file.name : 'Click or drag to upload CSV, Excel, or TXT file'}
                    </p>
                    <p className="text-sm text-[#6b9a85] mt-1">Maximum file size: 10MB</p>
                  </div>
                </label>
              </div>

              {file && (
                <div className="flex items-center gap-3 p-4 bg-[#2d5a3d] rounded-lg">
                  <CheckCircle className="w-5 h-5 text-[#4ade80]" />
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-[#a7c4bc]">
                      {(file.size / 1024).toFixed(2)} KB uploaded
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[#a7c4bc] text-sm font-medium">
                  Custom Requirement (Optional)
                </label>
                <input
                  type="text"
                  value={customRequirement}
                  onChange={(e) => setCustomRequirement(e.target.value)}
                  placeholder="e.g., Focus on churn, Show only revenue trends..."
                  className="w-full px-4 py-3 bg-[#1a4d2e] border border-[#3d6b4d] rounded-xl text-white placeholder-[#6b9a85] focus:outline-none focus:border-[#5a9a6f] transition-colors"
                />
              </div>

              {error && (
                <div className="flex items-center gap-3 p-4 bg-[#4d1a1a] rounded-lg border border-[#8b3a3a]">
                  <AlertCircle className="w-5 h-5 text-[#f87171] flex-shrink-0" />
                  <p className="text-[#fca5a5]">{error}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={handleAnalyze}
                  disabled={!file || analyzing}
                  className="py-4 px-6 bg-[#2d7a4e] hover:bg-[#3d9a5e] disabled:bg-[#1d4a2e] disabled:cursor-not-allowed rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <FileText className="w-5 h-5" />
                      Analyze Report
                    </>
                  )}
                </button>

                <button
                  onClick={handleCustomReport}
                  disabled={!file || analyzing || !customRequirement.trim()}
                  className="py-4 px-6 bg-[#3d5a4d] hover:bg-[#4d6a5d] disabled:bg-[#1d4a2e] disabled:cursor-not-allowed rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2"
                >
                  {analyzing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-5 h-5" />
                      Generate Custom Report
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          {analyzing && loadingMessage && (
            <section className="bg-[#0d2818] rounded-2xl p-8 shadow-xl border border-[#2d5a3d]">
              <div className="flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-12 h-12 text-[#4ade80] animate-spin" />
                <p className="text-xl font-medium text-[#a7c4bc]">{loadingMessage}</p>
                <p className="text-sm text-[#6b9a85]">Please wait while we process your data</p>
              </div>
            </section>
          )}

          {dashboardData && (
            <section className="bg-[#0d2818] rounded-2xl p-6 shadow-xl border border-[#2d5a3d]">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <LayoutDashboard className="w-5 h-5" />
                  {viewMode === 'report' ? 'Report View' : 'Dashboard View'}
                </h2>
                <button
                  onClick={() => setViewMode(viewMode === 'report' ? 'dashboard' : 'report')}
                  className="px-4 py-2 bg-[#2d5a3d] hover:bg-[#3d7a5d] rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  View {viewMode === 'report' ? 'Dashboard' : 'Report'}
                </button>
              </div>

              {viewMode === 'dashboard' ? (
                <div className="space-y-6">
                  <h3 className="text-center text-2xl font-bold text-[#4ade80] mb-6">
                    Business Performance Dashboard
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-[#1a4d2e] rounded-xl p-5 border border-[#3d6b4d]">
                      <p className="text-[#a7c4bc] text-sm mb-2">Revenue</p>
                      <p className="text-2xl font-bold text-[#4ade80]">
                        ${dashboardData.totalRevenue.toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </p>
                      {dashboardData.revenueChange !== undefined && (
                        <p className={`text-sm mt-2 font-medium ${dashboardData.revenueChange >= 0 ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
                          {dashboardData.revenueChange >= 0 ? '↑' : '↓'} {Math.abs(dashboardData.revenueChange).toFixed(1)}%
                        </p>
                      )}
                    </div>
                    <div className="bg-[#1a4d2e] rounded-xl p-5 border border-[#3d6b4d]">
                      <p className="text-[#a7c4bc] text-sm mb-2">Churn Rate</p>
                      <p className="text-2xl font-bold text-[#fbbf24]">
                        {dashboardData.churnRate !== undefined ? `${dashboardData.churnRate.toFixed(1)}%` : 'N/A'}
                      </p>
                      {dashboardData.churnChange !== undefined && (
                        <p className={`text-sm mt-2 font-medium ${dashboardData.churnChange <= 0 ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>
                          {dashboardData.churnChange <= 0 ? '↓' : '↑'} {Math.abs(dashboardData.churnChange).toFixed(1)}%
                        </p>
                      )}
                    </div>
                    <div className="bg-[#1a4d2e] rounded-xl p-5 border border-[#3d6b4d]">
                      <p className="text-[#a7c4bc] text-sm mb-2">Total Customers</p>
                      <p className="text-2xl font-bold text-[#60a5fa]">
                        {dashboardData.totalCustomers.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-[#1a4d2e] rounded-xl p-5 border border-[#3d6b4d]">
                      <p className="text-[#a7c4bc] text-sm mb-2">Total Records</p>
                      <p className="text-2xl font-bold text-[#c4b5fd]">
                        {dashboardData.metrics[0]?.value || 'N/A'}
                      </p>
                    </div>
                  </div>

                  {(dashboardData.topRegion || dashboardData.lowestRegion) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-[#1a4d2e] rounded-xl p-5 border border-[#4ade80]">
                        <p className="text-[#4ade80] text-sm mb-1 font-medium">Top Performing Region</p>
                        <p className="text-xl font-bold">{dashboardData.topRegion || 'N/A'}</p>
                      </div>
                      <div className="bg-[#1a4d2e] rounded-xl p-5 border border-[#f87171]">
                        <p className="text-[#f87171] text-sm mb-1 font-medium">Lowest Performing Region</p>
                        <p className="text-xl font-bold">{dashboardData.lowestRegion || 'N/A'}</p>
                      </div>
                    </div>
                  )}

                  <div className="bg-[#1a4d2e] rounded-xl p-5 border border-[#3d6b4d]">
                    <h4 className="text-lg font-semibold mb-4">Region Summary</h4>
                    <div className="space-y-3">
                      {dashboardData.regions.map((region, i) => (
                        <div key={i} className="flex items-center justify-between text-[#a7c4bc]">
                          <span className="flex items-center gap-2">
                            {i === 0 && dashboardData.topRegion === region.name && (
                              <span className="text-[#4ade80]">★</span>
                            )}
                            {region.name}
                          </span>
                          <span className="font-medium text-white">{region.count} records</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : result && (
                <div className="space-y-6">
                  {result.headline && (
                    <div className="text-center py-4 border-b border-[#3d6b4d]">
                      <h3 className="text-xl font-bold text-[#4ade80]">{result.headline}</h3>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {result.keyNumbers.map((num, i) => (
                      <div key={i} className="bg-[#1a4d2e] rounded-xl p-4 border border-[#3d6b4d] text-center">
                        <p className="text-lg font-bold text-[#fbbf24]">{num}</p>
                      </div>
                    ))}
                  </div>

                  {(result.topRegion || result.lowestRegion || dashboardData?.topRegion || dashboardData?.lowestRegion) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-[#1a4d2e] rounded-xl p-5 border border-[#4ade80]">
                        <p className="text-[#4ade80] text-sm mb-1 font-medium">Top Performing Region</p>
                        <p className="text-xl font-bold">{result.topRegion || dashboardData?.topRegion || 'N/A'}</p>
                      </div>
                      <div className="bg-[#1a4d2e] rounded-xl p-5 border border-[#f87171]">
                        <p className="text-[#f87171] text-sm mb-1 font-medium">Lowest Performing Region</p>
                        <p className="text-xl font-bold">{result.lowestRegion || dashboardData?.lowestRegion || 'N/A'}</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-5">
                    <div className="bg-[#1a4d2e] rounded-xl p-5 border border-[#3d6b4d]">
                      <h4 className="text-lg font-semibold text-[#4ade80] mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 bg-[#4ade80] rounded-full"></span>
                        Executive Summary
                      </h4>
                      <p className="text-[#a7c4bc] leading-relaxed">{result.summary}</p>
                    </div>

                    {result.trends.length > 0 && (
                      <div className="bg-[#1a4d2e] rounded-xl p-5 border border-[#3d6b4d]">
                        <h4 className="text-lg font-semibold text-[#60a5fa] mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 bg-[#60a5fa] rounded-full"></span>
                          Key Insights
                        </h4>
                        <ul className="space-y-2">
                          {result.trends.map((trend, i) => (
                            <li key={i} className="text-[#a7c4bc] flex items-start gap-2">
                              <span className="text-[#60a5fa] mt-1">•</span>
                              <span>{trend}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {result.metrics.length > 0 && (
                      <div className="bg-[#1a4d2e] rounded-xl p-5 border border-[#3d6b4d]">
                        <h4 className="text-lg font-semibold text-[#fbbf24] mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 bg-[#fbbf24] rounded-full"></span>
                          Metrics
                        </h4>
                        <ul className="space-y-2">
                          {result.metrics.map((metric, i) => (
                            <li key={i} className="text-[#a7c4bc] flex items-start gap-2">
                              <span className="text-[#fbbf24] mt-1">•</span>
                              <span>{metric}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {result.issues.length > 0 && (
                      <div className="bg-[#1a4d2e] rounded-xl p-5 border border-[#f87171]/30">
                        <h4 className="text-lg font-semibold text-[#f87171] mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 bg-[#f87171] rounded-full"></span>
                          Issues
                        </h4>
                        <ul className="space-y-2">
                          {result.issues.map((issue, i) => (
                            <li key={i} className="text-[#a7c4bc] flex items-start gap-2">
                              <span className="text-[#f87171] mt-1">•</span>
                              <span>{issue}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {result.actions.length > 0 && (
                      <div className="bg-[#1a4d2e] rounded-xl p-5 border border-[#3d6b4d]">
                        <h4 className="text-lg font-semibold text-[#c4b5fd] mb-3 flex items-center gap-2">
                          <span className="w-2 h-2 bg-[#c4b5fd] rounded-full"></span>
                          Recommended Actions
                        </h4>
                        <ul className="space-y-2">
                          {result.actions.map((action, i) => (
                            <li key={i} className="text-[#a7c4bc] flex items-start gap-2">
                              <span className="w-5 h-5 bg-[#c4b5fd]/20 rounded text-[#c4b5fd] flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                                {i + 1}
                              </span>
                              <span>{action}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}

          {result && viewMode === 'report' && (
            <section className="bg-[#0d2818] rounded-2xl p-6 shadow-xl border border-[#2d5a3d]">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <Download className="w-5 h-5" />
                Download Report
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleDownload('txt')}
                  className="py-3 px-4 bg-[#2d5a3d] hover:bg-[#3d7a5d] rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download as TXT
                </button>
                <button
                  onClick={() => handleDownload('csv')}
                  className="py-3 px-4 bg-[#2d5a3d] hover:bg-[#3d7a5d] rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download as CSV
                </button>
              </div>
            </section>
          )}
        </main>

        <footer className="mt-16 text-center text-[#6b9a85] text-sm">
          <p>Supports CSV, Excel (.xlsx), and TXT file formats</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
