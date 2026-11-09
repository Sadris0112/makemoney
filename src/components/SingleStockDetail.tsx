import React, { useState } from 'react';
import { StockFinancialData } from '../types/stock';
import { Building2, TrendingUp, TrendingDown, DollarSign, PieChart, ShieldCheck, Activity, Search } from 'lucide-react';

interface SingleStockDetailProps {
  stocks: StockFinancialData[];
  selectedCode: string;
  onSelectCode: (code: string) => void;
}

export const SingleStockDetail: React.FC<SingleStockDetailProps> = ({
  stocks,
  selectedCode,
  onSelectCode,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const currentStock = stocks.find(s => s.code === selectedCode) || stocks[0];
  if (!currentStock) return null;

  const q = currentStock.quote;
  const isPositive = (q?.changePercent || 0) > 0;
  const isNegative = (q?.changePercent || 0) < 0;

  const filteredMetrics = currentStock.metrics.filter(m => {
    if (activeCategory !== 'all' && m.category !== activeCategory) return false;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return m.name.toLowerCase().includes(query) || m.category.toLowerCase().includes(query);
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Top Selector Strip */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700">切换股票:</span>
          <div className="flex flex-wrap gap-1.5">
            {stocks.map(s => (
              <button
                key={s.code}
                onClick={() => onSelectCode(s.code)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  s.code === currentStock.code
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {s.name} ({s.code})
              </button>
            ))}
          </div>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          当前年份: <span className="font-semibold text-slate-800">{currentStock.year || '最新披露年度'}</span>
        </div>
      </div>

      {/* Stock Quote & Basic Valuation Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            {currentStock.name.slice(0, 2)}
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold text-slate-900">{currentStock.name}</h2>
              <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {currentStock.code} ({currentStock.symbol.toUpperCase()})
              </span>
              {q?.industry && (
                <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                  {q.industry}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-500">
              <span>行情刷新: {q?.updateTime || '已同步'}</span>
              <span>·</span>
              <span>报告期数: {currentStock.reportDates.length} 期</span>
            </div>
          </div>
        </div>

        {/* Real-time price stats */}
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs text-slate-500 mb-0.5">最新价</div>
            <div
              className={`text-2xl font-bold font-mono tabular-nums ${
                isPositive ? 'text-rose-600' : isNegative ? 'text-emerald-600' : 'text-slate-900'
              }`}
            >
              {q?.price !== undefined ? q.price.toFixed(2) : '--'}
            </div>
            <div className="text-xs font-mono font-semibold">
              {q?.changePercent !== undefined ? (
                <span className={isPositive ? 'text-rose-600' : isNegative ? 'text-emerald-600' : 'text-slate-600'}>
                  {isPositive ? '+' : ''}
                  {q.changePercent.toFixed(2)}% ({isPositive ? '+' : ''}
                  {q.change.toFixed(2)})
                </span>
              ) : (
                '--'
              )}
            </div>
          </div>

          <div className="h-10 w-px bg-slate-200" />

          {/* Key Quick Ratios */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
            <div>
              <span className="text-slate-500">市盈率 PE(TTM): </span>
              <span className="font-mono font-semibold text-slate-800">{q?.peTTM ?? '--'}</span>
            </div>
            <div>
              <span className="text-slate-500">市净率 PB: </span>
              <span className="font-mono font-semibold text-slate-800">{q?.pb ?? '--'}</span>
            </div>
            <div>
              <span className="text-slate-500">总市值: </span>
              <span className="font-mono font-semibold text-slate-800">
                {q?.totalMarketCap ? `${q.totalMarketCap} 亿` : '--'}
              </span>
            </div>
            <div>
              <span className="text-slate-500">流通市值: </span>
              <span className="font-mono font-semibold text-slate-800">
                {q?.circulatingMarketCap ? `${q.circulatingMarketCap} 亿` : '--'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Core Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-start justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">每股收益 EPS (元)</span>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">
              {currentStock.coreSummary.eps}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              最新报告期: {currentStock.coreSummary.reportDate}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-start justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">净资产收益率 ROE</span>
            <div className="text-xl font-bold font-mono text-blue-700 mt-1">
              {currentStock.coreSummary.roe}
              {currentStock.coreSummary.roe !== '--' ? '%' : ''}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              销售净利率: {currentStock.coreSummary.netMargin}%
            </span>
          </div>
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
            <TrendingUp className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-start justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">资产负债率</span>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">
              {currentStock.coreSummary.debtRatio}
              {currentStock.coreSummary.debtRatio !== '--' ? '%' : ''}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              流动比率: {currentStock.coreSummary.currentRatio}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-start justify-between">
          <div>
            <span className="text-xs text-slate-500 font-medium">营业总收入增长率</span>
            <div className="text-xl font-bold font-mono text-slate-900 mt-1">
              {currentStock.coreSummary.revenueGrowth}
              {currentStock.coreSummary.revenueGrowth !== '--' ? '%' : ''}
            </div>
            <span className="text-[11px] text-slate-400 mt-1 block">
              净利润增长率: {currentStock.coreSummary.netProfitGrowth}%
            </span>
          </div>
          <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
            <Activity className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* All Indicators Detailed Table across Quarters */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        {/* Table Filter Header */}
        <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-700">指标类型:</span>
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                activeCategory === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              全部 ({filteredMetrics.length})
            </button>
            {currentStock.categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  activeCategory === cat
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索指标名称..."
              className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 text-slate-800"
            />
          </div>
        </div>

        {/* Detailed Matrix Table */}
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="sticky top-0 bg-slate-100 z-10 shadow-xs">
              <tr className="border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-4 whitespace-nowrap w-28 bg-slate-100">分类</th>
                <th className="py-2.5 px-4 whitespace-nowrap min-w-[220px] bg-slate-100">财务指标名称</th>
                {currentStock.reportDates.map((date, idx) => (
                  <th
                    key={date}
                    className="py-2.5 px-4 text-right whitespace-nowrap min-w-[130px] font-mono tabular-nums bg-slate-100"
                  >
                    <span>{date}</span>
                    <span className="text-[10px] text-slate-400 block font-sans font-normal">
                      {idx === 0 ? '最新期' : `前期 (${idx})`}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMetrics.length === 0 ? (
                <tr>
                  <td colSpan={currentStock.reportDates.length + 2} className="py-12 text-center text-slate-400">
                    没有找到匹配的指标
                  </td>
                </tr>
              ) : (
                filteredMetrics.map((metric, idx) => {
                  const isEven = idx % 2 === 0;
                  return (
                    <tr
                      key={`${metric.category}-${metric.name}-${idx}`}
                      className={`hover:bg-blue-50/40 transition-colors ${isEven ? 'bg-white' : 'bg-slate-50/30'}`}
                    >
                      <td className="py-2 px-4 whitespace-nowrap text-slate-500 text-[11px]">
                        {metric.category}
                      </td>
                      <td className="py-2 px-4 whitespace-nowrap font-medium text-slate-800">
                        {metric.name}
                      </td>
                      {currentStock.reportDates.map((_, colIdx) => {
                        const val = metric.values[colIdx] ?? '--';
                        return (
                          <td
                            key={colIdx}
                            className="py-2 px-4 text-right font-mono tabular-nums whitespace-nowrap text-slate-700"
                          >
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
