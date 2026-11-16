export async function enforceRateLimit(binding, request, routeKey, delta = 1) {
  if (!binding || typeof binding.limit !== 'function') return { configured: false, success: false };
  const ip = request.headers.get('cf-connecting-ip') || 'local-development';
  try {
    const result = await binding.limit({ key: ip + ':' + routeKey, delta });
    return { configured: true, success: Boolean(result?.success) };
  } catch {
    return { configured: false, success: false };
  }
}
