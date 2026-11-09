import { fetchQuotes } from '../../../src/lib/sinaFinance';

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

  const url = new URL(request.url);
  const symbolsParam = (url.searchParams.get('symbols') || '').trim();
  const symbols = symbolsParam.split(',').map((s: string) => s.trim()).filter(Boolean);

  try {
    const quotes = await fetchQuotes(symbols);
    return new Response(JSON.stringify({ success: true, quotes }), {
      status: 200,
      headers: CORS_HEADERS,
    });
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || '获取行情失败' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
