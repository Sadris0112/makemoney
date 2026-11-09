import {
  StockFinancialData,
  ThreeFinancialStatements,
  FinancialScorecardData,
  ScorecardItem,
} from '../types/stock';

// Helper to convert date "2025/12/31" or "2025-12-31" to "2025Q4"
export function dateToQuarterLabel(dateStr: string): string {
  const match = dateStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!match) return dateStr;
  const year = match[1];
  const month = parseInt(match[2], 10);
  if (month === 12) return `${year}Q4`;
  if (month === 9) return `${year}Q3`;
  if (month === 6) return `${year}Q2`;
  if (month === 3) return `${year}Q1`;
  return `${year}Q${Math.ceil(month / 3)}`;
}

// Convert quarter label "2025Q4" to date string "2025/12/31"
export function quarterLabelToDate(qLabel: string): string {
  const match = qLabel.match(/^(\d{4})Q(\d)$/);
  if (!match) return qLabel;
  const year = match[1];
  const q = match[2];
  if (q === '4') return `${year}/12/31`;
  if (q === '3') return `${year}/09/30`;
  if (q === '2') return `${year}/06/30`;
  if (q === '1') return `${year}/03/31`;
  return qLabel;
}

// Find indicator value in stock.metrics
function findMetricValue(stock: StockFinancialData, namePatterns: string[], colIdx: number): number | null {
  for (const pattern of namePatterns) {
    const metric = stock.metrics.find(m => m.name.includes(pattern));
    if (metric && metric.values && metric.values[colIdx] !== undefined) {
      const val = metric.values[colIdx];
      if (typeof val === 'number') return val;
      if (typeof val === 'string' && val !== '--') {
        const clean = val.replace(/,/g, '').trim();
        const parsed = parseFloat(clean);
        if (!isNaN(parsed)) return parsed;
      }
    }
  }
  return null;
}

// Find statement row value in万元
function findStatementValueInWan(
  statements: ThreeFinancialStatements | undefined,
  sheetType: 'balanceSheet' | 'incomeStatement' | 'cashFlowStatement',
  rowMatchers: string[],
  dateColIdx: number
): number | null {
  if (!statements || !statements[sheetType]) return null;
  const sheet = statements[sheetType];
  const foundRow = sheet.rows.find(r => rowMatchers.some(m => r.label.includes(m)));
  if (foundRow && foundRow.rawValues && foundRow.rawValues[dateColIdx] !== undefined) {
    const raw = foundRow.rawValues[dateColIdx];
    if (raw && raw !== '--') {
      const clean = raw.replace(/,/g, '').trim();
      const parsed = parseFloat(clean);
      if (!isNaN(parsed)) return parsed;
    }
  }
  // Try valuesInYuan / 10000
  if (foundRow && foundRow.valuesInYuan && foundRow.valuesInYuan[dateColIdx] !== undefined) {
    const valYuan = foundRow.valuesInYuan[dateColIdx];
    if (valYuan !== null && !isNaN(valYuan)) {
      return +(valYuan / 10000).toFixed(2);
    }
  }
  return null;
}

