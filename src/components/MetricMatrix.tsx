import React, { useState, useMemo } from 'react';
import { StockFinancialData, FinancialMetric } from '../types/stock';
import { Filter, Search, CheckSquare, Square } from 'lucide-react';

interface MetricMatrixProps {
  stocks: StockFinancialData[];
}

export const MetricMatrix: React.FC<MetricMatrixProps> = ({ stocks }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Collect union of all categories across stocks
  const allCategories = useMemo(() => {
    const set = new Set<string>();
    stocks.forEach(s => {
      s.categories.forEach(c => set.add(c));
    });
    return Array.from(set);
  }, [stocks]);

  // Collect unique metric names per category
  const matrixItems = useMemo(() => {
    const map = new Map<string, { category: string; name: string }>();

    stocks.forEach(s => {
      s.metrics.forEach(m => {
        const key = `${m.category}::${m.name}`;
        if (!map.has(key)) {
          map.set(key, { category: m.category, name: m.name });
        }
      });
    });

    let items = Array.from(map.values());

    if (selectedCategory !== 'all') {
      items = items.filter(i => i.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
    }

    return items;
  }, [stocks, selectedCategory, searchQuery]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
      {/* Category selector & search bar */}
      <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-slate-50/50">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            指标分类:
          </span>
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedCategory === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            全部指标 ({matrixItems.length})
          </button>
          {allCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedCategory === cat
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
            placeholder="搜索特定指标名称..."
            className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-52 text-slate-800"
          />
        </div>
      </div>

      {/* Grid Table */}
      <div className="overflow-x-auto max-h-[650px] overflow-y-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="sticky top-0 bg-slate-100 z-20 shadow-xs">
            <tr className="border-b border-slate-200 text-slate-600 font-semibold">
              <th className="py-2.5 px-3 whitespace-nowrap bg-slate-100 sticky left-0 z-30 w-28 border-r border-slate-200">
                分类
              </th>
              <th className="py-2.5 px-4 whitespace-nowrap bg-slate-100 sticky left-28 z-30 min-w-[180px] border-r border-slate-200">
                关键指标名称
              </th>
              {stocks.map(stock => (
                <th
                  key={stock.code}
                  className="py-2.5 px-4 text-right whitespace-nowrap min-w-[130px] border-r border-slate-100 bg-slate-100"
                >
                  <div className="flex flex-col items-end">
                    <span className="font-bold text-slate-900">{stock.name}</span>
                    <span className="font-mono text-[11px] text-slate-500">{stock.code}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {matrixItems.length === 0 ? (
              <tr>
                <td colSpan={stocks.length + 2} className="py-12 text-center text-slate-400">
                  未找到匹配的财务指标
                </td>
              </tr>
            ) : (
              matrixItems.map((item, idx) => {
                const isEven = idx % 2 === 0;
                return (
                  <tr
                    key={`${item.category}-${item.name}`}
                    className={`hover:bg-blue-50/40 transition-colors ${isEven ? 'bg-white' : 'bg-slate-50/30'}`}
                  >
                    {/* Category */}
                    <td className="py-2 px-3 whitespace-nowrap sticky left-0 bg-inherit z-10 border-r border-slate-200 text-slate-500 text-[11px]">
                      {item.category}
                    </td>

                    {/* Metric Name */}
                    <td className="py-2 px-4 whitespace-nowrap sticky left-28 bg-inherit z-10 border-r border-slate-200 font-medium text-slate-800">
                      {item.name}
                    </td>

                    {/* Values per stock */}
                    {stocks.map(stock => {
                      const metric = stock.metrics.find(
                        m => m.name === item.name && m.category === item.category
                      ) || stock.metrics.find(m => m.name === item.name);

                      const val = metric && metric.values.length > 0 ? metric.values[0] : '--';
                      const isNumber = val !== '--' && val !== null && val !== undefined && !isNaN(Number(val));
                      const numVal = isNumber ? Number(val) : null;

                      let valColor = 'text-slate-700';
                      if (item.name.includes('率') || item.name.includes('增长')) {
                        if (numVal !== null && numVal > 0) valColor = 'text-rose-600 font-medium';
                        if (numVal !== null && numVal < 0) valColor = 'text-emerald-600 font-medium';
                      }

                      return (
                        <td
                          key={stock.code}
                          className={`py-2 px-4 text-right font-mono tabular-nums whitespace-nowrap border-r border-slate-100 ${valColor}`}
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

      <div className="p-3 bg-slate-50 border-t border-slate-200 text-slate-500 text-[11px] flex items-center justify-between">
        <span>当前显示最新定期报告数据（单期指标）</span>
        <span>完整全期历史请在单股明细中查看或导出完整 Excel</span>
      </div>
    </div>
  );
};
