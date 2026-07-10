export interface DataQualityResult {
  totalRows: number;
  totalColumns: number;
  nullPercentage: number;
  nullsByColumn: { column: string; nullCount: number; nullPercentage: number }[];
  duplicateRecords: number;
  duplicatePercentage: number;
  invalidValues: number;
  invalidValuesByColumn: { column: string; invalidCount: number }[];
  missingDates: number;
  qualityScore: number;
  remediation: { issue: string; recommendation: string; severity: 'high' | 'medium' | 'low' }[];
}

export function assessDataQuality(headers: string[], rows: string[][]): DataQualityResult {
  const totalRows = rows.length;
  const totalColumns = headers.length;
  const totalCells = totalRows * totalColumns;

  // Null analysis
  const nullsByColumn: { column: string; nullCount: number; nullPercentage: number }[] = [];
  let totalNulls = 0;

  headers.forEach((header, idx) => {
    let nullCount = 0;
    rows.forEach(row => {
      const val = row[idx];
      if (val === undefined || val === null || val.trim() === '' || val.toLowerCase() === 'null' || val.toLowerCase() === 'na' || val.toLowerCase() === 'n/a') {
        nullCount++;
      }
    });
    totalNulls += nullCount;
    nullsByColumn.push({
      column: header,
      nullCount,
      nullPercentage: totalRows > 0 ? (nullCount / totalRows) * 100 : 0
    });
  });

  const nullPercentage = totalCells > 0 ? (totalNulls / totalCells) * 100 : 0;

  // Duplicate analysis
  const seen = new Set<string>();
  let duplicateRecords = 0;
  rows.forEach(row => {
    const key = row.join('|');
    if (seen.has(key)) {
      duplicateRecords++;
    } else {
      seen.add(key);
    }
  });
  const duplicatePercentage = totalRows > 0 ? (duplicateRecords / totalRows) * 100 : 0;

  // Invalid values analysis (non-numeric in expected numeric columns, bad dates)
  const invalidValuesByColumn: { column: string; invalidCount: number }[] = [];
  let invalidValues = 0;

  headers.forEach((header, idx) => {
    const values = rows.map(r => r[idx]).filter(v => v !== undefined && v.trim() !== '');
    if (values.length === 0) return;

    const numericValues = values.map(v => parseFloat(v)).filter(n => !isNaN(n));
    const isNumericCol = numericValues.length > values.length * 0.6;

    let invalidCount = 0;
    if (isNumericCol) {
      values.forEach(v => {
        if (isNaN(parseFloat(v))) invalidCount++;
      });
    }

    if (/date|month|year|period|time/i.test(header)) {
      values.forEach(v => {
        if (!isNaN(Date.parse(v)) === false && !/^\d{4}[-/]\d{1,2}([-/]\d{1,2})?/.test(v) && !/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(v)) {
          invalidCount++;
        }
      });
    }

    if (invalidCount > 0) {
      invalidValuesByColumn.push({ column: header, invalidCount });
      invalidValues += invalidCount;
    }
  });

  // Missing dates
  let missingDates = 0;
  const dateColIdx = headers.findIndex(h => /date|month|year|period|time/i.test(h));
  if (dateColIdx !== -1) {
    rows.forEach(row => {
      const val = row[dateColIdx];
      if (!val || val.trim() === '') missingDates++;
    });
  }

  // Quality score (0-100)
  let qualityScore = 100;
  qualityScore -= nullPercentage * 0.5;
  qualityScore -= duplicatePercentage * 0.3;
  if (totalRows > 0) qualityScore -= (invalidValues / (totalRows * totalColumns)) * 100 * 0.2;
  if (dateColIdx !== -1 && totalRows > 0) qualityScore -= (missingDates / totalRows) * 100 * 0.1;
  qualityScore = Math.max(0, Math.min(100, Math.round(qualityScore)));

  // Remediation recommendations
  const remediation: DataQualityResult['remediation'] = [];

  nullsByColumn.forEach(col => {
    if (col.nullPercentage > 50) {
      remediation.push({
        issue: `Column "${col.column}" has ${col.nullPercentage.toFixed(1)}% missing values`,
        recommendation: `Consider dropping this column or implementing a data collection strategy to fill gaps. If critical, use imputation (mean/median for numeric, mode for categorical).`,
        severity: 'high'
      });
    } else if (col.nullPercentage > 20) {
      remediation.push({
        issue: `Column "${col.column}" has ${col.nullPercentage.toFixed(1)}% missing values`,
        recommendation: `Use imputation techniques or filter records with missing values for this column in analysis.`,
        severity: 'medium'
      });
    }
  });

  if (duplicatePercentage > 5) {
    remediation.push({
      issue: `${duplicateRecords} duplicate records detected (${duplicatePercentage.toFixed(1)}%)`,
      recommendation: `Deduplicate records before analysis. Use a unique identifier or composite key to identify and remove duplicates.`,
      severity: 'high'
    });
  } else if (duplicatePercentage > 1) {
    remediation.push({
      issue: `${duplicateRecords} duplicate records detected (${duplicatePercentage.toFixed(1)}%)`,
      recommendation: `Review and remove duplicate entries to ensure accurate aggregations.`,
      severity: 'medium'
    });
  }

  invalidValuesByColumn.forEach(col => {
    remediation.push({
      issue: `Column "${col.column}" has ${col.invalidCount} invalid values`,
      recommendation: `Cleanse invalid values. For numeric columns, remove or convert non-numeric entries. For date columns, standardize date formats.`,
      severity: col.invalidCount > totalRows * 0.1 ? 'high' : 'medium'
    });
  });

  if (missingDates > 0 && dateColIdx !== -1) {
    remediation.push({
      issue: `${missingDates} records missing date information`,
      recommendation: `Fill missing dates using sequential inference or exclude from time-series analysis.`,
      severity: missingDates > totalRows * 0.1 ? 'high' : 'low'
    });
  }

  if (remediation.length === 0) {
    remediation.push({
      issue: 'No significant data quality issues detected',
      recommendation: 'Data quality is good. Continue monitoring with regular quality checks.',
      severity: 'low'
    });
  }

  return {
    totalRows,
    totalColumns,
    nullPercentage: Math.round(nullPercentage * 10) / 10,
    nullsByColumn: nullsByColumn.sort((a, b) => b.nullPercentage - a.nullPercentage),
    duplicateRecords,
    duplicatePercentage: Math.round(duplicatePercentage * 10) / 10,
    invalidValues,
    invalidValuesByColumn,
    missingDates,
    qualityScore,
    remediation
  };
}
