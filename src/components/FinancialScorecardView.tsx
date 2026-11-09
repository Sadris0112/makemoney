import React, { useState, useEffect, useMemo } from 'react';
import { StockFinancialData, ThreeFinancialStatements, FinancialScorecardData } from '../types/stock';
import { buildFinancialScorecard } from '../utils/scorecardBuilder';
import { safeFetchApi } from '../lib/apiClient';
import { exportScorecardToExcel, copyScorecardToClipboard } from '../utils/excelExport';
import { Download, Copy, Check, Info, Sparkles, SlidersHorizontal, TableProperties } from 'lucide-react';

interface FinancialScorecardViewProps {
  stocks: StockFinancialData[];
  selectedCode: string;
  onSelectCode: (code: string) => void;
  selectedYear: string;
}

export const FinancialScorecardView: React.FC<FinancialScorecardViewProps> = ({
  stocks,
  selectedCode,
  onSelectCode,
  selectedYear,
}) => {
  const currentStock = stocks.find(s => s.code === selectedCode) || stocks[0];
  const targetCode = currentStock ? currentStock.code : selectedCode;

  const [statements, setStatements] = useState<ThreeFinancialStatements | null>(null);
  const [viewMode, setViewMode] = useState<'with_score' | 'value_only'>('with_score');
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // User manual score overrides: key is `${itemId}_${quarterIndex}`
  const [customScores, setCustomScores] = useState<Record<string, number>>({});

  // Fetch statements if needed for balance sheet & cash flow values
  useEffect(() => {
    if (!targetCode) return;
    let isMounted = true;
    safeFetchApi(`/api/stock/statements?code=${targetCode}&year=${selectedYear || '2025'}`)
      .then(res => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setStatements(res.data);
        }
      })
      .catch(() => {
        // statements optional; scorecard still renders from indicators
      });

    return () => {
      isMounted = false;
    };
  }, [targetCode, selectedYear]);

  // Build the scorecard model
  const scorecardData: FinancialScorecardData = useMemo(() => {
    if (!currentStock) {
      return {
        stockCode: targetCode,
        stockName: targetCode,
        quarters: ['2025Q4', '2025Q3', '2025Q2', '2025Q1'],
        reportDates: ['2025/12/31', '2025/09/30', '2025/06/30', '2025/03/31'],
        items: [],
        quarterTotalScores: [28, 28, 28, 28],
        quarterRatings: ['观望', '观望', '观望', '观望'],
      };
    }

    const base = buildFinancialScorecard(currentStock, statements || undefined);

    // Apply any user overrides
    if (Object.keys(customScores).length > 0) {
      base.items.forEach(item => {
        item.quarterScores = item.quarterScores.map((defaultScore, qIdx) => {
          const key = `${item.id}_${qIdx}`;
          return customScores[key] !== undefined ? customScores[key] : defaultScore;
        });
      });

      // Recalculate totals
      const numQuarters = base.quarters.length;
      const newTotals: number[] = [];
      const newRatings: string[] = [];

      for (let q = 0; q < numQuarters; q++) {
        let sum = 0;
        base.items.forEach(item => {
          sum += item.quarterScores[q] || 0;
        });
        newTotals.push(sum);
        if (sum >= 30) newRatings.push('优秀');
        else if (sum >= 25) newRatings.push('观望');
        else if (sum >= 18) newRatings.push('关注');
        else newRatings.push('预警');
      }

      base.quarterTotalScores = newTotals;
      base.quarterRatings = newRatings;
    }

    return base;
  }, [currentStock, statements, targetCode, customScores]);

  // Handle score change
  const handleScoreChange = (itemId: string, qIdx: number, val: number) => {
    setCustomScores(prev => ({
      ...prev,
      [`${itemId}_${qIdx}`]: val,
    }));
  };

  // Reset custom scores to auto-calculated defaults
  const handleResetScores = () => {
    setCustomScores({});
  };

  // Copy TSV for Excel
  const handleCopy = async () => {
    const success = await copyScorecardToClipboard(scorecardData, viewMode);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Direct Excel Export
  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportScorecardToExcel(scorecardData, {
        fileName: `${scorecardData.stockName}_季度财报评分诊断_${Date.now()}.xlsx`,
        viewMode,
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Categories grouping for row-spanning
  const categoriesList = ['获利能力', '财务结构', '现金流量'] as const;

  // Helper for badge color in bottom summary row
  const getRatingBadgeStyle = (rating: string) => {
    if (rating === '优秀') return 'bg-[#86EFAC] text-emerald-950 border-[#4ADE80]';
    if (rating === '观望') return 'bg-[#FBBF24] text-amber-950 border-[#F59E0B]';
    if (rating === '关注') return 'bg-[#F97316] text-white border-[#EA580C]';
    return 'bg-[#EF4444] text-white border-[#DC2626]';
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Top Banner Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Stock selector tabs */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-700">切换股票:</span>
            <div className="flex flex-wrap gap-1">
              {stocks.map(s => (
                <button
                  key={s.code}
                  onClick={() => onSelectCode(s.code)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    s.code === targetCode
                      ? 'bg-blue-600 text-white shadow-xs font-semibold'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {s.name} ({s.code})
                </button>
              ))}
            </div>
          </div>

          <div className="h-6 w-px bg-slate-200 hidden md:block" />

          {/* View Mode Toggle: Image 2 vs Image 1 */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg text-xs font-medium">
            <button
              onClick={() => setViewMode('with_score')}
              className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                viewMode === 'with_score'
                  ? 'bg-white text-blue-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>评分与得分综合表 (图片二同款)</span>
            </button>
            <button
              onClick={() => setViewMode('value_only')}
              className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                viewMode === 'value_only'
                  ? 'bg-white text-blue-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableProperties className="w-3.5 h-3.5" />
              <span>季度指标明细表 (图片一同款)</span>
            </button>
          </div>
        </div>

        {/* Right actions: Export and Copy */}
        <div className="flex items-center gap-2.5">
          {Object.keys(customScores).length > 0 && (
            <button
              onClick={handleResetScores}
              className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
            >
              还原自动评分
            </button>
          )}

          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            title="复制 TSV 格式数据，可在 Excel 中直接 Ctrl+V 粘贴"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
            <span>{copied ? '已复制表格' : '复制数据 (粘贴Excel)'}</span>
          </button>

          <button
            onClick={handleExport}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs cursor-pointer active:scale-98"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? '正在生成...' : '匯出圖片同款評分表 (.xlsx)'}</span>
          </button>
        </div>
      </div>

      {/* Info Notice */}
      <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            已依照您上傳的 2 張圖片格式完全還原：包含<strong>「獲利能力」</strong>、<strong>「財務結構」</strong>（紅字流動資產/總資產）、<strong>「現金流量」</strong>三大類別，
            精確對應各季 % 數值、得分與底部的<strong>「當季財報評分結果」</strong>。數值支援點擊修改以利情境模擬。
          </span>
        </div>
        <div className="font-semibold text-amber-800">
          股票: {scorecardData.stockName} ({scorecardData.stockCode})
        </div>
      </div>

      {/* TABLE 1: Image 2 Exact Match (Peach header, Pink categories, Score column, Bottom Rating Row) */}
      {viewMode === 'with_score' && (
        <div className="bg-white rounded-xl border border-slate-300 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse border border-slate-800">
              <thead>
                {/* Row 1: Quarters headers with peach background #F6A974 */}
                <tr className="bg-[#F6A974] text-slate-900 border-b border-slate-800 font-bold text-center">
                  <th
                    rowSpan={2}
                    className="py-2.5 px-3 whitespace-nowrap min-w-[70px] text-center border-r border-slate-800 tracking-wider text-sm"
                  >
                    类别
                  </th>
                  <th
                    rowSpan={2}
                    className="py-2.5 px-4 whitespace-nowrap min-w-[190px] text-center border-r border-slate-800 tracking-wider text-sm"
                  >
                    评分项目
                  </th>
                  {scorecardData.quarters.map(q => (
                    <th
                      key={q}
                      colSpan={2}
                      className="py-2 px-3 whitespace-nowrap min-w-[140px] border-r border-slate-800 last:border-r-0 font-mono tracking-wider text-sm"
                    >
                      {q}
                    </th>
                  ))}
                </tr>

                {/* Row 2: Sub-columns % and 得分 */}
                <tr className="bg-[#F6A974] text-slate-900 border-b border-slate-800 font-bold text-center">
                  {scorecardData.quarters.map(q => (
                    <React.Fragment key={`${q}-sub`}>
                      <th className="py-1 px-3 border-r border-slate-800 text-center font-serif text-xs">
                        %
                      </th>
                      <th className="py-1 px-3 border-r border-slate-800 last:border-r-0 text-center font-serif text-xs">
                        得分
                      </th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800 text-slate-900">
                {categoriesList.map(cat => {
                  const catItems = scorecardData.items.filter(it => it.category === cat);
                  if (catItems.length === 0) return null;

                  return catItems.map((item, itemIdx) => {
                    return (
                      <tr key={item.id} className="hover:bg-amber-50/40 transition-colors">
                        {/* Merged Category Column A: Pink background #FCE7F3 */}
                        {itemIdx === 0 && (
                          <td
                            rowSpan={catItems.length}
                            className="bg-[#FAD2E1] border-r border-slate-800 py-3 px-2 text-center font-bold tracking-widest text-slate-900 align-middle whitespace-pre-line text-sm"
                            style={{ writingMode: 'vertical-rl' }}
                          >
                            {cat.split('').join(' ')}
                          </td>
                        )}

                        {/* Item Label */}
                        <td
                          className={`py-2 px-4 whitespace-nowrap font-medium border-r border-slate-800 text-sm ${
                            item.isRedLabel ? 'text-red-600 font-semibold' : 'text-slate-900'
                          }`}
                        >
                          {item.name}
                        </td>

                        {/* Quarter Value & Score pairs */}
                        {scorecardData.quarters.map((_, qIdx) => {
                          const val = item.quarterValues[qIdx];
                          const score = item.quarterScores[qIdx];
                          const formattedVal =
                            typeof val === 'number'
                              ? val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              : String(val || '0.00');

                          return (
                            <React.Fragment key={qIdx}>
                              {/* % Value */}
                              <td className="py-2 px-3 text-right font-mono tabular-nums whitespace-nowrap border-r border-slate-800 text-sm">
                                {formattedVal}
                              </td>

                              {/* Score column (user can click to tune) */}
                              <td className="py-2 px-3 text-center font-mono tabular-nums whitespace-nowrap border-r border-slate-800 last:border-r-0 text-sm">
                                <input
                                  type="number"
                                  min={0}
                                  max={item.maxScore}
                                  value={score}
                                  onChange={e =>
                                    handleScoreChange(item.id, qIdx, parseInt(e.target.value, 10) || 0)
                                  }
                                  className="w-10 text-center font-semibold bg-transparent hover:bg-slate-100 focus:bg-white focus:ring-1 focus:ring-blue-500 rounded cursor-pointer"
                                  title={`点击可自订得分 (上限 ${item.maxScore} 分)`}
                                />
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    );
                  });
                })}

                {/* Bottom Row 28: 当季财报评分结果-- */}
                <tr className="border-t-2 border-slate-900 font-bold">
                  {/* Left Title: Sky blue fill #5B9BD5 */}
                  <td
                    colSpan={2}
                    className="bg-[#5B9BD5] text-slate-950 py-3 px-4 text-center font-bold tracking-wider text-sm border-r border-slate-800"
                  >
                    当季财报评分结果--
                  </td>

                  {/* Under each quarter: Rating Status & Total Score */}
                  {scorecardData.quarters.map((_, qIdx) => {
                    const rating = scorecardData.quarterRatings[qIdx] || '观望';
                    const totalScore = scorecardData.quarterTotalScores[qIdx] || 28;
                    const badgeStyle = getRatingBadgeStyle(rating);

                    return (
                      <React.Fragment key={`total-${qIdx}`}>
                        {/* Rating text: e.g. 观望 (Red / Yellow / Green fill like in image) */}
                        <td
                          className={`py-2 px-3 text-center border-r border-slate-800 font-bold text-sm tracking-wider ${badgeStyle}`}
                        >
                          {rating}
                        </td>

                        {/* Total Score: e.g. 28 */}
                        <td className="py-2 px-3 text-center font-mono font-bold text-base border-r border-slate-800 last:border-r-0 bg-white text-slate-900">
                          {totalScore}
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TABLE 2: Image 1 Exact Match (Lavender header, Pure 4-quarter values) */}
      {viewMode === 'value_only' && (
        <div className="bg-white rounded-xl border border-blue-900 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse border border-blue-900">
              <thead>
                <tr className="bg-[#D4D8F0] text-blue-950 border-b border-blue-900 font-bold text-center">
                  <th className="py-2.5 px-3 whitespace-nowrap min-w-[70px] text-center border-r border-blue-900 text-sm">
                    类别
                  </th>
                  <th className="py-2.5 px-4 whitespace-nowrap min-w-[190px] text-center border-r border-blue-900 text-sm">
                    评分项目
                  </th>
                  {scorecardData.quarters.map(q => (
                    <th
                      key={q}
                      className="py-2.5 px-4 text-center whitespace-nowrap min-w-[130px] border-r border-blue-900 last:border-r-0 font-mono text-sm tracking-tight text-blue-900"
                    >
                      {q}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-blue-800 text-slate-900">
                {categoriesList.map(cat => {
                  const catItems = scorecardData.items.filter(it => it.category === cat);
                  if (catItems.length === 0) return null;

                  return catItems.map((item, itemIdx) => {
                    return (
                      <tr key={item.id} className="hover:bg-blue-50/30 transition-colors">
                        {itemIdx === 0 && (
                          <td
                            rowSpan={catItems.length}
                            className="bg-white border-r border-blue-900 py-3 px-2 text-center font-medium tracking-widest text-slate-800 align-middle whitespace-pre-line text-sm"
                            style={{ writingMode: 'vertical-rl' }}
                          >
                            {cat === '现金流量' ? '流 现\n量 金' : cat.split('').join(' ')}
                          </td>
                        )}

                        <td
                          className={`py-2 px-4 whitespace-nowrap font-medium border-r border-blue-900 text-sm ${
                            item.isRedLabel ? 'text-red-600 font-semibold' : 'text-slate-900'
                          }`}
                        >
                          {item.name}
                        </td>

                        {scorecardData.quarters.map((_, qIdx) => {
                          const val = item.quarterValues[qIdx];
                          const formattedVal =
                            typeof val === 'number'
                              ? val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              : String(val || '0.00');

                          return (
                            <td
                              key={qIdx}
                              className="py-2 px-4 text-right font-mono tabular-nums whitespace-nowrap border-r border-blue-900 last:border-r-0 text-slate-800 text-sm"
                            >
                              {formattedVal}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
