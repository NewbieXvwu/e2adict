/**
 * API 路由: /api/dict/:word
 * 从 KV 中获取单词定义
 */
export async function onRequestGet(context) {
    try {
      // context.params.word 会获取 URL 中的动态部分，例如 /api/dict/ability 中的 "ability"
      const word = context.params.word.toLowerCase();
  
      // context.env.EC_DICTIONARY 会自动绑定到你连接的 KV 命名空间
      // "EC_DICTIONARY" 是你在 Pages 设置中配置的绑定名称
      const { EC_DICTIONARY } = context.env;
      
      const value = await EC_DICTIONARY.get(word);
  
      if (value === null) {
        return new Response(JSON.stringify({ error: 'Word not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
  
      // 直接返回从 KV 中获取的 JSON 字符串
      return new Response(value, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          // 添加缓存头，让浏览器和 Cloudflare CDN 缓存结果
          'Cache-Control': 'public, max-age=604800, immutable', 
        },
      });
    } catch (err) {
      return new Response(JSON.stringify({ error: 'Internal server error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }