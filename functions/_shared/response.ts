/**
 * Shared HTTP response helpers for edge functions.
 */

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': Deno.env.get('INSFORGE_BASE_URL') ?? '',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Creates a JSON response with CORS headers.
 */
export function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/json',
    },
  });
}
