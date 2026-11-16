function safeEqual(left, right) {
  const encoder = new TextEncoder();
  const a = encoder.encode(String(left || ''));
  const b = encoder.encode(String(right || ''));
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (a[index] || 0) ^ (b[index] || 0);
  }
  return difference === 0;
}

export function hasValidAppToken(request, env) {
  const expected = env.APP_ACCESS_TOKEN;
  if (typeof expected !== 'string' || expected.length < 32) return false;
  const authorization = request.headers.get('authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return Boolean(match && safeEqual(match[1], expected));
}

export function appTokenConfigured(env) {
  return typeof env.APP_ACCESS_TOKEN === 'string' && env.APP_ACCESS_TOKEN.length >= 32;
}

export async function enforceRateLimit(binding, request, routeKey) {
  if (!binding || typeof binding.limit !== 'function') return true;
  const ip = request.headers.get('cf-connecting-ip') || 'local-development';
  const result = await binding.limit({ key: ip + ':' + routeKey });
  return Boolean(result?.success);
}
