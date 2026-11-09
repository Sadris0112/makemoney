/**
 * Centralized, resilient API client for fetching stock data.
 * Safely parses JSON and guards against static SPA 200/404 HTML fallback responses
 * (which trigger "Unexpected token '<', <!doctype... is not valid JSON").
 */

const API_BASE_STORAGE_KEY = 'SINA_STOCK_API_BASE_URL';

export function getCustomApiBaseUrl(): string {
  try {
    return localStorage.getItem(API_BASE_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setCustomApiBaseUrl(url: string): void {
  try {
    const clean = url.trim().replace(/\/+$/, '');
    if (clean) {
      localStorage.setItem(API_BASE_STORAGE_KEY, clean);
    } else {
      localStorage.removeItem(API_BASE_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

export function resolveApiUrl(path: string): string {
  const customBase = getCustomApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (customBase) {
    return `${customBase}${cleanPath}`;
  }
  return cleanPath;
}

export async function safeFetchApi<T = any>(path: string, options?: RequestInit): Promise<T> {
  const fullUrl = resolveApiUrl(path);
  let res: Response;
  try {
    res = await fetch(fullUrl, options);
  } catch (netErr: any) {
    throw new Error(`网络连接失败: ${netErr.message || '请检查网络连接'}`);
  }

  const rawText = await res.text();
  const trimmed = rawText.trim();

  // Guard against HTML / SPA fallback responses
  if (
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    trimmed.startsWith('<HTML') ||
    trimmed.startsWith('<?xml')
  ) {
    throw new Error(
      `API 服务未响应 JSON（返回了 HTML 页面）。这是因为 Cloudflare Pages 尚未加载边缘函数或正在使用纯静态託管。请在 Cloudflare Pages 设置中确认「Build output directory」设为 dist，且包含 _worker.js，或者连接 Git 仓库自动部署。`
    );
  }

  let json: any;
  try {
    json = JSON.parse(rawText);
  } catch (parseErr: any) {
    throw new Error(`JSON 解析失败: ${rawText.slice(0, 80)}...`);
  }

  if (!res.ok) {
    throw new Error(json?.error || `网络请求异常: HTTP ${res.status}`);
  }

  return json as T;
}

/**
 * Fetch batch financial data with automatic POST -> GET fallback
 */
export async function fetchStockBatchApi(codes: string[], year?: string): Promise<any> {
  const postUrl = resolveApiUrl('/api/stock/batch');

  // 1. First attempt POST
  try {
    const postRes = await fetch(postUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codes, year: year || undefined }),
    });

    const postText = await postRes.text();
    const trimmed = postText.trim();

    if (
      postRes.ok &&
      !trimmed.startsWith('<!doctype') &&
      !trimmed.startsWith('<!DOCTYPE') &&
      !trimmed.startsWith('<html')
    ) {
      const json = JSON.parse(trimmed);
      if (json.success) return json;
    }
  } catch {
    // ignore and fallback to GET
  }

  // 2. Fallback to GET
  const queryParams = new URLSearchParams({
    codes: codes.join(','),
    year: year || '',
  });

  return safeFetchApi(`/api/stock/batch?${queryParams.toString()}`, {
    method: 'GET',
  });
}
