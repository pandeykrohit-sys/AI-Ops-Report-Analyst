export interface ExecutiveReport {
  executiveSummary: string;
  kpiReview: { name: string; value: string; trend?: string; status: 'good' | 'warning' | 'critical'; insight: string }[];
  trends: { description: string; direction: 'up' | 'down' | 'stable'; impact: 'positive' | 'negative' | 'neutral' }[];
  risks: { title: string; description: string; severity: 'high' | 'medium' | 'low'; mitigation: string }[];
  opportunities: { title: string; description: string; potential: string }[];
  recommendations: { priority: number; action: string; expectedImpact: string; timeline: string }[];
  actionPlan: { phase: string; actions: string[]; timeline: string }[];
}

export function generateExecutiveReport(
  kpiData: { name: string; value: number; trend?: number; format: string }[],
  insights: { type: string; title: string; description: string }[],
  totalRecords: number,
  totalColumns: number
): ExecutiveReport {
  // Executive Summary
  const positiveTrends = kpiData.filter(k => k.trend && k.trend > 0).length;
  const negativeTrends = kpiData.filter(k => k.trend && k.trend < 0).length;
  const topKPI = kpiData[0];

  const executiveSummary = `Analysis of ${totalRecords.toLocaleString()} records across ${totalColumns} data dimensions reveals ${
    positiveTrends > negativeTrends ? 'generally positive' : negativeTrends > positiveTrends ? 'concerning' : 'stable'
  } business performance. ${positiveTrends} key metrics trending upward, ${negativeTrends} declining. ${
    topKPI ? `Primary metric ${topKPI.name} stands at ${topKPI.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}.` : ''
  } ${insights.filter(i => i.type === 'risk').length} risks and ${insights.filter(i => i.type === 'opportunity').length} opportunities identified.`;

  // KPI Review
  const kpiReview = kpiData.map(kpi => {
    const status = kpi.trend !== undefined
      ? kpi.trend > 5 ? 'good' as const : kpi.trend < -5 ? 'critical' as const : 'warning' as const
      : 'good' as const;
    const insight = status === 'good'
      ? `Strong performance with ${kpi.trend ? `+${kpi.trend.toFixed(1)}%` : 'stable'} trend. Maintain current strategy.`
      : status === 'critical'
      ? `Declining at ${kpi.trend ? `${kpi.trend.toFixed(1)}%` : 'unknown rate'}. Immediate intervention needed.`
      : `Moderate performance. Monitor closely for trend changes.`;

    return {
      name: kpi.name,
      value: kpi.format === 'currency'
        ? `$${kpi.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
        : kpi.format === 'percentage'
        ? `${kpi.value.toFixed(1)}%`
        : kpi.value.toLocaleString(undefined, { maximumFractionDigits: 0 }),
      trend: kpi.trend ? `${kpi.trend >= 0 ? '+' : ''}${kpi.trend.toFixed(1)}%` : undefined,
      status,
      insight
    };
  });

  // Trends
  const trends = kpiData
    .filter(k => k.trend !== undefined)
    .map(k => ({
      description: `${k.name} ${k.trend! >= 0 ? 'increasing' : 'decreasing'} at ${Math.abs(k.trend!).toFixed(1)}%`,
      direction: k.trend! > 0 ? 'up' as const : k.trend! < 0 ? 'down' as const : 'stable' as const,
      impact: k.trend! > 0 ? 'positive' as const : 'negative' as const
    }));

  // Risks
  const risks = insights
    .filter(i => i.type === 'risk')
    .slice(0, 5)
    .map(i => ({
      title: i.title,
      description: i.description,
      severity: /critical|severe|high/i.test(i.description) ? 'high' as const : /elevated|warning/i.test(i.description) ? 'medium' as const : 'low' as const,
      mitigation: `Investigate root causes and implement corrective measures for: ${i.title}`
    }));

  if (risks.length === 0) {
    risks.push({
      title: 'No Critical Risks Identified',
      description: 'Current data does not reveal significant risk factors.',
      severity: 'low',
      mitigation: 'Continue regular monitoring and establish early warning alerts.'
    });
  }

  // Opportunities
  const opportunities = insights
    .filter(i => i.type === 'opportunity' || i.type === 'finding')
    .slice(0, 5)
    .map(i => ({
      title: i.title,
      description: i.description,
      potential: 'High' // Simplified
    }));

  if (opportunities.length === 0) {
    opportunities.push({
      title: 'Data-Driven Optimization',
      description: 'Leverage current data patterns to identify optimization opportunities.',
      potential: 'Medium'
    });
  }

  // Recommendations
  const recommendations = [
    { priority: 1, action: 'Address identified risks immediately', expectedImpact: 'Prevent metric decline', timeline: '1-2 weeks' },
    { priority: 2, action: 'Capitalize on growth opportunities in top-performing segments', expectedImpact: 'Increase revenue by 10-15%', timeline: '1-3 months' },
    { priority: 3, action: 'Implement regular monitoring for key metrics', expectedImpact: 'Early detection of issues', timeline: 'Ongoing' },
    { priority: 4, action: 'Investigate underperforming areas for root causes', expectedImpact: 'Targeted improvement', timeline: '2-4 weeks' },
    { priority: 5, action: 'Align resources to high-performing segments', expectedImpact: 'Maximize ROI', timeline: '1-2 months' }
  ];

  // Action Plan
  const actionPlan = [
    {
      phase: 'Phase 1: Immediate Actions (1-2 weeks)',
      actions: risks.slice(0, 2).map(r => r.mitigation),
      timeline: '1-2 weeks'
    },
    {
      phase: 'Phase 2: Short-term Initiatives (1-3 months)',
      actions: opportunities.slice(0, 2).map(o => `Develop strategy for: ${o.title}`),
      timeline: '1-3 months'
    },
    {
      phase: 'Phase 3: Long-term Strategy (3-12 months)',
      actions: ['Establish continuous monitoring framework', 'Regular review of KPI performance', 'Iterative optimization based on data insights'],
      timeline: '3-12 months'
    }
  ];

  return { executiveSummary, kpiReview, trends, risks, opportunities, recommendations, actionPlan };
}
