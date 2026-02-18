/**
 * InsForge Edge Function: classify
 *
 * Pipeline:
 * 1. Fetch item from DB
 * 2. If URL → Jina Reader extracts page content
 * 3. Send to AI via InsForge AI Gateway (gpt-4o-mini)
 * 4. Parse structured JSON response
 * 5. Update item in DB with classification
 * 6. Create action rows
 * 7. Notify client via realtime
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
    const { item_id } = await req.json();
    if (!item_id) {
      return jsonResponse({ error: 'item_id required' }, 400);
    }

    const authHeader = req.headers.get('Authorization');
    const userToken = authHeader
      ? authHeader.replace('Bearer ', '')
      : null;

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

    // 2. If URL, extract content via Jina Reader
    const rawContent = String(item.raw_content ?? '');
    const itemType = String(item.type ?? 'text');
    const content = itemType === 'link'
      ? await fetchJinaContent(rawContent)
      : rawContent;

    // 3. Classify via AI Gateway
    const classification = await classifyWithAI(
      client,
      content,
      itemType,
    );

    // 4. Update item with classification
    await client.database
      .from('items')
      .update({
        category: classification.category,
        title: classification.title,
        description: classification.description,
        extracted_data: classification.extracted_data,
        suggested_actions: classification.suggested_actions,
        confidence: classification.confidence,
        status: 'classified',
        updated_at: new Date().toISOString(),
      })
      .eq('id', item_id);

    // 5. Create action rows
    const userId = String(item.user_id);
    for (const action of classification.suggested_actions) {
      await client.database.from('actions').insert({
        user_id: userId,
        item_id: item_id,
        type: action.type,
        status: 'suggested',
        action_data: action,
      });
    }

    // 6. Notify via realtime
    try {
      await client.realtime.connect();
      await client.realtime.subscribe(`items:${userId}`);
      await client.realtime.publish(
        `items:${userId}`,
        'item_updated',
        { item: { ...item, ...classification, status: 'classified' } },
      );
    } catch (realtimeErr) {
      console.warn('Realtime notify failed (non-fatal):', realtimeErr);
    }

    return jsonResponse({ success: true, item_id });
  } catch (err) {
    console.error('Classify function error:', err);
    return jsonResponse({ error: 'Classification failed' }, 500);
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

    if (!response.ok) {
      console.warn(`Jina Reader returned ${response.status} for ${url}`);
      return url;
    }

    const text = await response.text();
    return text.slice(0, 15_000);
  } catch (err) {
    console.warn('Jina Reader failed, using raw URL:', err);
    return url;
  } finally {
    clearTimeout(timeout);
  }
}

// ─── AI Classification ──────────────────────────────────────────────

interface ClassificationResult {
  category: string;
  confidence: number;
  title: string;
  description: string;
  extracted_data: Record<string, unknown>;
  suggested_actions: Array<{
    type: string;
    label: string;
    data: Record<string, unknown>;
    priority: number;
  }>;
  tags: string[];
}

const CLASSIFY_PROMPT = `You are Ada, an AI personal secretary. Classify this content.

Respond with ONLY valid JSON matching this exact structure:
{
  "category": one of ["events_plans","food_dining","shopping_deals","travel",
    "jobs_career","learning","entertainment","health_fitness","finance",
    "social","inspiration","other"],
  "confidence": number 0-1,
  "title": "concise title, max 60 chars",
  "description": "1-2 sentence summary",
  "extracted_data": {
    "dates": ["ISO date strings found"],
    "prices": [{"amount": number, "currency": "USD"}],
    "locations": ["place names"],
    "contacts": [{"name": "", "email": "", "phone": ""}],
    "deadline": "ISO date if applicable",
    "urgency": "low|medium|high|critical"
  },
  "suggested_actions": [
    {
      "type": "add_to_calendar|set_reminder|save_contact|summarize|create_note|track_price",
      "label": "human-readable action label",
      "data": {},
      "priority": 1-3
    }
  ],
  "tags": ["relevant", "tags"]
}

Rules:
- Extract ALL structured data (dates, prices, contacts, locations)
- Suggest 1-3 actions that would be most useful
- If content has a deadline within 7 days, urgency should be "high" or "critical"
- Confidence should reflect how certain you are about the category
- Keep title concise and informative
- Only include fields where you found actual data`;

async function classifyWithAI(
  client: ReturnType<typeof createClient>,
  content: string,
  type: string,
): Promise<ClassificationResult> {
  const prompt = `${CLASSIFY_PROMPT}\n\nContent type: ${type}\nContent:\n${content}`;

  const completion = await client.ai.chat.completions.create({
    model: 'openai/gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
  });

  const responseText = completion.choices[0]?.message?.content ?? '';

  try {
    // Strip markdown code fences if present
    const cleaned = responseText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    return JSON.parse(cleaned) as ClassificationResult;
  } catch (parseErr) {
    console.error('Failed to parse AI response:', responseText);
    return {
      category: 'other',
      confidence: 0.3,
      title: content.slice(0, 60),
      description: '',
      extracted_data: {},
      suggested_actions: [],
      tags: [],
    };
  }
}

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
