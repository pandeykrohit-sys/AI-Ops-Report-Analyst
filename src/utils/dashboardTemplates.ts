export type TemplateType =
  | 'auto' | 'finance' | 'sales' | 'operations' | 'customer' | 'hr' | 'supplyChain';

export interface DashboardTemplate {
  id: TemplateType;
  name: string;
  description: string;
  icon: string;
  kpiPatterns: string[];
  dimensionPatterns: string[];
  chartTypes: { type: string; titlePattern: string }[];
  colorScheme: { primary: string; secondary: string; accent: string };
}

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  {
    id: 'auto',
    name: 'Auto Detect',
    description: 'Automatically detect the best dashboard configuration based on your data',
    icon: 'Sparkles',
    kpiPatterns: [],
    dimensionPatterns: [],
    chartTypes: [],
    colorScheme: { primary: '#2563eb', secondary: '#10b981', accent: '#f59e0b' }
  },
  {
    id: 'finance',
    name: 'Finance Analytics',
    description: 'Financial KPIs, revenue trends, cost analysis, and profitability metrics',
    icon: 'DollarSign',
    kpiPatterns: ['revenue', 'profit', 'cost', 'expense', 'margin', 'ebitda', 'cash', 'budget', 'amount', 'total', 'value'],
    dimensionPatterns: ['department', 'account', 'category', 'period', 'month', 'quarter', 'year'],
    chartTypes: [
      { type: 'bar', titlePattern: 'Revenue by Category' },
      { type: 'line', titlePattern: 'Profit Trend' },
      { type: 'donut', titlePattern: 'Cost Distribution' },
      { type: 'area', titlePattern: 'Cash Flow Over Time' }
    ],
    colorScheme: { primary: '#059669', secondary: '#0d9488', accent: '#84cc16' }
  },
  {
    id: 'sales',
    name: 'Sales Analytics',
    description: 'Sales performance, conversion rates, pipeline, and revenue by segment',
    icon: 'TrendingUp',
    kpiPatterns: ['revenue', 'sales', 'amount', 'deal', 'conversion', 'pipeline', 'quota', 'order', 'quantity'],
    dimensionPatterns: ['region', 'segment', 'product', 'channel', 'rep', 'team', 'month', 'quarter'],
    chartTypes: [
      { type: 'bar', titlePattern: 'Sales by Region' },
      { type: 'line', titlePattern: 'Sales Trend' },
      { type: 'pie', titlePattern: 'Segment Distribution' },
      { type: 'stackedBar', titlePattern: 'Sales by Product & Channel' }
    ],
    colorScheme: { primary: '#2563eb', secondary: '#7c3aed', accent: '#06b6d4' }
  },
  {
    id: 'operations',
    name: 'Operations Analytics',
    description: 'Operational efficiency, throughput, cycle times, and resource utilization',
    icon: 'Settings',
    kpiPatterns: ['count', 'duration', 'time', 'cycle', 'throughput', 'capacity', 'utilization', 'efficiency', 'rate'],
    dimensionPatterns: ['process', 'stage', 'status', 'facility', 'shift', 'line', 'operator', 'day', 'week'],
    chartTypes: [
      { type: 'bar', titlePattern: 'Throughput by Process' },
      { type: 'line', titlePattern: 'Cycle Time Trend' },
      { type: 'donut', titlePattern: 'Status Distribution' },
      { type: 'area', titlePattern: 'Capacity Utilization' }
    ],
    colorScheme: { primary: '#ea580c', secondary: '#dc2626', accent: '#fbbf24' }
  },
  {
    id: 'customer',
    name: 'Customer Analytics',
    description: 'Customer metrics, churn, retention, segmentation, and lifetime value',
    icon: 'Users',
    kpiPatterns: ['churn', 'retention', 'satisfaction', 'nps', 'lifecycle', 'lifetime', 'value', 'count', 'customer', 'user'],
    dimensionPatterns: ['segment', 'region', 'plan', 'tier', 'channel', 'demographic', 'age', 'month'],
    chartTypes: [
      { type: 'bar', titlePattern: 'Customers by Segment' },
      { type: 'line', titlePattern: 'Churn Trend' },
      { type: 'donut', titlePattern: 'Plan Distribution' },
      { type: 'area', titlePattern: 'Retention Over Time' }
    ],
    colorScheme: { primary: '#0891b2', secondary: '#6366f1', accent: '#ec4899' }
  },
  {
    id: 'hr',
    name: 'HR Analytics',
    description: 'Headcount, attrition, performance, compensation, and workforce metrics',
    icon: 'UserCheck',
    kpiPatterns: ['headcount', 'salary', 'compensation', 'attrition', 'performance', 'rating', 'score', 'count', 'hire', 'turnover'],
    dimensionPatterns: ['department', 'role', 'level', 'location', 'gender', 'manager', 'quarter', 'year'],
    chartTypes: [
      { type: 'bar', titlePattern: 'Headcount by Department' },
      { type: 'line', titlePattern: 'Attrition Trend' },
      { type: 'pie', titlePattern: 'Role Distribution' },
      { type: 'stackedBar', titlePattern: 'Performance by Department' }
    ],
    colorScheme: { primary: '#7c3aed', secondary: '#c026d3', accent: '#f59e0b' }
  },
  {
    id: 'supplyChain',
    name: 'Supply Chain Analytics',
    description: 'Inventory, delivery, supplier performance, and logistics metrics',
    icon: 'Truck',
    kpiPatterns: ['inventory', 'order', 'delivery', 'lead', 'stock', 'quantity', 'cost', 'shipment', 'defect', 'fulfillment'],
    dimensionPatterns: ['supplier', 'warehouse', 'region', 'product', 'category', 'route', 'carrier', 'month'],
    chartTypes: [
      { type: 'bar', titlePattern: 'Inventory by Warehouse' },
      { type: 'line', titlePattern: 'Delivery Performance Trend' },
      { type: 'donut', titlePattern: 'Supplier Distribution' },
      { type: 'area', titlePattern: 'Order Fulfillment Over Time' }
    ],
    colorScheme: { primary: '#0d9488', secondary: '#0891b2', accent: '#84cc16' }
  }
];

export function applyTemplate(
  template: DashboardTemplate,
  headers: string[]
): {
  selectedKPIs: string[];
  selectedDimensions: string[];
  chartConfigs: { type: string; title: string; dimension: string; metric: string }[];
} {
  if (template.id === 'auto') {
    return { selectedKPIs: [], selectedDimensions: [], chartConfigs: [] };
  }

  const selectedKPIs = headers.filter(h =>
    template.kpiPatterns.some(p => h.toLowerCase().includes(p))
  );

  const selectedDimensions = headers.filter(h =>
    template.dimensionPatterns.some(p => h.toLowerCase().includes(p))
  );

  const chartConfigs = template.chartTypes.map(ct => ({
    type: ct.type,
    title: ct.titlePattern,
    dimension: selectedDimensions[0] || headers[0],
    metric: selectedKPIs[0] || headers[0]
  }));

  return { selectedKPIs, selectedDimensions, chartConfigs };
}
