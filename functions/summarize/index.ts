/**
 * InsForge Edge Function: summarize
 *
 * On-demand summarization using claude-sonnet-4.5 via InsForge AI Gateway.
 * Called when user approves a "summarize" action.
 */

import { createClient } from 'npm:@insforge/sdk';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export default async function handler(
  req: Request,
): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const userToken = authHeader
      ? authHeader.replace('Bearer ', '')
      : null;

    if (!userToken) {
      return jsonResponse({ error: 'Authentication required' }, 401);
    }

    const { item_id, action_id } = await req.json();
    if (!item_id || !action_id) {
      return jsonResponse(
        { error: 'item_id and action_id required' },
        400,
      );
    }

    const client = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
      edgeFunctionToken: userToken,
    });

    // 1. Fetch item
    const { data: items, error: fetchError } = await client.database
      .from('items')
      .select('*')
      .eq('id', item_id);

    if (fetchError || !items || items.length === 0) {
      return jsonResponse({ error: 'Item not found' }, 404);
    }

    const item = items[0] as Record<string, unknown>;

    // 2. Get content — if URL, use Jina Reader
    const rawContent = String(item.raw_content ?? '');
    const itemType = String(item.type ?? 'text');
    const content = itemType === 'link'
      ? await fetchJinaContent(rawContent)
      : rawContent;

    // 3. Summarize via AI Gateway (claude-sonnet-4.5)
    const completion = await client.ai.chat.completions.create({
      model: 'anthropic/claude-sonnet-4.5',
      messages: [
        {
          role: 'user',
          content: `${SUMMARIZE_PROMPT}\n\nContent:\n${content}`,
        },
      ],
      temperature: 0.3,
    });

    const summary = completion.choices[0]?.message?.content ?? '';

    // 4. Update action as completed with summary result
    await client.database
      .from('actions')
      .update({
        status: 'completed',
        result: { summary },
        completed_at: new Date().toISOString(),
      })
      .eq('id', action_id);

    // 5. Also update the item description with the summary
    await client.database
      .from('items')
      .update({ description: summary.slice(0, 1000) })
      .eq('id', item_id);

    return jsonResponse({ success: true, summary });
  } catch (err) {
    console.error('Summarize function error:', err);

    // Mark action as failed so user sees the error
    try {
      const body = await req.clone().json();
      if (body?.action_id) {
        const failClient = createClient({
          baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
          edgeFunctionToken: req.headers.get('Authorization')?.replace('Bearer ', '') ?? null,
        });
        await failClient.database
          .from('actions')
          .update({
            status: 'failed',
            result: {
              error: err instanceof Error ? err.message : 'Unknown error',
            },
          })
          .eq('id', body.action_id);
      }
    } catch {
      // Ignore cleanup errors
    }

    return jsonResponse({ error: 'Summarization failed' }, 500);
  }
}

// ─── Jina Reader ─────────────────────────────────────────────────────

async function fetchJinaContent(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: 'text/plain' },
      signal: controller.signal,
    });

    if (!response.ok) return url;

    const text = await response.text();
    return text.slice(0, 15_000);
  } catch {
    return url;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Constants ───────────────────────────────────────────────────────

const SUMMARIZE_PROMPT = `Summarize the following content concisely.

Provide:
1. A 2-3 sentence executive summary
2. 3-5 key bullet points
3. Any action items mentioned

Keep the total response under 300 words.`;

// ─── Helpers ─────────────────────────────────────────────────────────

function jsonResponse(
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
