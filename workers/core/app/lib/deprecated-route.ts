/**
 * Handles requests to deprecated API routes.
 * Returns 410 Gone with a message body on first request per token per day.
 * Subsequent requests within 24 hours return 410 with empty body.
 */
export async function handleDeprecatedRoute(
  token: string,
  env: Env
): Promise<Response> {
  const kvKey = `deprecated-notify::${token}`;
  const ONE_DAY_SECONDS = 60 * 60 * 24; // 86400 seconds

  // Check if we've already notified this token recently
  const existing = await env.PVTCH_KV.get(kvKey);

  if (existing) {
    // Already notified within 24h - return minimal 410
    return new Response(null, { status: 410 });
  }

  // First notification - set the key with 1-day TTL
  await env.PVTCH_KV.put(kvKey, 'notified', {
    expirationTtl: ONE_DAY_SECONDS,
  });

  // Return 410 with helpful message
  return new Response(
    'MegaphoneZ This URL is no longer in use, see updates on pvtch.com',
    {
      status: 410,
      headers: { 'Content-Type': 'text/plain' },
    }
  );
}
