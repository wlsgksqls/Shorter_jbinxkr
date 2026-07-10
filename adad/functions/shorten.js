export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    
    // Check if KV namespace is bound
    if (!env.SHORTENER_KV) {
      return new Response(
        JSON.stringify({ 
          error: "Cloudflare KV 네임스페이스 'SHORTENER_KV' 바인딩을 찾을 수 없습니다. Pages 프로젝트의 [설정 > 함수 > KV 네임스페이스 바인딩]에서 SHORTENER_KV 바인딩을 추가해 주세요." 
        }), 
        { 
          status: 500, 
          headers: { "Content-Type": "application/json" } 
        }
      );
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (_) {
      return new Response(
        JSON.stringify({ error: "올바르지 않은 JSON 데이터입니다." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const { url, name } = body;

    // Validate request parameters
    if (!url || !name) {
      return new Response(
        JSON.stringify({ error: "대상 URL과 단축 경로명(이름)을 모두 입력해 주세요." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate URL syntax
    try {
      new URL(url);
    } catch (_) {
      return new Response(
        JSON.stringify({ error: "대상 URL 형식이 올바르지 않습니다. (예: https://example.com)" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Sanitize slug: allow alphanumeric, hyphens, underscores, and Korean
    const sanitizedSlug = name.replace(/[^a-zA-Z0-9-_\u3131-\uD79D]/g, '');
    if (!sanitizedSlug || sanitizedSlug !== name) {
      return new Response(
        JSON.stringify({ error: "경로명에는 영문, 한글, 숫자, 하이픈(-), 언더바(_)만 사용할 수 있습니다." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Store slug mapping in Cloudflare KV
    // Key: TetrisGame, Value: https://original-url.com
    await env.SHORTENER_KV.put(sanitizedSlug, url);

    return new Response(
      JSON.stringify({
        success: true,
        slug: sanitizedSlug
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" }
      }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: `서버 오류가 발생했습니다: ${err.message}` }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json" } 
      }
    );
  }
}
