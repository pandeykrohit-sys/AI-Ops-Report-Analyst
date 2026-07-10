import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import { ExecutiveReport } from './executiveReport';
import { DataQualityResult } from './dataQuality';
import { DataDictionary } from './dataDictionary';

export interface ExportData {
  kpis: { name: string; value: number; trend?: number; format: string }[];
  insights: { type: string; title: string; description: string }[];
  executiveReport?: ExecutiveReport;
  qualityResult?: DataQualityResult;
  dictionary?: DataDictionary;
  headers: string[];
  rows: string[][];
  chartDataMap?: { [key: string]: any[] };
  chartTitles?: { [key: string]: string };
}

export function exportToPDF(data: ExportData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 25;

  // Title
  doc.setFontSize(24);
  doc.setTextColor(37, 99, 235);
  doc.text('AI Business Analyst Report', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  // Executive Summary
  if (data.executiveReport) {
    doc.setFontSize(16);
    doc.setTextColor(37, 99, 235);
    doc.text('Executive Summary', 20, yPos);
    yPos += 8;
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    const lines = doc.splitTextToSize(data.executiveReport.executiveSummary, pageWidth - 40);
    doc.text(lines, 20, yPos);
    yPos += lines.length * 5 + 5;

    // KPI Review
    yPos += 5;
    doc.setFontSize(14);
    doc.setTextColor(37, 99, 235);
    doc.text('KPI Review', 20, yPos);
    yPos += 8;
    doc.setFontSize(10);
    data.executiveReport.kpiReview.forEach(kpi => {
      if (yPos > 270) { doc.addPage(); yPos = 20; }
      doc.setTextColor(kpi.status === 'good' ? 16 : kpi.status === 'critical' ? 220 : 180, kpi.status === 'good' ? 150 : kpi.status === 'critical' ? 50 : 120, 60);
      doc.text(`${kpi.name}: ${kpi.value}${kpi.trend ? ` (${kpi.trend})` : ''}`, 25, yPos);
      yPos += 5;
      doc.setTextColor(100, 100, 100);
      const insightLines = doc.splitTextToSize(kpi.insight, pageWidth - 50);
      doc.text(insightLines, 25, yPos);
      yPos += insightLines.length * 5 + 3;
    });

    // Risks
    if (yPos > 250) { doc.addPage(); yPos = 20; }
    yPos += 5;
    doc.setFontSize(14);
    doc.setTextColor(220, 50, 50);
    doc.text('Risks', 20, yPos);
    yPos += 8;
    doc.setFontSize(10);
    data.executiveReport.risks.forEach(risk => {
      if (yPos > 270) { doc.addPage(); yPos = 20; }
      doc.setTextColor(60, 60, 60);
      doc.text(`• ${risk.title} (${risk.severity})`, 25, yPos);
      yPos += 5;
      const descLines = doc.splitTextToSize(risk.description, pageWidth - 50);
      doc.text(descLines, 30, yPos);
      yPos += descLines.length * 5 + 3;
    });

    // Opportunities
    if (yPos > 250) { doc.addPage(); yPos = 20; }
    yPos += 5;
    doc.setFontSize(14);
    doc.setTextColor(16, 150, 80);
    doc.text('Opportunities', 20, yPos);
    yPos += 8;
    doc.setFontSize(10);
    data.executiveReport.opportunities.forEach(opp => {
      if (yPos > 270) { doc.addPage(); yPos = 20; }
      doc.setTextColor(60, 60, 60);
      doc.text(`• ${opp.title}`, 25, yPos);
      yPos += 5;
      const descLines = doc.splitTextToSize(opp.description, pageWidth - 50);
      doc.text(descLines, 30, yPos);
      yPos += descLines.length * 5 + 3;
    });

    // Recommendations
    if (yPos > 250) { doc.addPage(); yPos = 20; }
    yPos += 5;
    doc.setFontSize(14);
    doc.setTextColor(37, 99, 235);
    doc.text('Recommendations', 20, yPos);
    yPos += 8;
    doc.setFontSize(10);
    data.executiveReport.recommendations.forEach(rec => {
      if (yPos > 270) { doc.addPage(); yPos = 20; }
      doc.setTextColor(60, 60, 60);
      doc.text(`${rec.priority}. ${rec.action}`, 25, yPos);
      yPos += 5;
      doc.setTextColor(120, 120, 120);
      doc.text(`Impact: ${rec.expectedImpact} | Timeline: ${rec.timeline}`, 30, yPos);
      yPos += 7;
    });

    // Action Plan
    if (yPos > 250) { doc.addPage(); yPos = 20; }
    yPos += 5;
    doc.setFontSize(14);
    doc.setTextColor(37, 99, 235);
    doc.text('Action Plan', 20, yPos);
    yPos += 8;
    doc.setFontSize(10);
    data.executiveReport.actionPlan.forEach(phase => {
      if (yPos > 270) { doc.addPage(); yPos = 20; }
      doc.setTextColor(60, 60, 60);
      doc.text(phase.phase, 25, yPos);
      yPos += 5;
      phase.actions.forEach(action => {
        const actionLines = doc.splitTextToSize(`• ${action}`, pageWidth - 50);
        doc.text(actionLines, 30, yPos);
        yPos += actionLines.length * 5;
      });
      yPos += 3;
    });
  }

  // Data Quality
  if (data.qualityResult) {
    doc.addPage();
    yPos = 20;
    doc.setFontSize(16);
    doc.setTextColor(37, 99, 235);
    doc.text('Data Quality Assessment', 20, yPos);
    yPos += 10;
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(`Quality Score: ${data.qualityResult.qualityScore}/100`, 25, yPos); yPos += 6;
    doc.text(`Total Rows: ${data.qualityResult.totalRows}`, 25, yPos); yPos += 6;
    doc.text(`Total Columns: ${data.qualityResult.totalColumns}`, 25, yPos); yPos += 6;
    doc.text(`Null Percentage: ${data.qualityResult.nullPercentage}%`, 25, yPos); yPos += 6;
    doc.text(`Duplicate Records: ${data.qualityResult.duplicateRecords}`, 25, yPos); yPos += 6;
    doc.text(`Invalid Values: ${data.qualityResult.invalidValues}`, 25, yPos); yPos += 10;

    doc.setFontSize(12);
    doc.text('Remediation Recommendations:', 25, yPos); yPos += 7;
    doc.setFontSize(10);
    data.qualityResult.remediation.forEach(r => {
      if (yPos > 270) { doc.addPage(); yPos = 20; }
      doc.text(`• [${r.severity}] ${r.issue}`, 30, yPos); yPos += 5;
      const recLines = doc.splitTextToSize(r.recommendation, pageWidth - 55);
      doc.text(recLines, 35, yPos); yPos += recLines.length * 5 + 2;
    });
  }

  // Data Dictionary
  if (data.dictionary) {
    doc.addPage();
    yPos = 20;
    doc.setFontSize(16);
    doc.setTextColor(37, 99, 235);
    doc.text('Data Dictionary', 20, yPos);
    yPos += 10;
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    data.dictionary.entries.forEach(entry => {
      if (yPos > 270) { doc.addPage(); yPos = 20; }
      doc.setFontSize(10);
      doc.setTextColor(37, 99, 235);
      doc.text(`${entry.columnName}`, 25, yPos);
      yPos += 5;
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.text(`Type: ${entry.detectedType} | Role: ${entry.role} | Unique: ${entry.uniqueValues} | Nulls: ${entry.nullCount}`, 30, yPos);
      yPos += 5;
      const meaningLines = doc.splitTextToSize(`Meaning: ${entry.businessMeaning}`, pageWidth - 55);
      doc.text(meaningLines, 30, yPos);
      yPos += meaningLines.length * 5 + 3;
    });
  }

  doc.save('ai-business-analyst-report.pdf');
}

export function exportToExcel(data: ExportData): void {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryData: any[][] = [
    ['AI Business Analyst Report'],
    ['Generated', new Date().toLocaleString()],
    [],
    ['Key Performance Indicators'],
    ['Metric', 'Value', 'Trend', 'Format']
  ];
  data.kpis.forEach(k => {
    summaryData.push([k.name, k.value, k.trend ? `${k.trend.toFixed(1)}%` : 'N/A', k.format]);
  });
  summaryData.push([], ['Key Insights']);
  data.insights.forEach(i => summaryData.push([i.type, i.title, i.description]));

  if (data.executiveReport) {
    summaryData.push([], ['Executive Summary', data.executiveReport.executiveSummary]);
    summaryData.push([], ['Risks']);
    data.executiveReport.risks.forEach(r => summaryData.push([r.title, r.severity, r.description, r.mitigation]));
    summaryData.push([], ['Opportunities']);
    data.executiveReport.opportunities.forEach(o => summaryData.push([o.title, o.description, o.potential]));
    summaryData.push([], ['Recommendations']);
    data.executiveReport.recommendations.forEach(r => summaryData.push([r.priority, r.action, r.expectedImpact, r.timeline]));
    summaryData.push([], ['Action Plan']);
    data.executiveReport.actionPlan.forEach(p => summaryData.push([p.phase, p.actions.join('; '), p.timeline]));
  }

  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

  // Raw data
  const rawWs = XLSX.utils.aoa_to_sheet([data.headers, ...data.rows]);
  XLSX.utils.book_append_sheet(wb, rawWs, 'Raw Data');

  // Data Quality
  if (data.qualityResult) {
    const qualityData: any[][] = [
      ['Data Quality Assessment'],
      ['Quality Score', data.qualityResult.qualityScore],
      ['Total Rows', data.qualityResult.totalRows],
      ['Total Columns', data.qualityResult.totalColumns],
      ['Null Percentage', `${data.qualityResult.nullPercentage}%`],
      ['Duplicate Records', data.qualityResult.duplicateRecords],
      ['Invalid Values', data.qualityResult.invalidValues],
      ['Missing Dates', data.qualityResult.missingDates],
      [],
      ['Column', 'Null Count', 'Null %'],
      ...data.qualityResult.nullsByColumn.map(c => [c.column, c.nullCount, `${c.nullPercentage.toFixed(1)}%`]),
      [],
      ['Remediation'],
      ['Issue', 'Recommendation', 'Severity'],
      ...data.qualityResult.remediation.map(r => [r.issue, r.recommendation, r.severity])
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(qualityData), 'Data Quality');
  }

  // Data Dictionary
  if (data.dictionary) {
    const dictData: any[][] = [
      ['Column Name', 'Detected Type', 'Business Meaning', 'Role', 'Unique Values', 'Null Count', 'Sample Values'],
      ...data.dictionary.entries.map(e => [e.columnName, e.detectedType, e.businessMeaning, e.role, e.uniqueValues, e.nullCount, e.sampleValues.join(', ')])
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dictData), 'Data Dictionary');
  }

  // Chart data
  if (data.chartDataMap) {
    Object.entries(data.chartDataMap).forEach(([chartId, chartData]) => {
      const title = data.chartTitles?.[chartId] || chartId;
      if (chartData.length > 0) {
        const ws = XLSX.utils.json_to_sheet(chartData);
        XLSX.utils.book_append_sheet(wb, ws, title.substring(0, 31));
      }
    });
  }

  XLSX.writeFile(wb, 'ai-business-analyst-report.xlsx');
}

