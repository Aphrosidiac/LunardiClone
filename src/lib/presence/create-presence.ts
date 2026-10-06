// Ported from reference module 998374: the per-page live cursor layer. One WebSocket per room
// (pathname). Other visitors' cursors are plain DOM nodes in a fixed overlay, pinned to the element
// they hover (link/button key or [data-presence-anchor]) so they land on the same thing on every
// screen size. "/" opens a one-line chat bubble at your cursor.
import {
  CURSOR_IDLE_MS,
  PING,
  clampUnit,
  cleanChatText,
  encodeClientMessage,
  isValidAnchor,
  parseServerMessage,
  roomFromPathname,
  type CursorPosition,
} from './protocol';

const ANCHOR_ATTR = 'data-presence-anchor';
const CHAT_PLACEHOLDER = 'Say something';
const BUBBLE_CLASS =
  'absolute top-18 left-12 w-max max-w-240 rounded-2 bg-theme-bg px-6 py-2 text-body-14 text-theme-fg ring-1 ring-theme-fg/30';
const INTERACTIVE = 'a[href], button';
const ELEMENT_KEY = /^e-([a-z0-9]+)-(\d+)$/;
const MAX_CURSORS = 8;
const SEND_INTERVAL = 66;

function isVisible(element: Element) {
  return element.isConnected && element.getClientRects().length > 0;
}

function describe(element: Element) {
  return element.tagName === 'A'
    ? `a ${element.getAttribute('href') ?? ''}`
    : `b ${element.getAttribute('aria-label') ?? element.textContent?.trim().slice(0, 60) ?? ''}`;
}

/** FNV-1a, base 36. */
function hash(value: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x1000193);
  }
  return (h >>> 0).toString(36);
}

function elementsWithHash(key: string) {
  return Array.from(document.querySelectorAll(INTERACTIVE)).filter((el) => isVisible(el) && hash(describe(el)) === key);
}

type Pointer = { x: number; y: number; target: Element };

type Cursor = {
  element: HTMLDivElement;
  target: CursorPosition;
  anchor: { key: string; element: Element } | null;
  x: number;
  y: number;
  placed: boolean;
  lastSeen: number;
  bubble: HTMLDivElement | null;
  chatAt: number;
  tag: HTMLDivElement | null;
};

type Chat = {
  container: HTMLDivElement;
  input: HTMLTextAreaElement;
  sizer: HTMLSpanElement;
  text: string;
  spoke: boolean;
  sent: boolean;
  returnFocus: Element | null;
};

export type PresenceOptions = {
  url: string;
  showOthers: boolean;
  onPeopleChange: (others: number) => void;
  onCursorsChange: (cursors: number) => void;
};

export type PresenceHandle = {
  join(pathname: string): void;
  setIdentity(token: string | null): void;
  setHighlight(highlight: { id: string; label: string } | null): void;
  setShowOthers(show: boolean): void;
  destroy(): void;
};

