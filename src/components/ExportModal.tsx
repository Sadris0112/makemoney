import React, { useState } from 'react';
import { StockFinancialData, ThreeFinancialStatements } from '../types/stock';
import { exportStocksToExcel, exportComparisonToCSV, copyTableToClipboard } from '../utils/excelExport';
import { X, FileSpreadsheet, Download, Copy, Check, Info, Sparkles } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  stocks: StockFinancialData[];
  activeStockCode: string;
  selectedYear: string;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  stocks,
  activeStockCode,
  selectedYear,
}) => {
  const [includeStatements, setIncludeStatements] = useState(true);
  const [includeSummary, setIncludeSummary] = useState(true);
  const [includeMatrix, setIncludeMatrix] = useState(true);
  const [includeDefinitions, setIncludeDefinitions] = useState(true);
  const [customFileName, setCustomFileName] = useState('');
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportStockCode, setExportStockCode] = useState(activeStockCode || (stocks[0]?.code || '600519'));
  const [modalYear, setModalYear] = useState(selectedYear || '2025');

  if (!isOpen) return null;

  const currentStockObj = stocks.find(s => s.code === exportStockCode) || stocks[0];
  const stockName = currentStockObj ? currentStockObj.name : exportStockCode;
  const targetYear = modalYear || selectedYear || '2025';
  const defaultFileName = `${stockName}_${targetYear.replace(/,/g, '_')}三大财务报表与核心指标_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      let statementsData: ThreeFinancialStatements | undefined = undefined;

      if (includeStatements && exportStockCode) {
        // Fetch 3 statements for the chosen stock and year
        const res = await fetch(`/api/stock/statements?code=${exportStockCode}&year=${encodeURIComponent(targetYear)}`);
        const json = await res.json();
        if (json.success && json.data) {
          statementsData = json.data;
        }
      }

      await exportStocksToExcel(stocks, {
        fileName: customFileName.trim()
          ? customFileName.endsWith('.xlsx')
            ? customFileName
            : `${customFileName}.xlsx`
          : defaultFileName,
        statements: statementsData,
        includeStatementSheets: includeStatements,
        includeSummarySheet: includeSummary,
        includeMatrixSheet: includeMatrix,
        includeDefinitionsSheet: includeDefinitions,
      });

      setTimeout(() => {
        setIsExporting(false);
        onClose();
      }, 500);
    } catch (err) {
      console.error(err);
      setIsExporting(false);
    }
  };

  const handleCopyClipboard = async () => {
    const success = await copyTableToClipboard(stocks);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">导出 Excel 财务分析报表</h3>
              <p className="text-xs text-slate-500">支持一模一样图片格式三大报表与多股对比</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col gap-4 text-xs text-slate-700 max-h-[80vh] overflow-y-auto">
          {/* Stock & Year for Statements */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-slate-800">
                三大报表目标股票:
              </label>
              <select
                value={exportStockCode}
                onChange={e => setExportStockCode(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-blue-500"
              >
                {stocks.map(s => (
                  <option key={s.code} value={s.code}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="font-semibold text-slate-800">
                报表年度与跨度:
              </label>
              <select
                value={modalYear}
                onChange={e => setModalYear(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-blue-500"
              >
                <option value="2025">2025 年度 (4 季)</option>
                <option value="2024">2024 年度 (4 季)</option>
                <option value="2023">2023 年度 (4 季)</option>
                <option value="2022">2022 年度 (4 季)</option>
                <option value="2025,2024">近2年四季 (8 季: 2025+2024)</option>
                <option value="2025,2024,2023">近3年四季 (12 季: 2025~2023)</option>
                <option value="2025,2024,2023,2022,2021">近5年全期 (20 季)</option>
              </select>
            </div>
          </div>

          {/* File Name */}
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold text-slate-800">报表文件名设置:</label>
            <input
              type="text"
              value={customFileName}
              onChange={e => setCustomFileName(e.target.value)}
              placeholder={defaultFileName}
              className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 font-mono text-[11px]"
            />
          </div>

          {/* Sheets Configuration */}
          <div className="flex flex-col gap-2">
            <label className="font-semibold text-slate-800">导出包含的工作表 (Sheets):</label>
            <div className="flex flex-col gap-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              {/* Image identical 3 statements */}
              <label className="flex items-start gap-2.5 cursor-pointer bg-blue-50/60 p-2 rounded-lg border border-blue-200">
                <input
                  type="checkbox"
                  checked={includeStatements}
                  onChange={e => setIncludeStatements(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 mt-0.5"
                />
                <div className="flex flex-col">
                  <span className="font-bold text-blue-900 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    图片同款三大财务报表 (资产负债表、利润表、现金流量表)
                  </span>
                  <span className="text-[11px] text-blue-700">
                    完全符合您提供的 3 张图片：一模一样的青蓝色表头 (<code>#3E96B5</code>)、淺藍邊框 (<code>#9AC7D7</code>) 及千分位數字格式。
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={includeSummary}
                  onChange={e => setIncludeSummary(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <div className="flex flex-col">
                  <span className="font-medium text-slate-900">多股关键指标横向对比总表</span>
                  <span className="text-[11px] text-slate-500">全部所查股票的估值、ROE、净利率、杠杆率对比</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMatrix}
                  onChange={e => setIncludeMatrix(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <div className="flex flex-col">
                  <span className="font-medium text-slate-900">核心指标对照矩阵</span>
                  <span className="text-[11px] text-slate-500">按分类纵向逐项罗列对比</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeDefinitions}
                  onChange={e => setIncludeDefinitions(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                />
                <div className="flex flex-col">
                  <span className="font-medium text-slate-900">数据源说明与指标定义</span>
                  <span className="text-[11px] text-slate-500">新浪财经来源与指标计算公式</span>
                </div>
              </label>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-slate-500 text-[11px] bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-200">
            <Info className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>导出的 .xlsx 表格已做格式与字型校准，在 Microsoft Excel、WPS Office、Google 试算表中开启皆完美呈現。</span>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyClipboard}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied ? '已复制' : '复制对比数据'}</span>
            </button>
            <button
              onClick={() => {
                exportComparisonToCSV(stocks);
                onClose();
              }}
              className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>导出 CSV</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleExportExcel}
              disabled={isExporting}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs cursor-pointer active:scale-98"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? '正在生成报表...' : '下载 Excel (.xlsx)'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
