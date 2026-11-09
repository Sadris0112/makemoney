export interface StockQuote {
  symbol: string;
  code: string;
  name: string;
  price: number;
  open: number;
  preClose: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
  peTTM: number | null;
  pb: number | null;
  totalMarketCap: number | null; // 亿元
  circulatingMarketCap: number | null; // 亿元
  industry: string;
  updateTime: string;
}

export interface FinancialMetric {
  category: string;
  name: string;
  values: (string | number)[];
}

export interface CoreSummary {
  reportDate: string;
  eps: string;
  bps: string;
  cashFlowPerShare: string;
  roe: string;
  netMargin: string;
  grossMargin: string;
  debtRatio: string;
  currentRatio: string;
  quickRatio: string;
  revenueGrowth: string;
  netProfitGrowth: string;
  turnoverRatio: string;
}

export interface StockFinancialData {
  code: string;
  symbol: string;
  name: string;
  year?: string;
  availableYears: string[];
  reportDates: string[];
  categories: string[];
  metrics: FinancialMetric[];
  quote?: StockQuote;
  coreSummary: CoreSummary;
}

export interface BatchQueryResult {
  success: boolean;
  stocks: StockFinancialData[];
  errors: { code: string; error: string }[];
  allMetricsCatalog: string[];
  queryTime: string;
}

export interface StockSuggestion {
  name: string;
  type: string;
  code: string;
  symbol: string;
  fullName: string;
}

export interface StatementRow {
  label: string;
  rawValues: string[]; // as reported in 万元, e.g. "5,169,061.09"
  valuesInYuan: (number | null)[]; // converted to 元, e.g. 51690610900
  formattedYuan: string[]; // formatted string with commas, e.g. "51,690,610,900.00"
}

export interface StatementData {
  title: string;
  unit: string;
  reportDates: string[]; // e.g. ["2025/12/31", "2025/09/30", "2025/6/30", "2025/3/31"]
  rows: StatementRow[];
}

export interface ThreeFinancialStatements {
  stockCode: string;
  stockName: string;
  year: string;
  availableYears: string[];
  balanceSheet: StatementData;
  incomeStatement: StatementData;
  cashFlowStatement: StatementData;
}

