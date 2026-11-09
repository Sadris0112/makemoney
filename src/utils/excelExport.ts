import ExcelJS from 'exceljs';
import { StockFinancialData, ThreeFinancialStatements, StatementData } from '../types/stock';

export interface ExcelExportOptions {
  fileName?: string;
  // Options for 3 financial statements matching the user's images
  includeStatementSheets?: boolean;
  statements?: ThreeFinancialStatements;
  selectedDates?: string[]; // Custom selected reporting dates to export
  // General summary options
  includeSummarySheet?: boolean;
  includeMatrixSheet?: boolean;
  includeDetailSheets?: boolean;
  includeDefinitionsSheet?: boolean;
  selectedMetrics?: string[];
}

const TEAL_HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF3E96B5' }, // Teal-cyan from user screenshot
};

const TEAL_HEADER_FONT: Partial<ExcelJS.Font> = {
  name: 'Microsoft YaHei',
  size: 11,
  bold: true,
  color: { argb: 'FFFFFFFF' },
};

const BORDER_STYLE: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF9AC7D7' } },
  left: { style: 'thin', color: { argb: 'FF9AC7D7' } },
  bottom: { style: 'thin', color: { argb: 'FF9AC7D7' } },
  right: { style: 'thin', color: { argb: 'FF9AC7D7' } },
};

// Helper to filter statement data by selected dates
export function filterStatementByDates(
  statement: StatementData,
  selectedDates?: string[]
): StatementData {
  if (!selectedDates || selectedDates.length === 0) {
    return statement;
  }

  // Find index map
  const activeIndices: number[] = [];
  const filteredDates: string[] = [];

  statement.reportDates.forEach((d, idx) => {
    if (selectedDates.includes(d)) {
      activeIndices.push(idx);
      filteredDates.push(d);
    }
  });

  if (activeIndices.length === 0) {
    return statement; // fallback to all if none matched
  }

  const filteredRows = statement.rows.map(r => ({
    label: r.label,
    rawValues: activeIndices.map(i => r.rawValues[i] || '--'),
    valuesInYuan: activeIndices.map(i => (r.valuesInYuan[i] !== undefined ? r.valuesInYuan[i] : null)),
    formattedYuan: activeIndices.map(i => r.formattedYuan[i] || '--'),
  }));

  return {
    title: statement.title,
    unit: statement.unit,
    reportDates: filteredDates,
    rows: filteredRows,
  };
}

function addStyledStatementSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  statement: StatementData,
  selectedDates?: string[]
) {
  const filtered = filterStatementByDates(statement, selectedDates);
  const ws = wb.addWorksheet(sheetName, {
    views: [{ showGridLines: true }],
  });

  // Header Row: e.g. ["资产负债表 ( 元 )", "2025/12/31", "2025/09/30", "2025/6/30", "2025/3/31"]
  const headerValues = [filtered.title, ...filtered.reportDates];
  const headerRow = ws.addRow(headerValues);
  headerRow.height = 26;

  headerRow.eachCell((cell, colNum) => {
    cell.fill = TEAL_HEADER_FILL;
    cell.font = TEAL_HEADER_FONT;
    cell.border = BORDER_STYLE;
    cell.alignment = {
      vertical: 'middle',
      horizontal: colNum === 1 ? 'left' : 'center',
    };
  });

  // Data rows
  filtered.rows.forEach(item => {
    const rowValues: (string | number)[] = [item.label];
    item.valuesInYuan.forEach(val => {
      rowValues.push(val !== null ? val : '--');
    });

    const dataRow = ws.addRow(rowValues);
    dataRow.height = 21;

    dataRow.eachCell((cell, colNum) => {
      cell.border = BORDER_STYLE;
      cell.font = { name: 'Microsoft YaHei', size: 10 };

      if (colNum === 1) {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0.00';
        }
      }
    });
  });

  // Column widths
  ws.columns = [
    { width: 34 }, // Row label
    ...filtered.reportDates.map(() => ({ width: 22 })),
  ];

  return ws;
}

