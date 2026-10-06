# FF Desk presence server

Cloudflare Worker + two Durable Objects that speak the exact protocol of the site's presence
client (`src/lib/presence/*`, ported from the reference modules 998374 / 775529 / 125559).
The site connects when `NEXT_PUBLIC_PRESENCE_URL` (→ `SITE.presenceUrl`) is set, e.g.
`wss://presence.example.dev`. Empty = feature off. The client only boots for a real mouse
(`(hover: hover) and (pointer: fine)`) and never under `navigator.webdriver`.

## Run locally

```sh
cd presence
npm install
cp .dev.vars.example .dev.vars   # set TOKEN_SECRET
npm run dev                      # ws://127.0.0.1:8787
npm run smoke                    # protocol smoke test (17 checks)
```

Point the site at it with `NEXT_PUBLIC_PRESENCE_URL=ws://127.0.0.1:8787 npm run dev`.

Deploy (not done yet): `wrangler secret put TOKEN_SECRET`, set `ALLOWED_ORIGINS` in
`wrangler.jsonc` to the site origin(s), `npm run deploy`, add a custom domain.

## Routing

| URL | Object | Purpose |
|---|---|---|
| `<base>/lobby[?token=T]` | `Lobby` (one instance, `idFromName('lobby')`) | identity + who is on which page |
| `<base>/?room=<path>[&token=T]` | `Room` (one per `room`, `idFromName(room)`) | live cursors + chat on one page |

`room` is the pathname with trailing slashes removed (`/` for home), max 256 chars. Non-WebSocket
requests get `426`. Origins outside `ALLOWED_ORIGINS` (if set) get `403`. Both objects use the
WebSocket Hibernation API; `"ping"` is auto-answered with `"pong"` without waking the object (the
client ignores it). All frames are JSON arrays except `"ping"`, `"pong"` and the room leave `"0"`.

## Identity token

`<id>.<number>.<sig>` — `id` 8 hex chars, `number` 1..100000 ("Visitor N"), `sig` = first 22
chars of base64url(HMAC-SHA256(TOKEN_SECRET, "id.number")). The lobby mints one per new visitor
(number from a persisted counter that wraps at 100000) and the client keeps it in
`sessionStorage['ff-presence-token']`, so a reload or reconnect keeps the same visitor. A missing or
forged token gets a fresh identity. Rooms verify the same token so a cursor's id equals the
visitor's lobby id (which is how "follow" tags the right cursor). Without a valid token (lobby
down, or no answer within 5s) the client joins rooms anonymously and the room assigns a random id.

## Lobby protocol

Client → server

| Frame | Meaning |
|---|---|
| `["p", url]` | I am at `url` (path + search + hash, must pass `isValidVisitUrl`), active |
| `["p", url, 1]` | same, but away (tab hidden or no input for 120s) |
| `["p", null]` | location unknown / not listable |

Server → client

| Frame | When |
|---|---|
| `["y", id, number, token]` | first frame after connect: your identity |
| `["s", [[id, number, url(, 1)], …]]` | second frame: everyone else with a known url (never you), ≤ 262144 chars |
| `["u", id, number, url(, 1)]` | another visitor appeared / moved / went away or came back |
| `["x", id]` | another visitor left (last socket for that id closed) or reported `url: null` |

The client sorts the list by number, hides away visitors (unless being followed) and counts the
non-away ones for the header badge.

## Room protocol

Client → server (only sent while someone else is in the room; throttled to one per 66ms)

| Frame | Meaning |
|---|---|
| `[anchor, ax, ay, vx, vy]` | cursor moved. `anchor` is `null`, a `data-presence-anchor` value, or `e-<fnv36>-<n>` (nth visible link/button with that hash); `ax/ay` 0..1 inside the anchor rect, `vx/vy` 0..1 of the viewport; 4 decimals |
| `["t", text]` | chat bubble text (≤ 80 code points, control/bidi chars stripped; `""` clears) |
| `"0"` | my pointer left the page / tab hidden |

Server → client

| Frame | When |
|---|---|
| `["c", n]` | on every join/leave, to everyone: people in the room including you (1..1000). When it rises, clients re-send their position (and open chat) so the newcomer sees them |
| `["m", id, anchor, ax, ay, vx, vy]` | another cursor moved (relayed, re-validated) |
| `["t", id, text]` | another visitor's chat text (cleaned again server-side) |
| `["l", id]` | another cursor left (`"0"` or socket closed) |

The server keeps no cursor state. Invalid frames, frames over 512 chars and floods (room 30/s burst
60, lobby 5/s burst 20 per socket) are dropped silently. Clients show at most 8 cursors, fade a
cursor after 120s without updates and drop a chat bubble after 10s.

## Client behaviour worth knowing (for operating it)

- Reconnect: exponential backoff 1s·2^n, max 30s, at most 6 attempts, reset on success, page show
  or tab focus.
- Pings every 30s on both sockets.
- `/` opens the chat box at your cursor; Enter sends (box stays 5s), Esc cancels.
