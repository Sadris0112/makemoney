import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, X, Layers, Sparkles, ChevronDown, Calendar, AlertCircle } from 'lucide-react';
import { StockSuggestion } from '../types/stock';

interface StockSearchInputProps {
  selectedCodes: string[];
  onCodesChange: (codes: string[]) => void;
  selectedYear: string;
  onYearChange: (year: string) => void;
  onFetchData: () => void;
  isLoading: boolean;
  stockNamesMap?: Record<string, string>;
}

const PRESET_BASKETS = [
  {
    name: '白酒龙头',
    description: '茅台/五粮液/老窖/汾酒',
    codes: ['600519', '000858', '000568', '600809'],
  },
  {
    name: '新能源与汽车',
    description: '宁德时代/比亚迪/亿纬锂能',
    codes: ['300750', '002594', '300014'],
  },
  {
    name: '核心大金融',
    description: '招商银行/中国平安/平安银行/中信证券',
    codes: ['600036', '601318', '000001', '600030'],
  },
  {
    name: '芯片半导体',
    description: '中芯国际/北方华创/韦尔股份',
    codes: ['688981', '002371', '603501'],
  },
  {
    name: '高股息红利',
    description: '长江电力/中国神华/中国海油',
    codes: ['600900', '601088', '600938'],
  },
];

const AVAILABLE_YEARS = [
  { value: '', label: '最新披露期 (默认)' },
  { value: '2026', label: '2026 年度报告期' },
  { value: '2025', label: '2025 年度报告期' },
  { value: '2024', label: '2024 年度报告期' },
  { value: '2023', label: '2023 年度报告期' },
  { value: '2022', label: '2022 年度报告期' },
];

