import { fetchThreeStatements } from '../../../src/lib/sinaFinance';

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
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message || '获取三大财务报表失败' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
