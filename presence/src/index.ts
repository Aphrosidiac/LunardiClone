// FF Desk presence server: a Cloudflare Worker routing WebSockets to two Durable Objects.
//   GET <base>/lobby[?token=]        -> Lobby (single instance): identity + who is where.
//   GET <base>/?room=<path>[&token=] -> Room (one per pathname): live cursors + chat.
// Protocol: see README.md. Both objects use the WebSocket Hibernation API, so idle sockets cost
// nothing; per-socket state lives in the socket attachment.
import { DurableObject } from 'cloudflare:workers';
import {
  ID,
  MAX_COUNT,
  MAX_LOBBY_FRAME,
  MAX_NUMBER,
  encode,
  parseLobbyClientMessage,
  parseRoomClientMessage,
  roomFromPathname,
} from './protocol';

export interface Env {
  LOBBY: DurableObjectNamespace<Lobby>;
  ROOMS: DurableObjectNamespace<Room>;
  TOKEN_SECRET?: string;
  ALLOWED_ORIGINS?: string;
}

// ---------------------------------------------------------------------------------------------
// Identity tokens: `<id>.<number>.<sig>`, sig = first 22 chars of base64url(HMAC-SHA256(id.number)).
// The lobby mints them; rooms verify them so a cursor's id matches its lobby visitor id
// (that is how "follow" highlights the right cursor).

const TOKEN = /^([a-f0-9]{8})\.([0-9]{1,6})\.([A-Za-z0-9_-]{22})$/;
const encoder = new TextEncoder();
const keys = new Map<string, Promise<CryptoKey>>();

function hmacKey(secret: string) {
  let key = keys.get(secret);
  if (!key) {
    key = crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    keys.set(secret, key);
  }
  return key;
}

function base64url(bytes: ArrayBuffer) {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(secret: string, id: string, number: number) {
  const mac = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(`${id}.${number}`));
  return base64url(mac).slice(0, 22);
}

export async function mintToken(secret: string, id: string, number: number) {
  return `${id}.${number}.${await sign(secret, id, number)}`;
}

export async function verifyToken(secret: string, token: string | null): Promise<{ id: string; number: number } | null> {
  const match = token ? TOKEN.exec(token) : null;
  if (!match) return null;
  const [, id, rawNumber, signature] = match as unknown as [string, string, string, string];
  const number = Number(rawNumber);
  if (!Number.isInteger(number) || number < 1 || number > MAX_NUMBER) return null;
  const expected = await sign(secret, id, number);
  // Constant-time compare.
  let diff = expected.length ^ signature.length;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ (signature.charCodeAt(i) || 0);
  return diff === 0 ? { id, number } : null;
}

function randomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------------------------
// Per-socket flood guard (in memory; resets if the object hibernates, which is fine).

class RateLimit {
  private buckets = new WeakMap<WebSocket, { tokens: number; at: number }>();
  constructor(
    private readonly perSecond: number,
    private readonly burst: number,
  ) {}
  take(ws: WebSocket) {
    const now = Date.now();
    const bucket = this.buckets.get(ws) ?? { tokens: this.burst, at: now };
    bucket.tokens = Math.min(this.burst, bucket.tokens + ((now - bucket.at) / 1000) * this.perSecond);
    bucket.at = now;
    this.buckets.set(ws, bucket);
    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }
}

function send(ws: WebSocket, data: string) {
  try {
    ws.send(data);
  } catch {}
}

function upgrade() {
  const pair = new WebSocketPair();
  return { client: pair[0], server: pair[1] };
}

// ---------------------------------------------------------------------------------------------
// Lobby: `["y", id, number, token]` on connect, then `["s", visitors]`; `["u", …]` / `["x", id]`
// as others move or leave. The list never contains the recipient's own id.

type LobbyAttachment = { id: string; number: number; url: string | null; away: boolean; at: number };
type VisitorTuple = [id: string, number: number, url: string] | [id: string, number: number, url: string, away: 1];

const visitorTuple = (v: LobbyAttachment): VisitorTuple => (v.away ? [v.id, v.number, v.url!, 1] : [v.id, v.number, v.url!]);

export class Lobby extends DurableObject<Env> {
  private limit = new RateLimit(5, 20);

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  private attachment(ws: WebSocket) {
    return ws.deserializeAttachment() as LobbyAttachment | null;
  }

  /** Latest state per visitor id (a duplicated tab can share one identity). */
  private visitors() {
    const byId = new Map<string, LobbyAttachment>();
    for (const ws of this.ctx.getWebSockets()) {
      const state = this.attachment(ws);
      if (!state) continue;
      const current = byId.get(state.id);
      if (!current || state.at > current.at) byId.set(state.id, state);
    }
    return byId;
  }

  private async nextNumber() {
    const last = (await this.ctx.storage.get<number>('number')) ?? 0;
    const next = last >= MAX_NUMBER ? 1 : last + 1;
    await this.ctx.storage.put('number', next);
    return next;
  }

