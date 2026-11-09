import { fetchStockFinancials, getCleanCode } from '../../../src/lib/sinaFinance';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: CORS_HEADERS });
}

export async function onRequest(context: any) {
  const request = context.request;
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  let codes: string[] = [];
  let year: string | undefined = undefined;

  if (request.method === 'POST') {
    try {
      const body = await request.json();
      codes = Array.isArray(body?.codes) ? body.codes : [];
      year = body?.year || undefined;
    } catch {
      // fallback to url params
    }
  }

  if (codes.length === 0) {
    const url = new URL(request.url);
    const codesParam = url.searchParams.get('codes') || '';
    codes = codesParam.split(/[,+ ]/).map((s: string) => s.trim()).filter(Boolean);
    year = url.searchParams.get('year') || year;
  }

  if (codes.length === 0) {
    return new Response(
      JSON.stringify({ success: false, error: '请提供股票代码列表' }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const cleanCodes = Array.from(
    new Set(codes.map((c: string) => getCleanCode(c)).filter(Boolean))
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
    successful.forEach(s => {
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
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || '批量查询失败' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
