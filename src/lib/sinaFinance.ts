import {
  StockQuote,
  StockFinancialData,
  FinancialMetric,
  ThreeFinancialStatements,
  StatementData,
  StatementRow,
  StockSuggestion,
} from '../types/stock';

// Helper to determine market prefix for China A/B/BSE stocks
export function getSymbol(rawCode: string): string {
  const code = rawCode.trim().toLowerCase();
  if (code.startsWith('sh') || code.startsWith('sz') || code.startsWith('bj')) {
    return code;
  }
  if (/^\d{6}$/.test(code)) {
    if (code.startsWith('60') || code.startsWith('68') || code.startsWith('90')) {
      return 'sh' + code;
    } else if (code.startsWith('00') || code.startsWith('30') || code.startsWith('20')) {
      return 'sz' + code;
    } else if (code.startsWith('8') || code.startsWith('4') || code.startsWith('92')) {
      return 'bj' + code;
    }
  }
  return code;
}

export function getCleanCode(rawCode: string): string {
  const code = rawCode.trim();
  const match = code.match(/\d{6}/);
  return match ? match[0] : code.replace(/^(sh|sz|bj)/i, '');
}

// Fetch helper with Sina headers & GBK decode
export async function fetchSinaText(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Referer': 'https://finance.sina.com.cn/',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} fetching ${url}`);
    }
    const buf = await res.arrayBuffer();
    return new TextDecoder('gbk').decode(buf);
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchQuotes(symbols: string[]): Promise<Record<string, StockQuote>> {
  if (symbols.length === 0) return {};
  const cleanSymbols = symbols.map(getSymbol);
  const listParam = cleanSymbols.join(',');
  const listParamI = cleanSymbols.map(s => `${s}_i`).join(',');

  const [rawQuoteText, rawQuoteIText] = await Promise.all([
    fetchSinaText(`https://hq.sinajs.cn/list=${listParam}`).catch(() => ''),
    fetchSinaText(`https://hq.sinajs.cn/list=${listParamI}`).catch(() => ''),
  ]);

  const results: Record<string, StockQuote> = {};

  // Parse standard quotes
  const quoteLines = rawQuoteText.split(';');
  for (const line of quoteLines) {
    const match = line.match(/var\s+hq_str_([a-zA-Z0-9]+)="([^"]+)"/);
    if (!match) continue;
    const sym = match[1];
    const parts = match[2].split(',');
    if (parts.length < 30) continue;

    const name = parts[0];
    const open = parseFloat(parts[1]) || 0;
    const preClose = parseFloat(parts[2]) || 0;
    const price = parseFloat(parts[3]) || preClose;
    const high = parseFloat(parts[4]) || 0;
    const low = parseFloat(parts[5]) || 0;
    const volume = parseFloat(parts[8]) || 0; // shares
    const amount = parseFloat(parts[9]) || 0; // RMB
    const date = parts[30] || '';
    const time = parts[31] || '';

    const change = price && preClose ? +(price - preClose).toFixed(3) : 0;
    const changePercent = preClose ? +(((price - preClose) / preClose) * 100).toFixed(2) : 0;

    results[sym] = {
      symbol: sym,
      code: sym.replace(/^[a-zA-Z]+/, ''),
      name,
      price,
      open,
      preClose,
      change,
      changePercent,
      high,
      low,
      volume,
      amount,
      peTTM: null,
      pb: null,
      totalMarketCap: null,
      circulatingMarketCap: null,
      industry: '',
      updateTime: `${date} ${time}`.trim(),
    };
  }

  // Parse _i indicators
  const quoteILines = rawQuoteIText.split(';');
  for (const line of quoteILines) {
    const match = line.match(/var\s+hq_str_([a-zA-Z0-9]+)_i="([^"]+)"/);
    if (!match) continue;
    const sym = match[1];
    const parts = match[2].split(',');
    const quote = results[sym];
    if (!quote) continue;

    const eps = parseFloat(parts[2]) || 0;
    const bps = parseFloat(parts[5]) || 0;
    const totalCapWan = parseFloat(parts[7]) || 0; // 万股
    const circCapWan = parseFloat(parts[8]) || 0; // 万股
    const peFromI = parseFloat(parts[16]) || 0;
    const industry = parts[34] || '';

    const price = quote.price;
    if (totalCapWan > 0 && price > 0) {
      quote.totalMarketCap = +((totalCapWan * price) / 10000).toFixed(2); // 亿元
    }
    if (circCapWan > 0 && price > 0) {
      quote.circulatingMarketCap = +((circCapWan * price) / 10000).toFixed(2); // 亿元
    }
    if (peFromI > 0) {
      quote.peTTM = peFromI;
    } else if (eps > 0 && price > 0) {
      quote.peTTM = +(price / eps).toFixed(2);
    }
    if (bps > 0 && price > 0) {
      quote.pb = +(price / bps).toFixed(2);
    }
    if (industry) {
      quote.industry = industry;
    }
  }

  return results;
}

