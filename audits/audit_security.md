# RetroParty Comprehensive Security Audit & Threat Model Report

**Date**: October 16, 2026  
**Auditor**: Security & Threat Model Expert  
**Target Repository**: RetroParty (`@workspace/api-server`, `@workspace/sega-party`)  
**Scope**: Server-Side Request Forgery (SSRF) & Proxy Risks, WebSocket & WebRTC Signaling Security, HTTP & API Security, Client-Side Input & Session Security.  
**Mode**: Read-Only Defensive Audit (No code modified).

---

## Executive Summary

A comprehensive architectural and source code security assessment of the RetroParty multi-player cloud gaming platform was performed. Several high-impact security risks were identified, most critically a **Full Read Server-Side Request Forgery (SSRF)** vulnerability in the ROM proxy router (`/api/rom-proxy`), **Host Session Usurpation & State Exhaustion DoS** in the WebSocket signaling subsystem (`/ws`), and **Authentication / Session Hijacking** via predictable display name collision in the session REST API (`/api/sessions/:code/join`).

Overall platform defense requires implementing strict network address egress filtering on proxy requests, cryptographically authenticating host and player identity across both HTTP and WebSocket layers, enforcing frame size and message rate limits on WebSockets, and deploying standard defensive HTTP headers (`helmet`).

---

## Vulnerability Summary Matrix

| ID | Title | Severity | Affected Component | CVSS v3.1 |
|---|---|---|---|---|
| **SEC-01** | Full Read Server-Side Request Forgery (SSRF) via ROM Proxy | **Critical** | `artifacts/api-server/src/routes/romProxy.ts:5-40` | **9.8** |
| **SEC-02** | Host Usurpation & Role Takeover via Unauthenticated Join | **High** | `artifacts/api-server/src/lib/signaling.ts:122-133` | **8.2** |
| **SEC-03** | Player & Host Identity Hijacking via Display Name Collision | **High** | `artifacts/api-server/src/routes/sessions.ts:145-194` | **8.1** |
| **SEC-04** | Unbounded Memory & CPU Denial of Service via Signaling Flooding | **High** | `artifacts/api-server/src/lib/signaling.ts:32-49, 93-99` | **7.5** |
| **SEC-05** | Lack of Origin Validation (Cross-Site WebSocket Hijacking - CSWSH) | **Medium** | `artifacts/api-server/src/lib/signaling.ts:80-83` | **6.5** |
| **SEC-06** | Arbitrary Slot Manipulation & Controller Impersonation | **Medium** | `artifacts/api-server/src/lib/signaling.ts:287-348` | **6.3** |
| **SEC-07** | Missing HTTP Defensive Security Headers (`helmet`, CSP, HSTS) | **Medium** | `artifacts/api-server/src/app.ts:10-44` | **5.3** |
| **SEC-08** | Unauthorized Input Injection to Player 1 Slot via Race Condition | **Low** | `artifacts/sega-party/src/pages/session.tsx:418-424, 835-842` | **4.3** |
| **SEC-09** | Information Disclosure of Internal Errors & Network Topography | **Low** | `artifacts/api-server/src/routes/romProxy.ts:38` | **4.3** |

---

## Detailed Vulnerability Analysis

---

### [SEC-01] Full Read Server-Side Request Forgery (SSRF) in ROM Proxy

- **Severity**: **Critical** (CVSS: 9.8 - `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H`)
- **Affected File**: `artifacts/api-server/src/routes/romProxy.ts` (Lines 5–40)
- **Vulnerability Class**: CWE-918 (Server-Side Request Forgery)

#### Description & Root Cause
The `/api/rom-proxy` GET route takes a query parameter `url` and directly passes it to Node's global `fetch(targetUrl)`:
```typescript
romProxyRouter.get("/rom-proxy", async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl || (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://"))) {
    res.status(400).json({ error: "Valid http or https URL is required" });
    return;
  }
  const upstreamRes = await fetch(targetUrl);
  ...
  // Stream upstream body to client
  const reader = upstreamRes.body.getReader();
  ...
});
```
The only check performed is verifying that `targetUrl` begins with `http://` or `https://`. No domain whitelist, hostname validation, DNS resolution checks, or private IP address filters exist.

