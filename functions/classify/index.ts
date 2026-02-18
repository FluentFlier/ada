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
    const authHeader = req.headers.get('Authorization');
    const userToken = authHeader
      ? authHeader.replace('Bearer ', '')
      : null;

    if (!userToken) {
      return jsonResponse({ error: 'Authentication required' }, 401);
    }

    const body = await req.json();
    const { item_id } = body;
    if (!item_id) {
      return jsonResponse({ error: 'item_id required' }, 400);
    }

    const client = createClient({
      baseUrl: Deno.env.get('INSFORGE_BASE_URL'),
      edgeFunctionToken: userToken,
    });

    // 1. Fetch item (skip DB round-trip if caller passed type + raw_content)
    let item: Record<string, unknown>;
    if (body.type && body.raw_content) {
      item = {
        id: item_id,
        type: body.type,
        raw_content: body.raw_content,
        user_id: body.user_id,
      };
    } else {
      const { data: items, error: fetchError } = await client.database
        .from('items')
        .select('*')
        .eq('id', item_id);

      if (fetchError || !items || items.length === 0) {
        return jsonResponse({ error: 'Item not found' }, 404);
      }
      item = items[0] as Record<string, unknown>;
    }

    // 2. Get content based on type
    const rawContent = String(item.raw_content ?? '');
    const itemType = String(item.type ?? 'text');
    let textContent: string;
    let imageBase64: string | null = null;

    if (itemType === 'link') {
      textContent = await fetchJinaContent(rawContent);
    } else if (itemType === 'image' || itemType === 'screenshot') {
      textContent = rawContent;
      imageBase64 = await downloadImageAsBase64(client, rawContent);
    } else {
      textContent = rawContent;
    }

    // 3. Classify via AI Gateway
    const classification = await classifyWithAI(
      client,
      textContent,
      itemType,
      imageBase64,
    );

    // 4. Update item with classification
    const { error: updateError } = await client.database
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

    if (updateError) {
      console.warn('Item update failed:', updateError);
      return jsonResponse({ error: 'Failed to update item' }, 500);
    }

    // 5. Create action rows (batch insert)
    const userId = String(item.user_id);
    if (classification.suggested_actions.length > 0) {
      const actionRows = classification.suggested_actions.map(
        (action: { type: string; label: string; data: Record<string, unknown> }) => ({
          user_id: userId,
          item_id: item_id,
          type: action.type,
          status: 'suggested',
          action_data: { label: action.label, ...action.data },
        }),
      );

      const { error: actionsError } = await client.database
        .from('actions')
        .insert(actionRows);

      if (actionsError) {
        console.error('Failed to create actions:', actionsError);
      }
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

// ─── Image Download ──────────────────────────────────────────────────

async function downloadImageAsBase64(
  client: ReturnType<typeof createClient>,
  storagePath: string,
): Promise<string | null> {
  try {
    const { data, error } = await client.storage
      .from('item-images')
      .download(storagePath);

    if (error || !data) {
      console.warn('Image download failed:', error);
      return null;
    }

    const arrayBuf = await (data as Blob).arrayBuffer();
    const bytes = new Uint8Array(arrayBuf);
    return btoa(
      Array.from(bytes, (b) => String.fromCharCode(b)).join(''),
    );
  } catch (err) {
    console.warn('Image base64 conversion failed:', err);
    return null;
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
      "type": "add_to_calendar|set_reminder|summarize",
      "label": "human-readable action label",
      "data": { ... see schemas below ... },
      "priority": 1-3
    }
  ]
}

Action data schemas (MUST match exactly):
- add_to_calendar: {"title": "event title", "start_time": "ISO 8601", "end_time": "ISO 8601 or omit for 1hr default", "location": "optional", "description": "optional", "all_day": false}
- set_reminder: {"message": "reminder text", "remind_at": "ISO 8601 future date", "urgency": "low|medium|high|critical"}
- summarize: {} (no data needed)

Rules:
- Extract ALL structured data (dates, prices, contacts, locations)
- Only suggest actions of type: add_to_calendar, set_reminder, summarize
- Suggest add_to_calendar when dates/events are found (include start_time!)
- Suggest set_reminder when deadlines or urgency detected (include remind_at!)
- Suggest summarize for long-form content (articles, papers, emails)
- If content has a deadline within 7 days, urgency should be "high" or "critical"
- Confidence should reflect how certain you are about the category
- Keep title concise and informative
- Only include fields where you found actual data
- For images/screenshots: extract ALL visible text as "ocrText" in extracted_data
- Use the visible text to determine category and suggest actions`;

async function classifyWithAI(
  client: ReturnType<typeof createClient>,
  content: string,
  type: string,
  imageBase64: string | null = null,
): Promise<ClassificationResult> {
  const textPrompt =
    `${CLASSIFY_PROMPT}\n\nContent type: ${type}\nContent:\n${content}`;

  type MessageContent =
    | string
    | Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
      >;

  let messageContent: MessageContent;

  if (imageBase64) {
    messageContent = [
      { type: 'text', text: textPrompt },
      {
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${imageBase64}`,
        },
      },
    ];
  } else {
    messageContent = textPrompt;
  }

  const completion = await client.ai.chat.completions.create({
    model: 'openai/gpt-4o-mini',
    messages: [{ role: 'user', content: messageContent }],
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
