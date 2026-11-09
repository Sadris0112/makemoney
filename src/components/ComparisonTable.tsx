import React, { useState, useMemo } from 'react';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Copy,
  Check,
  Download,
  Eye,
  SlidersHorizontal,
} from 'lucide-react';
import { StockFinancialData } from '../types/stock';
import { copyTableToClipboard, exportComparisonToCSV } from '../utils/excelExport';

interface ComparisonTableProps {
  stocks: StockFinancialData[];
  onSelectStock: (code: string) => void;
}

type SortField =
  | 'code'
  | 'name'
  | 'industry'
  | 'price'
  | 'changePercent'
  | 'peTTM'
  | 'pb'
  | 'totalMarketCap'
  | 'eps'
  | 'bps'
  | 'cashFlowPerShare'
  | 'roe'
  | 'netMargin'
  | 'grossMargin'
  | 'debtRatio'
  | 'revenueGrowth'
  | 'netProfitGrowth';

export const ComparisonTable: React.FC<ComparisonTableProps> = ({ stocks, onSelectStock }) => {
  const [sortField, setSortField] = useState<SortField>('roe');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filterQuery, setFilterQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeGroup, setActiveGroup] = useState<'all' | 'valuation' | 'profit' | 'solvency' | 'growth'>('all');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleCopy = async () => {
    const success = await copyTableToClipboard(stocks);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const parseNumber = (val: any): number => {
    if (typeof val === 'number') return val;
    if (!val || val === '--') return -9999999;
    const n = parseFloat(String(val).replace(/%/g, ''));
    return isNaN(n) ? -9999999 : n;
  };

  const sortedAndFilteredStocks = useMemo(() => {
    return stocks
      .filter(s => {
        if (!filterQuery) return true;
        const q = filterQuery.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.code.includes(q) ||
          (s.quote?.industry || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        let valA: any = 0;
        let valB: any = 0;

        switch (sortField) {
          case 'code':
            valA = a.code;
            valB = b.code;
            return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
          case 'name':
            valA = a.name;
            valB = b.name;
            return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
          case 'industry':
            valA = a.quote?.industry || '';
            valB = b.quote?.industry || '';
            return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
          case 'price':
            valA = a.quote?.price || 0;
            valB = b.quote?.price || 0;
            break;
          case 'changePercent':
            valA = a.quote?.changePercent || 0;
            valB = b.quote?.changePercent || 0;
            break;
          case 'peTTM':
            valA = a.quote?.peTTM || 999999;
            valB = b.quote?.peTTM || 999999;
            break;
          case 'pb':
            valA = a.quote?.pb || 999999;
            valB = b.quote?.pb || 999999;
            break;
          case 'totalMarketCap':
            valA = a.quote?.totalMarketCap || 0;
            valB = b.quote?.totalMarketCap || 0;
            break;
          case 'eps':
            valA = parseNumber(a.coreSummary.eps);
            valB = parseNumber(b.coreSummary.eps);
            break;
          case 'bps':
            valA = parseNumber(a.coreSummary.bps);
            valB = parseNumber(b.coreSummary.bps);
            break;
          case 'cashFlowPerShare':
            valA = parseNumber(a.coreSummary.cashFlowPerShare);
            valB = parseNumber(b.coreSummary.cashFlowPerShare);
            break;
          case 'roe':
            valA = parseNumber(a.coreSummary.roe);
            valB = parseNumber(b.coreSummary.roe);
            break;
          case 'netMargin':
            valA = parseNumber(a.coreSummary.netMargin);
            valB = parseNumber(b.coreSummary.netMargin);
            break;
          case 'grossMargin':
            valA = parseNumber(a.coreSummary.grossMargin);
            valB = parseNumber(b.coreSummary.grossMargin);
            break;
          case 'debtRatio':
            valA = parseNumber(a.coreSummary.debtRatio);
            valB = parseNumber(b.coreSummary.debtRatio);
            break;
          case 'revenueGrowth':
            valA = parseNumber(a.coreSummary.revenueGrowth);
            valB = parseNumber(b.coreSummary.revenueGrowth);
            break;
          case 'netProfitGrowth':
            valA = parseNumber(a.coreSummary.netProfitGrowth);
            valB = parseNumber(b.coreSummary.netProfitGrowth);
            break;
        }

        return sortOrder === 'asc' ? valA - valB : valB - valA;
      });
  }, [stocks, filterQuery, sortField, sortOrder]);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-blue-600" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-600" />
    );
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
      {/* Table Toolbar */}
      <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={filterQuery}
              onChange={e => setFilterQuery(e.target.value)}
              placeholder="在已查股票中快速筛选..."
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-56 text-slate-800"
            />
          </div>

          {/* Group View Toggle Buttons */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-200/60 rounded-lg text-xs font-medium">
            <button
              onClick={() => setActiveGroup('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                activeGroup === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              全部核心指标
            </button>
            <button
              onClick={() => setActiveGroup('valuation')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                activeGroup === 'valuation' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              估值与行情
            </button>
            <button
              onClick={() => setActiveGroup('profit')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                activeGroup === 'profit' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              盈利回报(ROE)
            </button>
            <button
              onClick={() => setActiveGroup('solvency')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                activeGroup === 'solvency' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              偿债杠杆
            </button>
            <button
              onClick={() => setActiveGroup('growth')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                activeGroup === 'growth' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              成长增长
            </button>
          </div>
        </div>

        {/* Export / Copy Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            title="复制为表格格式，可直接在 Excel/WPS/Google Sheets 中 Ctrl+V 粘贴"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
            <span>{copied ? '已复制表格数据' : '复制数据 (可直接粘贴Excel)'}</span>
          </button>
          <button
            onClick={() => exportComparisonToCSV(stocks)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>导出 CSV</span>
          </button>
        </div>
      </div>

      {/* Table Element */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-600 font-semibold select-none">
              <th className="py-2.5 px-3 whitespace-nowrap sticky left-0 bg-slate-100 z-10">
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center gap-1 group text-left cursor-pointer"
                >
                  <span>公司与代码</span>
                  {renderSortIcon('name')}
                </button>
              </th>
              <th className="py-2.5 px-3 whitespace-nowrap">
                <button
                  onClick={() => handleSort('industry')}
                  className="flex items-center gap-1 group text-left cursor-pointer"
                >
                  <span>所属行业</span>
                  {renderSortIcon('industry')}
                </button>
              </th>

              {(activeGroup === 'all' || activeGroup === 'valuation') && (
                <>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleSort('price')}
                      className="inline-flex items-center gap-1 group cursor-pointer ml-auto"
                    >
                      <span>最新价(元)</span>
                      {renderSortIcon('price')}
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleSort('changePercent')}
                      className="inline-flex items-center gap-1 group cursor-pointer ml-auto"
                    >
                      <span>涨跌幅</span>
                      {renderSortIcon('changePercent')}
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleSort('peTTM')}
                      className="inline-flex items-center gap-1 group cursor-pointer ml-auto"
                    >
                      <span>市盈率(PE)</span>
                      {renderSortIcon('peTTM')}
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleSort('pb')}
                      className="inline-flex items-center gap-1 group cursor-pointer ml-auto"
                    >
                      <span>市净率(PB)</span>
                      {renderSortIcon('pb')}
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleSort('totalMarketCap')}
                      className="inline-flex items-center gap-1 group cursor-pointer ml-auto"
                    >
                      <span>总市值(亿)</span>
                      {renderSortIcon('totalMarketCap')}
                    </button>
                  </th>
                </>
              )}

              <th className="py-2.5 px-3 text-center whitespace-nowrap text-slate-500 font-normal">
                报告期
              </th>

              {(activeGroup === 'all' || activeGroup === 'profit') && (
                <>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleSort('roe')}
                      className="inline-flex items-center gap-1 group cursor-pointer ml-auto"
                    >
                      <span>净资产收益率(ROE%)</span>
                      {renderSortIcon('roe')}
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleSort('netMargin')}
                      className="inline-flex items-center gap-1 group cursor-pointer ml-auto"
                    >
                      <span>销售净利率(%)</span>
                      {renderSortIcon('netMargin')}
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleSort('grossMargin')}
                      className="inline-flex items-center gap-1 group cursor-pointer ml-auto"
                    >
                      <span>主营毛利率(%)</span>
                      {renderSortIcon('grossMargin')}
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleSort('eps')}
                      className="inline-flex items-center gap-1 group cursor-pointer ml-auto"
                    >
                      <span>每股收益(EPS)</span>
                      {renderSortIcon('eps')}
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleSort('cashFlowPerShare')}
                      className="inline-flex items-center gap-1 group cursor-pointer ml-auto"
                    >
                      <span>每股经营现金流</span>
                      {renderSortIcon('cashFlowPerShare')}
                    </button>
                  </th>
                </>
              )}

              {(activeGroup === 'all' || activeGroup === 'solvency') && (
                <>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleSort('debtRatio')}
                      className="inline-flex items-center gap-1 group cursor-pointer ml-auto"
                    >
                      <span>资产负债率(%)</span>
                      {renderSortIcon('debtRatio')}
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">
                    <span>流动比率</span>
                  </th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">
                    <span>速动比率</span>
                  </th>
                </>
              )}

              {(activeGroup === 'all' || activeGroup === 'growth') && (
                <>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleSort('revenueGrowth')}
                      className="inline-flex items-center gap-1 group cursor-pointer ml-auto"
                    >
                      <span>营收增长率(%)</span>
                      {renderSortIcon('revenueGrowth')}
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleSort('netProfitGrowth')}
                      className="inline-flex items-center gap-1 group cursor-pointer ml-auto"
                    >
                      <span>净利增长率(%)</span>
                      {renderSortIcon('netProfitGrowth')}
                    </button>
                  </th>
                </>
              )}

              <th className="py-2.5 px-3 text-center whitespace-nowrap">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sortedAndFilteredStocks.length === 0 ? (
              <tr>
                <td colSpan={18} className="py-8 text-center text-slate-400">
                  没有匹配的股票数据
                </td>
              </tr>
            ) : (
              sortedAndFilteredStocks.map(stock => {
                const q = stock.quote;
                const change = q?.changePercent || 0;
                const isPositive = change > 0;
                const isNegative = change < 0;
                const changeColor = isPositive
                  ? 'text-rose-600 font-semibold'
                  : isNegative
                  ? 'text-emerald-600 font-semibold'
                  : 'text-slate-600';

                const roeNum = parseFloat(stock.coreSummary.roe);
                const isHighRoe = !isNaN(roeNum) && roeNum >= 15;

                return (
                  <tr
                    key={stock.code}
                    className="hover:bg-slate-50 transition-colors group cursor-default"
                  >
                    {/* Name & Code */}
                    <td className="py-2.5 px-3 whitespace-nowrap sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-100">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onSelectStock(stock.code)}
                          className="font-bold text-slate-900 hover:text-blue-600 text-left transition-colors cursor-pointer"
                        >
                          {stock.name}
                        </button>
                        <span className="font-mono text-slate-400 text-[11px] bg-slate-100 px-1.5 py-0.5 rounded">
                          {stock.code}
                        </span>
                      </div>
                    </td>

                    {/* Industry */}
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-600">
                      {q?.industry ? (
                        <span>{q.industry}</span>
                      ) : (
                        <span className="text-slate-300">--</span>
                      )}
                    </td>

                    {/* Valuation / Quote Group */}
                    {(activeGroup === 'all' || activeGroup === 'valuation') && (
                      <>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                          {q?.price !== undefined ? q.price.toFixed(2) : '--'}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap ${changeColor}`}>
                          {q?.changePercent !== undefined
                            ? `${isPositive ? '+' : ''}${q.changePercent.toFixed(2)}%`
                            : '--'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                          {q?.peTTM !== null && q?.peTTM !== undefined ? q.peTTM : '--'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                          {q?.pb !== null && q?.pb !== undefined ? q.pb : '--'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                          {q?.totalMarketCap !== null && q?.totalMarketCap !== undefined
                            ? `${q.totalMarketCap.toLocaleString()} 亿`
                            : '--'}
                        </td>
                      </>
                    )}

                    {/* Report Date */}
                    <td className="py-2.5 px-3 text-center font-mono tabular-nums text-slate-500 whitespace-nowrap text-[11px]">
                      {stock.coreSummary.reportDate}
                    </td>

                    {/* Profitability Group */}
                    {(activeGroup === 'all' || activeGroup === 'profit') && (
                      <>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                          <span
                            className={
                              isHighRoe
                                ? 'font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded'
                                : 'text-slate-800'
                            }
                          >
                            {stock.coreSummary.roe}
                            {stock.coreSummary.roe !== '--' ? '%' : ''}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                          {stock.coreSummary.netMargin}
                          {stock.coreSummary.netMargin !== '--' ? '%' : ''}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                          {stock.coreSummary.grossMargin}
                          {stock.coreSummary.grossMargin !== '--' ? '%' : ''}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                          {stock.coreSummary.eps}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                          {stock.coreSummary.cashFlowPerShare}
                        </td>
                      </>
                    )}

                    {/* Solvency Group */}
                    {(activeGroup === 'all' || activeGroup === 'solvency') && (
                      <>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                          {stock.coreSummary.debtRatio}
                          {stock.coreSummary.debtRatio !== '--' ? '%' : ''}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                          {stock.coreSummary.currentRatio}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                          {stock.coreSummary.quickRatio}
                        </td>
                      </>
                    )}

                    {/* Growth Group */}
                    {(activeGroup === 'all' || activeGroup === 'growth') && (
                      <>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                          {parseFloat(stock.coreSummary.revenueGrowth) > 0 ? (
                            <span className="text-rose-600 font-medium">+{stock.coreSummary.revenueGrowth}%</span>
                          ) : (
                            <span className="text-slate-700">{stock.coreSummary.revenueGrowth}%</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                          {parseFloat(stock.coreSummary.netProfitGrowth) > 0 ? (
                            <span className="text-rose-600 font-medium">+{stock.coreSummary.netProfitGrowth}%</span>
                          ) : parseFloat(stock.coreSummary.netProfitGrowth) < 0 ? (
                            <span className="text-emerald-600 font-medium">{stock.coreSummary.netProfitGrowth}%</span>
                          ) : (
                            <span className="text-slate-700">{stock.coreSummary.netProfitGrowth}%</span>
                          )}
                        </td>
                      </>
                    )}

                    {/* Action */}
                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                      <button
                        onClick={() => onSelectStock(stock.code)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-colors cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>各期明细</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer info */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-2">
          <span>共 {sortedAndFilteredStocks.length} 支股票</span>
          <span>·</span>
          <span>数据源: 新浪财经 (finance.sina.com.cn)</span>
          <span>·</span>
          <span>默认以 ROE 从高到低排序</span>
        </div>
        <div className="flex items-center gap-3">
          <span>红涨绿跌 (中国A股行情惯例)</span>
          <span>·</span>
          <span className="text-blue-600 font-medium">点击表头可任意升降序排序</span>
        </div>
      </div>
    </div>
  );
};
