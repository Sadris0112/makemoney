/**
 * Centralized, resilient API client for fetching stock data.
 * Safely parses JSON and guards against static SPA 200/404 HTML fallback responses
 * (which trigger "Unexpected token '<', <!doctype... is not valid JSON").
 */
export async function safeFetchApi<T = any>(url: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, options);
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
      `API 服务未响应 JSON（返回了 HTML 页面）。这是因为 Cloudflare Pages 尚未加载边缘函数或正在使用纯静态託管。本次構建已為您生成 dist/_worker.js 與 functions/，重新部署即可在邊緣端正常執行。`
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
  // 1. First attempt POST
  try {
    const postRes = await fetch('/api/stock/batch', {
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
