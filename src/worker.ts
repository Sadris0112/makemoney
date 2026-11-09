import {
  fetchStockFinancials,
  fetchThreeStatements,
  fetchSuggestions,
  fetchQuotes,
  getCleanCode,
} from './lib/sinaFinance';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    // 1. Handle CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const cleanPath = url.pathname.replace(/\/+$/, '') || '/';

    // 2. Intercept all /api/ requests with top-level try-catch
    if (cleanPath.startsWith('/api/')) {
      try {
        // 2.1 Batch Stock Financials
        if (cleanPath === '/api/stock/batch') {
          let codes: string[] = [];
          let year: string | undefined = undefined;

          if (request.method === 'POST') {
            try {
              const body: any = await request.json();
              codes = Array.isArray(body?.codes) ? body.codes : [];
              year = body?.year || undefined;
            } catch {
              // ignore json parse error
            }
          }

          if (codes.length === 0) {
            const codesParam = url.searchParams.get('codes') || '';
            codes = codesParam.split(/[,+ ]/).map(s => s.trim()).filter(Boolean);
            year = url.searchParams.get('year') || year;
          }

          if (codes.length === 0) {
            return new Response(
              JSON.stringify({ success: false, error: '请提供股票代码列表' }),
              { status: 400, headers: CORS_HEADERS }
            );
          }

          const cleanCodes = Array.from(
            new Set(codes.map(c => getCleanCode(c)).filter(Boolean))
          ).slice(0, 20);

          const promises = cleanCodes.map(code =>
            fetchStockFinancials(code, year)
              .then(data => ({ success: true as const, code, data }))
              .catch(err => ({ success: false as const, code, error: err.message }))
          );

          const outcomes = await Promise.all(promises);
          const successful = outcomes.filter(o => o.success).map(o => (o as any).data);
          const errors = outcomes.filter(o => !o.success).map(o => ({ code: o.code, error: (o as any).error }));

          const allMetricsSet = new Set<string>();
          successful.forEach((s: any) => {
            s.metrics.forEach((m: any) => allMetricsSet.add(`${m.category}::${m.name}`));
          });

          return new Response(
            JSON.stringify({
              success: true,
              stocks: successful,
              errors,
              allMetricsCatalog: Array.from(allMetricsSet),
              queryTime: new Date().toISOString(),
            }),
            { status: 200, headers: CORS_HEADERS }
          );
        }

        // 2.2 Three Financial Statements
        if (cleanPath === '/api/stock/statements') {
          const code = (url.searchParams.get('code') || '').trim();
          const year = url.searchParams.get('year') || undefined;
          if (!code) {
            return new Response(
              JSON.stringify({ success: false, error: '缺少股票代码' }),
              { status: 400, headers: CORS_HEADERS }
            );
          }

          const data = await fetchThreeStatements(code, year);
          return new Response(JSON.stringify({ success: true, data }), {
            status: 200,
            headers: CORS_HEADERS,
          });
        }

        // 2.3 Stock Suggestion / Search
        if (cleanPath === '/api/stock/suggest') {
          const q = (url.searchParams.get('q') || '').trim();
          const list = await fetchSuggestions(q);
          return new Response(JSON.stringify({ success: true, list }), {
            status: 200,
            headers: CORS_HEADERS,
          });
        }

        // 2.4 Quotes
        if (cleanPath === '/api/stock/quote') {
          const symbolsParam = (url.searchParams.get('symbols') || '').trim();
          const symbols = symbolsParam.split(',').map(s => s.trim()).filter(Boolean);
          const quotes = await fetchQuotes(symbols);
          return new Response(JSON.stringify({ success: true, quotes }), {
            status: 200,
            headers: CORS_HEADERS,
          });
        }

        // 2.5 Indicators
        if (cleanPath === '/api/stock/indicators') {
          const code = (url.searchParams.get('code') || '').trim();
          const year = url.searchParams.get('year') || undefined;
          if (!code) {
            return new Response(
              JSON.stringify({ success: false, error: '缺少股票代码' }),
              { status: 400, headers: CORS_HEADERS }
            );
          }

          const data = await fetchStockFinancials(code, year);
          return new Response(JSON.stringify({ success: true, data }), {
            status: 200,
            headers: CORS_HEADERS,
          });
        }

        return new Response(
          JSON.stringify({ success: false, error: `未找到 API 接口: ${cleanPath}` }),
          { status: 404, headers: CORS_HEADERS }
        );
      } catch (err: any) {
        // ALWAYS return valid JSON on errors, NEVER return HTML!
        return new Response(
          JSON.stringify({
            success: false,
            error: `Cloudflare 边际函数处理失败: ${err.message || String(err)}`,
          }),
          { status: 500, headers: CORS_HEADERS }
        );
      }
    }

    // 3. Pass through to static assets on Cloudflare Pages
    if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not found', { status: 404 });
  },
};