#### Exploitation Scenarios
1. **Cloud Instance Metadata Extraction**:
   If hosted on AWS, GCP, Azure, or DigitalOcean, an attacker can issue:
   `GET /api/rom-proxy?url=http://169.254.169.254/latest/meta-data/iam/security-credentials/`
   Because the server streams the upstream response directly back to the client (`res.write(Buffer.from(value))`), this is a **Full Read SSRF**. Temporary IAM keys, environment secrets, and instance identity tokens can be extracted.
2. **Internal Network & Microservice Port Scanning**:
   An attacker can query internal loopback services:
   `GET /api/rom-proxy?url=http://127.0.0.1:5432/` (PostgreSQL)
   `GET /api/rom-proxy?url=http://localhost:3000/api/sessions`
   `GET /api/rom-proxy?url=http://redis.internal:6379/`
3. **Redirect-Based Evasion**:
   By default, `fetch()` follows HTTP 301/302 redirects. An attacker-controlled public server (`http://evil.com/redirect`) can return a 302 redirect pointing to `http://127.0.0.1:3000`, bypassing naive initial URL string checks.
4. **Denial of Service via Unbounded Stream Proxying**:
   No upper limit is imposed on upstream response size. A request targeting `http://speedtest.tele2.net/100GB.zip` or an infinite `/dev/urandom` stream will tie up Node.js server memory and bandwidth indefinitely.

#### Remediation Recommendation
1. **Restrict Protocol & Whitelist Domains**:
   If the proxy is intended for trusted ROM repositories (e.g. Internet Archive or licensed CDN buckets), enforce a strict domain allowlist.
2. **Block Private / Loopback / Link-Local IP Ranges**:
   Resolve the hostname via `dns.promises.lookup()` prior to fetching, and reject:
   - IPv4 Loopback: `127.0.0.0/8`
   - IPv6 Loopback: `::1`
   - RFC 1918 Private ranges: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
   - Link-local & Cloud Metadata: `169.254.0.0/16`, `fe80::/10`
   - Carrier-Grade NAT: `100.64.0.0/10`
3. **Disable Automatic Redirect Following**:
   Set `redirect: "manual"` in `fetch()`. If redirects must be followed, manually resolve and validate the destination URL of each redirect against the IP blocklist before proceeding.
4. **Enforce Response Size and Timeout Limits**:
   Inspect `Content-Length` headers (< 250 MB) and abort requests exceeding a timeout (e.g. 15 seconds) or byte threshold.

---

### [SEC-02] Host Usurpation & Role Takeover via Unauthenticated Join

- **Severity**: **High** (CVSS: 8.2 - `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:H`)
- **Affected File**: `artifacts/api-server/src/lib/signaling.ts` (Lines 103–134)
- **Vulnerability Class**: CWE-287 (Improper Authentication), CWE-284 (Improper Access Control)

#### Description & Root Cause
In `signaling.ts`, when a client sends a WebSocket `join` message, the server assigns roles based solely on the client-supplied `msg.role`:
```typescript
if (role === "host") {
  room.hostPeerId = peerId;
  if (!room.slots[1] || room.slots[1].isHost || room.slots[1].playerName === playerName) {
    room.slots[1] = { peerId, playerName, isHost: true };
  }
...
```
There is no session token, host password, or cryptographic secret verified when a client declares `role: "host"`. If a host is actively running a game with guests, any other client who connects and transmits `{"type":"join","sessionCode":"ABCDEF","role":"host","peerId":"attacker-id"}` immediately overwrites `room.hostPeerId` with `attacker-id`.

#### Impact
The rogue client immediately gains host privileges:
- Can kick legitimate players from any controller slot (`slot-kick`, lines 439–472).
- Can change or terminate the loaded ROM core (`rom-change`, lines 526–560).
- Intercepts all player controller inputs routed to the host (`player-input`, line 604).
- Prompts legitimate guests to treat the attacker as the WebRTC stream source.

#### Remediation Recommendation
1. **Issue Cryptographic Host Tokens**:
   When the session is initialized in `POST /api/sessions`, return a cryptographically random `hostToken` (e.g. `crypto.randomBytes(32).toString('hex')`) exclusively to the creator.
