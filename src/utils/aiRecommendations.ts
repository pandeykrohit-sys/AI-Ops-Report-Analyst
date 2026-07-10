export interface AIRecommendation {
  topOpportunities: { title: string; description: string; potentialImpact: string }[];
  topRisks: { title: string; description: string; severity: 'high' | 'medium' | 'low'; mitigation: string }[];
  businessRecommendations: { title: string; description: string; priority: 'high' | 'medium' | 'low' }[];
  costReductionOpportunities: { area: string; description: string; estimatedSavings: string }[];
  revenueGrowthOpportunities: { area: string; description: string; estimatedUpside: string }[];
}

export function generateAIRecommendations(
  kpiData: { name: string; value: number; trend?: number; format: string }[],
  chartData: { [key: string]: { name: string; value: number }[] },
  insights: { type: string; title: string; description: string }[],
  qualityScore: number
): AIRecommendation {
  // Top Opportunities
  const topOpportunities = insights
    .filter(i => i.type === 'opportunity' || i.type === 'trend')
    .slice(0, 3)
    .map(i => ({
      title: i.title,
      description: i.description,
      potentialImpact: 'High'
    }));

  if (topOpportunities.length < 3) {
    const positiveTrends = kpiData.filter(k => k.trend && k.trend > 5);
    positiveTrends.forEach(k => {
      if (topOpportunities.length < 3) {
        topOpportunities.push({
          title: `${k.name} Growth Opportunity`,
          description: `${k.name} is trending up at ${k.trend!.toFixed(1)}%. This momentum can be accelerated with targeted investment.`,
          potentialImpact: 'Medium'
        });
      }
    });
  }

  // Top Risks
  const topRisks = insights
    .filter(i => i.type === 'risk')
    .slice(0, 3)
    .map(i => ({
      title: i.title,
      description: i.description,
      severity: /critical|severe/i.test(i.description) ? 'high' as const : /elevated|warning/i.test(i.description) ? 'medium' as const : 'low' as const,
      mitigation: `Address: ${i.title} - ${i.description}`
    }));

  if (topRisks.length < 3) {
    const negativeTrends = kpiData.filter(k => k.trend && k.trend < -5);
    negativeTrends.forEach(k => {
      if (topRisks.length < 3) {
        topRisks.push({
          title: `${k.name} Declining`,
          description: `${k.name} has decreased by ${Math.abs(k.trend!).toFixed(1)}% — requires investigation.`,
          severity: 'high',
          mitigation: `Investigate root causes of ${k.name} decline and implement corrective actions.`
        });
      }
    });
  }

  // Business Recommendations
  const businessRecommendations: AIRecommendation['businessRecommendations'] = [];

  if (qualityScore < 70) {
    businessRecommendations.push({
      title: 'Improve Data Quality',
      description: `Data quality score is ${qualityScore}/100. Clean and standardize data before deeper analysis.`,
      priority: 'high'
    });
  }

  Object.entries(chartData).forEach(([_, data]) => {
    if (data.length > 0) {
      const sorted = [...data].sort((a, b) => b.value - a.value);
      if (sorted.length >= 2) {
        const gap = sorted[0].value - sorted[sorted.length - 1].value;
        if (gap > sorted[0].value * 0.5) {
          businessRecommendations.push({
            title: `Address Performance Gap in ${sorted[sorted.length - 1].name}`,
            description: `Significant gap detected between top and bottom performers. Investigate and support underperforming segments.`,
            priority: 'medium'
          });
        }
      }
    }
  });

  businessRecommendations.push({
    title: 'Establish Continuous Monitoring',
    description: 'Set up regular tracking of key metrics with automated alerts for threshold breaches.',
    priority: 'medium'
  });

  // Cost Reduction Opportunities
  const costReductionOpportunities: AIRecommendation['costReductionOpportunities'] = [];

  kpiData.forEach(k => {
    if (/cost|expense|fee|tax|spend/i.test(k.name) && k.value > 0) {
      costReductionOpportunities.push({
        area: k.name,
        description: `${k.name} totals ${k.format === 'currency' ? '$' : ''}${k.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}. Review for optimization.`,
        estimatedSavings: '10-20%'
      });
    }
  });

  if (costReductionOpportunities.length === 0) {
    costReductionOpportunities.push({
      area: 'Operational Efficiency',
      description: 'Streamline processes and automate repetitive tasks to reduce operational overhead.',
      estimatedSavings: '5-15%'
    });
    costReductionOpportunities.push({
      area: 'Resource Allocation',
      description: 'Reallocate resources from underperforming segments to high-ROI areas.',
      estimatedSavings: '8-12%'
    });
  }

  // Revenue Growth Opportunities
  const revenueGrowthOpportunities: AIRecommendation['revenueGrowthOpportunities'] = [];

  kpiData.forEach(k => {
    if (/revenue|sales|income|amount|total|value/i.test(k.name) && k.trend && k.trend > 0) {
      revenueGrowthOpportunities.push({
        area: k.name,
        description: `${k.name} is growing at ${k.trend.toFixed(1)}%. Scale successful strategies to accelerate growth.`,
        estimatedUpside: '15-25%'
      });
    }
  });

  if (revenueGrowthOpportunities.length === 0) {
    revenueGrowthOpportunities.push({
      area: 'Top Performing Segments',
      description: 'Double down on high-performing segments by increasing investment and marketing spend.',
      estimatedUpside: '10-20%'
    });
    revenueGrowthOpportunities.push({
      area: 'Underperforming Segments',
      description: 'Targeted campaigns for underperforming segments can unlock new revenue streams.',
      estimatedUpside: '5-15%'
    });
  }

  return {
    topOpportunities,
    topRisks,
    businessRecommendations: businessRecommendations.slice(0, 5),
    costReductionOpportunities,
    revenueGrowthOpportunities
  };
}
