import React from 'react';
import { StockFinancialData } from '../types/stock';
import { Award, AlertTriangle, CheckCircle, TrendingUp, ShieldAlert, BarChart3, HelpCircle } from 'lucide-react';

interface FinancialDiagnosisProps {
  stocks: StockFinancialData[];
  onSelectStock: (code: string) => void;
}

export const FinancialDiagnosis: React.FC<FinancialDiagnosisProps> = ({ stocks, onSelectStock }) => {
  if (stocks.length === 0) return null;

  // Analysis groupings
  const highRoeStocks = stocks.filter(s => {
    const roe = parseFloat(s.coreSummary.roe);
    return !isNaN(roe) && roe >= 15;
  });

  const lowValuationStocks = stocks.filter(s => {
    const pe = s.quote?.peTTM;
    const pb = s.quote?.pb;
    return pe !== null && pe !== undefined && pe > 0 && pe <= 15 && pb !== null && pb !== undefined && pb <= 1.5;
  });

  const highLeverageStocks = stocks.filter(s => {
    const debt = parseFloat(s.coreSummary.debtRatio);
    return !isNaN(debt) && debt >= 65;
  });

  const strongCashFlowStocks = stocks.filter(s => {
    const cf = parseFloat(s.coreSummary.cashFlowPerShare);
    const eps = parseFloat(s.coreSummary.eps);
    return !isNaN(cf) && !isNaN(eps) && cf > 0 && cf >= eps;
  });

  const fastGrowingStocks = stocks.filter(s => {
    const rev = parseFloat(s.coreSummary.revenueGrowth);
    const profit = parseFloat(s.coreSummary.netProfitGrowth);
    return !isNaN(rev) && !isNaN(profit) && rev > 10 && profit > 10;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* High ROE */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700">高ROE优质企业 (≥15%)</span>
            <span className="text-xs font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              {highRoeStocks.length} 支
            </span>
          </div>
          <div className="flex flex-col gap-1.5 mt-2">
            {highRoeStocks.length > 0 ? (
              highRoeStocks.slice(0, 4).map(s => (
                <button
                  key={s.code}
                  onClick={() => onSelectStock(s.code)}
                  className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <span className="font-medium text-slate-800">{s.name}</span>
                  <span className="font-mono text-blue-700 font-semibold">{s.coreSummary.roe}%</span>
                </button>
              ))
            ) : (
              <span className="text-xs text-slate-400 italic">当前标的中无 ROE ≥ 15% 股票</span>
            )}
          </div>
        </div>

        {/* Low Valuation */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700">低估值/高安全边际</span>
            <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
              {lowValuationStocks.length} 支
            </span>
          </div>
          <div className="flex flex-col gap-1.5 mt-2">
            {lowValuationStocks.length > 0 ? (
              lowValuationStocks.slice(0, 4).map(s => (
                <button
                  key={s.code}
                  onClick={() => onSelectStock(s.code)}
                  className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <span className="font-medium text-slate-800">{s.name}</span>
                  <span className="font-mono text-emerald-700 font-semibold">
                    PE {s.quote?.peTTM} / PB {s.quote?.pb}
                  </span>
                </button>
              ))
            ) : (
              <span className="text-xs text-slate-400 italic">无 PE≤15 且 PB≤1.5 股票</span>
            )}
          </div>
        </div>

        {/* Strong Cash Flow */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700">现金流充沛 (经营流≥EPS)</span>
            <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
              {strongCashFlowStocks.length} 支
            </span>
          </div>
          <div className="flex flex-col gap-1.5 mt-2">
            {strongCashFlowStocks.length > 0 ? (
              strongCashFlowStocks.slice(0, 4).map(s => (
                <button
                  key={s.code}
                  onClick={() => onSelectStock(s.code)}
                  className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <span className="font-medium text-slate-800">{s.name}</span>
                  <span className="font-mono text-indigo-700 font-semibold">
                    CF: {s.coreSummary.cashFlowPerShare}
                  </span>
                </button>
              ))
            ) : (
              <span className="text-xs text-slate-400 italic">暂无现金流覆盖EPS标的</span>
            )}
          </div>
        </div>

        {/* High Leverage Alert */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700">较高负债率提示 (≥65%)</span>
            <span className="text-xs font-mono font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
              {highLeverageStocks.length} 支
            </span>
          </div>
          <div className="flex flex-col gap-1.5 mt-2">
            {highLeverageStocks.length > 0 ? (
              highLeverageStocks.slice(0, 4).map(s => (
                <button
                  key={s.code}
                  onClick={() => onSelectStock(s.code)}
                  className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <span className="font-medium text-slate-800">{s.name}</span>
                  <span className="font-mono text-amber-700 font-semibold">{s.coreSummary.debtRatio}%</span>
                </button>
              ))
            ) : (
              <span className="text-xs text-slate-400 italic">当前标的负债率均低于 65%</span>
            )}
          </div>
        </div>
      </div>

      {/* Visual Rank Comparison Strip */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">核心指标横向阶梯排行 (ROE对比)</h3>
          </div>
          <span className="text-xs text-slate-500">点击公司名可进入单股明细</span>
        </div>

        <div className="flex flex-col gap-3">
          {[...stocks]
            .sort((a, b) => {
              const rA = parseFloat(a.coreSummary.roe) || 0;
              const rB = parseFloat(b.coreSummary.roe) || 0;
              return rB - rA;
            })
            .map((s, idx) => {
              const roe = parseFloat(s.coreSummary.roe) || 0;
              const maxRoe = 40;
              const percentage = Math.min(100, Math.max(0, (roe / maxRoe) * 100));

              return (
                <div key={s.code} className="flex items-center gap-4 text-xs">
                  <div className="w-6 font-mono text-slate-400 font-semibold">{idx + 1}.</div>
                  <button
                    onClick={() => onSelectStock(s.code)}
                    className="w-28 text-left font-semibold text-slate-900 hover:text-blue-600 transition-colors truncate cursor-pointer"
                  >
                    {s.name}
                  </button>
                  <div className="w-16 font-mono text-slate-500 text-[11px]">{s.code}</div>
                  <div className="flex-1 bg-slate-100 h-3 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="w-20 text-right font-mono font-bold text-blue-700 tabular-nums">
                    {s.coreSummary.roe}%
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Financial Health Guideline notes */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-600 flex flex-col gap-2">
        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
          <HelpCircle className="w-4 h-4 text-slate-500" />
          <span>新浪财经关键指标分析说明与指导原则：</span>
        </div>
        <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
          <li><strong>净资产收益率 (ROE)</strong>：通常长期持续在 15% 以上的企业展现出强大的股东资本回报率与护城河优势。</li>
          <li><strong>销售净利率与毛利率</strong>：毛利率反映定价权，净利率反映费用控制能力；两者同步上升通常预示盈利质量优良。</li>
          <li><strong>资产负债率与偿债安全</strong>：一般工业/科技制造业适宜在 40%~60% 之间，金融银行与地产因行业特殊性通常负债率较高需结合流动比率与利息保障倍数综合研判。</li>
          <li><strong>每股经营现金流对比</strong>：优质企业的经营现金流净额通常高于净利润（现金流含金量高），说明应收账款周转顺畅、不存在虚增利润。</li>
        </ul>
      </div>
    </div>
  );
};
