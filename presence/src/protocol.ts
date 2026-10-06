// Server half of the wire format. Mirrors src/lib/presence/protocol.ts in the site (ported from
// the reference client module 125559): the server validates with the same rules the client parses
// with, so anything it relays is something every client accepts.

const ANCHOR = /^[A-Za-z0-9_-]{1,64}$/;
export const ID = /^[a-f0-9]{8}$/;
const UNSAFE_CHAT = /[\p{Cc}\p{Bidi_Control}\u2028\u2029]/gu;

/** Max visitor number; the client rejects anything outside 1..100000. */
export const MAX_NUMBER = 100_000;
/** Largest count the client accepts in a room `["c", n]`. */
export const MAX_COUNT = 1000;
/** The client rejects a lobby frame longer than this many characters. */
export const MAX_LOBBY_FRAME = 262_144;
/** Client frames are tiny; anything longer is dropped unread. */
export const MAX_CLIENT_FRAME = 512;

export type Position = [anchor: string | null, ax: number, ay: number, vx: number, vy: number];

export function cleanChatText(text: string) {
  return Array.from(text.replace(UNSAFE_CHAT, '')).slice(0, 80).join('');
}

const isUnit = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

const round = (value: number) => Math.round(1e4 * value) / 1e4;

export function isValidVisitUrl(url: unknown): url is string {
  return (
    typeof url === 'string' &&
    url.length <= 256 &&
    /^\/(?![/\\])[\x21-\x7e]*$/.test(url) &&
    !url.includes('\\') &&
    !/^\/api(?:[/?#]|$)/i.test(url)
  );
}

export function roomFromPathname(pathname: string | null) {
  if (pathname?.startsWith('/') && !(pathname.length > 256)) return pathname.replace(/\/+$/, '') || '/';
  return undefined;
}

export function parseJson(raw: string, max = MAX_CLIENT_FRAME): unknown {
  if (raw.length > max) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** Room client frames: `"0"` (leave), `["t", text]` (chat), `[anchor, ax, ay, vx, vy]` (move). */
export type RoomClientMessage = { type: 'leave' } | { type: 'chat'; text: string } | { type: 'move'; position: Position };

export function parseRoomClientMessage(raw: string): RoomClientMessage | undefined {
  if (raw === '0') return { type: 'leave' };
  const data = parseJson(raw);
  if (!Array.isArray(data)) return undefined;
  if (data.length === 2 && data[0] === 't' && typeof data[1] === 'string') {
    return { type: 'chat', text: cleanChatText(data[1]) };
  }
  if (data.length !== 5) return undefined;
  const [anchor, ax, ay, vx, vy] = data;
  if ((anchor === null || (typeof anchor === 'string' && ANCHOR.test(anchor))) && isUnit(ax) && isUnit(ay) && isUnit(vx) && isUnit(vy)) {
    return { type: 'move', position: [anchor, round(ax), round(ay), round(vx), round(vy)] };
  }
  return undefined;
}

/** Lobby client frame: `["p", url]` or `["p", url, 1]` (away). `url` may be null. */
export function parseLobbyClientMessage(raw: string): { url: string | null; away: boolean } | undefined {
  const data = parseJson(raw);
  if (!Array.isArray(data) || data[0] !== 'p' || data.length < 2 || data.length > 3) return undefined;
  const [, url, away] = data;
  if (url !== null && !isValidVisitUrl(url)) return undefined;
  if (data.length === 3 && away !== 1) return undefined;
  return { url, away: away === 1 };
}

export const encode = (message: unknown[]) => JSON.stringify(message);
