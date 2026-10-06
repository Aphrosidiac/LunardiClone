// Local protocol smoke test against `wrangler dev` (default ws://127.0.0.1:8787).
// Uses the site's own client parsers' rules: every frame received must be one the client accepts.
// Run: npm run dev (in another terminal), then npm run smoke.
const BASE = process.env.PRESENCE_URL ?? 'ws://127.0.0.1:8787';
const TOKEN = /^[a-f0-9]{8}\.[0-9]{1,6}\.[A-Za-z0-9_-]{22}$/;

function open(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    const frames = [];
    const waiters = [];
    ws.onmessage = (event) => {
      frames.push(event.data);
      for (const waiter of [...waiters]) waiter();
    };
    ws.onopen = () => resolve({ ws, frames, next });
    ws.onerror = (error) => reject(error);
    function next(predicate, timeout = 3000) {
      return new Promise((done, fail) => {
        const check = () => {
          const index = frames.findIndex((frame) => predicate(JSON.parse(frame)));
          if (index === -1) return false;
          const [frame] = frames.splice(index, 1);
          waiters.splice(waiters.indexOf(check), 1);
          clearTimeout(timer);
          done(JSON.parse(frame));
          return true;
        };
        const timer = setTimeout(() => {
          waiters.splice(waiters.indexOf(check), 1);
          fail(new Error(`timeout; frames: ${JSON.stringify(frames)}`));
        }, timeout);
        waiters.push(check);
        check();
      });
    }
  });
}

const assert = (condition, message) => {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`ok - ${message}`);
};

const a = await open(`${BASE}/lobby`);
const welcomeA = await a.next((m) => m[0] === 'y');
assert(/^[a-f0-9]{8}$/.test(welcomeA[1]) && TOKEN.test(welcomeA[3]), 'lobby welcome ["y", id, number, token]');
assert((await a.next((m) => m[0] === 's'))[1].length >= 0, 'lobby snapshot ["s", visitors]');
a.ws.send(JSON.stringify(['p', '/works']));

const b = await open(`${BASE}/lobby`);
const welcomeB = await b.next((m) => m[0] === 'y');
const snapshotB = await b.next((m) => m[0] === 's');
assert(snapshotB[1].some((v) => v[0] === welcomeA[1] && v[2] === '/works'), 'snapshot lists the other visitor and their url');
assert(!snapshotB[1].some((v) => v[0] === welcomeB[1]), 'snapshot excludes self');
b.ws.send(JSON.stringify(['p', '/blog', 1]));
const update = await a.next((m) => m[0] === 'u' && m[1] === welcomeB[1]);
assert(update[3] === '/blog' && update[4] === 1, 'away update ["u", id, number, url, 1]');

// Reconnect with the token keeps the identity.
const b2 = await open(`${BASE}/lobby?token=${encodeURIComponent(welcomeB[3])}`);
const welcomeB2 = await b2.next((m) => m[0] === 'y');
assert(welcomeB2[1] === welcomeB[1] && welcomeB2[2] === welcomeB[2], 'token restores id and number');
b2.ws.close(1000);
const bad = await open(`${BASE}/lobby?token=${encodeURIComponent(welcomeB[3].slice(0, -1) + 'A')}`);
const welcomeBad = await bad.next((m) => m[0] === 'y');
assert(welcomeBad[1] !== welcomeB[1], 'forged token gets a fresh identity');
bad.ws.close(1000);

// Rooms.
const ra = await open(`${BASE}/?room=${encodeURIComponent('/works')}&token=${encodeURIComponent(welcomeA[3])}`);
assert((await ra.next((m) => m[0] === 'c'))[1] === 1, 'room count ["c", 1] alone');
const rb = await open(`${BASE}/?room=${encodeURIComponent('/works')}&token=${encodeURIComponent(welcomeB[3])}`);
assert((await ra.next((m) => m[0] === 'c' && m[1] === 2))[1] === 2, 'room count rises to 2 for existing member');
assert((await rb.next((m) => m[0] === 'c'))[1] === 2, 'room count 2 for newcomer');
ra.ws.send(JSON.stringify(['e-abc-0', 0.5, 0.25, 0.1, 0.9]));
const move = await rb.next((m) => m[0] === 'm');
assert(move[1] === welcomeA[1] && move[2] === 'e-abc-0' && move[6] === 0.9, 'move relayed ["m", lobbyId, anchor, ax, ay, vx, vy]');
ra.ws.send(JSON.stringify([null, 2, 0, 0, 0]));
ra.ws.send(JSON.stringify(['t', 'hi\u0007 there']));
const chat = await rb.next((m) => m[0] === 't');
assert(chat[1] === welcomeA[1] && chat[2] === 'hi there', 'chat cleaned and relayed; invalid move dropped');
ra.ws.send('0');
assert((await rb.next((m) => m[0] === 'l'))[1] === welcomeA[1], 'leave "0" relayed as ["l", id]');
ra.ws.send('ping');
ra.ws.close(1000);
assert((await rb.next((m) => m[0] === 'l'))[1] === welcomeA[1], 'close relayed as ["l", id]');
assert((await rb.next((m) => m[0] === 'c' && m[1] === 1))[1] === 1, 'count drops to 1');

const anon = await open(`${BASE}/?room=${encodeURIComponent('/works')}`);
anon.ws.send(JSON.stringify([null, 0.1, 0.1, 0.1, 0.1]));
const anonMove = await rb.next((m) => m[0] === 'm' && m[1] !== welcomeA[1]);
assert(/^[a-f0-9]{8}$/.test(anonMove[1]), 'anonymous room member gets a random 8-hex id');
anon.ws.close(1000);

a.ws.close(1000);
const gone = await b.next((m) => m[0] === 'x' && m[1] === welcomeA[1]);
assert(gone[1] === welcomeA[1], 'lobby close broadcasts ["x", id]');
b.ws.close(1000);
rb.ws.close(1000);
console.log('all good');
process.exit(0);