export async function exportStocksToExcel(
  stocks: StockFinancialData[],
  options: ExcelExportOptions = {}
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

  // 1. If 3 Financial Statements are provided (exact template matching user's images)
  if (options.statements) {
    const st = options.statements;
    const sDates = options.selectedDates;

    // Filtered statements for consistent combined view
    const fBalance = filterStatementByDates(st.balanceSheet, sDates);
    const fProfit = filterStatementByDates(st.incomeStatement, sDates);
    const fCash = filterStatementByDates(st.cashFlowStatement, sDates);

    // Sheet 1: 资产负债表 ( 元 )
    addStyledStatementSheet(wb, '资产负债表', fBalance);

    // Sheet 2: 利润表 ( 元 )
    addStyledStatementSheet(wb, '利润表', fProfit);

    // Sheet 3: 现金流量表 ( 元 )
    addStyledStatementSheet(wb, '现金流量表', fCash);

    // Sheet 4: 三大财务报表 (同款合并一览)
    const wsCombined = wb.addWorksheet('三大报表一览', {
      views: [{ showGridLines: true }],
    });

    const allStatements = [fBalance, fProfit, fCash];
    allStatements.forEach((stmt, stmtIdx) => {
      if (stmtIdx > 0) {
        // empty spacing row
        const emptyRow = wsCombined.addRow([]);
        emptyRow.height = 16;
      }

      const hRow = wsCombined.addRow([stmt.title, ...stmt.reportDates]);
      hRow.height = 26;
      hRow.eachCell((cell, colNum) => {
        cell.fill = TEAL_HEADER_FILL;
        cell.font = TEAL_HEADER_FONT;
        cell.border = BORDER_STYLE;
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNum === 1 ? 'left' : 'center',
        };
      });

      stmt.rows.forEach(item => {
        const rowVals: (string | number)[] = [item.label];
        item.valuesInYuan.forEach(val => {
          rowVals.push(val !== null ? val : '--');
        });

        const dRow = wsCombined.addRow(rowVals);
        dRow.height = 21;
        dRow.eachCell((cell, colNum) => {
          cell.border = BORDER_STYLE;
          cell.font = { name: 'Microsoft YaHei', size: 10 };
          if (colNum === 1) {
            cell.alignment = { vertical: 'middle', horizontal: 'left' };
          } else {
            cell.alignment = { vertical: 'middle', horizontal: 'right' };
            if (typeof cell.value === 'number') {
              cell.numFmt = '#,##0.00';
            }
          }
        });
      });
    });

    wsCombined.columns = [
      { width: 34 },
      ...fBalance.reportDates.map(() => ({ width: 22 })),
    ];
  }

  // 2. 多股关键指标横向对比总表
  if (options.includeSummarySheet !== false && stocks.length > 0) {
    const wsSummary = wb.addWorksheet('多股关键指标横向对比', {
      views: [{ showGridLines: true }],
    });

    const headers = [
      '股票代码',
      '股票名称',
      '所属行业',
      '最新价格(元)',
      '涨跌幅(%)',
      '市盈率PE(TTM)',
      '市净率PB',
      '总市值(亿元)',
      '流通市值(亿元)',
      '最新报告期',
      '每股收益EPS(元)',
      '每股净资产BPS(元)',
      '每股经营现金流(元)',
      '净资产收益率ROE(%)',
      '销售净利率(%)',
      '主营毛利率(%)',
      '资产负债率(%)',
      '流动比率',
      '速动比率',
      '营业收入增长率(%)',
      '净利润增长率(%)',
      '总资产周转率(次)',
    ];

    const hRow = wsSummary.addRow(headers);
    hRow.height = 26;
    hRow.eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E293B' }, // Dark slate
      };
      cell.font = { name: 'Microsoft YaHei', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = BORDER_STYLE;
    });

    stocks.forEach(s => {
      const q = s.quote;
      const row = wsSummary.addRow([
        s.code,
        s.name,
        q?.industry || '--',
        q?.price ?? '--',
        q?.changePercent ? `${q.changePercent}%` : '--',
        q?.peTTM ?? '--',
        q?.pb ?? '--',
        q?.totalMarketCap ?? '--',
        q?.circulatingMarketCap ?? '--',
        s.coreSummary.reportDate,
        s.coreSummary.eps,
        s.coreSummary.bps,
        s.coreSummary.cashFlowPerShare,
        s.coreSummary.roe,
        s.coreSummary.netMargin,
        s.coreSummary.grossMargin,
        s.coreSummary.debtRatio,
        s.coreSummary.currentRatio,
        s.coreSummary.quickRatio,
        s.coreSummary.revenueGrowth,
        s.coreSummary.netProfitGrowth,
        s.coreSummary.turnoverRatio,
      ]);
      row.height = 22;
      row.eachCell((cell, colNum) => {
        cell.border = BORDER_STYLE;
        cell.font = { name: 'Microsoft YaHei', size: 10 };
        cell.alignment = {
          vertical: 'middle',
          horizontal: colNum <= 3 || colNum === 10 ? 'center' : 'right',
        };
      });
    });

    wsSummary.columns = [
      { width: 12 }, // 代码
      { width: 16 }, // 名称
      { width: 16 }, // 行业
      { width: 14 }, // 价格
      { width: 14 }, // 涨跌幅
      { width: 15 }, // PE
      { width: 14 }, // PB
      { width: 16 }, // 总市值
      { width: 16 }, // 流通市值
      { width: 15 }, // 报告期
      { width: 16 }, // EPS
      { width: 16 }, // BPS
      { width: 18 }, // 经营现金流
      { width: 18 }, // ROE
      { width: 16 }, // 销售净利率
      { width: 16 }, // 毛利率
      { width: 16 }, // 资产负债率
      { width: 14 }, // 流动比率
      { width: 14 }, // 速动比率
      { width: 18 }, // 营收增长率
      { width: 18 }, // 净利润增长率
      { width: 16 }, // 周转率
    ];
  }

  // 3. 数据来源与指标定义说明
  if (options.includeDefinitionsSheet !== false) {
    const wsMeta = wb.addWorksheet('数据源与指标定义', {
      views: [{ showGridLines: true }],
    });

    const metaData = [
      ['新浪财经股票关键指标采集与分析报表 (含三大财务报表)'],
      ['数据来源', '新浪财经 (https://finance.sina.com.cn/)'],
      ['导出时间', new Date().toLocaleString('zh-CN')],
      ['包含报表', '资产负债表 (元)、利润表 (元)、现金流量表 (元)、关键指标横向对比'],
      ['股票总数', stocks.length],
      ['数据说明', '本报表数据由系统自动采集整理，包含实时行情与上市公司定期报告官方指标。'],
      [],
      ['三大财务报表说明：'],
      ['资产负债表 (元)', '反映企业在报告期末所拥有的资产、承担的负债及所有者权益全貌，按图片標準28項指標完全還原。'],
      ['利润表 (元)', '反映企业在报告期间的经营成果与净利润形成过程，按图片標準16項指標完全還原。'],
      ['现金流量表 (元)', '反映企业在报告期间现金流入流出的真实动态，按图片標準13項指標完全還原。'],
      [],
      ['主要指标计算说明：'],
      ['市盈率 PE(TTM)', '最新股价 / 滚动12个月每股收益(EPS)'],
      ['市净率 PB', '最新股价 / 最新每股净资产(BPS)'],
      ['净资产收益率 ROE', '净利润 / 平均股东权益 * 100%，衡量企业股东资金利用效率'],
      ['销售净利率', '净利润 / 营业总收入 * 100%，反映销售收入创造净利能力'],
      ['资产负债率', '负债总额 / 资产总额 * 100%，反映企业杠杆程度与长期偿债风险'],
    ];

    metaData.forEach((row, idx) => {
      const r = wsMeta.addRow(row);
      r.height = 20;
      if (idx === 0) {
        r.font = { name: 'Microsoft YaHei', size: 12, bold: true, color: { argb: 'FF1E293B' } };
      } else {
        r.font = { name: 'Microsoft YaHei', size: 10 };
      }
    });

    wsMeta.columns = [{ width: 22 }, { width: 70 }];
  }

  // Generate buffer and trigger browser download
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const fileName = options.fileName || `新浪财经股票指标与三大报表_${dateStr}.xlsx`;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