export const StockSearchInput: React.FC<StockSearchInputProps> = ({
  selectedCodes,
  onCodesChange,
  selectedYear,
  onYearChange,
  onFetchData,
  isLoading,
  stockNamesMap = {},
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchInput, setBatchInput] = useState('');
  const [suggestions, setSuggestions] = useState<StockSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search for suggestions from Sina
  useEffect(() => {
    const q = inputValue.trim();
    if (!q || isBatchMode) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/stock/suggest?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.list) && data.list.length > 0) {
          // Filter to A-shares or relevant Chinese stocks
          setSuggestions(data.list.slice(0, 8));
          setShowDropdown(true);
        } else {
          setSuggestions([]);
          setShowDropdown(false);
        }
      } catch (err) {
        setSuggestions([]);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [inputValue, isBatchMode]);

  // Click outside to close suggestion dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddCode = (rawCode: string) => {
    setInputError(null);
    const code = rawCode.trim().replace(/^(sh|sz|bj)/i, '');
    if (!code) return;

    if (!/^\d{6}$/.test(code)) {
      setInputError('请输入有效的6位股票代码（如 600519）或通过下拉列表选择');
      return;
    }

    if (selectedCodes.includes(code)) {
      setInputError(`股票代码 ${code} 已在列表中`);
      return;
    }

    if (selectedCodes.length >= 20) {
      setInputError('单次最多同时对比分析 20 支股票');
      return;
    }

    onCodesChange([...selectedCodes, code]);
    setInputValue('');
    setShowDropdown(false);
  };

  const handleRemoveCode = (codeToRemove: string) => {
    onCodesChange(selectedCodes.filter(c => c !== codeToRemove));
  };

  const handleApplyBatch = () => {
    setInputError(null);
    const extracted = batchInput
      .split(/[\s,，;；\n]+/)
      .map(s => s.trim().replace(/^(sh|sz|bj)/i, ''))
      .filter(s => /^\d{6}$/.test(s));

    if (extracted.length === 0) {
      setInputError('未检测到有效的6位股票代码，请使用逗号或空格分隔');
      return;
    }

    const combined = Array.from(new Set([...selectedCodes, ...extracted])).slice(0, 20);
    onCodesChange(combined);
    setBatchInput('');
    setIsBatchMode(false);
  };

  const handleApplyPreset = (presetCodes: string[]) => {
    const combined = Array.from(new Set([...selectedCodes, ...presetCodes])).slice(0, 20);
    onCodesChange(combined);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions.length > 0 && showDropdown) {
        handleAddCode(suggestions[0].code);
      } else {
        handleAddCode(inputValue);
      }
    }
  };

  return (
    <section className="bg-white border-b border-slate-200 px-6 py-4">
      <div className="max-w-7xl mx-auto flex flex-col gap-3.5">
        {/* Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Search / Input Box */}
          <div className="relative flex-1 min-w-[320px] max-w-2xl" ref={dropdownRef}>
            {!isBatchMode ? (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={inputValue}
                    onChange={e => {
                      setInputValue(e.target.value);
                      setInputError(null);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="输入股票代码（如 600519、000001）或公司名称（如 茅台、比亚迪）..."
                    className="w-full pl-9 pr-24 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-900 placeholder:text-slate-400"
                  />
                  <button
                    onClick={() => handleAddCode(inputValue)}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors"
                  >
                    添加
                  </button>
                </div>
                <button
                  onClick={() => setIsBatchMode(true)}
                  className="px-2.5 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap flex items-center gap-1"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>批量粘贴</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-300 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    批量输入股票代码（支持逗号、空格或换行分隔）：
                  </span>
                  <button
                    onClick={() => setIsBatchMode(false)}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    取消
                  </button>
                </div>
                <textarea
                  value={batchInput}
                  onChange={e => setBatchInput(e.target.value)}
                  rows={2}
                  placeholder="例如: 600519, 000001, 300750, 002594, 601318"
                  className="w-full p-2 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 font-mono"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={handleApplyBatch}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded"
                  >
                    解析并导入代码
                  </button>
                </div>
              </div>
            )}

            {/* Suggestions Dropdown */}
            {showDropdown && suggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden divide-y divide-slate-100">
                {suggestions.map((item, idx) => (
                  <button
                    key={`${item.code}-${idx}`}
                    onClick={() => handleAddCode(item.code)}
                    className="w-full px-3.5 py-2.5 text-left text-xs hover:bg-blue-50 flex items-center justify-between transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 group-hover:text-blue-600">
                        {item.name}
                      </span>
                      <span className="font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                        {item.code}
                      </span>
                      <span className="text-slate-400 text-[11px]">
                        {item.symbol.toUpperCase()}
                      </span>
                    </div>
                    <span className="text-[11px] text-blue-600 opacity-0 group-hover:opacity-100 font-medium">
                      + 点击添加
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Year Selector & Primary Query Action */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-slate-600 font-medium">财务报告期:</span>
              <select
                value={selectedYear}
                onChange={e => onYearChange(e.target.value)}
                className="bg-transparent text-slate-900 font-medium focus:outline-none cursor-pointer pr-1"
              >
                {AVAILABLE_YEARS.map(y => (
                  <option key={y.value} value={y.value}>
                    {y.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={onFetchData}
              disabled={isLoading || selectedCodes.length === 0}
              className={`px-5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all shadow-xs ${
                isLoading || selectedCodes.length === 0
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer active:scale-98'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>正在采集新浪数据...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>自动采集并汇总 ({selectedCodes.length})</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Input Error Message */}
        {inputError && (
          <div className="flex items-center gap-1.5 text-xs text-rose-600 bg-rose-50 px-3 py-1.5 rounded-md border border-rose-200">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{inputError}</span>
          </div>
        )}

        {/* Selected Codes Chips + Preset Industry Baskets */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          {/* Selected Codes Pills */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">待查询股票 ({selectedCodes.length}):</span>
            {selectedCodes.length === 0 ? (
              <span className="text-xs text-slate-400 italic">暂未选择股票，可点击右侧预设行业包快速添加</span>
            ) : (
              selectedCodes.map(code => {
                const name = stockNamesMap[code];
                return (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md text-xs transition-colors"
                  >
                    <span className="font-semibold text-slate-800">{name ? name : code}</span>
                    <span className="text-slate-400 font-mono text-[11px]">{code}</span>
                    <button
                      onClick={() => handleRemoveCode(code)}
                      className="text-slate-400 hover:text-rose-600 transition-colors ml-0.5 cursor-pointer"
                      title="移除"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })
            )}
            {selectedCodes.length > 0 && (
              <button
                onClick={() => onCodesChange([])}
                className="text-xs text-slate-400 hover:text-rose-600 ml-1 underline transition-colors cursor-pointer"
              >
                清空全部
              </button>
            )}
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 hidden lg:inline">行业预设:</span>
            {PRESET_BASKETS.map(b => (
              <button
                key={b.name}
                onClick={() => handleApplyPreset(b.codes)}
                title={b.description}
                className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:text-blue-700 bg-slate-100 hover:bg-blue-50 border border-slate-200 rounded transition-colors whitespace-nowrap cursor-pointer"
              >
                + {b.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