2. **Authenticate Host on WebSocket Join**:
   Require `msg.hostToken` for any client claiming `role: "host"`. Verify the token matches the stored session host token before granting host authority:
   ```typescript
   if (role === "host") {
     if (!session || session.hostToken !== msg.hostToken) {
       ws.send(JSON.stringify({ type: "error", message: "Unauthorized: Invalid host token" }));
       return;
     }
     room.hostPeerId = peerId;
   }
   ```

---

### [SEC-03] Player & Host Identity Hijacking via Display Name Collision

- **Severity**: **High** (CVSS: 8.1 - `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:H/A:H`)
- **Affected File**: `artifacts/api-server/src/routes/sessions.ts` (Lines 145–194)
- **Vulnerability Class**: CWE-287 (Improper Authentication)

#### Description & Root Cause
In `sessions.ts`, when joining an existing session via `POST /api/sessions/:code/join`, the server attempts to detect reconnecting players by doing a case-insensitive name match:
```typescript
const existingIndex = players.findIndex(
  (p) => p.name.trim().toLowerCase() === playerName.trim().toLowerCase(),
);

if (existingIndex !== -1) {
  playerId = players[existingIndex].id || generatePlayerId();
  players[existingIndex].name = playerName;
  players[existingIndex].id = playerId;
  updatedPlayers = [...players];
}
```
If an existing player or the host has the name `"Sonic"`:
1. An attacker sends `POST /api/sessions/:code/join` with `{"playerName": "Sonic"}`.
2. The server matches `existingIndex` and returns the victim's existing `playerId` in the HTTP response (`res.json({ session, playerId })`).
3. The attacker now possesses the authentic `playerId` of the host or player.

#### Impact
- **Session Termination**: The attacker can send `POST /api/sessions/:code/leave` with the retrieved host `playerId`. Line 219 checks `if (playerId === session.hostId)` and permanently deletes the session from the database/memory.
- **Account / Player Identity Theft**: The attacker can claim controller slots and submit inputs under the victim's identity.

#### Remediation Recommendation
1. Do not use plain display names as an authentication factor.
2. Generate a secure, unguessable player session secret (or cookie) on initial join and store its hash in the database.
3. Reject join requests with duplicate active player names unless accompanied by the secret token issued during the first join.

---

### [SEC-04] Unbounded Memory & CPU Denial of Service via Signaling Flooding

- **Severity**: **High** (CVSS: 7.5 - `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H`)
- **Affected File**: `artifacts/api-server/src/lib/signaling.ts` (Lines 30–49, 81–99, 616–658)
- **Vulnerability Class**: CWE-400 (Uncontrolled Resource Consumption)

#### Description & Root Cause
1. **Unconstrained Room Creation**:
   `getOrCreateRoom(sessionCode)` creates a new `RoomState` entry in `rooms = new Map<string, RoomState>()` for any string received. There is no session code regex validation, no limit on maximum active rooms, and no room TTL. A script can generate 200,000 unique room codes in seconds, exhausting Node.js heap memory.
2. **Missing WebSocket Max Payload Size**:
   `new WebSocketServer({ server, path: "/ws" })` uses the `ws` library default `maxPayload` of 100 megabytes (`104857600` bytes). An attacker can transmit multi-megabyte payloads, causing high CPU spikes and V8 GC pressure during `JSON.parse(rawData.toString())`.
3. **Uncapped Broadcast Relaying (`video-frame` & `audio-chunk`)**:
   Lines 616–658 allow clients to send high-frequency base64 video frames and audio chunks that are broadcast to all connected peers in the room:
   ```typescript
   if (type === "video-frame") {
     broadcastToRoom(room, { type: "video-frame", fromPeerId: myPeerId, frame, ... }, myPeerId);
   }
   ```
   A single rogue client transmitting 1080p JPEG frames at 60 FPS will saturate the server's network bandwidth and freeze the single-threaded Node.js event loop due to repetitive `JSON.stringify()` serialization across multiple sockets.

#### Remediation Recommendation
1. Validate `sessionCode` format: `if (!/^[A-Z0-9]{4,8}$/.test(sessionCode)) return;`.
2. Configure `maxPayload: 256 * 1024` (256 KB) on `WebSocketServer`.
3. Implement a per-socket token-bucket rate limiter (e.g. max 50 signaling messages/sec, max 20 frame broadcasts/sec).
4. Restrict `video-frame` and `audio-chunk` broadcast permissions strictly to the verified host.

---

