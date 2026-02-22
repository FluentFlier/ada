/**
 * InsForge Edge Function: summarize
 *
 * On-demand summarization using claude-sonnet-4.5 via InsForge AI Gateway.
 * Called when user approves a "summarize" action.
 */

import { createClient } from 'npm:@insforge/sdk';
import { fetchJinaContent } from '../_shared/jina.ts';
import { jsonResponse, CORS_HEADERS } from '../_shared/response.ts';

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
      model: 'google/gemini-2.5-flash',
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

    // 6. Notify via realtime
    const userId = String(item.user_id);
    try {
      await client.realtime.connect();
      await client.realtime.subscribe(`items:${userId}`);
      await client.realtime.publish(
        `items:${userId}`,
        'item_updated',
        { item: { ...item, description: summary.slice(0, 1000) } },
      );
    } catch (realtimeErr) {
      console.warn('Realtime notify failed (non-fatal):', realtimeErr);
    }

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
    } catch (cleanupErr) {
      console.warn('Failed to mark action as failed:', cleanupErr);
    }

    return jsonResponse({ error: 'Summarization failed' }, 500);
  }
}

// ─── Constants ───────────────────────────────────────────────────────

const SUMMARIZE_PROMPT = `Summarize the following content concisely.

Provide:
1. A 2-3 sentence executive summary
2. 3-5 key bullet points
3. Any action items mentioned

Keep the total response under 300 words.`;
