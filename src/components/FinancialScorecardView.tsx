import React, { useState, useEffect, useMemo } from 'react';
import { StockFinancialData, ThreeFinancialStatements, FinancialScorecardData } from '../types/stock';
import { buildFinancialScorecard, dateToQuarterLabel } from '../utils/scorecardBuilder';
import { safeFetchApi } from '../lib/apiClient';
import { exportScorecardToExcel, copyScorecardToClipboard } from '../utils/excelExport';
import {
  Download,
  Copy,
  Check,
  Info,
  Sparkles,
  TableProperties,
  Calendar,
  CheckSquare,
  Square,
  Filter,
  CheckCheck,
  RotateCcw,
} from 'lucide-react';

interface FinancialScorecardViewProps {
  stocks: StockFinancialData[];
  selectedCode: string;
  onSelectCode: (code: string) => void;
  selectedYear: string;
  onYearChange?: (year: string) => void;
  selectedDates?: string[];
  onDatesChange?: (dates: string[]) => void;
}

// Helper to determine quarter type label
function getQuarterLabel(dateStr: string): string {
  if (dateStr.endsWith('12/31') || dateStr.endsWith('12-31')) return '年报';
  if (dateStr.endsWith('09/30') || dateStr.endsWith('9/30') || dateStr.endsWith('09-30')) return '三季报';
  if (dateStr.endsWith('06/30') || dateStr.endsWith('6/30') || dateStr.endsWith('06-30')) return '中报';
  if (dateStr.endsWith('03/31') || dateStr.endsWith('3/31') || dateStr.endsWith('03-31')) return '一季报';
  return '定期报告';
}

