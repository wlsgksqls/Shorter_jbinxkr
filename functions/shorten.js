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
        JSON.stringify({ error: "긴 주소와 내가 정할 이름을 둘 다 적어주세요!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate URL syntax
    try {
      new URL(url);
    } catch (_) {
      return new Response(
        JSON.stringify({ error: "올바른 인터넷 주소(http:// 또는 https://로 시작)를 입력해 주세요!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Sanitize slug: allow alphanumeric, hyphens, underscores, and Korean
    const sanitizedSlug = name.replace(/[^a-zA-Z0-9-_\u3131-\uD79D]/g, '');
    if (!sanitizedSlug || sanitizedSlug !== name) {
      return new Response(
        JSON.stringify({ error: "이름에는 한글, 영문, 숫자, 하이픈(-), 언더바(_)만 쓸 수 있어요!" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if the short name is already taken
    const existingUrl = await env.SHORTENER_KV.get(sanitizedSlug);
    if (existingUrl) {
      return new Response(
        JSON.stringify({ error: "이미 등록된 이름이에요! 다른 멋진 이름을 입력해 주세요." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Store slug mapping in Cloudflare KV
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

export async function onRequestDelete(context) {
  try {
    const { request, env } = context;

    // Check if KV namespace is bound
    if (!env.SHORTENER_KV) {
      return new Response(
        JSON.stringify({ error: "Cloudflare KV 네임스페이스 'SHORTENER_KV' 바인딩을 찾을 수 없습니다." }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get slug from URL query parameter
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug");

    if (!slug) {
      return new Response(
        JSON.stringify({ error: "삭제할 경로명이 누락되었습니다." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Delete key from KV
    await env.SHORTENER_KV.delete(slug);

    return new Response(
      JSON.stringify({ success: true, slug }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: `서버 오류가 발생했습니다: ${err.message}` }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
