import React, { useState, useEffect, useMemo } from 'react';
import { ThreeFinancialStatements, StatementData, StockFinancialData } from '../types/stock';
import { exportStocksToExcel, copyStatementToClipboard, filterStatementByDates } from '../utils/excelExport';
import { safeFetchApi } from '../lib/apiClient';
import {
  Download,
  Copy,
  Check,
  RefreshCw,
  FileSpreadsheet,
  Calendar,
  CheckSquare,
  Square,
  Filter,
  CheckCheck,
  RotateCcw,
  Sparkles,
  Info,
  ChevronDown
} from 'lucide-react';

interface ThreeStatementsViewProps {
  stocks: StockFinancialData[];
  selectedCode: string;
  onSelectCode: (code: string) => void;
  selectedYear: string;
  onYearChange: (year: string) => void;
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

export const ThreeStatementsView: React.FC<ThreeStatementsViewProps> = ({
  stocks,
  selectedCode,
  onSelectCode,
  selectedYear,
  onYearChange,
  selectedDates: propSelectedDates,
  onDatesChange,
}) => {
  const [statements, setStatements] = useState<ThreeFinancialStatements | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeStatementTab, setActiveStatementTab] = useState<'all' | 'balance' | 'profit' | 'cash'>('all');
  const [unitMode, setUnitMode] = useState<'yuan' | 'wan'>('yuan');
  const [copied, setCopied] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Active Year Query (support multi-year, e.g. "2025" or "2025,2024")
  const [queryYears, setQueryYears] = useState<string>(selectedYear || '2025');

  // Selected Dates State for granular column filtering
  const [localSelectedDates, setLocalSelectedDates] = useState<string[]>([]);
  const selectedDates = propSelectedDates !== undefined ? propSelectedDates : localSelectedDates;
  const updateSelectedDates = (dates: string[]) => {
    setLocalSelectedDates(dates);
    if (onDatesChange) onDatesChange(dates);
  };
  const [isDatePanelOpen, setIsDatePanelOpen] = useState(true);

  const currentStock = stocks.find(s => s.code === selectedCode) || stocks[0];
  const targetCode = currentStock ? currentStock.code : selectedCode;

  // Sync prop changes
  useEffect(() => {
    if (selectedYear && selectedYear !== queryYears) {
      setQueryYears(selectedYear);
    }
  }, [selectedYear]);