// Quick CSV Exporter for current comparison table
export function exportComparisonToCSV(stocks: StockFinancialData[], fileName?: string) {
  if (!stocks || stocks.length === 0) return;
  const headers = [
    '股票代码',
    '股票名称',
    '所属行业',
    '最新价格',
    '涨跌幅%',
    '市盈率PE',
    '市净率PB',
    '总市值(亿)',
    '报告期',
    '每股收益EPS',
    '每股净资产BPS',
    '经营现金流',
    'ROE%',
    '销售净利率%',
    '毛利率%',
    '资产负债率%',
    '营收增长%',
    '净利润增长%',
  ];

  const lines = [headers.join(',')];
  stocks.forEach(s => {
    const q = s.quote;
    lines.push(
      [
        s.code,
        `"${s.name}"`,
        `"${q?.industry || '--'}"`,
        q?.price ?? '--',
        q?.changePercent ?? '--',
        q?.peTTM ?? '--',
        q?.pb ?? '--',
        q?.totalMarketCap ?? '--',
        s.coreSummary.reportDate,
        s.coreSummary.eps,
        s.coreSummary.bps,
        s.coreSummary.cashFlowPerShare,
        s.coreSummary.roe,
        s.coreSummary.netMargin,
        s.coreSummary.grossMargin,
        s.coreSummary.debtRatio,
        s.coreSummary.revenueGrowth,
        s.coreSummary.netProfitGrowth,
      ].join(',')
    );
  });

  const csv = lines.join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || `股票关键指标对比_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Copy to Clipboard as TSV (Tab Separated Values) for pasting directly into Excel
export async function copyTableToClipboard(stocks: StockFinancialData[]): Promise<boolean> {
  if (!stocks || stocks.length === 0) return false;
  const headers = [
    '股票代码',
    '股票名称',
    '行业',
    '现价',
    '涨跌幅%',
    'PE(TTM)',
    'PB',
    '总市值(亿)',
    '报告期',
    'EPS',
    'BPS',
    '每股现金流',
    'ROE%',
    '销售净利率%',
    '毛利率%',
    '资产负债率%',
    '营收增长%',
    '净利增长%',
  ];

  const lines = [headers.join('\t')];
  stocks.forEach(s => {
    const q = s.quote;
    lines.push(
      [
        s.code,
        s.name,
        q?.industry || '--',
        q?.price ?? '--',
        q?.changePercent ? `${q.changePercent}%` : '--',
        q?.peTTM ?? '--',
        q?.pb ?? '--',
        q?.totalMarketCap ?? '--',
        s.coreSummary.reportDate,
        s.coreSummary.eps,
        s.coreSummary.bps,
        s.coreSummary.cashFlowPerShare,
        s.coreSummary.roe,
        s.coreSummary.netMargin,
        s.coreSummary.grossMargin,
        s.coreSummary.debtRatio,
        s.coreSummary.revenueGrowth,
        s.coreSummary.netProfitGrowth,
      ].join('\t')
    );
  });

  const text = lines.join('\n');
  await navigator.clipboard.writeText(text);
  return true;
}

// Copy specific Statement to Clipboard as TSV for pasting directly into Excel
export async function copyStatementToClipboard(
  statement: StatementData,
  selectedDates?: string[]
): Promise<boolean> {
  if (!statement || !statement.rows) return false;
  const filtered = filterStatementByDates(statement, selectedDates);
  const header = [filtered.title, ...filtered.reportDates].join('\t');
  const lines = [header];

  filtered.rows.forEach(r => {
    const rowVals = [
      r.label,
      ...r.valuesInYuan.map(v => (v !== null ? v.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '--')),
    ];
    lines.push(rowVals.join('\t'));
  });

  await navigator.clipboard.writeText(lines.join('\n'));
  return true;
}
