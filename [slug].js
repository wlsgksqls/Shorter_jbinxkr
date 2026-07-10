export async function onRequest(context) {
  const { request, env, params } = context;
  const slug = params.slug;

  // Safeguard: ignore assets and the shorten API
  if (slug.includes('.') || slug === 'shorten') {
    return context.next();
  }

  // Check if KV is bound
  if (!env.SHORTENER_KV) {
    return new Response(
      "Cloudflare KV 'SHORTENER_KV' 바인딩을 찾을 수 없습니다. Pages 대시보드에서 KV 네임스페이스를 바인딩해 주세요.",
      { status: 500 }
    );
  }

  // Decode slug for Korean support
  let decodedSlug = slug;
  try {
    decodedSlug = decodeURIComponent(slug);
  } catch (_) {}

  // Retrieve destination URL from KV
  const destinationUrl = await env.SHORTENER_KV.get(decodedSlug);

  if (destinationUrl) {
    // 302 Redirect to destination
    return Response.redirect(destinationUrl, 302);
  }

  // If short link not found, redirect to root with error parameters
  // The client side (app.js) will detect this and show a beautiful toast message.
  const url = new URL(request.url);
  return Response.redirect(`${url.origin}/?error=not-found&slug=${encodeURIComponent(slug)}`, 302);
}
