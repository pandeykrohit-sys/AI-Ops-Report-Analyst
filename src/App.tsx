import { useState, useCallback } from 'react';
import {
  Upload, FileText, AlertCircle, CheckCircle, LayoutDashboard,
  FileSpreadsheet, Download, Loader2, BarChart3, FileUp, X
} from 'lucide-react';
import { AIDashboardGenerator } from './components/AIDashboardGenerator';
import { NativeDashboard } from './components/NativeDashboard';
import {
  parseRequirementsDocument,
  analyzeRequirements,
  mapRequirementsToData,
  ExtractedRequirements
} from './utils/requirementsAnalyzer';

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
  const [requirementsFile, setRequirementsFile] = useState<File | null>(null);
  const [error, setError] = useState<string>('');
  const [analyzing, setAnalyzing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [rawData, setRawData] = useState<string>('');
  const [businessRequirements, setBusinessRequirements] = useState<string>('');
  const [viewMode, setViewMode] = useState<'report' | 'dashboard' | 'ai-dashboard'>('report');
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [parsedData, setParsedData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [extractedRequirements, setExtractedRequirements] = useState<ExtractedRequirements | null>(null);
  const [mappedData, setMappedData] = useState<{
    mappedKPIs: { name: string; columns: string[]; aggregation: string }[];
    mappedDimensions: { name: string; columns: string[] }[];
    recommendedCharts: { type: string; title: string; dimension: string; metric: string }[];
  } | null>(null);

  const allowedTypes = [
    'text/csv',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ];

  const allowedExtensions = ['.csv', '.xlsx', '.txt'];

  const requirementsAllowedTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/pdf',
    'text/plain'
  ];

  const requirementsExtensions = ['.docx', '.pdf', '.txt'];

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

  const validateRequirementsFile = (file: File): string | null => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (!requirementsAllowedTypes.includes(file.type) && !requirementsExtensions.includes(extension)) {
      return 'Unsupported requirements file type. Please upload DOCX, PDF, or TXT files.';
    }

    if (file.size > 5 * 1024 * 1024) {
      return 'Requirements file size exceeds 5MB limit.';
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

      if (/revenue|sales|income|profit|amount|value|total/i.test(col)) {
        keyNumbers.push(`Total ${col}: ${sum.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
        metrics.push(`${col}: Total ${sum.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);

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
      } else if (/customer|client|user|transaction|count/i.test(col)) {
        keyNumbers.push(`Total ${col}: ${sum.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
        metrics.push(`${col}: ${sum.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
      } else if (/churn|attrition/i.test(col)) {
        keyNumbers.push(`Avg ${col}: ${avg.toFixed(1)}%`);
        metrics.push(`${col}: ${avg.toFixed(1)}% avg`);
        if (avg > 5) issues.push(`Churn elevated at ${avg.toFixed(1)}%`);
      } else if (/fee|tax|cost|expense/i.test(col)) {
        metrics.push(`${col}: ${sum.toLocaleString(undefined, { maximumFractionDigits: 0 })} total`);
      } else if (/growth|rate|success/i.test(col)) {
        keyNumbers.push(`${col}: ${avg.toFixed(1)}%`);
        metrics.push(`${col}: ${avg.toFixed(1)}% avg`);
      }
    });

    let topRegion: string | undefined;
    let lowestRegion: string | undefined;

    Object.entries(textColumns).forEach(([col, values]) => {
      if (/region|area|zone|category|segment/i.test(col)) {
        const counts: { [key: string]: number } = {};
        values.forEach(v => { counts[v] = (counts[v] || 0) + 1; });
        const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        if (sorted[0]) {
          metrics.push(`Top ${col}: ${sorted[0][0]} (${sorted[0][1]})`);
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

      if (/revenue|sales|income|amount|value|total/i.test(colLower)) {
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

      if (/customer|client|user|count|transaction/i.test(colLower) && !/id/i.test(colLower)) {
        const nums = values.map(v => parseFloat(v)).filter(n => !isNaN(n));
        if (nums.length > 0) {
          totalCustomers = nums.reduce((a, b) => a + b, 0);
        }
      }

      if (/region|area|zone|territory|category|segment/i.test(colLower)) {
        const revenueIdx = headers.findIndex(h => /revenue|sales|income|amount/i.test(h.toLowerCase()));
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
    setExtractedRequirements(null);
    setMappedData(null);

    if (!uploadedFile) return;

    const validationError = validateFile(uploadedFile);
    if (validationError) {
      setError(validationError);
      setFile(null);
      return;
    }

    setFile(uploadedFile);
  }, []);

  const handleRequirementsUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    setError('');

    if (!uploadedFile) return;

    const validationError = validateRequirementsFile(uploadedFile);
    if (validationError) {
      setError(validationError);
      setRequirementsFile(null);
      return;
    }

    setRequirementsFile(uploadedFile);
  }, []);

  const handleAnalyze = async () => {
    if (!file) {
      setError('Please upload a data file first.');
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

      setLoadingMessage('Analyzing business requirements...');

      // Parse requirements if uploaded
      let requirements: ExtractedRequirements | null = null;
      if (requirementsFile) {
        const reqText = await parseRequirementsDocument(requirementsFile);
        requirements = analyzeRequirements(reqText);
        setExtractedRequirements(requirements);
      } else if (businessRequirements.trim()) {
        requirements = analyzeRequirements(businessRequirements);
        setExtractedRequirements(requirements);
      }

      setLoadingMessage('Generating AI dashboard...');

      // Map requirements to data
      if (requirements) {
        const mapped = mapRequirementsToData(requirements, parsed.headers);
        setMappedData(mapped);
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      const requirementText = requirements?.objectives?.join('. ') || businessRequirements || undefined;
      const analysis = analyzeDataWithRequirement(data, requirementText);
      const dashboard = generateDashboardData(data, parsed);
      setResult(analysis);
      setDashboardData(dashboard);

      // Auto-switch to AI dashboard if requirements were provided
      if (requirements) {
        setViewMode('ai-dashboard');
      }
    } catch (err) {
      setError('Failed to analyze file. Please ensure the file is not corrupted.');
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
    result.keyNumbers.forEach((n, i) => { csv += `"KEY INSIGHT ${i + 1}","${n}"\n`; });
    result.trends.forEach((t, i) => { csv += `"TREND ${i + 1}","${t}"\n`; });
    result.metrics.forEach((m, i) => { csv += `"METRIC ${i + 1}","${m}"\n`; });
    if (result.topRegion || dashboardData?.topRegion) {
      csv += `"TOP PERFORMING REGION","${result.topRegion || dashboardData?.topRegion}"\n`;
    }
    if (result.lowestRegion || dashboardData?.lowestRegion) {
      csv += `"LOWEST PERFORMING REGION","${result.lowestRegion || dashboardData?.lowestRegion}"\n`;
    }
    result.issues.forEach((issue, i) => { csv += `"ISSUE ${i + 1}","${issue}"\n`; });
    result.actions.forEach((a, i) => { csv += `"ACTION ${i + 1}","${a}"\n`; });
    return csv;
  };

  const formatReport = (result: AnalysisResult, dashboardData?: DashboardData | null): string => {
    let report = '';
    report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    report += `        AI DASHBOARD REPORT\n`;
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

    const topRegion = result.topRegion || dashboardData?.topRegion;
    const lowestRegion = result.lowestRegion || dashboardData?.lowestRegion;

    if (topRegion || lowestRegion) {
      report += `\n${'─'.repeat(40)}\n`;
      report += `REGION PERFORMANCE\n`;
      report += `${'─'.repeat(40)}\n\n`;
      if (topRegion) report += `    Top Performing Region: ${topRegion}\n`;
      if (lowestRegion) report += `    Lowest Performing Region: ${lowestRegion}\n`;
    }

    report += `\n${'━'.repeat(40)}\n`;
    report += `        END OF REPORT\n`;
    report += `${'━'.repeat(40)}\n`;

    return report;
  };

  return (
    <div className="min-h-screen bg-[#1a4d2e] text-white">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <header className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <BarChart3 className="w-10 h-10 text-[#4ade80]" />
            <h1 className="text-3xl font-bold tracking-tight">AI Dashboard Generator</h1>
          </div>
          <p className="text-[#a7c4bc] text-lg">
            Upload your data and business requirements to generate intelligent dashboards
          </p>
        </header>

        <main className="space-y-6">
          {/* Data Upload Section */}
          <section className="bg-[#0d2818] rounded-2xl p-6 shadow-xl border border-[#2d5a3d]">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Data File
            </h2>

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
                className="flex items-center justify-center w-full h-28 border-2 border-dashed border-[#3d6b4d] rounded-xl cursor-pointer hover:border-[#5a9a6f] hover:bg-[#1a5a35] transition-all duration-200"
              >
                <div className="text-center">
                  <Upload className="w-7 h-7 mx-auto mb-2 text-[#5a9a6f]" />
                  <p className="text-[#a7c4bc]">
                    {file ? file.name : 'Click or drag to upload CSV, Excel, or TXT file'}
                  </p>
                  <p className="text-sm text-[#6b9a85] mt-1">Maximum file size: 10MB</p>
                </div>
              </label>
            </div>

            {file && (
              <div className="flex items-center gap-3 p-3 bg-[#2d5a3d] rounded-lg mt-3">
                <CheckCircle className="w-4 h-4 text-[#4ade80]" />
                <div>
                  <p className="font-medium text-sm">{file.name}</p>
                  <p className="text-xs text-[#a7c4bc]">{(file.size / 1024).toFixed(2)} KB</p>
                </div>
              </div>
            )}
          </section>

          {/* Business Requirements Section */}
          <section className="bg-[#0d2818] rounded-2xl p-6 shadow-xl border border-[#2d5a3d]">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FileUp className="w-5 h-5" />
              Business Requirements (Optional)
            </h2>

            <p className="text-sm text-[#a7c4bc] mb-4">
              Upload a requirements document (DOCX, PDF, TXT) or paste your requirements below. The AI will automatically extract objectives, KPIs, and generate a tailored dashboard.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-sm text-[#a7c4bc] block mb-2">Requirements Document</label>
                <input
                  type="file"
                  accept=".docx,.pdf,.txt"
                  onChange={handleRequirementsUpload}
                  className="hidden"
                  id="requirements-upload"
                />
                <label
                  htmlFor="requirements-upload"
                  className="flex items-center justify-center w-full h-20 border-2 border-dashed border-[#3d6b4d] rounded-xl cursor-pointer hover:border-[#5a9a6f] hover:bg-[#1a5a35] transition-all duration-200"
                >
                  <div className="text-center">
                    <FileUp className="w-5 h-5 mx-auto mb-1 text-[#5a9a6f]" />
                    <p className="text-sm text-[#a7c4bc]">
                      {requirementsFile ? requirementsFile.name : 'Upload DOCX, PDF, or TXT'}
                    </p>
                  </div>
                </label>
              </div>

              <div>
                <label className="text-sm text-[#a7c4bc] block mb-2">Or Paste Requirements</label>
                <textarea
                  value={businessRequirements}
                  onChange={(e) => setBusinessRequirements(e.target.value)}
                  placeholder="E.g., 'Analyze monthly revenue by region. Show KPIs for total transactions, average order value, growth rate. Create charts for category distribution and trend analysis...'"
                  className="w-full h-20 px-3 py-2 bg-[#1a4d2e] border border-[#3d6b4d] rounded-xl text-white placeholder-[#6b9a85] focus:outline-none focus:border-[#5a9a6f] resize-none text-sm"
                />
              </div>
            </div>

            {requirementsFile && (
              <div className="flex items-center justify-between p-3 bg-[#2d5a3d] rounded-lg mb-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-[#4ade80]" />
                  <div>
                    <p className="font-medium text-sm">{requirementsFile.name}</p>
                    <p className="text-xs text-[#a7c4bc]">{(requirementsFile.size / 1024).toFixed(2)} KB</p>
                  </div>
                </div>
                <button
                  onClick={() => setRequirementsFile(null)}
                  className="p-1 hover:bg-[#1a4d2e] rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-3 p-3 bg-[#4d1a1a] rounded-lg border border-[#8b3a3a] mb-4">
                <AlertCircle className="w-4 h-4 text-[#f87171] flex-shrink-0" />
                <p className="text-[#fca5a5] text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={!file || analyzing}
              className="w-full py-3 px-6 bg-[#2d7a4e] hover:bg-[#3d9a5e] disabled:bg-[#1d4a2e] disabled:cursor-not-allowed rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2"
            >
              {analyzing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {loadingMessage || 'Analyzing...'}
                </>
              ) : (
                <>
                  <BarChart3 className="w-5 h-5" />
                  Generate AI Dashboard
                </>
              )}
            </button>
          </section>

          {/* Loading State */}
          {analyzing && loadingMessage && (
            <section className="bg-[#0d2818] rounded-2xl p-8 shadow-xl border border-[#2d5a3d]">
              <div className="flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-12 h-12 text-[#4ade80] animate-spin" />
                <p className="text-xl font-medium text-[#a7c4bc]">{loadingMessage}</p>
                <p className="text-sm text-[#6b9a85]">AI is analyzing your data and requirements</p>
              </div>
            </section>
          )}

          {/* Results Section */}
          {result && parsedData && dashboardData && !analyzing && (
            <>
              {/* View Mode Toggle */}
              <section className="bg-[#0d2818] rounded-2xl p-4 shadow-xl border border-[#2d5a3d]">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <LayoutDashboard className="w-5 h-5" />
                    Dashboard View
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setViewMode('report')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        viewMode === 'report' ? 'bg-[#2d7a4e] text-white' : 'bg-[#1a4d2e] text-[#a7c4bc] hover:bg-[#2d5a3d]'
                      }`}
                    >
                      Report
                    </button>
                    <button
                      onClick={() => setViewMode('dashboard')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        viewMode === 'dashboard' ? 'bg-[#2d7a4e] text-white' : 'bg-[#1a4d2e] text-[#a7c4bc] hover:bg-[#2d5a3d]'
                      }`}
                    >
                      Charts
                    </button>
                    <button
                      onClick={() => setViewMode('ai-dashboard')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        viewMode === 'ai-dashboard' ? 'bg-[#fbbf24] text-[#0d2818]' : 'bg-[#fbbf24]/20 text-[#fbbf24] hover:bg-[#fbbf24]/30'
                      }`}
                    >
                      AI Dashboard
                    </button>
                  </div>
                </div>
              </section>

              {/* AI Dashboard */}
              {viewMode === 'ai-dashboard' && (
                <AIDashboardGenerator
                  data={{ headers: parsedData.headers, rows: parsedData.rows }}
                  requirements={extractedRequirements}
                  mappedKPIs={mappedData?.mappedKPIs}
                  mappedDimensions={mappedData?.mappedDimensions}
                  recommendedCharts={mappedData?.recommendedCharts}
                />
              )}

              {/* Legacy Views */}
              {viewMode !== 'ai-dashboard' && (
                <>
                  {viewMode === 'dashboard' && (
                    <NativeDashboard
                      data={{ headers: parsedData.headers, rows: parsedData.rows }}
                      summary={{
                        totalRevenue: dashboardData.totalRevenue,
                        revenueChange: dashboardData.revenueChange,
                        totalCustomers: dashboardData.totalCustomers,
                        churnRate: dashboardData.churnRate,
                        churnChange: dashboardData.churnChange,
                        regions: dashboardData.regions,
                        topRegion: dashboardData.topRegion,
                        lowestRegion: dashboardData.lowestRegion
                      }}
                    />
                  )}

                  {viewMode === 'report' && (
                    <section className="bg-[#0d2818] rounded-2xl p-6 shadow-xl border border-[#2d5a3d]">
                      <div className="space-y-5">
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

                        <div className="bg-[#1a4d2e] rounded-xl p-5 border border-[#3d6b4d]">
                          <h4 className="text-lg font-semibold text-[#4ade80] mb-3">Executive Summary</h4>
                          <p className="text-[#a7c4bc] leading-relaxed">{result.summary}</p>
                        </div>

                        {extractedRequirements && (
                          <div className="bg-[#1a4d2e] rounded-xl p-5 border border-[#fbbf24]/30">
                            <h4 className="text-lg font-semibold text-[#fbbf24] mb-3">Requirements Analysis</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div>
                                <p className="text-sm text-[#a7c4bc] mb-1">Objectives</p>
                                <p className="text-[#4ade80] font-medium">{extractedRequirements.objectives.length}</p>
                              </div>
                              <div>
                                <p className="text-sm text-[#a7c4bc] mb-1">KPIs</p>
                                <p className="text-[#60a5fa] font-medium">{extractedRequirements.kpis.length}</p>
                              </div>
                              <div>
                                <p className="text-sm text-[#a7c4bc] mb-1">Dimensions</p>
                                <p className="text-[#c4b5fd] font-medium">{extractedRequirements.dimensions.length}</p>
                              </div>
                              <div>
                                <p className="text-sm text-[#a7c4bc] mb-1">Confidence</p>
                                <p className="text-[#fbbf24] font-medium">{extractedRequirements.confidence}%</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  {/* Export Section */}
                  <section className="bg-[#0d2818] rounded-2xl p-6 shadow-xl border border-[#2d5a3d]">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Download className="w-5 h-5" />
                      Export Report
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => handleDownload('txt')}
                        className="py-3 px-4 bg-[#2d5a3d] hover:bg-[#3d7a5d] rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <FileText className="w-4 h-4" />
                        Download TXT
                      </button>
                      <button
                        onClick={() => handleDownload('csv')}
                        className="py-3 px-4 bg-[#2d5a3d] hover:bg-[#3d7a5d] rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                        Download CSV
                      </button>
                    </div>
                  </section>
                </>
              )}
            </>
          )}
        </main>

        <footer className="mt-8 text-center text-[#6b9a85] text-sm">
          <p>Supports CSV, Excel (.xlsx), TXT, DOCX, and PDF file formats</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
