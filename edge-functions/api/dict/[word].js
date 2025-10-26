export async function onRequestGet(context) {
  try {
    // 1. 从环境变量中获取 Cloudflare Pages 的基础 URL
    const { CF_PAGES_URL } = context.env;

    // 健壮性检查：确保环境变量已配置
    if (!CF_PAGES_URL) {
      return new Response(JSON.stringify({ error: 'Upstream URL (CF_PAGES_URL) is not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. 从请求中获取单词，并构建目标 URL
    const word = context.params.word.toLowerCase();
    const targetUrl = `${CF_PAGES_URL}/api/dict/${encodeURIComponent(word)}`;

    // 3. 直接 fetch 目标 URL，无需任何额外的头信息
    const response = await fetch(targetUrl);

    // 4. 将从 Cloudflare Pages 收到的响应完整地透传给用户
    // 这样做可以保留原始的 Cache-Control 头，从而启用 EdgeOne 的 CDN 缓存
    return new Response(response.body, {
      status: response.status,
      headers: response.headers,
    });

  } catch (err) {
    // 捕获网络错误等异常
    console.error('Error proxying to Cloudflare Pages:', err);
    return new Response(JSON.stringify({ error: 'Internal proxy error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