export function exportToCSV(data: ExportData): void {
  const ws = XLSX.utils.aoa_to_sheet([data.headers, ...data.rows]);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dashboard-data.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToJSON(data: ExportData): void {
  const jsonData = {
    generated: new Date().toISOString(),
    kpis: data.kpis,
    insights: data.insights,
    executiveReport: data.executiveReport,
    dataQuality: data.qualityResult,
    dataDictionary: data.dictionary,
    chartData: data.chartDataMap,
    data: data.rows.map(row => Object.fromEntries(data.headers.map((h, i) => [h, row[i]])))
  };
  const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ai-business-analyst-report.json';
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportToPPTX(data: ExportData): Promise<void> {
  const pptxgen = (await import('pptxgenjs')).default;
  const pres = new pptxgen();
  pres.defineLayout({ name: 'WIDE', width: 13.33, height: 7.5 });
  pres.layout = 'WIDE';

  // Title slide
  const titleSlide = pres.addSlide();
  titleSlide.background = { color: '1E3A5F' };
  titleSlide.addText('AI Business Analyst Report', { x: 0.5, y: 2.5, w: 12, h: 1.5, fontSize: 40, color: 'FFFFFF', bold: true, align: 'center' });
  titleSlide.addText(`Generated: ${new Date().toLocaleString()}`, { x: 0.5, y: 4, w: 12, h: 0.5, fontSize: 14, color: 'A7C4BC', align: 'center' });

  // Executive Summary slide
  if (data.executiveReport) {
    const execSlide = pres.addSlide();
    execSlide.addText('Executive Summary', { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 28, color: '1E3A5F', bold: true });
    execSlide.addText(data.executiveReport.executiveSummary, { x: 0.5, y: 1.2, w: 12, h: 2, fontSize: 14, color: '333333' });

    // KPI table
    const kpiRows: any[] = [['KPI', 'Value', 'Trend', 'Status']];
    data.executiveReport.kpiReview.forEach(k => {
      kpiRows.push([k.name, k.value, k.trend || 'N/A', k.status]);
    });
    execSlide.addTable(kpiRows as any, { x: 0.5, y: 3.5, w: 12, colW: [4, 3, 2, 3], fontSize: 11, border: { type: 'solid', color: 'CCCCCC' } });
  }

  // KPIs slide
  const kpiSlide = pres.addSlide();
  kpiSlide.addText('Key Performance Indicators', { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 28, color: '1E3A5F', bold: true });
  data.kpis.slice(0, 6).forEach((kpi, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.5 + col * 4.2;
    const y = 1.5 + row * 2.5;
    kpiSlide.addShape('rect', { x, y, w: 3.8, h: 2, fill: { color: 'F0F4F8' }, line: { color: '2563EB', width: 1 } });
    kpiSlide.addText(kpi.name, { x: x + 0.2, y: y + 0.2, w: 3.4, h: 0.4, fontSize: 12, color: '666666' });
    const valStr = kpi.format === 'currency' ? `$${kpi.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}` :
                   kpi.format === 'percentage' ? `${kpi.value.toFixed(1)}%` :
                   kpi.value.toLocaleString(undefined, { maximumFractionDigits: 0 });
    kpiSlide.addText(valStr, { x: x + 0.2, y: y + 0.6, w: 3.4, h: 0.8, fontSize: 24, color: '1E3A5F', bold: true });
    if (kpi.trend !== undefined) {
      kpiSlide.addText(`${kpi.trend >= 0 ? '+' : ''}${kpi.trend.toFixed(1)}%`, { x: x + 0.2, y: y + 1.4, w: 3.4, h: 0.4, fontSize: 14, color: kpi.trend >= 0 ? '10B981' : 'EF4444' });
    }
  });

  // Insights slide
  const insightsSlide = pres.addSlide();
  insightsSlide.addText('Key Insights', { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 28, color: '1E3A5F', bold: true });
  data.insights.slice(0, 6).forEach((insight, i) => {
    const y = 1.2 + i * 0.9;
    const color = insight.type === 'risk' ? 'EF4444' : insight.type === 'opportunity' ? '10B981' : insight.type === 'trend' ? '2563EB' : '8B5CF6';
    insightsSlide.addText(`${insight.title}`, { x: 0.5, y, w: 12, h: 0.3, fontSize: 14, bold: true, color });
    insightsSlide.addText(insight.description, { x: 0.5, y: y + 0.3, w: 12, h: 0.5, fontSize: 11, color: '666666' });
  });

  // Data Quality slide
  if (data.qualityResult) {
    const dqSlide = pres.addSlide();
    dqSlide.addText('Data Quality Assessment', { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 28, color: '1E3A5F', bold: true });
    dqSlide.addText(`Quality Score: ${data.qualityResult.qualityScore}/100`, { x: 0.5, y: 1.2, w: 6, h: 0.5, fontSize: 18, bold: true, color: data.qualityResult.qualityScore >= 70 ? '10B981' : 'EF4444' });
    const dqRows: any[] = [['Metric', 'Value'], ['Total Rows', String(data.qualityResult.totalRows)], ['Total Columns', String(data.qualityResult.totalColumns)], ['Null %', `${data.qualityResult.nullPercentage}%`], ['Duplicates', String(data.qualityResult.duplicateRecords)], ['Invalid Values', String(data.qualityResult.invalidValues)], ['Missing Dates', String(data.qualityResult.missingDates)]];
    dqSlide.addTable(dqRows as any, { x: 0.5, y: 2, w: 6, fontSize: 11, border: { type: 'solid', color: 'CCCCCC' } });
    dqSlide.addText('Remediation Recommendations', { x: 7, y: 2, w: 5.5, h: 0.4, fontSize: 14, bold: true, color: '1E3A5F' });
    data.qualityResult.remediation.slice(0, 5).forEach((r, i) => {
      dqSlide.addText(`[${r.severity}] ${r.issue}`, { x: 7, y: 2.5 + i * 0.7, w: 5.5, h: 0.3, fontSize: 10, bold: true, color: r.severity === 'high' ? 'EF4444' : r.severity === 'medium' ? 'F59E0B' : '10B981' });
      dqSlide.addText(r.recommendation, { x: 7, y: 2.8 + i * 0.7, w: 5.5, h: 0.4, fontSize: 9, color: '666666' });
    });
  }

  // Recommendations slide
  if (data.executiveReport) {
    const recSlide = pres.addSlide();
    recSlide.addText('Recommendations & Action Plan', { x: 0.5, y: 0.3, w: 12, h: 0.6, fontSize: 28, color: '1E3A5F', bold: true });
    data.executiveReport.recommendations.slice(0, 5).forEach((rec, i) => {
      recSlide.addText(`${rec.priority}. ${rec.action}`, { x: 0.5, y: 1.2 + i * 1.1, w: 12, h: 0.4, fontSize: 14, bold: true, color: '1E3A5F' });
      recSlide.addText(`Impact: ${rec.expectedImpact} | Timeline: ${rec.timeline}`, { x: 0.5, y: 1.6 + i * 1.1, w: 12, h: 0.3, fontSize: 11, color: '666666' });
    });
  }

  pres.writeFile({ fileName: 'ai-business-analyst-report.pptx' });
}