  private broadcastState(id: string, except?: WebSocket) {
    const state = this.visitors().get(id);
    const frame = state?.url ? encode(['u', ...visitorTuple(state)]) : encode(['x', id]);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except || this.attachment(ws)?.id === id) continue;
      send(ws, frame);
    }
  }

  async fetch(request: Request) {
    const secret = this.env.TOKEN_SECRET;
    if (!secret) return new Response('TOKEN_SECRET is not configured', { status: 500 });
    const token = new URL(request.url).searchParams.get('token');
    const identity = (await verifyToken(secret, token)) ?? { id: randomId(), number: await this.nextNumber() };
    const fresh = await mintToken(secret, identity.id, identity.number);

    const { client, server } = upgrade();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ ...identity, url: null, away: false, at: Date.now() } satisfies LobbyAttachment);

    send(server, encode(['y', identity.id, identity.number, fresh]));
    const list: VisitorTuple[] = [];
    let size = 8;
    for (const visitor of this.visitors().values()) {
      if (visitor.id === identity.id || !visitor.url) continue;
      const tuple = visitorTuple(visitor);
      size += JSON.stringify(tuple).length + 1;
      if (size > MAX_LOBBY_FRAME) break;
      list.push(tuple);
    }
    send(server, encode(['s', list]));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== 'string' || message === 'ping' || !this.limit.take(ws)) return;
    const where = parseLobbyClientMessage(message);
    const state = this.attachment(ws);
    if (!where || !state) return;
    ws.serializeAttachment({ ...state, url: where.url, away: where.away, at: Date.now() } satisfies LobbyAttachment);
    this.broadcastState(state.id, ws);
  }

  async webSocketClose(ws: WebSocket, code: number) {
    this.drop(ws);
    try {
      ws.close(code === 1005 || code === 1006 ? 1000 : code);
    } catch {}
  }

  async webSocketError(ws: WebSocket) {
    this.drop(ws);
  }

  private drop(ws: WebSocket) {
    const state = this.attachment(ws);
    if (!state) return;
    ws.serializeAttachment(null);
    // Remaining sockets for the same id (duplicate tab) keep the visitor alive.
    this.broadcastState(state.id, ws);
  }
}

// ---------------------------------------------------------------------------------------------
// Room: `["c", n]` (people here, including you) on every join/leave; `["m", id, anchor, ax, ay, vx,
// vy]`, `["t", id, text]` and `["l", id]` relayed from the others. The server keeps no cursor
// state: when the count goes up, every client re-sends its position for the newcomer.

type RoomAttachment = { id: string } | null;

export class Room extends DurableObject<Env> {
  private limit = new RateLimit(30, 60);

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  private live() {
    return this.ctx.getWebSockets().filter((ws) => ws.deserializeAttachment() as RoomAttachment);
  }

  private broadcast(frame: string, except?: WebSocket) {
    for (const ws of this.live()) if (ws !== except) send(ws, frame);
  }

  private broadcastCount() {
    const sockets = this.live();
    const frame = encode(['c', Math.min(MAX_COUNT, Math.max(1, sockets.length))]);
    for (const ws of sockets) send(ws, frame);
  }

  async fetch(request: Request) {
    const secret = this.env.TOKEN_SECRET;
    const token = new URL(request.url).searchParams.get('token');
    const identity = secret ? await verifyToken(secret, token) : null;
    const id = identity?.id ?? randomId();
    if (!ID.test(id)) return new Response('Bad id', { status: 400 });

    const { client, server } = upgrade();
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ id } satisfies RoomAttachment);
    this.broadcastCount();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== 'string' || message === 'ping' || !this.limit.take(ws)) return;
    const state = ws.deserializeAttachment() as RoomAttachment;
    const parsed = parseRoomClientMessage(message);
    if (!state || !parsed) return;
    if (parsed.type === 'leave') this.broadcast(encode(['l', state.id]), ws);
    else if (parsed.type === 'chat') this.broadcast(encode(['t', state.id, parsed.text]), ws);
    else this.broadcast(encode(['m', state.id, ...parsed.position]), ws);
  }

  async webSocketClose(ws: WebSocket, code: number) {
    this.drop(ws);
    try {
      ws.close(code === 1005 || code === 1006 ? 1000 : code);
    } catch {}
  }

  async webSocketError(ws: WebSocket) {
    this.drop(ws);
  }

  private drop(ws: WebSocket) {
    const state = ws.deserializeAttachment() as RoomAttachment;
    if (!state) return;
    ws.serializeAttachment(null);
    this.broadcast(encode(['l', state.id]), ws);
    // getWebSockets() still lists the closing socket; its attachment is null now, so live() skips it.
    this.broadcastCount();
  }
}

// ---------------------------------------------------------------------------------------------

function originAllowed(request: Request, env: Env) {
  const allowed = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (allowed.length === 0) return true;
  const origin = request.headers.get('Origin');
  return origin !== null && allowed.includes(origin);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('FF Desk presence: WebSocket endpoint.', { status: 426, headers: { Upgrade: 'websocket' } });
    }
    if (!originAllowed(request, env)) return new Response('Forbidden', { status: 403 });

    if (url.pathname.replace(/\/+$/, '').endsWith('/lobby')) {
      return env.LOBBY.get(env.LOBBY.idFromName('lobby')).fetch(request);
    }
    const room = roomFromPathname(url.searchParams.get('room'));
    if (room) return env.ROOMS.get(env.ROOMS.idFromName(room)).fetch(request);
    return new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Env>;