### [SEC-05] Cross-Site WebSocket Hijacking (CSWSH) via Missing Origin Validation

- **Severity**: **Medium** (CVSS: 6.5 - `CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:H/A:N`)
- **Affected File**: `artifacts/api-server/src/lib/signaling.ts` (Lines 80–84)
- **Vulnerability Class**: CWE-1385 (Missing Origin Validation in WebSockets)

#### Description & Root Cause
When upgrading HTTP connections to WebSockets:
```typescript
export function attachSignalingServer(server: Server) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => { ... });
```
The incoming HTTP upgrade request's `Origin` header (`_req.headers.origin`) is never inspected or validated against allowed hosts. 

#### Impact
A victim who is actively hosting or playing a RetroParty session can visit a malicious third-party site (`https://attacker-site.com`). JavaScript running on the malicious site can initiate `new WebSocket("wss://retroparty.example.com/ws")`. The browser automatically includes any host cookies/session context. The attacker can then eavesdrop on signaling, broadcast messages, or inject rogue inputs into the victim's active game room.

#### Remediation Recommendation
Validate the `Origin` header in `verifyClient` or inside the `connection` listener:
```typescript
const allowedOrigins = new Set([
  process.env.APP_URL,
  "http://localhost:3000",
  "http://localhost:5173",
]);

const wss = new WebSocketServer({
  server,
  path: "/ws",
  verifyClient: (info, callback) => {
    const origin = info.origin;
    if (!origin || allowedOrigins.has(origin)) {
      callback(true);
    } else {
      callback(false, 403, "Forbidden Origin");
    }
  },
});
```

---

### [SEC-06] Arbitrary Slot Manipulation & Controller Impersonation

- **Severity**: **Medium** (CVSS: 6.3 - `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:L`)
- **Affected File**: `artifacts/api-server/src/lib/signaling.ts` (Lines 287, 348)
- **Vulnerability Class**: CWE-284 (Improper Access Control)

#### Description & Root Cause
In `slot-claim` and `slot-release`:
```typescript
const effectivePeerId = (msg.peerId as string) || myPeerId;
const effectivePlayerName = (msg.playerName as string) || myPlayerName || "Player";
```
The server allows a message to override the socket's authenticated identity (`myPeerId`) with an arbitrary client-specified `msg.peerId`. 

#### Impact
A client can forcefully release another player's controller slot by sending:
`{"type": "slot-release", "sessionCode": "ABCDEF", "peerId": "victim-peer-id"}`
The server will erase the victim's controller assignment and broadcast to the room that the player has released their slot.

#### Remediation Recommendation
Always bind actions strictly to the connection's authenticated `myPeerId`:
```typescript
const effectivePeerId = myPeerId; // Do NOT accept peerId from client payload
const effectivePlayerName = myPlayerName;
```

---

### [SEC-07] Missing HTTP Defensive Security Headers (`helmet`, CSP, HSTS)

- **Severity**: **Medium** (CVSS: 5.3 - `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N`)
- **Affected File**: `artifacts/api-server/src/app.ts` (Lines 10–44)
- **Vulnerability Class**: CWE-1021 (Improper Restriction of Rendered UI Layers or Frames), CWE-693 (Protection Mechanism Failure)

#### Description & Root Cause
In `app.ts`, Cross-Origin Isolation headers (`COOP`, `COEP`, `CORP`) were configured manually for SharedArrayBuffer support in EmulatorJS Wasm threads. However, standard defensive HTTP headers are missing:
- No `helmet` middleware.
- Missing `Content-Security-Policy` (CSP).
- Missing `X-Content-Type-Options: nosniff` (vulnerable to MIME-type sniffing).
- Missing `X-Frame-Options` or `frame-ancestors` (vulnerable to clickjacking if framed).
- Missing `Strict-Transport-Security` (HSTS).
- Overly broad CORS: `app.use(cors())` configures `Access-Control-Allow-Origin: *` across all routes.

#### Remediation Recommendation
Install and configure `helmet`:
```typescript
import helmet from "helmet";

app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginEmbedderPolicy: { policy: "credentialless" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-eval'", "'wasm-unsafe-eval'"],
        connectSrc: ["'self'", "ws:", "wss:", "blob:", "https://*.google.com", "https://*.cloudflare.com"],
        mediaSrc: ["'self'", "blob:"],
        imgSrc: ["'self'", "data:", "blob:"],
      },
    },
  })
);
```

