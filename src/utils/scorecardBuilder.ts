import {
  StockFinancialData,
  ThreeFinancialStatements,
  FinancialScorecardData,
  ScorecardItem,
} from '../types/stock';

// Standardize date to "YYYY-MM-DD"
export function normalizeDate(d: string): string {
  if (!d) return '';
  const clean = d.trim().replace(/\//g, '-');
  const match = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const y = match[1];
    const m = match[2].padStart(2, '0');
    const day = match[3].padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return clean;
}

// Helper to convert date "2025/12/31" or "2025-12-31" or "2025/9/30" to "2025Q4"
export function dateToQuarterLabel(dateStr: string): string {
  if (!dateStr) return '';
  if (/^\d{4}Q\d$/i.test(dateStr.trim())) return dateStr.trim().toUpperCase();

  const norm = normalizeDate(dateStr);
  const match = norm.match(/^(\d{4})-(\d{2})-(\d{2})$/);
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
  const match = qLabel.trim().toUpperCase().match(/^(\d{4})Q(\d)$/);
  if (!match) {
    if (qLabel.includes('/') || qLabel.includes('-')) {
      const parts = normalizeDate(qLabel).split('-');
      if (parts.length === 3) {
        return `${parts[0]}/${parts[1]}/${parts[2]}`;
      }
    }
    return qLabel;
  }
  const year = match[1];
  const q = match[2];
  if (q === '4') return `${year}/12/31`;
  if (q === '3') return `${year}/09/30`;
  if (q === '2') return `${year}/06/30`;
  if (q === '1') return `${year}/03/31`;
  return qLabel;
}

// Check if candidate date matches target date or target quarter
function isDateMatch(candidate: string, targetDate: string, targetQuarter: string): boolean {
  if (!candidate) return false;
  const normCand = normalizeDate(candidate);
  const normTarget = normalizeDate(targetDate);
  if (normCand && normTarget && normCand === normTarget) return true;
  if (targetQuarter && dateToQuarterLabel(candidate) === targetQuarter) return true;
  return false;
}

// Find indicator value in stock.metrics by target date / quarter
function findMetricValueByDate(
  stock: StockFinancialData,
  namePatterns: string[],
  targetDate: string,
  targetQuarter: string,
  fallbackIdx: number
): number | null {
  // 1. Try finding matching column by date/quarter in stock.reportDates
  let colIdx = -1;
  if (stock.reportDates && stock.reportDates.length > 0) {
    colIdx = stock.reportDates.findIndex(d => isDateMatch(d, targetDate, targetQuarter));
  }
  if (colIdx === -1 && fallbackIdx >= 0 && stock.reportDates && fallbackIdx < stock.reportDates.length) {
    colIdx = fallbackIdx;
  }
  if (colIdx === -1) return null;

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

// Find statement row value in 万元 by target date / quarter
function findStatementValueInWanByDate(
  statements: ThreeFinancialStatements | undefined,
  sheetType: 'balanceSheet' | 'incomeStatement' | 'cashFlowStatement',
  rowMatchers: string[],
  targetDate: string,
  targetQuarter: string,
  fallbackIdx: number
): number | null {
  if (!statements || !statements[sheetType]) return null;
  const sheet = statements[sheetType];

  let colIdx = -1;
  if (sheet.reportDates && sheet.reportDates.length > 0) {
    colIdx = sheet.reportDates.findIndex(d => isDateMatch(d, targetDate, targetQuarter));
  }
  if (colIdx === -1 && fallbackIdx >= 0 && sheet.reportDates && fallbackIdx < sheet.reportDates.length) {
    colIdx = fallbackIdx;
  }
  if (colIdx === -1) return null;

  const foundRow = sheet.rows.find(r => rowMatchers.some(m => r.label.includes(m)));
  if (!foundRow) return null;

  // Prefer valuesInYuan / 10000
  if (foundRow.valuesInYuan && foundRow.valuesInYuan[colIdx] !== undefined) {
    const valYuan = foundRow.valuesInYuan[colIdx];
    if (valYuan !== null && !isNaN(valYuan)) {
      return +(valYuan / 10000).toFixed(2);
    }
  }
  // Try rawValues (already formatted or string)
  if (foundRow.rawValues && foundRow.rawValues[colIdx] !== undefined) {
    const raw = foundRow.rawValues[colIdx];
    if (raw && raw !== '--') {
      const clean = raw.replace(/,/g, '').trim();
      const parsed = parseFloat(clean);
      if (!isNaN(parsed)) {
        // Check sheet unit: if Yuan, convert to Wan
        if (sheet.unit === '元' && Math.abs(parsed) > 1000) {
          return +(parsed / 10000).toFixed(2);
        }
        return parsed;
      }
    }
  }
  return null;
}

// Find raw value in Yuan from statement for ratio calculations
function findStatementValueInYuanByDate(
  statements: ThreeFinancialStatements | undefined,
  sheetType: 'balanceSheet' | 'incomeStatement' | 'cashFlowStatement',
  rowMatchers: string[],
  targetDate: string,
  targetQuarter: string,
  fallbackIdx: number
): number | null {
  if (!statements || !statements[sheetType]) return null;
  const sheet = statements[sheetType];

  let colIdx = -1;
  if (sheet.reportDates && sheet.reportDates.length > 0) {
    colIdx = sheet.reportDates.findIndex(d => isDateMatch(d, targetDate, targetQuarter));
  }
  if (colIdx === -1 && fallbackIdx >= 0 && sheet.reportDates && fallbackIdx < sheet.reportDates.length) {
    colIdx = fallbackIdx;
  }
  if (colIdx === -1) return null;

  const foundRow = sheet.rows.find(r => rowMatchers.some(m => r.label.includes(m)));
  if (!foundRow) return null;

  if (foundRow.valuesInYuan && foundRow.valuesInYuan[colIdx] !== undefined) {
    const valYuan = foundRow.valuesInYuan[colIdx];
    if (valYuan !== null && !isNaN(valYuan)) return valYuan;
  }
  if (foundRow.rawValues && foundRow.rawValues[colIdx] !== undefined) {
    const raw = foundRow.rawValues[colIdx];
    if (raw && raw !== '--') {
      const clean = raw.replace(/,/g, '').trim();
      const parsed = parseFloat(clean);
      if (!isNaN(parsed)) return parsed;
    }
  }
  return null;
}

export function buildFinancialScorecard(
  stock: StockFinancialData,
  statements?: ThreeFinancialStatements,
  selectedDatesOrQuarters?: string[],
  selectedYear?: string
): FinancialScorecardData {
  // Determine available quarters and dates from user selection or defaults
  let quarters: string[] = [];
  let reportDates: string[] = [];

  if (selectedDatesOrQuarters && selectedDatesOrQuarters.length > 0) {
    // User custom selection
    quarters = selectedDatesOrQuarters.map(d => dateToQuarterLabel(d));
    reportDates = selectedDatesOrQuarters.map(d => (/^\d{4}Q\d$/i.test(d) ? quarterLabelToDate(d) : d));
  } else if (statements?.balanceSheet?.reportDates && statements.balanceSheet.reportDates.length > 0) {
    // Use statement reportDates (up to 4)
    reportDates = statements.balanceSheet.reportDates.slice(0, 4);
    quarters = reportDates.map(dateToQuarterLabel);
  } else if (stock.reportDates && stock.reportDates.length > 0) {
    // Use stock reportDates (up to 4)
    reportDates = stock.reportDates.slice(0, 4);
    quarters = reportDates.map(dateToQuarterLabel);
  } else {
    // Fallback to 4 quarters of selectedYear
    const yr = selectedYear || stock.year || String(new Date().getFullYear());
    quarters = [`${yr}Q4`, `${yr}Q3`, `${yr}Q2`, `${yr}Q1`];
    reportDates = [`${yr}/12/31`, `${yr}/09/30`, `${yr}/06/30`, `${yr}/03/31`];
  }

  const numQuarters = quarters.length;

  // 1. 毛利率(%)
  const grossMarginVals: number[] = [];
  const grossMarginScores: number[] = [];
  for (let i = 0; i < numQuarters; i++) {
    const targetD = reportDates[i];
    const targetQ = quarters[i];
    let v = findMetricValueByDate(stock, ['主营业务利润率', '毛利率'], targetD, targetQ, i);
    if (v === null && statements) {
      const rev = findStatementValueInYuanByDate(statements, 'incomeStatement', ['营业收入', '营业总收入'], targetD, targetQ, i);
      const cost = findStatementValueInYuanByDate(statements, 'incomeStatement', ['营业成本', '营业总成本'], targetD, targetQ, i);
      if (rev && rev > 0 && cost !== null) {
        v = +(((rev - cost) / rev) * 100).toFixed(2);
      }
    }
    const finalV = v !== null ? +v.toFixed(2) : 0;
    grossMarginVals.push(finalV);

    // Score rules matching Image 2
    let s = 0;
    if (finalV >= 40) s = 5;
    else if (finalV >= 25) s = 4;
    else if (finalV >= 15) s = 3;
    else if (finalV > 0) s = 2;
    grossMarginScores.push(s);
  }

  // 2. 营业利润率(%)
  const opMarginVals: number[] = [];
  const opMarginScores: number[] = [];
  for (let i = 0; i < numQuarters; i++) {
    const targetD = reportDates[i];
    const targetQ = quarters[i];
    let v = findMetricValueByDate(stock, ['营业利润率'], targetD, targetQ, i);
    if (v === null && statements) {
      const rev = findStatementValueInYuanByDate(statements, 'incomeStatement', ['营业收入', '营业总收入'], targetD, targetQ, i);
      const opProfit = findStatementValueInYuanByDate(statements, 'incomeStatement', ['营业利润'], targetD, targetQ, i);
      if (rev && rev > 0 && opProfit !== null) {
        v = +((opProfit / rev) * 100).toFixed(2);
      }
    }
    const finalV = v !== null ? +v.toFixed(2) : 0;
    opMarginVals.push(finalV);

    let s = 3;
    if (finalV < 0) s = 0;
    opMarginScores.push(s);
  }

  // 3. 净利率(%)
  const netMarginVals: number[] = [];
  const netMarginScores: number[] = [];
  for (let i = 0; i < numQuarters; i++) {
    const targetD = reportDates[i];
    const targetQ = quarters[i];
    let v = findMetricValueByDate(stock, ['销售净利率', '净利润率'], targetD, targetQ, i);
    if (v === null && statements) {
      const rev = findStatementValueInYuanByDate(statements, 'incomeStatement', ['营业收入', '营业总收入'], targetD, targetQ, i);
      const netProfit = findStatementValueInYuanByDate(statements, 'incomeStatement', ['归属于母公司所有者净利润', '净利润'], targetD, targetQ, i);
      if (rev && rev > 0 && netProfit !== null) {
        v = +((netProfit / rev) * 100).toFixed(2);
      }
    }
    const finalV = v !== null ? +v.toFixed(2) : 0;
    netMarginVals.push(finalV);

    let s = 3;
    if (finalV < 0) s = 0;
    netMarginScores.push(s);
  }

  // 4. 净资产收益率(%)
  const roeVals: number[] = [];
  const roeScores: number[] = [];
  for (let i = 0; i < numQuarters; i++) {
    const targetD = reportDates[i];
    const targetQ = quarters[i];
    let v = findMetricValueByDate(stock, ['加权平均净资产收益率', '净资产报酬率', '净资产收益率'], targetD, targetQ, i);
    if (v === null && statements) {
      const equity = findStatementValueInYuanByDate(statements, 'balanceSheet', ['所有者权益', '股东权益', '归属于母公司所有者权益'], targetD, targetQ, i);
      const netProfit = findStatementValueInYuanByDate(statements, 'incomeStatement', ['归属于母公司所有者净利润', '净利润'], targetD, targetQ, i);
      if (equity && equity > 0 && netProfit !== null) {
        v = +((netProfit / equity) * 100).toFixed(2);
      }
    }
    const finalV = v !== null ? +v.toFixed(2) : 0;
    roeVals.push(finalV);

    let s = 3;
    if (finalV < 0) s = 0;
    roeScores.push(s);
  }

  // 5. 资产负债比率(%)
  const debtRatioVals: number[] = [];
  const debtRatioScores: number[] = [];
  for (let i = 0; i < numQuarters; i++) {
    const targetD = reportDates[i];
    const targetQ = quarters[i];
    let v = findMetricValueByDate(stock, ['资产负债率', '资产负债比率'], targetD, targetQ, i);
    if (v === null && statements) {
      const debt = findStatementValueInYuanByDate(statements, 'balanceSheet', ['负债总额', '负债合计'], targetD, targetQ, i);
      const totalAssets = findStatementValueInYuanByDate(statements, 'balanceSheet', ['资产总额', '资产总计'], targetD, targetQ, i);
      if (debt !== null && totalAssets && totalAssets > 0) {
        v = +((debt / totalAssets) * 100).toFixed(2);
      }
    }
    const finalV = v !== null ? +v.toFixed(2) : 0;
    debtRatioVals.push(finalV);

    let s = 5;
    if (finalV > 75) s = 1;
    else if (finalV > 65) s = 3;
    debtRatioScores.push(s);
  }

  // 6. 流动资产 / 总资产(%) (Red text in Image 1 & 2)
  const currentToTotalVals: number[] = [];
  const currentToTotalScores: number[] = [];
  for (let i = 0; i < numQuarters; i++) {
    const targetD = reportDates[i];
    const targetQ = quarters[i];
    const currAssets = findStatementValueInWanByDate(statements, 'balanceSheet', ['流动资产'], targetD, targetQ, i);
    const totalAssets = findStatementValueInWanByDate(statements, 'balanceSheet', ['资产总额', '资产总计'], targetD, targetQ, i);
    let ratio = 0;
    if (currAssets !== null && totalAssets && totalAssets > 0) {
      ratio = +((currAssets / totalAssets) * 100).toFixed(2);
    } else {
      const v = findMetricValueByDate(stock, ['流动资产比率', '流动资产'], targetD, targetQ, i);
      ratio = v !== null ? +v.toFixed(2) : 0;
    }
    currentToTotalVals.push(ratio);

    let s = ratio >= 40 ? 2 : 0;
    currentToTotalScores.push(s);
  }

  // 7. 存货周转率(%) / 次
  const inventoryTurnoverVals: number[] = [];
  const inventoryTurnoverScores: number[] = [];
  for (let i = 0; i < numQuarters; i++) {
    const targetD = reportDates[i];
    const targetQ = quarters[i];
    const v = findMetricValueByDate(stock, ['存货周转率'], targetD, targetQ, i) ?? 0;
    inventoryTurnoverVals.push(+v.toFixed(2));
    inventoryTurnoverScores.push(2);
  }

  // 8. 应收账款周转率(%) / 次
  const arTurnoverVals: number[] = [];
  const arTurnoverScores: number[] = [];
  for (let i = 0; i < numQuarters; i++) {
    const targetD = reportDates[i];
    const targetQ = quarters[i];
    const v = findMetricValueByDate(stock, ['应收账款周转率'], targetD, targetQ, i) ?? 0;
    arTurnoverVals.push(+v.toFixed(2));
    arTurnoverScores.push(2);
  }

  // 9. 经营活动净额(万元)
  const ocfVals: number[] = [];
  const ocfScores: number[] = [];
  for (let i = 0; i < numQuarters; i++) {
    const targetD = reportDates[i];
    const targetQ = quarters[i];
    let v = findStatementValueInWanByDate(
      statements,
      'cashFlowStatement',
      ['经营现金流净额', '经营活动产生的现金流量净额'],
      targetD,
      targetQ,
      i
    );
    if (v === null) {
      v = findMetricValueByDate(stock, ['经营活动现金净额', '每股经营活动现金流'], targetD, targetQ, i);
    }
    const finalV = v !== null ? +v.toFixed(2) : 0;
    ocfVals.push(finalV);

    let s = 5;
    if (finalV < 0) s = 0;
    ocfScores.push(s);
  }

  // 10. 投资活动净额(万元)
  const icfVals: number[] = [];
  const icfScores: number[] = [];
  for (let i = 0; i < numQuarters; i++) {
    const targetD = reportDates[i];
    const targetQ = quarters[i];
    const v = findStatementValueInWanByDate(
      statements,
      'cashFlowStatement',
      ['投资现金流净额', '投资活动产生的现金流量净额'],
      targetD,
      targetQ,
      i
    ) ?? 0;
    icfVals.push(+v.toFixed(2));
    icfScores.push(3);
  }

  // 11. 筹资活动净额(万元)
  const fcfVals: number[] = [];
  const fcfScores: number[] = [];
  for (let i = 0; i < numQuarters; i++) {
    const targetD = reportDates[i];
    const targetQ = quarters[i];
    const v = findStatementValueInWanByDate(
      statements,
      'cashFlowStatement',
      ['筹资现金流净额', '筹资活动产生的现金流量净额'],
      targetD,
      targetQ,
      i
    ) ?? 0;
    fcfVals.push(+v.toFixed(2));
    fcfScores.push(2);
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