export async function fetchStockFinancials(rawCode: string, year?: string): Promise<StockFinancialData> {
  const cleanCode = getCleanCode(rawCode);
  const symbol = getSymbol(cleanCode);

  const url = year
    ? `https://money.finance.sina.com.cn/corp/go.php/vFD_FinancialGuideLine/stockid/${cleanCode}/ctrl/${year}/displaytype/4.phtml`
    : `https://money.finance.sina.com.cn/corp/go.php/vFD_FinancialGuideLine/stockid/${cleanCode}/displaytype/4.phtml`;

  const [html, quotes] = await Promise.all([
    fetchSinaText(url),
    fetchQuotes([symbol]).catch((): Record<string, StockQuote> => ({})),
  ]);

  const tableMatch = html.match(/<table[^>]*id="BalanceSheetNewTable0"[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) {
    throw new Error(`未找到股票代码 ${cleanCode} 的财务指标数据，请核对代码是否正确。`);
  }

  // Extract years
  const yearMatches = [...html.matchAll(/\/ctrl\/(\d{4})\//g)].map(x => x[1]);
  const availableYears = Array.from(new Set(yearMatches)).sort((a, b) => Number(b) - Number(a));

  // Extract company name from title
  let companyName = quotes[symbol]?.name || '';
  if (!companyName) {
    const titleMatch = html.match(/<title>([^(<]+)/i);
    companyName = titleMatch ? titleMatch[1].trim() : cleanCode;
  }

  const trMatches = [...tableMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  let reportDates: string[] = [];
  let currentCategory = '主要指标';
  const categoriesSet = new Set<string>();
  const metrics: FinancialMetric[] = [];

  for (const tr of trMatches) {
    const cells = [...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(td =>
      td[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
    );
    if (cells.length === 0) continue;

    if (cells[0] === '报告日期') {
      reportDates = cells.slice(1);
    } else if (cells.length === 1) {
      if (!cells[0].includes('财务指标') && cells[0].length > 1) {
        currentCategory = cells[0];
        categoriesSet.add(currentCategory);
      }
    } else if (cells.length > 1) {
      const metricName = cells[0];
      const values = cells.slice(1);
      categoriesSet.add(currentCategory);
      metrics.push({
        category: currentCategory,
        name: metricName,
        values,
      });
    }
  }

  // Build core summary from the latest available reporting column (index 0)
  const findValue = (namePrefixes: string[]): string => {
    for (const prefix of namePrefixes) {
      const found = metrics.find(m => m.name.includes(prefix));
      if (found && found.values.length > 0 && found.values[0] && found.values[0] !== '--') {
        return String(found.values[0]);
      }
    }
    return '--';
  };

  const coreSummary = {
    reportDate: reportDates[0] || '--',
    eps: findValue(['加权每股收益', '摊薄每股收益', '每股收益']),
    bps: findValue(['每股净资产_调整前', '每股净资产']),
    cashFlowPerShare: findValue(['每股经营性现金流', '每股现金流']),
    roe: findValue(['净资产报酬率', '加权平均净资产收益率', '净资产收益率']),
    netMargin: findValue(['销售净利率', '营业利润率']),
    grossMargin: findValue(['主营业务利润率', '毛利率']),
    debtRatio: findValue(['资产负债率']),
    currentRatio: findValue(['流动比率']),
    quickRatio: findValue(['速动比率']),
    revenueGrowth: findValue(['营业总收入增长率', '主营业务收入增长率']),
    netProfitGrowth: findValue(['净利润增长率']),
    turnoverRatio: findValue(['总资产周转率', '存货周转率']),
  };

  return {
    code: cleanCode,
    symbol,
    name: companyName,
    year: year || (availableYears[0] || ''),
    availableYears,
    reportDates,
    categories: Array.from(categoriesSet),
    metrics,
    quote: quotes[symbol],
    coreSummary,
  };
}

export const BALANCE_SHEET_TEMPLATE_ROWS = [
  { label: '货币资金', matchers: ['货币资金'] },
  { label: '应收账款', matchers: ['应收账款', '应收票据及应收账款'] },
  { label: '存货', matchers: ['存货'] },
  { label: '预付款项', matchers: ['预付款项'] },
  { label: '其他应收款', matchers: ['其他应收款', '其他应收款(合计)'] },
  { label: '流动资产', matchers: ['流动资产合计', '流动资产'] },
  { label: '可出售金融资产', matchers: ['可供出售金融资产', '交易性金融资产'] },
  { label: '无形资产', matchers: ['无形资产'] },
  { label: '固定资产', matchers: ['固定资产净额', '固定资产及清理(合计)', '固定资产'] },
  { label: '在建工程', matchers: ['在建工程', '在建工程(合计)'] },
  { label: '商誉', matchers: ['商誉'] },
  { label: '非流动资产', matchers: ['非流动资产合计', '非流动资产'] },
  { label: '资产总额', matchers: ['资产总计', '资产总额'] },
  { label: '短期借款', matchers: ['短期借款'] },
  { label: '应付账款', matchers: ['应付账款', '应付票据及应付账款'] },
  { label: '预收款款', matchers: ['预收款项', '预收款款'] },
  { label: '一年内到期非流动负债', matchers: ['一年内到期的非流动负债'] },
  { label: '流动负债', matchers: ['流动负债合计', '流动负债'] },
  { label: '长期借款', matchers: ['长期借款'] },
  { label: '非流动负债', matchers: ['非流动负债合计', '非流动负债'] },
  { label: '负债总额', matchers: ['负债合计', '负债总额'] },
  { label: '股本', matchers: ['实收资本(或股本)', '股本'] },
  { label: '资本公积', matchers: ['资本公积'] },
  { label: '盈余公积', matchers: ['盈余公积'] },
  { label: '未分配利润', matchers: ['未分配利润'] },
  { label: '归属于母公司所有者权益', matchers: ['归属于母公司股东权益合计', '归属于母公司所有者权益合计'] },
  { label: '少数股东权益', matchers: ['少数股东权益'] },
  { label: '所有者权益', matchers: ['所有者权益(或股东权益)合计', '所有者权益合计'] },
];

export const PROFIT_STATEMENT_TEMPLATE_ROWS = [
  { label: '一、营业总收入', matchers: ['一、营业总收入'] },
  { label: '营业收入', matchers: ['营业收入'] },
  { label: '二、营业总成本', matchers: ['二、营业总成本'] },
  { label: '营业成本', matchers: ['营业成本'] },
  { label: '销售费用', matchers: ['销售费用'] },
  { label: '管理费用', matchers: ['管理费用'] },
  { label: '财务费用', matchers: ['财务费用'] },
  { label: '投资收益', matchers: ['投资收益'] },
  { label: '三、营业利润', matchers: ['三、营业利润'] },
  { label: '加：营业外收入', matchers: ['加:营业外收入', '加：营业外收入', '营业外收入'] },
  { label: '减：营业外支出', matchers: ['减：营业外支出', '减:营业外支出', '营业外支出'] },
  { label: '四、利润总额', matchers: ['四、利润总额'] },
  { label: '减：所得税', matchers: ['减：所得税费用', '减:所得税费用', '所得税费用', '所得税'] },
  { label: '五、净利润', matchers: ['五、净利润'] },
  { label: '归属母公司所有者净利润', matchers: ['归属于母公司所有者的净利润', '归属于母公司股东的净利润'] },
  { label: '少数股东损益', matchers: ['少数股东损益'] },
];

export const CASH_FLOW_TEMPLATE_ROWS = [
  { label: '销售商品收现', matchers: ['销售商品、提供劳务收到的现金', '销售商品提供劳务收到的现金'] },
  { label: '经营现金流入', matchers: ['经营活动现金流入小计', '经营活动现金流入'] },
  { label: '经营现金流出', matchers: ['经营活动现金流出小计', '经营活动现金流出'] },
  { label: '经营现金流净额', matchers: ['经营活动产生的现金流量净额', '经营活动现金流量净额'] },
  { label: '投资现金流入', matchers: ['投资活动现金流入小计', '投资活动现金流入'] },
  { label: '投资现金流出', matchers: ['投资活动现金流出小计', '投资活动现金流出'] },
  { label: '投资现金流净额', matchers: ['投资活动产生的现金流量净额', '投资活动现金流量净额'] },
  { label: '筹资现金流入', matchers: ['筹资活动现金流入小计', '筹资活动现金流入'] },
  { label: '筹资现金流出', matchers: ['筹资活动现金流出小计', '筹资活动现金流出'] },
  { label: '筹资现金流净额', matchers: ['筹资活动产生的现金流量净额', '筹资活动现金流量净额'] },
  { label: '汇率变动对现金的影响', matchers: ['四、汇率变动对现金及现金等价物的影响', '汇率变动对现金的影响', '四、汇率变动对现金的影响'] },
  { label: '现金及现金等价物净增加额', matchers: ['五、现金及现金等价物净增加额', '现金及现金等价物净增加额'] },
  { label: '期末现金及现金等价物余额', matchers: ['六、期末现金及现金等价物余额', '期末现金及现金等价物余额'] },
];

export function formatStatementDate(rawDate: string): string {
  const match = rawDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const yr = match[1];
    const m = match[2];
    const d = match[3];
    const displayMonth = m === '06' ? '6' : (m === '03' ? '3' : m);
    return `${yr}/${displayMonth}/${d}`;
  }
  return rawDate.replace(/-/g, '/');
}

export function parseMoneyToYuan(rawStr: string): { yuanNum: number | null; formattedYuan: string } {
  if (!rawStr || rawStr === '--') {
    return { yuanNum: null, formattedYuan: '--' };
  }
  const clean = rawStr.replace(/,/g, '').trim();
  const numWan = parseFloat(clean);
  if (isNaN(numWan)) {
    return { yuanNum: null, formattedYuan: rawStr };
  }
  const yuan = numWan * 10000;
  const formatted = yuan.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return { yuanNum: yuan, formattedYuan: formatted };
}

export async function fetchThreeStatements(
  rawCode: string,
  year?: string
): Promise<ThreeFinancialStatements> {
  const cleanCode = getCleanCode(rawCode);
  const symbol = getSymbol(cleanCode);

  let availableYears: string[] = [];
  try {
    const guideText = await fetchSinaText(
      `https://money.finance.sina.com.cn/corp/go.php/vFD_FinancialGuideLine/stockid/${cleanCode}/displaytype/4.phtml`
    );
    const yearMatches = [...guideText.matchAll(/\/ctrl\/(\d{4})\//g)].map(x => x[1]);
    availableYears = Array.from(new Set(yearMatches)).sort((a, b) => Number(b) - Number(a));
  } catch {
    availableYears = ['2026', '2025', '2024', '2023', '2022', '2021', '2020'];
  }

  const targetYears = year
    ? year.split(',').map(y => y.trim()).filter(Boolean)
    : [availableYears[0] || '2025'];

  const fetchPromises: Promise<any>[] = [
    fetchQuotes([symbol]).catch((): Record<string, StockQuote> => ({})),
  ];

  targetYears.forEach(yr => {
    fetchPromises.push(
      fetchSinaText(
        `https://money.finance.sina.com.cn/corp/go.php/vFD_BalanceSheet/stockid/${cleanCode}/ctrl/${yr}/displaytype/4.phtml`
      ).catch(() => '')
    );
    fetchPromises.push(
      fetchSinaText(
        `https://money.finance.sina.com.cn/corp/go.php/vFD_ProfitStatement/stockid/${cleanCode}/ctrl/${yr}/displaytype/4.phtml`
      ).catch(() => '')
    );
    fetchPromises.push(
      fetchSinaText(
        `https://money.finance.sina.com.cn/corp/go.php/vFD_CashFlow/stockid/${cleanCode}/ctrl/${yr}/displaytype/4.phtml`
      ).catch(() => '')
    );
  });

  const allResults = await Promise.all(fetchPromises);
  const quotes = allResults[0] as Record<string, StockQuote>;
  const companyName = quotes[symbol]?.name || cleanCode;

  function parseHtmlTable(html: string, tableId: string) {
    const m = html.match(new RegExp(`<table[^>]*id="${tableId}"[^>]*>([\\s\\S]*?)<\\/table>`, 'i'));
    if (!m) return { dates: [] as string[], map: {} as Record<string, string[]> };
    const trMatches = [...m[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
    let dates: string[] = [];
    const map: Record<string, string[]> = {};
    for (const tr of trMatches) {
      const tds = [...tr[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(td =>
        td[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
      );
      if (tds.length === 0) continue;
      if (tds[0] === '报表日期' || tds[0] === '报告日期') {
        dates = tds.slice(1);
      } else if (tds.length > 1) {
        map[tds[0]] = tds.slice(1);
      }
    }
    return { dates, map };
  }

  const allRawDates: string[] = [];
  const mergedBalanceMap: Record<string, Record<string, string>> = {};
  const mergedProfitMap: Record<string, Record<string, string>> = {};
  const mergedCashMap: Record<string, Record<string, string>> = {};

  targetYears.forEach((_yr, yrIdx) => {
    const bHtml = (allResults[1 + yrIdx * 3] as string) || '';
    const pHtml = (allResults[2 + yrIdx * 3] as string) || '';
    const cHtml = (allResults[3 + yrIdx * 3] as string) || '';

    const bData = parseHtmlTable(bHtml, 'BalanceSheetNewTable0');
    const pData = parseHtmlTable(pHtml, 'ProfitStatementNewTable0');
    const cData = parseHtmlTable(cHtml, 'ProfitStatementNewTable0');

    const yearDates = bData.dates.length > 0 ? bData.dates : (pData.dates.length > 0 ? pData.dates : cData.dates);

    yearDates.forEach((d, colIdx) => {
      if (!allRawDates.includes(d)) {
        allRawDates.push(d);
      }
      for (const [k, vals] of Object.entries(bData.map)) {
        if (!mergedBalanceMap[k]) mergedBalanceMap[k] = {};
        mergedBalanceMap[k][d] = vals[colIdx] || '--';
      }
      for (const [k, vals] of Object.entries(pData.map)) {
        if (!mergedProfitMap[k]) mergedProfitMap[k] = {};
        mergedProfitMap[k][d] = vals[colIdx] || '--';
      }
      for (const [k, vals] of Object.entries(cData.map)) {
        if (!mergedCashMap[k]) mergedCashMap[k] = {};
        mergedCashMap[k][d] = vals[colIdx] || '--';
      }
    });
  });

  allRawDates.sort((a, b) => (a < b ? 1 : -1));
  const formattedDates = allRawDates.map(formatStatementDate);

  function buildStatement(
    title: string,
    templateRows: { label: string; matchers: string[] }[],
    dataMap: Record<string, Record<string, string>>
  ): StatementData {
    const rows: StatementRow[] = templateRows.map(item => {
      let matchedKey = '';
      for (const matcher of item.matchers) {
        if (dataMap[matcher]) {
          matchedKey = matcher;
          break;
        }
      }
      if (!matchedKey) {
        const foundKey = Object.keys(dataMap).find(k => k.includes(item.label) || item.matchers.some(m => k.includes(m)));
        if (foundKey) matchedKey = foundKey;
      }

      const dateValuesMap = matchedKey ? dataMap[matchedKey] || {} : {};

      const rawValues: string[] = [];
      const valuesInYuan: (number | null)[] = [];
      const formattedYuan: string[] = [];

      for (let i = 0; i < allRawDates.length; i++) {
        const d = allRawDates[i];
        const rawVal = dateValuesMap[d] || '--';
        const parsed = parseMoneyToYuan(rawVal);
        rawValues.push(rawVal);
        valuesInYuan.push(parsed.yuanNum);
        formattedYuan.push(parsed.formattedYuan);
      }

      return {
        label: item.label,
        rawValues,
        valuesInYuan,
        formattedYuan,
      };
    });

    return {
      title,
      unit: '元',
      reportDates: formattedDates,
      rows,
    };
  }

  return {
    stockCode: cleanCode,
    stockName: companyName,
    year: targetYears.join(','),
    availableYears,
    balanceSheet: buildStatement('资产负债表 ( 元 )', BALANCE_SHEET_TEMPLATE_ROWS, mergedBalanceMap),
    incomeStatement: buildStatement('利润表 ( 元 )', PROFIT_STATEMENT_TEMPLATE_ROWS, mergedProfitMap),
    cashFlowStatement: buildStatement('现金流量表 ( 元 )', CASH_FLOW_TEMPLATE_ROWS, mergedCashMap),
  };
}

export async function fetchSuggestions(query: string): Promise<StockSuggestion[]> {
  const cleanQ = query.trim();
  if (!cleanQ) return [];

  const rawText = await fetchSinaText(
    `https://suggest3.sinajs.cn/suggest/type=11,12,13,14,15&key=${encodeURIComponent(cleanQ)}`
  );
  const match = rawText.match(/var\s+suggestvalue="([^"]*)"/);
  if (!match || !match[1]) return [];

  const items = match[1].split(';').filter(Boolean);
  return items.map(item => {
    const parts = item.split(',');
    return {
      name: parts[0] || '',
      type: parts[1] || '',
      code: parts[2] || '',
      symbol: parts[3] || '',
      fullName: parts[4] || parts[0] || '',
    };
  });
}