---

### [SEC-08] Unauthorized Input Injection to Player 1 Slot via Race Condition

- **Severity**: **Low** (CVSS: 4.3 - `CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:L/A:L`)
- **Affected File**: `artifacts/sega-party/src/pages/session.tsx` (Lines 418–424, 835–842)
- **Vulnerability Class**: CWE-284 (Improper Access Control)

#### Description & Root Cause
When the host receives input over WebRTC DataChannel (`dc.onmessage`) or WebSocket (`msg.type === "player-input"`), the host checks if the sending peer has an assigned slot. If `assignedSlot === null`:
```typescript
// Peer is a spectator or has no slot. If requested slot is owned by someone else, ignore!
const requestedSlot = Number(input.playerIndex) || 2;
const owner = slotAssignmentsRef.current[requestedSlot];
if (!owner || owner.peerId === guestPeerId) {
  (simulateEmulatorInput as any)(requestedSlot, input.action, input.type === "keydown", activeCore);
}
```
If a guest transmits `input.playerIndex = 1` before the host's slot assignment has populated in `slotAssignmentsRef.current[1]`, the guest's input is dispatched directly to Player 1 (the host's controls).

#### Remediation Recommendation
Never permit unassigned spectator peers to dispatch inputs to Slot 1. Require that inputs to Slot 1 can strictly originate from local host hardware input events.

---

### [SEC-09] Information Disclosure of Internal Errors & Network Topography

- **Severity**: **Low** (CVSS: 4.3 - `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N`)
- **Affected File**: `artifacts/api-server/src/routes/romProxy.ts` (Line 38)
- **Vulnerability Class**: CWE-209 (Generation of Error Message Containing Sensitive Information)

#### Description & Root Cause
Line 38 of `romProxy.ts`:
```typescript
res.status(502).json({ error: "Error proxying ROM", details: String(err) });
```
When `fetch(targetUrl)` fails (e.g. connection refused, DNS lookup failed, TLS certificate failure), the exact Node.js network exception `details: String(err)` is returned to the client.

#### Impact
Attackers mapping internal infrastructure can differentiate between closed ports (`ECONNREFUSED`), non-existent hosts (`ENOTFOUND`), and active hosts with firewalls (`ETIMEDOUT`).

#### Remediation Recommendation
Log error details internally with `logger.warn({ err, targetUrl }, "ROM proxy error")`, and return a sanitized, generic error message to clients:
```typescript
res.status(502).json({ error: "Failed to fetch upstream resource" });
```

---

## Strategic Hardening Roadmap

### Phase 1: Immediate Critical Fixes (Day 1)
1. **SSRF Mitigation (`romProxy.ts`)**:
   - Implement hostname DNS resolution and reject RFC1918, loopback, and link-local IP addresses.
   - Set `redirect: "manual"` in `fetch()`.
   - Impose a strict maximum ROM download size of 200 MB.
   - Sanitize error messages.
2. **Host Authentication (`signaling.ts`)**:
   - Issue a 32-byte cryptographically secure `hostToken` when a session is created.
   - Require `hostToken` verification on WebSocket `join` before granting `role: "host"`.

### Phase 2: Signaling & Protocol Hardening (Week 1)
1. **WebSocket Flooding & Size Guards**:
   - Set `maxPayload: 262144` (256 KB) on `WebSocketServer`.
   - Validate `sessionCode` format: `/^[A-Z0-9]{6}$/`.
   - Enforce peer ID binding on `slot-claim` and `slot-release` (ignore client-supplied `peerId`).
   - Add origin verification in WebSocket upgrade handshake (`verifyClient`).
2. **REST API Authorization**:
   - In `/api/sessions/:code/join`, remove display-name matching as an identity recovery mechanism.
   - Restrict CORS origins to trusted application domains.
   - Add `helmet` middleware in `app.ts`.

### Phase 3: Client Resilience & Defense in Depth (Sprint 2)
1. **Strict Input Slot Segregation**:
   - Reject any remote WebRTC DataChannel inputs targeting Player 1 (`slot 1`).
2. **Session Storage Isolation**:
   - Scope all client session storage keys exclusively by room code (`playerId_${code}`).

---
*Report generated and validated for RetroParty engineering team.*
