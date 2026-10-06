// Ported from reference module 125559: the wire format shared by the lobby socket and the room
// (cursor) sockets. presence/src/protocol.ts on the server mirrors this file.

export const CURSOR_IDLE_MS = 120_000;
export const PING = 'ping';

const ANCHOR = /^[A-Za-z0-9_-]{1,64}$/;
const ID = /^[a-f0-9]{8}$/;
const UNSAFE_CHAT = /[\p{Cc}\p{Bidi_Control}\u2028\u2029]/gu;
const TOKEN = /^[a-f0-9]{8}\.[0-9]{1,6}\.[A-Za-z0-9_-]{22}$/;

export type CursorPosition = {
  /** Element key the cursor is pinned to, or null for viewport-relative. */
  anchor: string | null;
  /** Position inside the anchor's rect, 0..1. */
  ax: number;
  ay: number;
  /** Position inside the viewport, 0..1 (fallback when the anchor is not on screen). */
  vx: number;
  vy: number;
};

export type ClientMessage =
  | { type: 'move'; position: CursorPosition }
  | { type: 'leave' }
  | { type: 'chat'; text: string };

export type ServerMessage =
  | { type: 'count'; count: number }
  | { type: 'leave'; id: string }
  | { type: 'chat'; id: string; text: string }
  | { type: 'move'; id: string; position: CursorPosition };

export type Visitor = { id: string; number: number; url: string; away: boolean };

export type LobbyServerMessage =
  | { type: 'welcome'; id: string; number: number; token: string }
  | { type: 'visitors'; visitors: Visitor[] }
  | { type: 'visitor'; visitor: Visitor }
  | { type: 'gone'; id: string };

export type LobbyClientMessage = { type: 'where'; url: string | null; away: boolean };

export function cleanChatText(text: string) {
  return Array.from(text.replace(UNSAFE_CHAT, '')).slice(0, 80).join('');
}

export function isValidAnchor(anchor: string) {
  return ANCHOR.test(anchor);
}

function isUnit(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

const round = (value: number) => Math.round(1e4 * value) / 1e4;

export const clampUnit = (value: number) => Math.min(1, Math.max(0, value));

function parseJson(raw: string, max = 256): unknown {
  if (raw.length > max) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function isValidVisitUrl(url: unknown): url is string {
  return (
    typeof url === 'string' &&
    url.length <= 256 &&
    /^\/(?![/\\])[\x21-\x7e]*$/.test(url) &&
    !url.includes('\\') &&
    !/^\/api(?:[/?#]|$)/i.test(url)
  );
}

function isVisitorNumber(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 1e5;
}

function parseVisitor(entry: unknown): Visitor | undefined {
  if (!Array.isArray(entry) || entry.length < 3 || entry.length > 4) return undefined;
  const [id, number, url, away] = entry;
  if (typeof id === 'string' && ID.test(id) && isVisitorNumber(number) && isValidVisitUrl(url) && (entry.length !== 4 || away === 1)) {
    return { id, number, url, away: away === 1 };
  }
  return undefined;
}

export function encodeClientMessage(message: ClientMessage) {
  if (message.type === 'leave') return '0';
  if (message.type === 'chat') return JSON.stringify(['t', message.text]);
  const { anchor, ax, ay, vx, vy } = message.position;
  return JSON.stringify([anchor, round(ax), round(ay), round(vx), round(vy)]);
}

export function encodeLobbyClientMessage(message: LobbyClientMessage) {
  return JSON.stringify(message.away ? ['p', message.url, 1] : ['p', message.url]);
}

export function parseLobbyServerMessage(raw: string): LobbyServerMessage | undefined {
  const data = parseJson(raw, 262144);
  if (!Array.isArray(data)) return undefined;
  const [kind, ...rest] = data;
  if (kind === 'y') {
    const [id, number, token] = rest;
    return rest.length === 3 && typeof id === 'string' && ID.test(id) && isVisitorNumber(number) && typeof token === 'string' && TOKEN.test(token)
      ? { type: 'welcome', id, number, token }
      : undefined;
  }
  if (kind === 's') {
    const [list] = rest;
    if (rest.length !== 1 || !Array.isArray(list)) return undefined;
    return { type: 'visitors', visitors: list.map(parseVisitor).filter((v): v is Visitor => v !== undefined) };
  }
  if (kind === 'u') {
    const visitor = parseVisitor(rest);
    return visitor ? { type: 'visitor', visitor } : undefined;
  }
  if (kind === 'x') {
    const [id] = rest;
    return rest.length === 1 && typeof id === 'string' && ID.test(id) ? { type: 'gone', id } : undefined;
  }
  return undefined;
}

function parsePosition(values: unknown[]): CursorPosition | undefined {
  const [anchor, ax, ay, vx, vy] = values;
  if ((anchor === null || (typeof anchor === 'string' && isValidAnchor(anchor))) && isUnit(ax) && isUnit(ay) && isUnit(vx) && isUnit(vy)) {
    return { anchor, ax, ay, vx, vy };
  }
  return undefined;
}

export function parseServerMessage(raw: string): ServerMessage | undefined {
  const data = parseJson(raw);
  if (!Array.isArray(data)) return undefined;
  const [kind, id, ...rest] = data;
  if (kind === 'c') {
    return Number.isInteger(id) && id >= 1 && id <= 1e3 && rest.length === 0 ? { type: 'count', count: id } : undefined;
  }
  if (typeof id !== 'string' || !ID.test(id)) return undefined;
  if (kind === 'l' && rest.length === 0) return { type: 'leave', id };
  if (kind === 't') {
    const [text] = rest;
    return rest.length === 1 && typeof text === 'string' && cleanChatText(text) === text ? { type: 'chat', id, text } : undefined;
  }
  if (kind !== 'm' || rest.length !== 5) return undefined;
  const position = parsePosition(rest);
  return position ? { type: 'move', id, position } : undefined;
}

export function roomFromPathname(pathname: string | null | undefined) {
  if (pathname?.startsWith('/') && !(pathname.length > 256)) return pathname.replace(/\/+$/, '') || '/';
  return undefined;
}
