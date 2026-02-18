/**
 * Jina Reader integration for URL content extraction.
 * Used by classify and summarize edge functions.
 */

const JINA_READER_URL = 'https://r.jina.ai';
const JINA_TIMEOUT_MS = 5_000;
const MAX_CONTENT_LENGTH = 5_000;

/**
 * Fetches readable text content from a URL via Jina Reader.
 * Returns the raw URL as fallback if extraction fails.
 */
export async function fetchJinaContent(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), JINA_TIMEOUT_MS);

  try {
    const response = await fetch(`${JINA_READER_URL}/${url}`, {
      headers: {
        Accept: 'text/plain',
        'X-With-Images': 'false',
        'X-With-Links': 'false',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      console.warn(`Jina Reader returned ${response.status} for ${url}`);
      return url;
    }

    const text = await response.text();
    return text.slice(0, MAX_CONTENT_LENGTH);
  } catch (err) {
    console.warn('Jina Reader failed, using raw URL:', err);
    return url;
  } finally {
    clearTimeout(timeout);
  }
}
