import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { StockSearchInput } from './components/StockSearchInput';
import { ComparisonTable } from './components/ComparisonTable';
import { MetricMatrix } from './components/MetricMatrix';
import { SingleStockDetail } from './components/SingleStockDetail';
import { FinancialDiagnosis } from './components/FinancialDiagnosis';
import { ThreeStatementsView } from './components/ThreeStatementsView';
import { FinancialScorecardView } from './components/FinancialScorecardView';
import { ExportModal } from './components/ExportModal';
import { StockFinancialData } from './types/stock';
import { fetchStockBatchApi } from './lib/apiClient';
import { AlertCircle, RefreshCw, Layers, TrendingUp, ShieldCheck, DollarSign, FileSpreadsheet } from 'lucide-react';

export default function App() {
  const [selectedCodes, setSelectedCodes] = useState<string[]>([
    '600519', // 贵州茅台
    '000858', // 五粮液
    '300750', // 宁德时代
    '002594', // 比亚迪
    '600036', // 招商银行
  ]);
  const [selectedYear, setSelectedYear] = useState<string>('2025');
  const [stocksData, setStocksData] = useState<StockFinancialData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTab, setCurrentTab] = useState<string>('statements');
  const [activeStockCode, setActiveStockCode] = useState<string>('600519');
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // Map of stock codes to company names for quick UI chips
  const stockNamesMap = useMemo(() => {
    const map: Record<string, string> = {
      '600519': '贵州茅台',
      '000858': '五粮液',
      '300750': '宁德时代',
      '002594': '比亚迪',
      '600036': '招商银行',
      '601318': '中国平安',
      '000001': '平安银行',
      '688981': '中芯国际',
      '002371': '北方华创',
      '600900': '长江电力',
      '601088': '中国神华',
      '600938': '中国海油',
      '600809': '山西汾酒',
      '000568': '泸州老窖',
      '300014': '亿纬锂能',
    };
    stocksData.forEach(s => {
      if (s.code && s.name) {
        map[s.code] = s.name;
      }
    });
    return map;
  }, [stocksData]);

  // Fetch batch financial data from backend API with automatic fallback
  const handleFetchData = useCallback(async () => {
    if (selectedCodes.length === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchStockBatchApi(selectedCodes, selectedYear);
      if (!data.success) {
        throw new Error(data.error || '获取股票财务数据失败');
      }

      setStocksData(data.stocks || []);

      if (data.stocks && data.stocks.length > 0) {
        // Keep active stock valid
        if (!data.stocks.some((s: StockFinancialData) => s.code === activeStockCode)) {
          setActiveStockCode(data.stocks[0].code);
        }
      }

      if (data.errors && data.errors.length > 0) {
        const failedCodes = data.errors.map((e: any) => `${e.code}: ${e.error}`).join('; ');
        console.warn('部分股票查询失败:', failedCodes);
      }
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(err.message || '查询失败，请检查网络或稍后重试');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCodes, selectedYear, activeStockCode]);

  // Initial fetch on mount
  useEffect(() => {
    handleFetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectStock = (code: string) => {
    setActiveStockCode(code);
    setCurrentTab('single');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract (3 zones) */}
      <Header
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        onOpenExport={() => setIsExportModalOpen(true)}
        isRefreshing={isLoading}
        onRefreshAll={handleFetchData}
        hasData={stocksData.length > 0}
      />

      {/* Search & Code Input Bar */}
      <StockSearchInput
        selectedCodes={selectedCodes}
        onCodesChange={setSelectedCodes}
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
        onFetchData={handleFetchData}
        isLoading={isLoading}
        stockNamesMap={stockNamesMap}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 flex flex-col gap-6">
        {/* Error notification banner if any */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start justify-between gap-3 text-rose-800 text-xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={handleFetchData}
              className="text-rose-700 underline font-medium hover:text-rose-900 cursor-pointer"
            >
              重试
            </button>
          </div>
        )}

        {/* Loading State Skeleton */}
        {isLoading && stocksData.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="h-5 bg-slate-200 rounded w-48 animate-pulse" />
              <div className="h-5 bg-slate-100 rounded w-24 animate-pulse" />
            </div>
            <div className="space-y-3 pt-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-10 bg-slate-50 border border-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
            <div className="text-center text-xs text-slate-400 pt-4 flex items-center justify-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
              <span>正在连接新浪财经行情与财务服务器，解析关键指标...</span>
            </div>
          </div>
        ) : stocksData.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs flex flex-col items-center justify-center max-w-xl mx-auto my-8">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <FileSpreadsheet className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">尚未采集股票财务指标</h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed max-w-sm">
              在上方输入股票代码（如 600519、000001、300750）或选择行业预设，点击“自动采集并汇总”即可实时抓取新浪财经财务指标并导出 Excel。
            </p>
            <button
              onClick={() => {
                setSelectedCodes(['600519', '000858', '300750', '002594', '600036']);
                setTimeout(() => handleFetchData(), 100);
              }}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              一键载入核心蓝筹股示例
            </button>
          </div>
        ) : (
          /* Loaded Data Content */
          <>
            {/* View Switch Content */}
            {currentTab === 'statements' && (
              <ThreeStatementsView
                stocks={stocksData}
                selectedCode={activeStockCode}
                onSelectCode={setActiveStockCode}
                selectedYear={selectedYear}
                onYearChange={setSelectedYear}
              />
            )}

            {currentTab === 'scorecard' && (
              <FinancialScorecardView
                stocks={stocksData}
                selectedCode={activeStockCode}
                onSelectCode={setActiveStockCode}
                selectedYear={selectedYear}
              />
            )}

            {currentTab === 'comparison' && (
              <ComparisonTable stocks={stocksData} onSelectStock={handleSelectStock} />
            )}

            {currentTab === 'matrix' && (
              <MetricMatrix stocks={stocksData} />
            )}

            {currentTab === 'single' && (
              <SingleStockDetail
                stocks={stocksData}
                selectedCode={activeStockCode}
                onSelectCode={setActiveStockCode}
              />
            )}

            {currentTab === 'diagnosis' && (
              <FinancialDiagnosis stocks={stocksData} onSelectStock={handleSelectStock} />
            )}
          </>
        )}
      </main>

      {/* Export Options Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        stocks={stocksData}
        activeStockCode={activeStockCode}
        selectedYear={selectedYear}
      />

      {/* Quiet Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-4 px-6 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span>新浪财经股票关键指标采集与分析系统</span>
          <span>·</span>
          <span>数据均源自 finance.sina.com.cn 官方接口与上市公司披露财报</span>
        </div>
        <div className="flex items-center gap-4 text-slate-400">
          <span>支持导出 .xlsx / .csv</span>
          <span>·</span>
          <span>支持多股横向对比与全期趋势回溯</span>
        </div>
      </footer>
    </div>
  );
}