export function createPresence({ url, showOthers, onPeopleChange, onCursorsChange }: PresenceOptions): PresenceHandle {
  let room: string | undefined;
  let reconnectTimer: number | undefined;
  let moveTimer: number | undefined;
  let chatTimer: number | undefined;
  let chatExpireTimer: number | undefined;
  let socket: WebSocket | null = null;
  let attempts = 0;
  let lastMoveAt = 0;
  let visible = showOthers;
  let others = 0;
  let destroyed = false;
  let pointer: Pointer | null = null;
  let chat: Chat | null = null;
  let lastChatAt = 0;
  let frame = 0;
  let lastFrameAt = 0;
  let identityResolved = false;
  let token: string | null = null;
  let highlight: { id: string; label: string } | null = null;
  const cursors = new Map<string, Cursor>();
  let ownAnchor: { element: Element; key: string } | null = null;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const layer = document.createElement('div');

  function send(data: string) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(data);
  }

  function measure({ x, y, target }: Pointer): CursorPosition {
    const vx = clampUnit(x / window.innerWidth);
    const vy = clampUnit(y / window.innerHeight);
    const interactive = target.closest(INTERACTIVE);
    const host = interactive && isVisible(interactive) ? interactive : target.closest(`[${ANCHOR_ATTR}]`);
    let key: string | null | undefined = null;
    if (host && host === interactive) {
      if (ownAnchor?.element !== interactive) {
        const h = hash(describe(interactive));
        ownAnchor = { element: interactive, key: `e-${h}-${Math.max(0, elementsWithHash(h).indexOf(interactive))}` };
      }
      key = ownAnchor.key;
    } else {
      key = host?.getAttribute(ANCHOR_ATTR);
    }
    const rect = host?.getBoundingClientRect();
    return key && isValidAnchor(key) && rect?.width && rect.height
      ? { anchor: key, ax: clampUnit((x - rect.left) / rect.width), ay: clampUnit((y - rect.top) / rect.height), vx, vy }
      : { anchor: null, ax: 0, ay: 0, vx, vy };
  }

  function sendMove() {
    moveTimer = undefined;
    if (!pointer || others === 0) return;
    lastMoveAt = performance.now();
    send(encodeClientMessage({ type: 'move', position: measure(pointer) }));
  }

  function scheduleMove() {
    if (moveTimer !== undefined || others === 0) return;
    moveTimer = window.setTimeout(sendMove, Math.max(0, lastMoveAt + SEND_INTERVAL - performance.now()));
  }

  function leave() {
    pointer = null;
    window.clearTimeout(moveTimer);
    moveTimer = undefined;
    if (others > 0) send(encodeClientMessage({ type: 'leave' }));
  }

  function sendChat() {
    chatTimer = undefined;
    if (others === 0) return;
    lastChatAt = performance.now();
    send(encodeClientMessage({ type: 'chat', text: chat?.text ?? '' }));
  }

  function scheduleChat() {
    if (chatTimer !== undefined || others === 0) return;
    chatTimer = window.setTimeout(sendChat, Math.max(0, lastChatAt + SEND_INTERVAL - performance.now()));
  }

  function positionChat() {
    if (chat && pointer) chat.container.style.transform = `translate3d(${pointer.x - 1}px, ${pointer.y - 1}px, 0)`;
  }

  function closeChat() {
    window.clearTimeout(chatExpireTimer);
    if (!chat) return;
    const { container, returnFocus, spoke } = chat;
    chat = null;
    container.remove();
    if (returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
    if (spoke) scheduleChat();
  }

  function expireChat() {
    window.clearTimeout(chatExpireTimer);
    if (chat?.text) chatExpireTimer = window.setTimeout(closeChat, 5000);
  }

  function renderTag(id: string, cursor: Cursor) {
    if (highlight?.id === id && highlight) {
      cursor.tag ??= cursor.element.appendChild(document.createElement('div'));
      cursor.tag.className =
        'absolute top-0 left-14 whitespace-nowrap rounded-2 bg-theme-fg px-4 py-1 font-mono text-body-10 text-theme-bg uppercase';
      cursor.tag.textContent = highlight.label;
      return;
    }
    cursor.tag?.remove();
    cursor.tag = null;
  }

  function removeCursor(id: string) {
    const cursor = cursors.get(id);
    if (!cursor) return;
    cursors.delete(id);
    onCursorsChange(cursors.size);
    cursor.element.style.opacity = '0';
    window.setTimeout(() => cursor.element.remove(), 200);
  }

  function clearCursors() {
    for (const cursor of cursors.values()) cursor.element.remove();
    cursors.clear();
    onCursorsChange(0);
    others = 0;
    onPeopleChange(0);
  }

  function requestFrame() {
    if (visible && !frame && cursors.size > 0) frame = requestAnimationFrame(tick);
  }

  function resolveAnchor(cursor: Cursor, key: string) {
    const cached = cursor.anchor;
    if (cached?.key === key && isVisible(cached.element)) return cached.element;
    const match = ELEMENT_KEY.exec(key);
    const element = match
      ? (elementsWithHash(match[1] ?? '')[Number(match[2])] ?? null)
      : (Array.from(document.querySelectorAll(`[${ANCHOR_ATTR}="${CSS.escape(key)}"]`)).find(isVisible) ?? null);
    cursor.anchor = element ? { key, element } : null;
    return element;
  }

  function targetPoint(cursor: Cursor) {
    const { anchor, ax, ay, vx, vy } = cursor.target;
    const element = anchor ? resolveAnchor(cursor, anchor) : null;
    if (element) {
      const rect = element.getBoundingClientRect();
      return { x: rect.left + ax * rect.width, y: rect.top + ay * rect.height };
    }
    return { x: vx * window.innerWidth, y: vy * window.innerHeight };
  }

  function tick(now: number) {
    frame = 0;
    const dt = lastFrameAt ? Math.min(0.1, (now - lastFrameAt) / 1000) : 0;
    lastFrameAt = now;
    const k = reducedMotion.matches ? 1 : 1 - Math.exp(-dt / 0.06);
    const targets = Array.from(cursors.values(), (cursor) => ({ cursor, target: targetPoint(cursor) }));
    let moving = false;
    for (const { cursor, target } of targets) {
      if (cursor.placed) {
        cursor.x += (target.x - cursor.x) * k;
        cursor.y += (target.y - cursor.y) * k;
      } else {
        cursor.placed = true;
        cursor.x = target.x;
        cursor.y = target.y;
        cursor.element.style.opacity = '1';
      }
      if (Math.abs(target.x - cursor.x) < 0.25 && Math.abs(target.y - cursor.y) < 0.25) {
        cursor.x = target.x;
        cursor.y = target.y;
      } else {
        moving = true;
      }
      cursor.element.style.transform = `translate3d(${cursor.x - 1}px, ${cursor.y - 1}px, 0)`;
    }
    if (moving && visible) frame = requestAnimationFrame(tick);
    else lastFrameAt = 0;
  }

  function onChat(id: string, text: string) {
    const cursor = cursors.get(id);
    if (!cursor) return;
    if (!text) {
      cursor.bubble?.remove();
      cursor.bubble = null;
      return;
    }
    if (!cursor.bubble) {
      cursor.bubble = document.createElement('div');
      cursor.bubble.className = `${BUBBLE_CLASS} whitespace-pre-wrap wrap-anywhere`;
      cursor.element.append(cursor.bubble);
    }
    cursor.bubble.textContent = text;
    cursor.chatAt = performance.now();
    cursor.lastSeen = cursor.chatAt;
    cursor.element.style.opacity = cursor.placed ? '1' : '0';
  }

  function onMessage(raw: string) {
    const message = parseServerMessage(raw);
    if (!message) return;
    if (message.type === 'count') {
      const next = message.count - 1;
      if (next === others) return;
      const grew = next > others;
      others = next;
      onPeopleChange(next);
      // Someone new arrived: re-send our position (and open chat) so they see us immediately.
      if (grew && pointer) {
        scheduleMove();
        if (chat?.text) scheduleChat();
      }
      return;
    }
    if (message.type === 'leave') return removeCursor(message.id);
    if (message.type === 'chat') return onChat(message.id, message.text);

    let cursor = cursors.get(message.id);
    if (!cursor) {
      if (cursors.size >= MAX_CURSORS) {
        const stalest = [...cursors.entries()].sort(([, a], [, b]) => a.lastSeen - b.lastSeen)[0];
        if (stalest) removeCursor(stalest[0]);
      }
      const element = document.createElement('div');
      element.className = 'absolute top-0 left-0 opacity-0 transition-opacity duration-200 will-change-transform';
      element.innerHTML =
        '<svg viewBox="0 0 13 19" width="13" height="19" class="block fill-theme-fg stroke-theme-bg" stroke-width="1.2" stroke-linejoin="round"><path d="M1 1v15.2l3.9-3.7 2.6 5.8 2.4-1-2.6-5.7h5.4z"/></svg>';
      layer.append(element);
      cursor = {
        element,
        target: message.position,
        anchor: null,
        x: 0,
        y: 0,
        placed: false,
        lastSeen: 0,
        bubble: null,
        chatAt: 0,
        tag: null,
      };
      cursors.set(message.id, cursor);
      onCursorsChange(cursors.size);
      renderTag(message.id, cursor);
    }
    cursor.target = message.position;
    cursor.lastSeen = performance.now();
    cursor.element.style.opacity = cursor.placed ? '1' : '0';
    requestFrame();
  }

  function connect() {
    if (destroyed || !room || !identityResolved) return;
    const ws = new WebSocket(
      `${url}?room=${encodeURIComponent(room)}${token ? `&token=${encodeURIComponent(token)}` : ''}`,
    );
    socket = ws;
    ws.onopen = () => {
      attempts = 0;
    };
    ws.onmessage = (event) => {
      if (typeof event.data === 'string') onMessage(event.data);
    };
    ws.onclose = () => {
      if (socket !== ws) return;
      socket = null;
      clearCursors();
      if (destroyed || attempts >= 6) return;
      reconnectTimer = window.setTimeout(connect, Math.min(30_000, 1000 * 2 ** attempts));
      attempts += 1;
    };
  }

  function disconnect() {
    window.clearTimeout(reconnectTimer);
    closeChat();
    const ws = socket;
    socket = null;
    ws?.close(1000);
    clearCursors();
  }

  layer.setAttribute('aria-hidden', 'true');
  layer.className = 'pointer-events-none fixed inset-0 z-9999 overflow-hidden';
  layer.hidden = !visible;
  document.body.append(layer);

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === 'touch' || !(event.target instanceof Element)) return;
    const first = pointer === null;
    pointer = { x: event.clientX, y: event.clientY, target: event.target };
    scheduleMove();
    positionChat();
    if (first && chat?.text) scheduleChat();
    requestFrame();
  };

  const onVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      closeChat();
      leave();
      return;
    }
    if (!socket) {
      attempts = 0;
      connect();
    }
    requestFrame();
  };

  const onPageHide = () => disconnect();

  const onPageShow = (event: PageTransitionEvent) => {
    if (event.persisted && !socket) {
      attempts = 0;
      connect();
    }
  };

  function openChat() {
    if (!pointer || document.querySelector('[aria-modal="true"]')) return;
    if (chat && !chat.sent) {
      chat.input.focus({ preventScroll: true });
      return;
    }
    closeChat();
    const container = document.createElement('div');
    container.className = 'pointer-events-none fixed top-0 left-0 z-9999';
    const bubble = document.createElement('div');
    bubble.className = `${BUBBLE_CLASS} grid`;
    const placeholder = document.createElement('span');
    placeholder.className = 'invisible col-start-1 row-start-1 whitespace-pre';
    placeholder.textContent = CHAT_PLACEHOLDER;
    const sizer = document.createElement('span');
    sizer.className = 'invisible col-start-1 row-start-1 whitespace-pre-wrap wrap-anywhere';
    sizer.textContent = ' ';
    const input = document.createElement('textarea');
    input.rows = 1;
    input.enterKeyHint = 'send';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = CHAT_PLACEHOLDER;
    input.setAttribute('aria-label', 'Message for everyone on this page');
    input.className =
      'col-start-1 row-start-1 w-0 min-w-full resize-none overflow-hidden wrap-anywhere bg-transparent text-theme-fg outline-none placeholder:text-theme-fg/50';
    bubble.append(placeholder, sizer, input);
    container.append(bubble);
    document.body.append(container);
    chat = { container, input, sizer, text: '', spoke: false, sent: false, returnFocus: document.activeElement };
    positionChat();
    window.setTimeout(() => {
      if (chat?.input === input) input.focus({ preventScroll: true });
    }, 0);
    input.addEventListener('input', () => {
      if (!chat || chat.sent) return;
      const text = cleanChatText(input.value);
      if (text !== input.value) input.value = text;
      chat.text = text;
      chat.spoke ||= text !== '';
      sizer.textContent = `${text}\u00a0`;
      scheduleChat();
      expireChat();
    });
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Enter') {
        if (!chat?.text) {
          closeChat();
        } else {
          chat.sent = true;
          chat.input.readOnly = true;
          expireChat();
        }
        return;
      }
      closeChat();
    });
    input.addEventListener('blur', () => {
      if (chat && !chat.sent) closeChat();
    });
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) {
      return;
    }
    event.preventDefault();
    openChat();
  };

  const idleInterval = window.setInterval(() => {
    const now = performance.now();
    for (const cursor of cursors.values()) {
      if (cursor.bubble && now - cursor.chatAt > 10_000) {
        cursor.bubble.remove();
        cursor.bubble = null;
      }
      if (cursor.placed) cursor.element.style.opacity = now - cursor.lastSeen > CURSOR_IDLE_MS ? '0' : '1';
    }
  }, 5000);
  const pingInterval = window.setInterval(() => send(PING), 30_000);

  window.addEventListener('pointermove', onPointerMove, { passive: true, capture: true });
  window.addEventListener('resize', requestFrame, { passive: true });
  window.addEventListener('scroll', requestFrame, { passive: true, capture: true });
  document.documentElement.addEventListener('mouseleave', leave);
  document.addEventListener('visibilitychange', onVisibilityChange);
  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('pageshow', onPageShow);

  return {
    join(pathname) {
      const next = roomFromPathname(pathname);
      if (next === room) return;
      room = next;
      attempts = 0;
      disconnect();
      connect();
    },
    setIdentity(next) {
      if (identityResolved && next === token) return;
      identityResolved = true;
      token = next;
      attempts = 0;
      disconnect();
      connect();
    },
    setHighlight(next) {
      highlight = next;
      for (const [id, cursor] of cursors) renderTag(id, cursor);
    },
    setShowOthers(show) {
      visible = show;
      layer.hidden = !show;
      if (show) {
        for (const cursor of cursors.values()) cursor.placed = false;
        requestFrame();
        return;
      }
      cancelAnimationFrame(frame);
      frame = 0;
      lastFrameAt = 0;
    },
    destroy() {
      destroyed = true;
      disconnect();
      window.clearTimeout(moveTimer);
      window.clearTimeout(chatTimer);
      window.clearTimeout(chatExpireTimer);
      window.clearInterval(pingInterval);
      window.clearInterval(idleInterval);
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onPointerMove, { capture: true });
      window.removeEventListener('resize', requestFrame);
      window.removeEventListener('scroll', requestFrame, { capture: true });
      document.documentElement.removeEventListener('mouseleave', leave);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      layer.remove();
    },
  };
}