export const FinancialScorecardView: React.FC<FinancialScorecardViewProps> = ({
  stocks,
  selectedCode,
  onSelectCode,
  selectedYear,
  onYearChange,
  selectedDates: propSelectedDates,
  onDatesChange,
}) => {
  const currentStock = stocks.find(s => s.code === selectedCode) || stocks[0];
  const targetCode = currentStock ? currentStock.code : selectedCode;

  const [statements, setStatements] = useState<ThreeFinancialStatements | null>(null);
  const [viewMode, setViewMode] = useState<'with_score' | 'value_only'>('with_score');
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Active Year Query (supports multi-year, e.g. "2025" or "2025,2024")
  const [queryYears, setQueryYears] = useState<string>(selectedYear || '2025');

  // Selected Dates State for granular quarter/date selection, linked with ThreeStatementsView
  const [localSelectedDates, setLocalSelectedDates] = useState<string[]>([]);
  const selectedDates = propSelectedDates !== undefined ? propSelectedDates : localSelectedDates;
  const updateSelectedDates = (dates: string[]) => {
    setLocalSelectedDates(dates);
    if (onDatesChange) onDatesChange(dates);
  };

  // User manual score overrides: keyed by `${itemId}_${quarterLabel}` (e.g. `gross_margin_2025Q3`)
  const [customScores, setCustomScores] = useState<Record<string, number>>({});

  // Sync selectedYear prop
  useEffect(() => {
    if (selectedYear && selectedYear !== queryYears) {
      setQueryYears(selectedYear);
    }
  }, [selectedYear]);

  // Fetch statements for targetCode and queryYears
  useEffect(() => {
    if (!targetCode) return;
    let isMounted = true;
    safeFetchApi(`/api/stock/statements?code=${targetCode}&year=${encodeURIComponent(queryYears)}`)
      .then(res => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setStatements(res.data);
          const dates = res.data.balanceSheet?.reportDates || [];
          if ((!selectedDates || selectedDates.length === 0) && dates.length > 0) {
            updateSelectedDates(dates.slice(0, 4));
          }
        }
      })
      .catch(() => {
        // statements optional; scorecard still renders from indicators
      });

    return () => {
      isMounted = false;
    };
  }, [targetCode, queryYears]);

  // All available dates from statements, stock indicators, or default 4 quarters
  const allAvailableDates = useMemo(() => {
    if (statements?.balanceSheet?.reportDates && statements.balanceSheet.reportDates.length > 0) {
      return statements.balanceSheet.reportDates;
    }
    if (currentStock?.reportDates && currentStock.reportDates.length > 0) {
      return currentStock.reportDates;
    }
    const currentYr = new Date().getFullYear();
    const yr = queryYears.includes(',') ? queryYears.split(',')[0] : (queryYears || String(currentYr));
    return [`${yr}/12/31`, `${yr}/09/30`, `${yr}/06/30`, `${yr}/03/31`];
  }, [statements, currentStock, queryYears]);

  // Available Years list from IPO to now
  const availableYearsList = useMemo(() => {
    if (statements?.availableYears && statements.availableYears.length > 0) {
      return statements.availableYears;
    }
    const currentYr = new Date().getFullYear();
    const list: string[] = [];
    for (let y = currentYr + 1; y >= 2018; y--) {
      list.push(String(y));
    }
    return list;
  }, [statements]);

  // Active selected dates for scorecard (fallback to top 4 if none selected)
  const effectiveSelectedDates = useMemo(() => {
    if (selectedDates && selectedDates.length > 0) {
      return selectedDates;
    }
    return allAvailableDates.slice(0, 4);
  }, [selectedDates, allAvailableDates]);

  // Build the scorecard model with the exact selected dates and quarters
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

    const base = buildFinancialScorecard(
      currentStock,
      statements || undefined,
      effectiveSelectedDates,
      queryYears
    );

    // Apply any user overrides (keyed by item id and quarter label)
    if (Object.keys(customScores).length > 0) {
      base.items.forEach(item => {
        item.quarterScores = item.quarterScores.map((defaultScore, qIdx) => {
          const qLabel = base.quarters[qIdx];
          const key = `${item.id}_${qLabel}`;
          return customScores[key] !== undefined ? customScores[key] : defaultScore;
        });
      });

      // Recalculate totals and ratings
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
  }, [currentStock, statements, targetCode, effectiveSelectedDates, queryYears, customScores]);

  // Handle score change
  const handleScoreChange = (itemId: string, qIdx: number, val: number) => {
    const qLabel = scorecardData.quarters[qIdx];
    setCustomScores(prev => ({
      ...prev,
      [`${itemId}_${qLabel}`]: val,
    }));
  };

  // Reset custom scores to auto-calculated defaults
  const handleResetScores = () => {
    setCustomScores({});
  };

  // Toggle single date in filter
  const toggleDate = (date: string) => {
    let next: string[];
    if (effectiveSelectedDates.includes(date)) {
      if (effectiveSelectedDates.length === 1) return; // Keep at least 1 date
      next = effectiveSelectedDates.filter(d => d !== date);
    } else {
      next = allAvailableDates.filter(d => effectiveSelectedDates.includes(d) || d === date);
    }
    updateSelectedDates(next);
  };

  // Quick Date Filter Actions
  const handleSelectAllDates = () => {
    updateSelectedDates([...allAvailableDates]);
  };

  const handleSelectAnnualOnly = () => {
    const annuals = allAvailableDates.filter(d => d.endsWith('12/31') || d.endsWith('12-31'));
    if (annuals.length > 0) {
      updateSelectedDates(annuals);
    } else {
      updateSelectedDates([...allAvailableDates]);
    }
  };

  const handleSelectSemiAnnualOnly = () => {
    const semis = allAvailableDates.filter(d => d.endsWith('06/30') || d.endsWith('6/30') || d.endsWith('06-30'));
    if (semis.length > 0) {
      updateSelectedDates(semis);
    }
  };

  const handleSelectQ3Only = () => {
    const q3s = allAvailableDates.filter(d => d.endsWith('09/30') || d.endsWith('9/30') || d.endsWith('09-30'));
    if (q3s.length > 0) {
      updateSelectedDates(q3s);
    }
  };

  const handleSelectQ1Only = () => {
    const q1s = allAvailableDates.filter(d => d.endsWith('03/31') || d.endsWith('3/31') || d.endsWith('03-31'));
    if (q1s.length > 0) {
      updateSelectedDates(q1s);
    }
  };

  const handleSelectLatest4 = () => {
    updateSelectedDates(allAvailableDates.slice(0, 4));
  };

  const handleInvertDates = () => {
    const inverted = allAvailableDates.filter(d => !effectiveSelectedDates.includes(d));
    if (inverted.length > 0) {
      updateSelectedDates(inverted);
    }
  };

  // Year quick presets
  const handleYearPreset = (years: string) => {
    setQueryYears(years);
    if (onYearChange) {
      onYearChange(years);
    }
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
      const datesLabel =
        effectiveSelectedDates.length === 1
          ? effectiveSelectedDates[0].replace(/\//g, '')
          : `${effectiveSelectedDates.length}期`;
      await exportScorecardToExcel(scorecardData, {
        fileName: `${scorecardData.stockName}_季度财报评分诊断_${datesLabel}_${Date.now()}.xlsx`,
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
            disabled={isExporting || effectiveSelectedDates.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs cursor-pointer active:scale-98"
          >
            <Download className="w-3.5 h-3.5" />
            <span>
              {isExporting ? '正在生成...' : `导出评分表 (${effectiveSelectedDates.length} 季度)`}
            </span>
          </button>
        </div>
      </div>

      {/* 报表报告日期与季度自选 (与三大财务报表完全实时联动) */}
      <div className="bg-white rounded-xl border border-blue-200/80 shadow-xs overflow-hidden">
        {/* Panel Header */}
        <div className="px-5 py-3.5 bg-blue-50/50 border-b border-blue-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-900">报表报告日期与季度自选</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-blue-700">
                  已选 {effectiveSelectedDates.length} / {allAvailableDates.length} 个季度 (与三大报表实时联动)
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                勾选任意单季或多季、切换年份跨度，下方图片同款评分表将完全按照您勾选的季度与日期动态重组与评分
              </p>
            </div>
          </div>

          {/* Year Range Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">年份跨度:</span>
            <div className="flex flex-wrap items-center gap-1">
              <button
                onClick={() => handleYearPreset('2025')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  queryYears === '2025'
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                2025 年 (4季)
              </button>
              <button
                onClick={() => handleYearPreset('2024')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  queryYears === '2024'
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                2024 年 (4季)
              </button>
              <button
                onClick={() => handleYearPreset('2025,2024')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  queryYears === '2025,2024'
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                近2年 (8季: 2025+2024)
              </button>
              <button
                onClick={() => handleYearPreset('2025,2024,2023')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  queryYears === '2025,2024,2023'
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                近3年 (12季)
              </button>
              <button
                onClick={() => handleYearPreset('2025,2024,2023,2022,2021')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  queryYears === '2025,2024,2023,2022,2021'
                    ? 'bg-blue-600 text-white font-semibold shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                近5年
              </button>

              {/* Specific Year Selector Dropdown */}
              <div className="relative inline-flex items-center">
                <select
                  value={queryYears.includes(',') ? 'custom' : queryYears}
                  onChange={e => {
                    if (e.target.value !== 'custom') {
                      handleYearPreset(e.target.value);
                    }
                  }}
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded-md text-xs text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="custom" disabled={!queryYears.includes(',')}>
                    {queryYears.includes(',') ? '已选多年度组合' : '选择具体年份...'}
                  </option>
                  {availableYearsList.slice(0, 15).map(yr => (
                    <option key={yr} value={yr}>
                      {yr} 年度报告
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Date Checklist and Quick Filters */}
        <div className="p-4 bg-white flex flex-col gap-3">
          {/* Quick Action Filter Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              <span>快捷选择:</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={handleSelectAllDates}
                className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors cursor-pointer flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>全选所有日期 ({allAvailableDates.length})</span>
              </button>
              <button
                onClick={handleSelectLatest4}
                className="px-2.5 py-1 text-xs font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md transition-colors cursor-pointer"
              >
                最近4个季度 (默认)
              </button>
              <button
                onClick={handleSelectAnnualOnly}
                className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors cursor-pointer"
                title="只选择 12/31 报表日期"
              >
                仅年报 (Q4)
              </button>
              <button
                onClick={handleSelectSemiAnnualOnly}
                className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors cursor-pointer"
                title="只选择 06/30 中期报告"
              >
                仅半年报 (Q2)
              </button>
              <button
                onClick={handleSelectQ3Only}
                className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors cursor-pointer"
                title="只选择 09/30 第三季度报告"
              >
                仅三季报 (Q3)
              </button>
              <button
                onClick={handleSelectQ1Only}
                className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors cursor-pointer"
                title="只选择 03/31 第一季度报告"
              >
                仅一季报 (Q1)
              </button>
              <button
                onClick={handleInvertDates}
                className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors cursor-pointer flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>反选</span>
              </button>
            </div>
          </div>

          {/* Interactive Checkbox Chips for all loaded dates */}
          <div className="flex flex-wrap gap-2 pt-1">
            {allAvailableDates.map(date => {
              const isSelected = effectiveSelectedDates.includes(date);
              const qType = getQuarterLabel(date);
              const qLabel = dateToQuarterLabel(date);
              return (
                <button
                  key={date}
                  onClick={() => toggleDate(date)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all border cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs font-semibold'
                      : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  {isSelected ? (
                    <CheckSquare className="w-3.5 h-3.5 text-white" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span className="font-bold">{qLabel}</span>
                  <span className="opacity-90">({date})</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[10px] font-sans ${
                      isSelected ? 'bg-blue-700/60 text-blue-100' : 'bg-slate-200/80 text-slate-600'
                    }`}
                  >
                    {qType}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Info Notice */}
      <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-900">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            已依照您提供的 2 张图片格式完全还原：包含<strong>「获利能力」</strong>、<strong>「财务结构」</strong>（红字流动资产/总资产）、<strong>「现金流量」</strong>三大类别，
            各列季度与报表日期完全动态连动。底部的<strong>「当季财报评分结果」</strong>根据所选季度自动汇总并判定状态。
          </span>
        </div>
        <div className="font-semibold text-amber-800">
          股票: {scorecardData.stockName} ({scorecardData.stockCode}) · 当前展示 {scorecardData.quarters.length} 个季度
        </div>
      </div>

      {/* TABLE 1: Image 2 Exact Match (Peach header, Pink categories, Score column, Bottom Rating Row) */}
      {viewMode === 'with_score' && (
        <div className="bg-white rounded-xl border border-slate-800 overflow-hidden shadow-xs">
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
                        {/* Merged Category Column A: Pink background #FAD2E1 */}
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

                {/* Bottom Row: 当季财报评分结果-- */}
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

      {/* TABLE 2: Image 1 Exact Match (Lavender header, Pure multi-quarter values) */}
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