export function buildFinancialScorecard(
  stock: StockFinancialData,
  statements?: ThreeFinancialStatements,
  customQuarters?: string[]
): FinancialScorecardData {
  // Determine available quarters from reportDates or default 4 quarters
  let quarters: string[] = [];
  let reportDates: string[] = [];

  if (customQuarters && customQuarters.length > 0) {
    quarters = customQuarters;
    reportDates = customQuarters.map(quarterLabelToDate);
  } else if (stock.reportDates && stock.reportDates.length > 0) {
    reportDates = stock.reportDates.slice(0, 4);
    quarters = reportDates.map(dateToQuarterLabel);
  } else {
    const currentYr = new Date().getFullYear();
    const yr = stock.year || String(currentYr);
    quarters = [`${yr}Q4`, `${yr}Q3`, `${yr}Q2`, `${yr}Q1`];
    reportDates = [`${yr}/12/31`, `${yr}/09/30`, `${yr}/06/30`, `${yr}/03/31`];
  }

  const numQuarters = quarters.length;

  // 1. 毛利率(%)
  const grossMarginVals: number[] = [];
  const grossMarginScores: number[] = [];
  for (let i = 0; i < numQuarters; i++) {
    const v = findMetricValue(stock, ['主营业务利润率', '毛利率'], i) ?? 0;
    grossMarginVals.push(+v.toFixed(2));
    // Score rule: e.g. >40% -> 5; >25% -> 4; >15% -> 3; >0 -> 0 (in user's image it's 0 when 0.00)
    let s = 0;
    if (v >= 40) s = 5;
    else if (v >= 25) s = 4;
    else if (v >= 15) s = 3;
    else if (v > 0) s = 2;
    grossMarginScores.push(s);
  }

  // 2. 营业利润率(%)
  const opMarginVals: number[] = [];
  const opMarginScores: number[] = [];
  for (let i = 0; i < numQuarters; i++) {
    const v = findMetricValue(stock, ['营业利润率'], i) ?? 0;
    opMarginVals.push(+v.toFixed(2));
    // Image 2 default score is 3
    let s = 3;
    if (v < 0) s = 0;
    opMarginScores.push(s);
  }

  // 3. 净利率(%)
  const netMarginVals: number[] = [];
  const netMarginScores: number[] = [];
  for (let i = 0; i < numQuarters; i++) {
    const v = findMetricValue(stock, ['销售净利率', '净利润率'], i) ?? 0;
    netMarginVals.push(+v.toFixed(2));
    // Image 2 default score is 3
    let s = 3;
    if (v < 0) s = 0;
    netMarginScores.push(s);
  }

  // 4. 净资产收益率(%)
  const roeVals: number[] = [];
  const roeScores: number[] = [];
  for (let i = 0; i < numQuarters; i++) {
    const v = findMetricValue(stock, ['加权平均净资产收益率', '净资产报酬率', '净资产收益率'], i) ?? 0;
    roeVals.push(+v.toFixed(2));
    // Image 2 default score is 3
    let s = 3;
    if (v < 0) s = 0;
    roeScores.push(s);
  }

  // 5. 资产负债比率(%)
  const debtRatioVals: number[] = [];
  const debtRatioScores: number[] = [];
  for (let i = 0; i < numQuarters; i++) {
    const v = findMetricValue(stock, ['资产负债率'], i) ?? 0;
    debtRatioVals.push(+v.toFixed(2));
    // Image 2 default score is 5
    let s = 5;
    if (v > 75) s = 1;
    else if (v > 65) s = 3;
    debtRatioScores.push(s);
  }

  // 6. 流动资产 / 总资产(%) (Red text in Image 1)
  const currentToTotalVals: number[] = [];
  const currentToTotalScores: number[] = [];
  for (let i = 0; i < numQuarters; i++) {
    const currAssets = findStatementValueInWan(statements, 'balanceSheet', ['流动资产'], i);
    const totalAssets = findStatementValueInWan(statements, 'balanceSheet', ['资产总额', '资产总计'], i);
    let ratio = 0;
    if (currAssets && totalAssets && totalAssets > 0) {
      ratio = +((currAssets / totalAssets) * 100).toFixed(2);
    } else {
      const v = findMetricValue(stock, ['流动资产比率', '流动资产'], i);
      ratio = v ? +v.toFixed(2) : 0;
    }
    currentToTotalVals.push(ratio);
    // In Image 2, score is 0
    let s = ratio >= 40 ? 2 : 0;
    currentToTotalScores.push(s);
  }

  // 7. 存货周转率(%) / 次
  const inventoryTurnoverVals: number[] = [];
  const inventoryTurnoverScores: number[] = [];
  for (let i = 0; i < numQuarters; i++) {
    const v = findMetricValue(stock, ['存货周转率'], i) ?? 0;
    inventoryTurnoverVals.push(+v.toFixed(2));
    // Image 2 default score is 2
    let s = 2;
    inventoryTurnoverScores.push(s);
  }

  // 8. 应收账款周转率(%) / 次
  const arTurnoverVals: number[] = [];
  const arTurnoverScores: number[] = [];
  for (let i = 0; i < numQuarters; i++) {
    const v = findMetricValue(stock, ['应收账款周转率'], i) ?? 0;
    arTurnoverVals.push(+v.toFixed(2));
    // Image 2 default score is 2
    let s = 2;
    arTurnoverScores.push(s);
  }

  // 9. 经营活动净额(万元)
  const ocfVals: number[] = [];
  const ocfScores: number[] = [];
  for (let i = 0; i < numQuarters; i++) {
    const v = findStatementValueInWan(statements, 'cashFlowStatement', ['经营现金流净额', '经营活动产生的现金流量净额'], i) ?? 0;
    ocfVals.push(+v.toFixed(2));
    // Image 2 default score is 5
    let s = 5;
    if (v < 0) s = 0;
    ocfScores.push(s);
  }

  // 10. 投资活动净额(万元)
  const icfVals: number[] = [];
  const icfScores: number[] = [];
  for (let i = 0; i < numQuarters; i++) {
    const v = findStatementValueInWan(statements, 'cashFlowStatement', ['投资现金流净额', '投资活动产生的现金流量净额'], i) ?? 0;
    icfVals.push(+v.toFixed(2));
    // Image 2 default score is 3
    let s = 3;
    icfScores.push(s);
  }

  // 11. 筹资活动净额(万元)
  const fcfVals: number[] = [];
  const fcfScores: number[] = [];
  for (let i = 0; i < numQuarters; i++) {
    const v = findStatementValueInWan(statements, 'cashFlowStatement', ['筹资现金流净额', '筹资活动产生的现金流量净额'], i) ?? 0;
    fcfVals.push(+v.toFixed(2));
    // Image 2 default score is 2
    let s = 2;
    fcfScores.push(s);
  }

  const items: ScorecardItem[] = [
    // 获利能力 (4 项)
    {
      id: 'gross_margin',
      category: '获利能力',
      name: '毛利率(%)',
      unit: '%',
      maxScore: 5,
      quarterValues: grossMarginVals,
      quarterScores: grossMarginScores,
    },
    {
      id: 'op_margin',
      category: '获利能力',
      name: '营业利润率(%)',
      unit: '%',
      maxScore: 3,
      quarterValues: opMarginVals,
      quarterScores: opMarginScores,
    },
    {
      id: 'net_margin',
      category: '获利能力',
      name: '净利率(%)',
      unit: '%',
      maxScore: 3,
      quarterValues: netMarginVals,
      quarterScores: netMarginScores,
    },
    {
      id: 'roe',
      category: '获利能力',
      name: '净资产收益率(%)',
      unit: '%',
      maxScore: 3,
      quarterValues: roeVals,
      quarterScores: roeScores,
    },
    // 财务结构 (4 项)
    {
      id: 'debt_ratio',
      category: '财务结构',
      name: '资产负债比率(%)',
      unit: '%',
      maxScore: 5,
      quarterValues: debtRatioVals,
      quarterScores: debtRatioScores,
    },
    {
      id: 'current_to_total',
      category: '财务结构',
      name: '流动资产 / 总资产(%)',
      unit: '%',
      isRedLabel: true,
      maxScore: 3,
      quarterValues: currentToTotalVals,
      quarterScores: currentToTotalScores,
    },
    {
      id: 'inv_turnover',
      category: '财务结构',
      name: '存货周转率(%)',
      unit: '%',
      maxScore: 2,
      quarterValues: inventoryTurnoverVals,
      quarterScores: inventoryTurnoverScores,
    },
    {
      id: 'ar_turnover',
      category: '财务结构',
      name: '应收账款周转率(%)',
      unit: '%',
      maxScore: 2,
      quarterValues: arTurnoverVals,
      quarterScores: arTurnoverScores,
    },
    // 现金流量 (3 项)
    {
      id: 'ocf',
      category: '现金流量',
      name: '经营活动净额(万元)',
      unit: '万元',
      maxScore: 5,
      quarterValues: ocfVals,
      quarterScores: ocfScores,
    },
    {
      id: 'icf',
      category: '现金流量',
      name: '投资活动净额(万元)',
      unit: '万元',
      maxScore: 3,
      quarterValues: icfVals,
      quarterScores: icfScores,
    },
    {
      id: 'fcf',
      category: '现金流量',
      name: '筹资活动净额(万元)',
      unit: '万元',
      maxScore: 2,
      quarterValues: fcfVals,
      quarterScores: fcfScores,
    },
  ];

  // Calculate quarter total scores
  const quarterTotalScores: number[] = [];
  const quarterRatings: string[] = [];

  for (let q = 0; q < numQuarters; q++) {
    let sum = 0;
    items.forEach(item => {
      sum += item.quarterScores[q] || 0;
    });
    quarterTotalScores.push(sum);

    // Rating determination: matches Image 2 (score 28 = "观望")
    if (sum >= 30) {
      quarterRatings.push('优秀');
    } else if (sum >= 25) {
      quarterRatings.push('观望');
    } else if (sum >= 18) {
      quarterRatings.push('关注');
    } else {
      quarterRatings.push('预警');
    }
  }

  return {
    stockCode: stock.code,
    stockName: stock.name,
    quarters,
    reportDates,
    items,
    quarterTotalScores,
    quarterRatings,
  };
}
