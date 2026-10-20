/**
 * The few formatting marks an admin can use in the banner message:
 *   **bold**   *italic*   [link text](https://example.com)   and any email address (becomes a mail link).
 * Anything else is plain text. No HTML is ever interpreted.
 */
export type BannerPart =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'italic'; text: string }
  | { kind: 'link'; text: string; url: string }
  | { kind: 'email'; text: string };

const TOKEN =
  /\*\*([^*]+?)\*\*|\*([^*]+?)\*|\[([^\]]+)\]\((https:\/\/[^\s)]+)\)|([A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,})/gi;

export function parseBanner(message: string): BannerPart[] {
  const parts: BannerPart[] = [];
  let last = 0;
  for (const m of message.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) parts.push({ kind: 'text', text: message.slice(last, at) });
    if (m[1] != null) parts.push({ kind: 'bold', text: m[1] });
    else if (m[2] != null) parts.push({ kind: 'italic', text: m[2] });
    else if (m[3] != null) parts.push({ kind: 'link', text: m[3], url: m[4] });
    else parts.push({ kind: 'email', text: m[5] });
    last = at + m[0].length;
  }
  if (last < message.length) parts.push({ kind: 'text', text: message.slice(last) });
  return parts;
}
