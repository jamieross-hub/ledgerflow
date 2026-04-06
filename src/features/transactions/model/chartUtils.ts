/**
 * 构建饼图圆锥梯度
 * @param segments 颜色与百分比段数组
 * @param minPercent 最小百分比阈值，低于此值的段会被过滤
 */
export function buildPieGradient(
  segments: Array<{ color: string; percent: number }>,
  minPercent = 0
): string {
  const normalized = segments
    .map((item) => ({
      color: item.color,
      percent: Number.isFinite(item.percent) ? Math.max(0, item.percent) : 0
    }))
    .filter((item) => item.percent > minPercent);

  const total = normalized.reduce((sum, item) => sum + item.percent, 0);
  if (!Number.isFinite(total) || total <= 0) {
    return 'none';
  }

  let cursor = 0;
  const gradientSegments = normalized.map((item) => {
    const normalizedPercent = (item.percent / total) * 100;
    const start = cursor;
    cursor += normalizedPercent;
    return `${item.color} ${start}% ${Math.min(100, cursor)}%`;
  });

  return gradientSegments.length ? `conic-gradient(${gradientSegments.join(',')})` : 'none';
}
