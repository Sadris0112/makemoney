import React from 'react';
import { FileSpreadsheet, Download, RefreshCw } from 'lucide-react';

interface HeaderProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  onOpenExport: () => void;
  isRefreshing?: boolean;
  onRefreshAll?: () => void;
  hasData: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  onOpenExport,
  isRefreshing,
  onRefreshAll,
  hasData,
}) => {
  return (
    <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
          <FileSpreadsheet className="w-5 h-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
            新浪财经股票指标采集器
          </span>
          <span className="text-[11px] text-slate-500 whitespace-nowrap">
            数据源: finance.sina.com.cn 自动同步
          </span>
        </div>
      </div>

      {/* Zone 2: Navigation Links / Views */}
      <nav className="hidden md:flex items-center gap-1 text-sm font-medium p-1 bg-slate-100 rounded-lg">
        <button
          onClick={() => onTabChange('statements')}
          className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
            currentTab === 'statements'
              ? 'bg-blue-600 text-white shadow-xs font-semibold'
              : 'text-slate-700 hover:text-slate-900 font-medium'
          }`}
        >
          三大财务报表 (图片同款)
        </button>
        <button
          onClick={() => onTabChange('scorecard')}
          className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
            currentTab === 'scorecard'
              ? 'bg-blue-600 text-white shadow-xs font-semibold'
              : 'text-slate-700 hover:text-slate-900 font-medium'
          }`}
        >
          季度评分诊断 (图片同款)
        </button>
        <button
          onClick={() => onTabChange('comparison')}
          className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
            currentTab === 'comparison'
              ? 'bg-white text-blue-700 shadow-xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          多股横向对比
        </button>
        <button
          onClick={() => onTabChange('matrix')}
          className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
            currentTab === 'matrix'
              ? 'bg-white text-blue-700 shadow-xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          全指标分类对照
        </button>
        <button
          onClick={() => onTabChange('single')}
          className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
            currentTab === 'single'
              ? 'bg-white text-blue-700 shadow-xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          单股各期明细
        </button>
        <button
          onClick={() => onTabChange('diagnosis')}
          className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap ${
            currentTab === 'diagnosis'
              ? 'bg-white text-blue-700 shadow-xs font-semibold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          财务健康诊断
        </button>
      </nav>

      {/* Zone 3: 1 Primary CTA and quick refresh */}
      <div className="flex items-center gap-2.5 shrink-0">
        {hasData && onRefreshAll && (
          <button
            onClick={onRefreshAll}
            disabled={isRefreshing}
            title="重新获取最新行情与指标"
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        )}
        <button
          onClick={onOpenExport}
          disabled={!hasData}
          className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shadow-xs ${
            hasData
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-98'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>导出 Excel 报表</span>
        </button>
      </div>
    </header>
  );
};
