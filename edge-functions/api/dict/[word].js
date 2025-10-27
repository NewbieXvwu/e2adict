// 文件路径: edge-functions/api/dict/[word].js (增强诊断版)

export async function onRequestGet(context) {
  // 1. 记录函数开始执行
  console.log(`[EO PROXY] Function triggered for word: "${context.params.word}"`);

  try {
    const { CF_PAGES_URL } = context.env;
    if (!CF_PAGES_URL) {
      console.error('[EO PROXY] FATAL: Environment variable CF_PAGES_URL is not set!');
      return new Response(JSON.stringify({ error: 'Upstream URL (CF_PAGES_URL) is not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const word = context.params.word.toLowerCase();
    const targetUrl = `${CF_PAGES_URL}/api/dict/${encodeURIComponent(word)}`;
    
    // 2. 记录将要请求的目标地址
    console.log(`[EO PROXY] Attempting to fetch upstream URL: ${targetUrl}`);

    // 执行 fetch 请求
    const response = await fetch(targetUrl);

    // 3. 记录从上游收到的响应状态
    console.log(`[EO PROXY] Received upstream response with status: ${response.status}`);

    // 4. (非常重要) 将上游响应头也打印出来，看看有没有 Content-Length 等信息
    const headers = {};
    for (const [key, value] of response.headers.entries()) {
      headers[key] = value;
    }
    console.log('[EO PROXY] Upstream response headers:', JSON.stringify(headers, null, 2));

    // 检查上游是否真的返回了错误
    if (!response.ok) {
        console.error(`[EO PROXY] Upstream returned an error status: ${response.status}`);
        const errorBody = await response.text();
        console.error(`[EO PROXY] Upstream error body: "${errorBody}"`);
    }

    // 5. 返回最终响应
    console.log('[EO PROXY] Streaming response back to client.');
    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });

  } catch (err) {
    // 6. 如果在 try 块中发生任何JS异常 (比如 fetch 网络错误)，在这里捕获并记录
    console.error('[EO PROXY] An exception was caught in the function:', err);
    return new Response(JSON.stringify({ error: 'Internal proxy error', details: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}
