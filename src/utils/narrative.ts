export interface ChartNarrative {
  chartTitle: string;
  whatHappened: string;
  whyItHappened: string;
  businessImpact: string;
  suggestedAction: string;
}

export function generateChartNarrative(
  chartTitle: string,
  chartData: { name: string; value: number; count?: number }[],
  dimension: string,
  metric: string
): ChartNarrative {
  if (chartData.length === 0) {
    return {
      chartTitle,
      whatHappened: 'No data available for this chart.',
      whyItHappened: 'The dataset may be empty or the selected dimension has no values.',
      businessImpact: 'Unable to assess impact without data.',
      suggestedAction: 'Verify data availability and dimension selection.'
    };
  }

  const sorted = [...chartData].sort((a, b) => b.value - a.value);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];
  const total = chartData.reduce((a, b) => a + b.value, 0);
  const topShare = total > 0 ? (top.value / total) * 100 : 0;
  const bottomShare = total > 0 ? (bottom.value / total) * 100 : 0;
  const gap = top.value - bottom.value;
  const gapPercent = bottom.value !== 0 ? (gap / Math.abs(bottom.value)) * 100 : 0;

  const whatHappened = `${top.name} leads in ${metric} with ${top.value.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${topShare.toFixed(1)}% of total), while ${bottom.name} has the lowest at ${bottom.value.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${bottomShare.toFixed(1)}%).`;

  const whyItHappened = topShare > 50
    ? `${top.name} dominates with over half the total, suggesting strong market concentration or superior performance in this segment.`
    : topShare > 30
    ? `${top.name} holds a significant share, indicating a leading position. The distribution shows moderate concentration.`
    : `The ${dimension} distribution is relatively balanced, with ${top.name} slightly ahead. No single segment dominates.`;

  const businessImpact = gapPercent > 100
    ? `High variance (${gapPercent.toFixed(0)}% gap between top and bottom) indicates significant performance disparity. Focusing on underperforming segments could yield substantial gains.`
    : gapPercent > 50
    ? `Moderate variance exists. The gap between top and bottom performers suggests room for improvement in lower segments.`
    : `Low variance across ${dimension}. Performance is relatively uniform, suggesting consistent execution.`;

  const suggestedAction = topShare > 50
    ? `Maintain ${top.name}'s lead while developing strategies to boost ${bottom.name}. Investigate what drives ${top.name}'s success and replicate.`
    : bottomShare < 10
    ? `${bottom.name} is significantly underperforming. Consider targeted intervention or resource reallocation to improve this segment.`
    : `Continue monitoring all segments. Focus optimization efforts on moving average performers above the current top.`;

  return { chartTitle, whatHappened, whyItHappened, businessImpact, suggestedAction };
}
