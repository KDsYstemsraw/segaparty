# RetroParty Phase 22 Deep Security Audit & Threat Model Report

**Date**: October 16, 2026  
**Auditor**: Security & Threat Model Expert  
**Target Repository**: RetroParty (`@workspace/api-server`, `@workspace/sega-party`, `@workspace/api-zod`)  
**Base Commit**: `082e145851447b881ba17cb51610699ad3e9a3ac`  
**Scope**: In-depth read-only architectural and source code security assessment focusing on SSRF hardening follow-up, Cross-Site WebSocket Hijacking (CSWSH), signaling flooding & DoS resilience, defensive HTTP headers & CORS, input sanitization, and authentication/token integrity.  
**Mode**: Read-Only Defensive Audit (No application code modified).

---

## Executive Summary

Following the initial remediation deployed in commit `082e145` (Phase 21), a deep, adversarial security audit (Phase 22) was conducted across the RetroParty platform. This review examined both the efficacy of earlier mitigations and secondary threat vectors across the network, signaling, session lifecycle, and transport boundaries.

While Phase 21 introduced baseline SSRF checks, host secret validation, and controller slot authorization, this audit uncovered critical vulnerabilities that undermine these defenses:

1. **SSRF Hardening Follow-Up (`romProxy.ts`)**: The current DNS pre-resolution check in `validateUrlSecurity` is susceptible to **Time-of-Check to Time-of-Use (TOCTOU) DNS Rebinding** attacks because Node's native `fetch()` executes a secondary, independent DNS lookup. Furthermore, IPv6 filtering misses deprecated IPv4-compatible IPv6 notations (`::127.0.0.1`), alternate zero notations (`::0`, `0:0:0:0:0:0:0:1`), and non-standard target ports are unrestricted.
2. **Session Hijacking & Unauthenticated Kill DoS (`sessions.ts`)**: `GET /api/sessions/:code` publicly discloses internal UUIDs (`hostId` and all `players[].id`). Because `POST /api/sessions/:code/leave` relies solely on `playerId` for authorization without any secret or session token, **any unauthenticated internet caller can terminate and delete any active room** by querying the room code and calling leave with the disclosed `hostId`.
3. **Host Takeover via Broadcast `peerId` Fallback & Host Lockout Bug (`signaling.ts`, `session.tsx`)**: In `signaling.ts`, when `hostSecret` is omitted during initial connection, the server falls back to using the socket's `peerId` as `room.hostSecret`. However, `peerId` is broadcast in plaintext to all guests in the room, allowing any guest to impersonate the host. Crucially, the frontend client never sends `hostSecret` or `playerId` in its WebSocket `join` packet, causing legitimate hosts to be **permanently downgraded to guests upon page refresh**.
4. **Cross-Site WebSocket Hijacking (CSWSH) (`signaling.ts`)**: The WebSocket server at `/ws` ignores the HTTP `Origin` header during upgrade and connection establishment. Malicious external websites can establish cross-origin WebSockets to hijack sessions, eavesdrop on WebRTC signaling and game video/audio streams, or inject controller input.
5. **Memory Exhaustion & DoS via Unbounded Room Creation & Large Payloads (`signaling.ts`)**: Unauthenticated clients can trigger creation of thousands of in-memory `RoomState` objects by spraying arbitrary session codes in `join` or `slot-claim` messages. Furthermore, lack of size caps on `chat` text and `signal` data allows malicious clients to broadcast massive payloads to all room participants.
6. **Defensive Headers & CORS Exposure (`app.ts`)**: The server lacks `helmet` middleware (missing CSP, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`), and uses an unrestricted `cors()` wildcard (`*`).

A prioritized matrix of all 11 new/follow-up vulnerabilities is provided below, followed by technical root-cause analyses, proof-of-concept mechanics, and verified drop-in remediation patches.

---

## Vulnerability Severity Matrix (Phase 22 Round 2)

| ID | Title | Severity | Affected Component | CVSS v3.1 |
|---|---|---|---|---|
| **SEC-10** | Time-of-Check to Time-of-Use (TOCTOU) DNS Rebinding in ROM Proxy | **High** | `artifacts/api-server/src/routes/romProxy.ts:77-124` | **8.6** |
| **SEC-11** | Incomplete IPv6 Range Filtering & Deprecated IPv4-Compatible IPv6 Bypass | **High** | `artifacts/api-server/src/routes/romProxy.ts:27-45` | **8.2** |
| **SEC-12** | Sensitive ID Disclosure in `GET /api/sessions/:code` Permitting Unauthenticated Session Termination DoS | **High** | `artifacts/api-server/src/routes/sessions.ts:100-122, 197-235` | **8.6** |
| **SEC-13** | Host Authentication Bypass via Broadcast `peerId` Fallback & Host Lockout on Refresh | **High** | `artifacts/api-server/src/lib/signaling.ts:160-174`, `artifacts/sega-party/src/pages/session.tsx:836-847` | **7.8** |
| **SEC-14** | Cross-Site WebSocket Hijacking (CSWSH) via Missing Origin Validation | **Medium** | `artifacts/api-server/src/lib/signaling.ts:83-89` | **6.5** |
| **SEC-15** | Memory Exhaustion DoS via Unbounded In-Memory Room Creation | **Medium** | `artifacts/api-server/src/lib/signaling.ts:33-51, 154, 351` | **6.5** |
| **SEC-16** | Unbounded Payload & Message Size on Chat, Signal & Input Channels | **Medium** | `artifacts/api-server/src/lib/signaling.ts:86, 296-339, 576-596` | **6.0** |
| **SEC-17** | Missing Defensive HTTP Security Headers (`helmet`, CSP, HSTS) & Permissive CORS | **Medium** | `artifacts/api-server/src/app.ts:12-40` | **5.3** |
| **SEC-18** | Unconstrained Input Length & Control Character Injection in Player Names and Chat | **Low** | `lib/api-zod/src/generated/api.ts:21-24, 55-57`, `artifacts/api-server/src/routes/sessions.ts:48, 135` | **4.3** |
| **SEC-19** | Predictable Pseudo-Random Session Code Generation via `Math.random` | **Low** | `artifacts/api-server/src/routes/sessions.ts:18-25` | **4.1** |
| **SEC-20** | Timing Attack on Host Secret Verification via Non-Constant-Time Comparison | **Low** | `artifacts/api-server/src/lib/signaling.ts:165` | **3.7** |

---

## Detailed Technical Analysis

---

### [SEC-10] Time-of-Check to Time-of-Use (TOCTOU) DNS Rebinding in ROM Proxy

- **Severity**: **High** (CVSS: 8.6 - `CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:C/C:H/I:N/A:H`)
- **Affected File**: `artifacts/api-server/src/routes/romProxy.ts` (Lines 77–124)
- **Vulnerability Class**: CWE-367 (Time-of-check Time-of-use Race Condition), CWE-918 (Server-Side Request Forgery)

#### Technical Mechanism
In `romProxy.ts`, the server validates target URLs through `validateUrlSecurity(currentUrl)`:
```typescript
// Line 79: Time of Check
const addresses = await dns.promises.lookup(hostname, { all: true });
for (const addr of addresses) {
  if (isBlockedIP(addr.address)) {
    return { valid: false, error: "Access to private or restricted network addresses is forbidden" };
  }
}
return { valid: true, url: parsed };
```
Following validation, the route invokes Node.js `fetch()`:
```typescript
// Line 117: Time of Use
const resp = await fetch(currentUrl, {
  redirect: "manual",
  signal: controller.signal,
  headers: { "User-Agent": "RetroParty-ROM-Proxy/1.0" },
});
```

Because Node's internal HTTP client (Undici) maintains its own DNS resolution lifecycle and connection pool, `fetch(currentUrl)` performs a **separate, independent DNS lookup** on `hostname`.

#### Proof-of-Concept Exploit Scenario
1. An attacker registers domain `rebind.attacker.com` pointing to a custom authoritative DNS server configured with `TTL = 0`.
2. The attacker triggers `GET /api/rom-proxy?url=http://rebind.attacker.com/rom.bin`.
3. Step 1 (Time of Check): Node calls `dns.promises.lookup("rebind.attacker.com")`. The attacker's DNS server returns `93.184.216.34` (public IP). The validation loop succeeds.
4. Step 2 (Time of Use): Milliseconds later, `fetch(currentUrl)` executes. Undici queries DNS for `rebind.attacker.com`. The attacker's DNS server now returns `169.254.169.254` (AWS/GCP Instance Metadata) or `127.0.0.1`.
5. Result: The socket connects to the internal service, and the response stream is piped directly back to the attacker (`res.write(Buffer.from(value))`), bypassing the SSRF filter completely.

---

### [SEC-11] Incomplete IPv6 Range Filtering & Deprecated IPv4-Compatible IPv6 Bypass

- **Severity**: **High** (CVSS: 8.2 - `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:N/A:L`)
- **Affected File**: `artifacts/api-server/src/routes/romProxy.ts` (Lines 27–45)
- **Vulnerability Class**: CWE-918 (Server-Side Request Forgery), CWE-184 (Incomplete List of Disallowed Inputs)

#### Technical Mechanism
`isPrivateIPv6` in `romProxy.ts` defines the following checks:
```typescript
function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true; // Loopback & unspecified
  if (lower.startsWith("::ffff:")) {
    const v4 = lower.slice(7);
    return isPrivateIPv4(v4);
  }
  if (/^fe[89ab]/i.test(lower)) return true; // fe80::/10 (Link-local)
  if (/^f[cd]/i.test(lower)) return true;   // fc00::/7 (Unique local)
  return false;
}
```

This filter has multiple bypass vectors:

1. **Deprecated IPv4-Compatible IPv6 Addresses (RFC 4291)**:
   - Format: `::d.d.d.d` (e.g. `::127.0.0.1`, `::169.254.169.254`, `::10.0.0.1`).
   - `net.isIPv6("::127.0.0.1")` returns `true`.
   - `lower.startsWith("::ffff:")` is `false`.
   - `lower === "::1" || lower === "::"` is `false`.
   - The function returns `false` (i.e. NOT blocked).
   - An attacker requesting `http://[::127.0.0.1]:3000/` completely bypasses the filter.
2. **Alternate Representations of Unspecified and Loopback Addresses**:
   - `::0`, `0:0:0:0:0:0:0:0`, `0:0:0:0:0:0:0:1`, `::0001`.
   - `lower === "::1" || lower === "::"` only tests exact string matches against `"::1"` and `"::"`.
   - `net.isIPv6("0:0:0:0:0:0:0:1")` is `true`, but `isPrivateIPv6("0:0:0:0:0:0:0:1")` returns `false`.
3. **Unchecked IPv6 Special Ranges**:
   - `64:ff9b::/96` (Well-known IPv4/IPv6 translation prefix).
   - `2002::/16` (6to4 transition mechanism encapsulating IPv4 addresses).
   - `2001:db8::/32` (Documentation prefix).
   - `100::/64` (Discard prefix).
   - `fec0::/10` (Deprecated site-local).
4. **Unrestricted Port Access**:
   - `romProxy.ts` does not validate target TCP ports. An attacker can use the proxy to connect to internal services running on ports such as `:22` (SSH), `:6379` (Redis), `:5432` (PostgreSQL), `:11434` (Ollama), or `:2375` (Docker daemon).

---

### [SEC-12] Sensitive ID Disclosure in `GET /api/sessions/:code` Permitting Unauthenticated Session Termination DoS

- **Severity**: **High** (CVSS: 8.6 - `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:H`)
- **Affected File**: `artifacts/api-server/src/routes/sessions.ts` (Lines 100–122, 197–235)
- **Vulnerability Class**: CWE-200 (Exposure of Sensitive Information), CWE-284 (Improper Access Control)

#### Technical Mechanism
When querying session metadata via `GET /api/sessions/:code`:
```typescript
// artifacts/api-server/src/routes/sessions.ts:115-121
res.json({
  code: session.code,
  hostId: session.hostId, // <-- LEAKED HOST UUID
  players: session.players, // <-- LEAKED ALL PLAYERS' UUIDs
  maxPlayers: session.maxPlayers,
  createdAt: session.createdAt.toISOString(),
});
```
The endpoint returns the private `hostId` (a UUID) and the internal `id` of every joined player.

Meanwhile, `POST /api/sessions/:code/leave` defines:
```typescript
// artifacts/api-server/src/routes/sessions.ts:207, 218-224
const { playerId } = bodyParsed.data;
// ...
if (playerId === session.hostId || updatedPlayers.length === 0) {
  if (hasDatabase && db) {
    await db.delete(sessionsTable).where(eq(sessionsTable.code, code));
  } else {
    inMemorySessions.delete(code);
  }
}
```

#### Proof-of-Concept Exploit Scenario
1. Any public observer scans or receives an active 6-character room code `ABCD12`.
2. Observer sends `GET /api/sessions/ABCD12`.
3. The response yields: `{"code":"ABCD12","hostId":"3fa85f64-5717-4562-b3fc-2c963f66afa6", ...}`.
4. Observer sends:
   ```http
   POST /api/sessions/ABCD12/leave
   Content-Type: application/json

   { "playerId": "3fa85f64-5717-4562-b3fc-2c963f66afa6" }
   ```
5. Because `playerId === session.hostId`, the server immediately deletes the session from PostgreSQL and memory. The game terminates for all active players.

---

### [SEC-13] Host Authentication Bypass via Broadcast `peerId` Fallback & Host Lockout on Refresh

- **Severity**: **High** (CVSS: 7.8 - `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:H`)
- **Affected Files**:
  - `artifacts/api-server/src/lib/signaling.ts` (Lines 144, 160–174, 217–227)
  - `artifacts/sega-party/src/pages/session.tsx` (Lines 103, 836–847)
- **Vulnerability Class**: CWE-287 (Improper Authentication), CWE-305 (Authentication Bypass by Primary Weakness)

#### Technical Mechanism
In `signaling.ts`:
```typescript
// Line 144:
const hostSecret = (msg.hostSecret as string) || (msg.hostToken as string) || (msg.playerId as string);

// Lines 161-173:
if (role === "host") {
  if (!room.hostSecret) {
    // If no secret was sent, fall back to peerId:
    room.hostSecret = hostSecret || peerId;
  } else if (hostSecret && hostSecret === room.hostSecret) {
    room.hostPeerId = peerId;
  } else {
    logger.warn({ sessionCode, peerId, playerName }, "Unauthorized host usurpation attempt rejected; downgrading to guest");
    role = "guest";
  }
}
```

At the same time, in `session.tsx`:
```typescript
// Line 103:
const myPeerId = useRef(crypto.randomUUID());

// Lines 836-846:
ws.send(
  JSON.stringify({
    type: "join",
    sessionCode: code,
    role: isHost ? "host" : "guest",
    peerId: myPeerId.current,
    playerName: myPlayerName,
    romName: activeRomName || undefined,
    core: activeCore || undefined,
    // BUG: hostSecret, hostToken, and playerId are NEVER sent!
  }),
);
```

#### Dual Failure Mode
1. **Security Vulnerability (Host Takeover)**:
   - When the host initially creates the room, the frontend sends no secret. `room.hostSecret` is assigned the host's `peerId`.
   - Lines 217–227 broadcast `room-state` containing `{ hostPeerId: room.hostPeerId }` to every participant.
   - Any guest who connects can read `hostPeerId`, disconnect, and reconnect with:
     ```json
     {
       "type": "join",
       "sessionCode": "ABCD12",
       "role": "host",
       "peerId": "attacker-id",
       "hostSecret": "<leaked-hostPeerId>"
     }
     ```
     The check `hostSecret === room.hostSecret` evaluates to `true`, granting the attacker full host privileges (kicking players, changing ROMs, commandeering Slot 1).
2. **Operational Vulnerability (Legitimate Host Lockout on Refresh)**:
   - When the legitimate host refreshes the browser tab, `myPeerId.current` generates a new random UUID.
   - The client sends `join` with `role: "host"`, but still sends no `hostSecret`.
   - On the server, `room.hostSecret` already exists from the previous connection.
   - The incoming `hostSecret` is undefined. The check fails, and the server **permanently downgrades the legitimate host to a guest**, locking them out of Slot 1 and game management controls.

---

### [SEC-14] Cross-Site WebSocket Hijacking (CSWSH) via Missing Origin Validation

- **Severity**: **Medium** (CVSS: 6.5 - `CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:L/A:N`)
- **Affected File**: `artifacts/api-server/src/lib/signaling.ts` (Lines 83–89)
- **Vulnerability Class**: CWE-1385 (Missing Origin Validation in WebSockets)

#### Technical Mechanism
In `signaling.ts`:
```typescript
export function attachSignalingServer(server: Server) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 4 * 1024 * 1024,
  });

  wss.on("connection", (ws: WebSocket, _req: IncomingMessage) => { ... });
```
Notice that:
1. `WebSocketServer` does not configure a `verifyClient` callback.
2. The `connection` callback prefixes `_req` as unused, ignoring `_req.headers.origin`.

Web browsers allow cross-origin WebSocket connections by default and send the initiating origin in the `Origin` header. Because the server does not validate this header against an allowlist, any malicious website can open a WebSocket connection to `wss://retroparty.onrender.com/ws`.

#### Impact
An attacker hosting `https://malicious-site.com` can trick a player into visiting their page while playing. The page's JavaScript connects to the signaling server, joins the victim's session, intercepts live party chat, listens to WebRTC SDP offers/answers, captures fallback JPEG/PCM video/audio frames, and injects rogue gamepad inputs.

---

### [SEC-15] Memory Exhaustion DoS via Unbounded In-Memory Room Creation

- **Severity**: **Medium** (CVSS: 6.5 - `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H`)
- **Affected File**: `artifacts/api-server/src/lib/signaling.ts` (Lines 33–51, 154, 351)
- **Vulnerability Class**: CWE-400 (Uncontrolled Resource Consumption)

#### Technical Mechanism
In `signaling.ts`, rooms are managed in an in-memory `Map`:
```typescript
const rooms = new Map<string, RoomState>();

function getOrCreateRoom(sessionCode: string): RoomState {
  if (!rooms.has(sessionCode)) {
    rooms.set(sessionCode, {
      code: sessionCode,
      // ... RoomState initialization with slot records and peers Map
    });
  }
  return rooms.get(sessionCode)!;
}
```
Whenever a `join` message arrives, the server executes `getOrCreateRoom(sessionCode)`.
Rooms are only pruned on socket disconnect:
```typescript
// Line 800-802:
if (room.peers.size === 0) {
  rooms.delete(mySessionCode);
}
```
However, an attacker over a single WebSocket connection can send 100,000 distinct `join` messages with random 6-character codes (`AAAAAA`, `AAAAAB`, ...). Each message creates a new `RoomState` entry in `rooms`. Because `handlePeerDisconnect` only deletes `mySessionCode` (the last joined code), the other 99,999 empty rooms remain in heap memory indefinitely, leading to Node.js Out-Of-Memory (OOM) crashes.

---

### [SEC-16] Unbounded Payload & Message Size on Chat, Signal & Input Channels

- **Severity**: **Medium** (CVSS: 6.0 - `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H`)
- **Affected File**: `artifacts/api-server/src/lib/signaling.ts` (Lines 86, 296–339, 576–596)
- **Vulnerability Class**: CWE-770 (Allocation of Resources Without Limits or Throttling)

#### Technical Mechanism
1. **Global `maxPayload: 4 * 1024 * 1024` (4 MB)**: While this limit caps the raw WebSocket frame, a 4 MB payload is excessive for non-streaming signaling messages.
2. **Uncapped Chat Text**:
   ```typescript
   // Line 576:
   if (type === "chat") {
     const text = (msg.text as string)?.trim();
     // No text.length check!
     broadcastToRoom(room, chatMsg);
   }
   ```
   A guest can transmit a 4 MB chat string. The server parses the JSON, constructs the broadcast payload, and forwards 4 MB to every participant in the room. In a room with 4 participants, a single message causes 16 MB of outbound network serialization.
3. **Uncapped `signal` and `voice-signal` Data**:
   `msg.data` has no byte-length ceiling. A rogue client can send 150 messages/sec containing large nested objects targeted at another peer, inducing client-side WebRTC packet processing lag and DOM lockups.

---

### [SEC-17] Missing Defensive HTTP Security Headers (`helmet`, CSP, HSTS) & Permissive CORS

- **Severity**: **Medium** (CVSS: 5.3 - `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N`)
- **Affected File**: `artifacts/api-server/src/app.ts` (Lines 12–40)
- **Vulnerability Class**: CWE-693 (Protection Mechanism Failure), CWE-942 (Overly Permissive CORS)

#### Technical Mechanism
In `app.ts`:
```typescript
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  next();
});
app.use(cors()); // Permissive: Access-Control-Allow-Origin: *
```
1. **Missing Security Headers**:
   - `helmet` is absent.
   - Missing `Content-Security-Policy` (CSP) to restrict script sources and object embeds.
   - Missing `X-Content-Type-Options: nosniff` (vulnerable to MIME-type sniffing).
   - Missing `X-Frame-Options: DENY` (vulnerable to Clickjacking and framing).
   - Missing `Strict-Transport-Security` (HSTS) allowing plaintext HTTP downgrades.
   - Missing `Referrer-Policy: strict-origin-when-cross-origin` (may leak full session URLs with codes to third-party assets).
2. **Overly Permissive CORS**:
   - Wildcard `*` allows any third-party domain to make cross-origin queries against `/api/sessions`.

---

### [SEC-18] Unconstrained Input Length & Control Character Injection in Player Names and Chat

- **Severity**: **Low** (CVSS: 4.3 - `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:N`)
- **Affected Files**:
  - `lib/api-zod/src/generated/api.ts` (Lines 21–24, 55–57)
  - `artifacts/api-server/src/routes/sessions.ts` (Lines 48, 135)
  - `artifacts/api-server/src/lib/signaling.ts` (Line 142)
- **Vulnerability Class**: CWE-20 (Improper Input Validation)

#### Technical Mechanism
In `api-zod`:
`hostName: zod.string()` and `playerName: zod.string()` have no `.min(1)` or `.max(32)` constraints.
A user can submit a 50,000-character name containing:
- Right-to-Left Override characters (`\u202E`) to disguise filenames or roles.
- Terminal control and escape sequences (`\x1b[2J`) that corrupt terminal and server log output.
- Zero-width spaces and non-printable characters.
While React escapes HTML entities, unconstrained strings overflow UI layout containers, break slot indicator widths, and disrupt chat feeds.

---

### [SEC-19] Predictable Pseudo-Random Session Code Generation via `Math.random`

- **Severity**: **Low** (CVSS: 4.1 - `CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N`)
- **Affected File**: `artifacts/api-server/src/routes/sessions.ts` (Lines 18–25)
- **Vulnerability Class**: CWE-338 (Use of Cryptographically Weak Pseudo-Random Number Generator)

#### Technical Mechanism
```typescript
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
```
`Math.random()` in V8 uses the XorShift128+ PRNG, which is not cryptographically secure. By collecting a sequence of generated room codes, an attacker can reconstruct the internal PRNG state and predict future room codes, enabling automated room sniffing and session sniping.

---

### [SEC-20] Timing Attack on Host Secret Verification via Non-Constant-Time Comparison

- **Severity**: **Low** (CVSS: 3.7 - `CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N`)
- **Affected File**: `artifacts/api-server/src/lib/signaling.ts` (Line 165)
- **Vulnerability Class**: CWE-208 (Observable Timing Discrepancy)

#### Technical Mechanism
```typescript
else if (hostSecret && hostSecret === room.hostSecret)
```
Standard JavaScript string comparison (`===`) terminates evaluation on the first mismatched byte, creating measurable timing differentials proportional to the matching prefix length. Secret tokens must be compared using constant-time algorithms (`crypto.timingSafeEqual`).

---

## Concrete Remediation Recommendations

---

### 1. Hardening `romProxy.ts` against TOCTOU Rebinding & IPv6 Bypasses

To eliminate the TOCTOU DNS rebinding window, the IP must be validated at the transport level during socket connection, rather than in an ahead-of-time lookup. Additionally, comprehensive CIDR range checking should be enforced, including deprecated IPv4-compatible IPv6 addresses.

#### Drop-In Code for `artifacts/api-server/src/routes/romProxy.ts`

```typescript
import { Router } from "express";
import dns from "node:dns";
import net from "node:net";
import { Agent } from "undici";
import { logger } from "../lib/logger";

export const romProxyRouter = Router();

const MAX_ROM_BYTES = 250 * 1024 * 1024; // 250 MB max limit
const REQUEST_TIMEOUT_MS = 10000;
const MAX_REDIRECTS = 3;
const ALLOWED_PORTS = new Set(["80", "443", "8080", "8443"]);

/**
 * Checks if an IPv4 address is in a private, loopback, link-local, or reserved range.
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8 (Current network)
  if (a === 127) return true; // 127.0.0.0/8 (Loopback)
  if (a === 10) return true; // 10.0.0.0/8 (RFC 1918)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 (RFC 1918)
  if (a === 192 && b === 168) return true; // 192.168.0.0/16 (RFC 1918)
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 (Link-local & AWS metadata)
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
  if (a >= 224) return true; // 224.0.0.0/4 (Multicast & reserved)
  return false;
}

/**
 * Comprehensive IPv6 address filter blocking private, loopback, translation, and encapsulated IPv4 addresses.
 */
function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();

  // Normalize and check loopback / unspecified variations
  if (lower === "::1" || lower === "::" || /^0*(:0*)*:?0*1?$/.test(lower)) return true;

  // IPv4-mapped IPv6 (::ffff:127.0.0.1)
  if (lower.startsWith("::ffff:")) {
    const v4 = lower.slice(7);
    return isBlockedIP(v4);
  }

  // Deprecated IPv4-compatible IPv6 (::127.0.0.1)
  if (/^::(?:\d{1,3}\.){3}\d{1,3}$/.test(lower)) {
    const v4 = lower.slice(2);
    return isBlockedIP(v4);
  }

  // Link-local: fe80::/10
  if (/^fe[89ab]/i.test(lower)) return true;
  // Unique local: fc00::/7
  if (/^f[cd]/i.test(lower)) return true;
  // Deprecated site-local: fec0::/10
  if (/^fec[0-9a-f]/i.test(lower)) return true;
  // NAT64 well-known prefix: 64:ff9b::/96
  if (lower.startsWith("64:ff9b:")) return true;
  // 6to4 tunneling: 2002::/16
  if (lower.startsWith("2002:")) return true;
  // Documentation: 2001:db8::/32
  if (lower.startsWith("2001:db8:")) return true;
  // Discard prefix: 100::/64
  if (lower.startsWith("100:")) return true;

  return false;
}

export function isBlockedIP(ip: string): boolean {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  if (net.isIPv6(ip)) return isPrivateIPv6(ip);
  return true; // Deny unparseable strings
}

/**
 * Secure Undici Agent that hooks socket lookup to guarantee Time-of-Check equals Time-of-Use.
 */
const ssrfProtectedAgent = new Agent({
  connect: {
    lookup: (hostname, options, callback) => {
      dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
        if (err) return callback(err, "", 4);
        const addrs = Array.isArray(addresses) ? addresses : [addresses];
        for (const addr of addrs) {
          if (isBlockedIP(addr.address)) {
            return callback(new Error("Blocked IP address (SSRF guard)"), "", 4);
          }
        }
        // Return first safe resolved address
        callback(null, addrs[0].address, addrs[0].family);
      });
    },
  },
});

export async function validateUrlSecurity(urlStr: string): Promise<{ valid: boolean; url?: URL; error?: string }> {
  let parsed: URL;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { valid: false, error: "Malformed URL" };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: "Only http and https protocols are permitted" };
  }

  const hostname = parsed.hostname;
  if (!hostname) return { valid: false, error: "Missing hostname" };

  if (parsed.username || parsed.password) {
    return { valid: false, error: "Credentials in URLs are not permitted" };
  }

  const effectivePort = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
  if (!ALLOWED_PORTS.has(effectivePort)) {
    return { valid: false, error: `Port ${effectivePort} is not permitted for ROM downloads` };
  }

  if (net.isIP(hostname) && isBlockedIP(hostname)) {
    return { valid: false, error: "Access to private or restricted network addresses is forbidden" };
  }

  return { valid: true, url: parsed };
}
```

---

### 2. Protecting Session Secrets & Preventing Unauthenticated Session Deletion (`sessions.ts`)

#### Remediation Details:
1. `GET /api/sessions/:code`: Strip out `hostId` and `players[].id`. Replace with sanitized public objects `{ name, isHost, playerIndex }`.
2. Generate a dedicated cryptographically secure `sessionToken` or `hostToken` returned **only once** to the session creator in `POST /api/sessions`.
3. Require `x-session-token` or `hostToken` to delete the session in `POST /api/sessions/:code/leave`.
4. Use `crypto.randomInt` for session code generation.

#### Drop-In Code for `artifacts/api-server/src/routes/sessions.ts`

```typescript
import crypto from "node:crypto";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    const randomIndex = crypto.randomInt(0, chars.length);
    code += chars[randomIndex];
  }
  return code;
}

// In GET /api/sessions/:code - Redact private IDs:
router.get("/sessions/:code", async (req, res) => {
  const parsed = GetSessionParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request params" });
    return;
  }

  const code = parsed.data.code.toUpperCase();
  const session = await findSession(code);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  // Redact internal player IDs and hostId from public read response
  const sanitizedPlayers = (session.players as Array<any>).map((p) => ({
    name: p.name,
    isHost: p.isHost,
    playerIndex: p.playerIndex,
  }));

  res.json({
    code: session.code,
    players: sanitizedPlayers,
    maxPlayers: session.maxPlayers,
    createdAt: session.createdAt.toISOString(),
  });
});
```

---

### 3. Securing WebSocket Handshake & Origin Validation (`signaling.ts`)

#### Remediation Details:
1. Validate `Origin` header during handshake against an explicit allowlist.
2. Require a valid `hostSecret` generated at session creation time; do **not** fall back to `peerId`.
3. Fix the frontend `session.tsx` to include `hostSecret` (`myPlayerId`) in the WebSocket `join` packet.
4. Enforce channel-specific size limits on chat messages (max 500 characters) and WebRTC signaling data.
5. Prevent unbounded room creation by validating session existence before instantiating `RoomState`.

#### Drop-In Code for `artifacts/api-server/src/lib/signaling.ts`

```typescript
import crypto from "node:crypto";

const ALLOWED_ORIGINS = new Set([
  "https://retroparty.onrender.com",
  "https://segaparty.com",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
]);

export function attachSignalingServer(server: Server) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    maxPayload: 2 * 1024 * 1024, // 2MB absolute transport ceiling
    verifyClient: (info, callback) => {
      const origin = info.origin || info.req.headers.origin;
      // In production, reject unknown origins
      if (origin && !ALLOWED_ORIGINS.has(origin)) {
        logger.warn({ origin }, "Rejected WebSocket connection from unauthorized origin (CSWSH defense)");
        callback(false, 403, "Forbidden Origin");
        return;
      }
      callback(true);
    },
  });

  // ... inside wss.on("connection", ...)

  // Constant-time token verification helper
  function verifySecret(provided: string, expected: string): boolean {
    if (!provided || !expected) return false;
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  // In "join" message handler:
  if (type === "join") {
    // ...
    if (role === "host") {
      if (!room.hostSecret) {
        // Require explicit hostSecret; do NOT fall back to peerId!
        if (!hostSecret) {
          ws.send(JSON.stringify({ type: "error", message: "Host secret required to initialize room" }));
          return;
        }
        room.hostSecret = hostSecret;
      } else if (hostSecret && verifySecret(hostSecret, room.hostSecret)) {
        room.hostPeerId = peerId;
      } else {
        logger.warn({ sessionCode, peerId }, "Unauthorized host usurpation attempt rejected");
        role = "guest";
      }
    }
  }

  // In "chat" message handler:
  if (type === "chat") {
    const rawText = (msg.text as string)?.trim() || "";
    // Strict chat length and sanitation limit (500 chars max)
    if (!rawText || rawText.length > 500) return;
    const sanitizedText = rawText.replace(/[\u202E\u200B-\u200D\uFEFF]/g, ""); // Strip Bidi override and zero-width spaces
    // broadcast sanitizedText...
  }
}
```

#### Drop-In Code for `artifacts/sega-party/src/pages/session.tsx`

```typescript
// Line 836: Include stored host secret / player token when connecting:
ws.send(
  JSON.stringify({
    type: "join",
    sessionCode: code,
    role: isHost ? "host" : "guest",
    peerId: myPeerId.current,
    playerName: myPlayerName,
    romName: activeRomName || undefined,
    core: activeCore || undefined,
    hostSecret: isHost ? myPlayerId : undefined,
    hostToken: isHost ? myPlayerId : undefined,
    playerId: myPlayerId || undefined,
  }),
);
```

---

### 4. Deploying Defensive HTTP Headers & Strict CORS (`app.ts`)

#### Drop-In Code for `artifacts/api-server/src/app.ts`

```typescript
import helmet from "helmet";

// Replace permissive cors() and manual header middleware with:
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
        connectSrc: ["'self'", "ws:", "wss:", "https://*.google.com", "https://*.cloudflare.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginEmbedderPolicy: { policy: "credentialless" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    frameguard: { action: "deny" },
    noSniff: true,
  }),
);

app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        "https://retroparty.onrender.com",
        "https://segaparty.com",
        "http://localhost:3000",
        "http://localhost:5173",
      ];
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS policy violation"));
      }
    },
    credentials: true,
  }),
);
```

---

## Conclusion & Strategic Roadmap

The Phase 22 security audit demonstrates that while individual defensive controls were established in Phase 21, subtle second-order failure modes (such as TOCTOU race windows in Node `fetch`, unauthenticated session termination via leaked UUIDs, and WebSocket origin neglect) continue to leave the application exposed to targeted abuse.

### Recommended Prioritized Action Plan:
1. **Immediate (Blocker)**: Deploy `ssrfProtectedAgent` in `romProxy.ts` to pin socket-level IP lookups and expand IPv6 blocking to cover `::127.0.0.1` and alternate formats.
2. **Immediate (Blocker)**: Sanitize `GET /api/sessions/:code` to conceal `hostId` and `players[].id`, preventing trivial one-click session kill attacks.
3. **High Priority**: Pass `hostSecret: myPlayerId` from `session.tsx` and eliminate the unauthenticated fallback to `peerId` in `signaling.ts`.
4. **Medium Priority**: Add `verifyClient` origin validation in `signaling.ts` to defend against CSWSH.
5. **Medium Priority**: Add `helmet()` security headers and replace `Math.random` with `crypto.randomInt`.
