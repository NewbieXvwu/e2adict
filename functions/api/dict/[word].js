/**
 * API 路由: /api/dict/:word
 * 从 KV 中获取单词定义
 */
export async function onRequestGet(context) {
  try {
    const word = context.params.word.toLowerCase();
    
    const etag = `W/"${word}"`; // 使用弱 ETag
    
    const ifNoneMatch = context.request.headers.get('If-None-Match');
    if (ifNoneMatch === etag) {
      // 客户端缓存仍然有效
      return new Response(null, { status: 304 });
    }

    const { EC_DICTIONARY } = context.env;
    const value = await EC_DICTIONARY.get(word);

    if (value === null) {
      return new Response(JSON.stringify({ error: 'Word not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(value, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=604800, immutable',
        'ETag': etag, // 在响应中包含 ETag
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}