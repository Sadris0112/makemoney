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
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const pathname = url.pathname;

    // 1. Batch Stock Financials
    if (pathname === '/api/stock/batch') {
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

      try {
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
      } catch (err: any) {
        return new Response(
          JSON.stringify({ success: false, error: err.message || '批量查询失败' }),
          { status: 500, headers: CORS_HEADERS }
        );
      }
    }

    // 2. Three Financial Statements (Matching User's Images)
    if (pathname === '/api/stock/statements') {
      const code = (url.searchParams.get('code') || '').trim();
      const year = url.searchParams.get('year') || undefined;
      if (!code) {
        return new Response(
          JSON.stringify({ success: false, error: '缺少股票代码' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }
      try {
        const data = await fetchThreeStatements(code, year);
        return new Response(JSON.stringify({ success: true, data }), {
          status: 200,
          headers: CORS_HEADERS,
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({ success: false, error: err.message || '获取三大财务报表失败' }),
          { status: 500, headers: CORS_HEADERS }
        );
      }
    }

    // 3. Stock Suggestion / Search
    if (pathname === '/api/stock/suggest') {
      const q = (url.searchParams.get('q') || '').trim();
      try {
        const list = await fetchSuggestions(q);
        return new Response(JSON.stringify({ success: true, list }), {
          status: 200,
          headers: CORS_HEADERS,
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({ success: false, error: err.message || '查询建议失败' }),
          { status: 500, headers: CORS_HEADERS }
        );
      }
    }

    // 4. Quotes
    if (pathname === '/api/stock/quote') {
      const symbolsParam = (url.searchParams.get('symbols') || '').trim();
      const symbols = symbolsParam.split(',').map(s => s.trim()).filter(Boolean);
      try {
        const quotes = await fetchQuotes(symbols);
        return new Response(JSON.stringify({ success: true, quotes }), {
          status: 200,
          headers: CORS_HEADERS,
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({ success: false, error: err.message || '获取行情失败' }),
          { status: 500, headers: CORS_HEADERS }
        );
      }
    }

    // 5. Indicators
    if (pathname === '/api/stock/indicators') {
      const code = (url.searchParams.get('code') || '').trim();
      const year = url.searchParams.get('year') || undefined;
      if (!code) {
        return new Response(
          JSON.stringify({ success: false, error: '缺少股票代码' }),
          { status: 400, headers: CORS_HEADERS }
        );
      }
      try {
        const data = await fetchStockFinancials(code, year);
        return new Response(JSON.stringify({ success: true, data }), {
          status: 200,
          headers: CORS_HEADERS,
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({ success: false, error: err.message || '获取指标失败' }),
          { status: 500, headers: CORS_HEADERS }
        );
      }
    }

    // Pass through to static assets on Cloudflare Pages
    if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not found', { status: 404 });
  },
};
