// Ported from reference module 775529: the site-wide lobby socket. It hands this tab a stable
// identity ("Visitor N", kept for the session via a signed token in sessionStorage), reports which
// URL we are on (and whether we are away), and streams the list of everyone else on the site.
import {
  CURSOR_IDLE_MS,
  PING,
  encodeLobbyClientMessage,
  isValidVisitUrl,
  parseLobbyServerMessage,
  type Visitor,
} from './protocol';

const ACTIVITY_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'scroll'] as const;
const LISTENER_OPTIONS = { passive: true, capture: true } as const;
/** sessionStorage key (reference: `presence-token`). */
const TOKEN_KEY = 'ff-presence-token';

export type LobbyOptions = {
  url: string;
  onIdentity: (identity: { id: string; number: number; token: string }) => void;
  onVisitors: (visitors: Visitor[]) => void;
  onUnavailable: () => void;
};

export type LobbyHandle = {
  setWhere(url: string | null): void;
  retry(): void;
  destroy(): void;
};

export function createLobby({ url, onIdentity, onVisitors, onUnavailable }: LobbyOptions): LobbyHandle {
  let reconnectTimer: number | undefined;
  let socket: WebSocket | null = null;
  let token = (() => {
    try {
      return sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  })();
  let where: string | null = null;
  let away = document.visibilityState === 'hidden';
  let lastActivity = performance.now();
  let attempts = 0;
  let destroyed = false;
  const visitors = new Map<string, Visitor>();

  function emit() {
    onVisitors([...visitors.values()].sort((a, b) => a.number - b.number));
  }

  function sendWhere() {
    if (socket?.readyState === WebSocket.OPEN) socket.send(encodeLobbyClientMessage({ type: 'where', url: where, away }));
  }

  function connect() {
    if (destroyed) return;
    const ws = new WebSocket(`${url.replace(/\/$/, '')}/lobby${token ? `?token=${encodeURIComponent(token)}` : ''}`);
    socket = ws;
    ws.onmessage = (event) => {
      if (typeof event.data !== 'string') return;
      const message = parseLobbyServerMessage(event.data);
      if (!message) return;
      if (message.type === 'welcome') {
        attempts = 0;
        token = message.token;
        try {
          sessionStorage.setItem(TOKEN_KEY, message.token);
        } catch {}
        onIdentity(message);
        sendWhere();
        return;
      }
      if (message.type === 'visitors') {
        visitors.clear();
        for (const visitor of message.visitors) visitors.set(visitor.id, visitor);
      } else if (message.type === 'visitor') {
        visitors.set(message.visitor.id, message.visitor);
      } else {
        visitors.delete(message.id);
      }
      emit();
    };
    ws.onclose = () => {
      if (socket !== ws) return;
      socket = null;
      visitors.clear();
      emit();
      if (destroyed) return;
      if (attempts >= 6) {
        onUnavailable();
        return;
      }
      if (!token) onUnavailable();
      reconnectTimer = window.setTimeout(connect, Math.min(30_000, 1000 * 2 ** attempts));
      attempts += 1;
    };
  }

  function retry() {
    if (destroyed || socket) return;
    window.clearTimeout(reconnectTimer);
    attempts = 0;
    connect();
  }

  function setAway(next: boolean) {
    if (next === away) return;
    away = next;
    sendWhere();
  }

  const onActivity = () => {
    lastActivity = performance.now();
    if (away && document.visibilityState === 'visible') setAway(false);
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      setAway(true);
    } else {
      retry();
      onActivity();
    }
  };

  const idleInterval = window.setInterval(() => {
    if (!away && performance.now() - lastActivity > CURSOR_IDLE_MS) setAway(true);
  }, 10_000);

  for (const type of ACTIVITY_EVENTS) window.addEventListener(type, onActivity, LISTENER_OPTIONS);

  const onPageHide = () => {
    window.clearTimeout(reconnectTimer);
    const ws = socket;
    socket = null;
    ws?.close(1000);
  };

  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted) retry();
  };

  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);

  const pingInterval = window.setInterval(() => {
    if (socket?.readyState === WebSocket.OPEN) socket.send(PING);
  }, 30_000);

  connect();

  return {
    setWhere(next) {
      const withoutHash = next?.split('#')[0] ?? null;
      const value = next === null || isValidVisitUrl(next) ? next : isValidVisitUrl(withoutHash) ? withoutHash : null;
      if (value === where) return;
      where = value;
      sendWhere();
    },
    retry,
    destroy() {
      destroyed = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      window.clearTimeout(reconnectTimer);
      window.clearInterval(pingInterval);
      window.clearInterval(idleInterval);
      for (const type of ACTIVITY_EVENTS) window.removeEventListener(type, onActivity, LISTENER_OPTIONS);
      const ws = socket;
      socket = null;
      ws?.close(1000);
      visitors.clear();
    },
  };
}
