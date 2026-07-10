export type ColumnRole = 'Measure' | 'Dimension' | 'Date' | 'Identifier';

export interface DataDictionaryEntry {
  columnName: string;
  detectedType: 'number' | 'text' | 'date' | 'boolean';
  businessMeaning: string;
  role: ColumnRole;
  uniqueValues: number;
  nullCount: number;
  sampleValues: string[];
}

export interface DataDictionary {
  entries: DataDictionaryEntry[];
  measures: string[];
  dimensions: string[];
  dates: string[];
  identifiers: string[];
}

function inferBusinessMeaning(colName: string, role: ColumnRole, type: string): string {
  const lower = colName.toLowerCase();
  const map: { pattern: RegExp; meaning: string }[] = [
    { pattern: /revenue|sales|income/, meaning: 'Financial revenue or sales amount' },
    { pattern: /cost|expense|spend/, meaning: 'Cost or expense value' },
    { pattern: /profit|margin/, meaning: 'Profitability metric' },
    { pattern: /amount|total|value/, meaning: 'Monetary or quantitative amount' },
    { pattern: /price/, meaning: 'Unit price' },
    { pattern: /fee|tax/, meaning: 'Fee or tax charge' },
    { pattern: /count|quantity|qty/, meaning: 'Count or quantity of items' },
    { pattern: /rate|percentage|ratio/, meaning: 'Rate or percentage metric' },
    { pattern: /growth|change|delta/, meaning: 'Growth or change indicator' },
    { pattern: /churn|attrition/, meaning: 'Customer churn or attrition rate' },
    { pattern: /region|area|zone|territory/, meaning: 'Geographic region or territory' },
    { pattern: /country|city|state/, meaning: 'Geographic location' },
    { pattern: /category|segment|group|class/, meaning: 'Categorical classification' },
    { pattern: /product|item|sku/, meaning: 'Product or item identifier' },
    { pattern: /customer|client|user/, meaning: 'Customer or client reference' },
    { pattern: /status|stage|state/, meaning: 'Process status or stage' },
    { pattern: /channel|platform|source/, meaning: 'Sales or communication channel' },
    { pattern: /date|month|year|quarter|week|period/, meaning: 'Time period or date' },
    { pattern: /id|key|ref/, meaning: 'Unique identifier' },
    { pattern: /name|label|title/, meaning: 'Descriptive name or label' },
  ];

  for (const m of map) {
    if (m.pattern.test(lower)) return m.meaning;
  }

  if (role === 'Measure') return 'Numeric measure or metric';
  if (role === 'Dimension') return 'Categorical dimension for grouping';
  if (role === 'Date') return 'Time-based field for trend analysis';
  if (role === 'Identifier') return 'Unique record identifier';
  return type === 'number' ? 'Numeric value' : 'Text field';
}

function detectType(values: string[]): 'number' | 'text' | 'date' | 'boolean' {
  const nonEmpty = values.filter(v => v && v.trim() !== '');
  if (nonEmpty.length === 0) return 'text';

  const numericCount = nonEmpty.filter(v => !isNaN(parseFloat(v))).length;
  if (numericCount > nonEmpty.length * 0.8) return 'number';

  const boolCount = nonEmpty.filter(v => /^(true|false|yes|no|y|n|0|1)$/i.test(v.trim())).length;
  if (boolCount > nonEmpty.length * 0.8) return 'boolean';

  const dateCount = nonEmpty.filter(v => !isNaN(Date.parse(v)) || /^\d{4}[-/]\d{1,2}/.test(v) || /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(v)).length;
  if (dateCount > nonEmpty.length * 0.7) return 'date';

  return 'text';
}

function detectRole(colName: string, type: string, uniqueCount: number, totalRows: number): ColumnRole {
  const lower = colName.toLowerCase();

  if (/^id$|_id$|id$|key$|ref$|code$/i.test(lower) || (uniqueCount === totalRows && type !== 'number')) {
    return 'Identifier';
  }
  if (/date|month|year|quarter|week|day|period|time/i.test(lower) || type === 'date') {
    return 'Date';
  }
  if (type === 'number' && !/id|key|ref|code/i.test(lower)) {
    return 'Measure';
  }
  return 'Dimension';
}

export function buildDataDictionary(headers: string[], rows: string[][]): DataDictionary {
  const entries: DataDictionaryEntry[] = [];
  const measures: string[] = [];
  const dimensions: string[] = [];
  const dates: string[] = [];
  const identifiers: string[] = [];

  headers.forEach((header, idx) => {
    const values = rows.map(r => r[idx]).filter(v => v !== undefined && v !== '');
    const type = detectType(values);
    const uniqueValues = new Set(values).size;
    const nullCount = rows.length - values.length;
    const role = detectRole(header, type, uniqueValues, rows.length);
    const sampleValues = [...new Set(values)].slice(0, 5);

    entries.push({
      columnName: header,
      detectedType: type,
      businessMeaning: inferBusinessMeaning(header, role, type),
      role,
      uniqueValues,
      nullCount,
      sampleValues
    });

    if (role === 'Measure') measures.push(header);
    else if (role === 'Dimension') dimensions.push(header);
    else if (role === 'Date') dates.push(header);
    else if (role === 'Identifier') identifiers.push(header);
  });

  return { entries, measures, dimensions, dates, identifiers };
}