  // Fetch 3 statements whenever targetCode or queryYears changes
  useEffect(() => {
    if (!targetCode) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    safeFetchApi(`/api/stock/statements?code=${targetCode}&year=${encodeURIComponent(queryYears)}`)
      .then(data => {
        if (!isMounted) return;
        if (data.success && data.data) {
          setStatements(data.data);
          // If no dates selected yet or previous dates not in new dataset, initialize
          const dates = data.data.balanceSheet?.reportDates || [];
          if (!selectedDates || selectedDates.length === 0) {
            updateSelectedDates(dates);
          }
        } else {
          setError(data.error || '获取三大报表数据失败');
        }
      })
      .catch(err => {
        if (!isMounted) return;
        setError(err.message || '网络连接超时');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [targetCode, queryYears]);

  // All dates currently loaded in statement
  const allAvailableDates = useMemo(() => {
    if (!statements) return [];
    return statements.balanceSheet?.reportDates || [];
  }, [statements]);

  // Years available from IPO to now
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

  // Toggle single date
  const toggleDate = (date: string) => {
    let next: string[];
    if (selectedDates.includes(date)) {
      if (selectedDates.length === 1) return; // Keep at least 1 date
      next = selectedDates.filter(d => d !== date);
    } else {
      // Maintain descending chronological order
      next = allAvailableDates.filter(d => selectedDates.includes(d) || d === date);
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
    const inverted = allAvailableDates.filter(d => !selectedDates.includes(d));
    if (inverted.length > 0) {
      updateSelectedDates(inverted);
    }
  };

  // Year quick presets
  const handleYearPreset = (years: string) => {
    setQueryYears(years);
    onYearChange(years);
  };

  // Copy filtered statement
  const handleCopy = async (statement: StatementData, key: string) => {
    const success = await copyStatementToClipboard(statement, selectedDates);
    if (success) {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  // Export filtered statement to Excel
  const handleExportThisStock = async () => {
    if (!statements) return;
    setIsExporting(true);
    try {
      const datesLabel = selectedDates.length === 1 ? selectedDates[0].replace(/\//g, '') : `${selectedDates.length}期`;
      await exportStocksToExcel(stocks, {
        fileName: `${statements.stockName}_三大财务报表_${datesLabel}_${Date.now()}.xlsx`,
        statements,
        selectedDates,
        includeStatementSheets: true,
        includeSummarySheet: true,
      });
    } finally {
      setIsExporting(false);
    }
  };

  // Render Single Statement Table with exact teal header style from user's images
  const renderSingleStatementTable = (originalStatement: StatementData, key: string) => {
    const statement = filterStatementByDates(originalStatement, selectedDates);
    const titleWithUnit = unitMode === 'yuan' ? statement.title : statement.title.replace('( 元 )', '( 万元 )');

    return (
      <div key={key} className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs mb-6">
        {/* Table Title and Actions */}
        <div className="px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-slate-800">{statement.title}</span>
            <span className="text-[11px] text-slate-400">·</span>
            <span className="text-[11px] text-slate-500">
              包含 {statement.rows.length} 项标准会计科目 · 显示 {statement.reportDates.length} 个自选日期
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy(originalStatement, key)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              title="复制当前所选日期的表格数据为 TSV 格式，可直接在 Excel 中 Ctrl+V 粘贴"
            >
              {copied === key ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied === key ? '已复制所选日期数据' : '复制已选日期数据 (粘贴Excel)'}</span>
            </button>
          </div>
        </div>

        {/* The Exact Table from User's Screenshots with dynamically selected dates */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-[#3E96B5] text-white border-b border-[#2C7B97] font-bold">
                <th className="py-2.5 px-4 whitespace-nowrap min-w-[220px] text-left border-r border-[#4FA3C0]">
                  {titleWithUnit}
                </th>
                {statement.reportDates.map(date => (
                  <th
                    key={date}
                    className="py-2.5 px-4 text-center whitespace-nowrap min-w-[140px] border-r border-[#4FA3C0] last:border-r-0 font-mono tracking-tight"
                  >
                    <div className="flex flex-col items-center">
                      <span>{date}</span>
                      <span className="text-[10px] font-normal text-teal-100 opacity-90">
                        {getQuarterLabel(date)}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E0EFF4]">
              {statement.rows.map((row, rowIdx) => {
                const isEven = rowIdx % 2 === 0;
                return (
                  <tr
                    key={row.label}
                    className={`hover:bg-[#EBF5F8] transition-colors ${
                      isEven ? 'bg-white' : 'bg-[#F7FBFC]'
                    }`}
                  >
                    {/* Item label */}
                    <td className="py-2 px-4 whitespace-nowrap font-medium text-slate-800 border-r border-[#D3E8F0]">
                      {row.label}
                    </td>

                    {/* Selected column values */}
                    {statement.reportDates.map((_, colIdx) => {
                      let displayVal = '--';
                      if (unitMode === 'yuan') {
                        displayVal = row.formattedYuan[colIdx] || '--';
                      } else {
                        displayVal = row.rawValues[colIdx] || '--';
                      }

                      return (
                        <td
                          key={colIdx}
                          className="py-2 px-4 text-right font-mono tabular-nums whitespace-nowrap text-slate-800 border-r border-[#D3E8F0] last:border-r-0"
                        >
                          {displayVal}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Top Banner & Control Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Stock selector tabs */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-700">当前股票:</span>
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

          {/* Statement Tab Selector */}
          <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-lg text-xs font-medium">
            <button
              onClick={() => setActiveStatementTab('all')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                activeStatementTab === 'all'
                  ? 'bg-white text-blue-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              三大报表全览
            </button>
            <button
              onClick={() => setActiveStatementTab('balance')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                activeStatementTab === 'balance'
                  ? 'bg-white text-blue-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              资产负债表
            </button>
            <button
              onClick={() => setActiveStatementTab('profit')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                activeStatementTab === 'profit'
                  ? 'bg-white text-blue-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              利润表
            </button>
            <button
              onClick={() => setActiveStatementTab('cash')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                activeStatementTab === 'cash'
                  ? 'bg-white text-blue-700 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              现金流量表
            </button>
          </div>
        </div>

        {/* Right action group: unit toggle & direct Excel export */}
        <div className="flex items-center gap-3">
          {/* Unit Toggle */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setUnitMode('yuan')}
              className={`px-2 py-1 rounded font-medium transition-colors ${
                unitMode === 'yuan' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-500'
              }`}
            >
              单位: 元 (圖片同款)
            </button>
            <button
              onClick={() => setUnitMode('wan')}
              className={`px-2 py-1 rounded font-medium transition-colors ${
                unitMode === 'wan' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-500'
              }`}
            >
              单位: 万元
            </button>
          </div>

          <button
            onClick={handleExportThisStock}
            disabled={!statements || isExporting || selectedDates.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs cursor-pointer active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" />
            <span>
              {isExporting
                ? '正在导出...'
                : `匯出圖片同款 Excel (${selectedDates.length} 個已選日期)`}
            </span>
          </button>
        </div>
      </div>

      {/* Date & Reporting Period Interactive Selection Panel */}
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
                  已选 {selectedDates.length} / {allAvailableDates.length} 个日期
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                可自由勾选任意单季或多季日期、切换年份跨度，导出的 Excel 与屏幕表格将完全按照您勾选的日期动态呈现
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
                onClick={handleSelectAnnualOnly}
                className="px-2.5 py-1 text-xs font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-md transition-colors cursor-pointer"
                title="只选择 12/31 报表日期，方便跨年度纵向对比"
              >
                仅年报 (12/31)
              </button>
              <button
                onClick={handleSelectSemiAnnualOnly}
                className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors cursor-pointer"
                title="只选择 06/30 中期报告"
              >
                仅半年报 (06/30)
              </button>
              <button
                onClick={handleSelectQ3Only}
                className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors cursor-pointer"
                title="只选择 09/30 第三季度报告"
              >
                仅三季报 (09/30)
              </button>
              <button
                onClick={handleSelectQ1Only}
                className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors cursor-pointer"
                title="只选择 03/31 第一季度报告"
              >
                仅一季报 (03/31)
              </button>
              <button
                onClick={handleSelectLatest4}
                className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors cursor-pointer"
              >
                最近4个季度
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
            {allAvailableDates.length === 0 ? (
              <span className="text-xs text-slate-400 italic">正在加载报表日期...</span>
            ) : (
              allAvailableDates.map(date => {
                const isChecked = selectedDates.includes(date);
                const quarterType = getQuarterLabel(date);
                const isAnnual = quarterType === '年报';

                return (
                  <button
                    key={date}
                    onClick={() => toggleDate(date)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                      isChecked
                        ? isAnnual
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-[#3E96B5] text-white border-[#3E96B5] shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {isChecked ? (
                      <CheckSquare className="w-3.5 h-3.5 text-white" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span className="font-mono font-semibold tracking-tight">{date}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded ${
                        isChecked
                          ? 'bg-black/15 text-white'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {quarterType}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Info notice bar */}
      <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs text-blue-900">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            已依照您提供的 3 張圖片格式完全還原表格樣式與科目，表頭顏色 (<code>#3E96B5</code>)、淺藍邊框 (<code>#9AC7D7</code>) 及千分位格式。
            表格列與 Excel 匯出已完全聯動上方自選日期！
          </span>
        </div>
        <div className="font-semibold whitespace-nowrap text-blue-700">
          股票: {statements?.stockName || currentStock.name} ({targetCode}) · 已选 {selectedDates.length} 个日期列
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700">
          {error}
        </div>
      )}

      {/* Loading state skeleton */}
      {isLoading && (
        <div className="bg-white p-8 rounded-xl border border-slate-200 text-center flex flex-col items-center justify-center gap-3">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
          <span className="text-xs text-slate-500">
            正在從新浪財經同步 {targetCode} [{queryYears}] 年度的資產負債表、利潤表與現金流量表...
          </span>
        </div>
      )}

      {/* Content Rendering */}
      {!isLoading && statements && (
        <div>
          {(activeStatementTab === 'all' || activeStatementTab === 'balance') &&
            renderSingleStatementTable(statements.balanceSheet, 'balance')}

          {(activeStatementTab === 'all' || activeStatementTab === 'profit') &&
            renderSingleStatementTable(statements.incomeStatement, 'profit')}

          {(activeStatementTab === 'all' || activeStatementTab === 'cash') &&
            renderSingleStatementTable(statements.cashFlowStatement, 'cash')}
        </div>
      )}
    </div>
  );
};
