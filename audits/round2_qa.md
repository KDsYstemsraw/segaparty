# RetroParty Deep QA & Network Resilience Audit (Round 2)
**Audit Version:** Phase 22 (Post-Commit `082e145`)  
**Auditor:** QA, Testing & Network Resilience Expert Subagent  
**Scope:** Core Real-Time Infrastructure (`session.tsx`, `webrtc.ts`, `useGamepad.ts`, `gamepadMapping.ts`, `emulator.tsx`, `signaling.ts`)  
**Classification:** Read-Only Audit & Remediation Roadmap  
**Date:** October 16, 2026

---

## 1. Executive Summary

Following the remediation deployed in commit `082e145`, an extensive, deep architectural audit was conducted across the RetroParty real-time multiplayer networking stack, WebRTC media/data pipelines, input simulation subsystem, and audio capture hooks.

While the primary vulnerabilities from Round 1 (such as SSRF URL proxy exploitation, missing signaling room token guards, and unbounded audio context proliferation) have been successfully mitigated, this second-round audit uncovered **critical architectural coupling and resilience vulnerabilities** that directly threaten long-running session stability, mobile compatibility, and network fault tolerance:

1. **Signaling-Media Plane Coupling (Critical)**: When the WebSocket signaling connection experiences a transient network disconnect or server restart, the client's cleanup handler immediately terminates and clears all active `RTCPeerConnection` and `RTCDataChannel` instances, destroying completely healthy peer-to-peer UDP gameplay streams.
2. **Missing ICE Restarts & Permanent Fallback Degradation (High)**: Transient network blips, cellular/Wi-Fi handovers, or brief packet loss transitions move `pc.iceConnectionState` to `"disconnected"` or `"failed"`. Neither host nor guest invokes `pc.restartIce()`, permanently demoting the session to lower-quality, high-latency WebSocket fallback JPEG frames until a hard browser refresh.
3. **Thundering Herd Reconnection Storms (High)**: WebSocket reconnections run on an unbacked fixed `2000ms` timer with zero exponential backoff and zero randomized jitter, causing massive synchronized reconnect spikes upon signaling server restart.
4. **iOS Safari Autoplay Demotion Trap (High)**: When WebRTC video tracks arrive asynchronously on iOS Safari, unmuted `video.play()` is rejected by WebKit's strict autoplay policy (`NotAllowedError`). The unhandled rejection leaves the `<video>` element paused, which the WebRTC watchdog interprets as a frozen stream, permanently trapping mobile iOS guests on the 7 FPS fallback image stream.
5. **Main-Thread PCM Audio Processor & Unthrottled Audio Broadcast (Medium)**: Deprecated `ScriptProcessorNode` running float-to-Int16 and base64 conversions on the main UI thread continues broadcasting uncompressed audio chunks over WebSocket 22 times per second even when all guests are actively receiving WebRTC audio.
6. **Analog Stick Diagonal Deadzone Truncation (Medium)**: An uncalibrated `0.5` axial deadzone threshold truncates diagonal inputs at shallow or steep stick angles (e.g. 25° or 65°), dropping horizontal or vertical inputs in platformers and fighting games.
7. **Dangling Inputs on DataChannel Close & Kick (Medium)**: Host `RTCDataChannel` instances lack `onclose` event handlers, delaying ghost key sweeps until WebSocket timeout when guests drop connection ungracefully.

---

## 2. Severity Issue Matrix

| ID | Title | Severity | Component | Primary Impact |
| :--- | :--- | :--- | :--- | :--- |
| **QA2-01** | WebSocket Reconnect Tears Down Healthy P2P WebRTC Sessions | **CRITICAL** | `session.tsx` (L1160–L1180) | Transient signaling blip or server reload terminates active multiplayer gameplay |
| **QA2-02** | Missing ICE Restart on Connection Blip (`pc.restartIce()`) | **HIGH** | `session.tsx` (L527–L530, L645–L660) | Wi-Fi/LTE handover permanently breaks WebRTC; session stuck in fallback mode |
| **QA2-03** | WebSocket Reconnection Storms (Thundering Herd) Without Backoff | **HIGH** | `session.tsx` (L1160–L1165) | Synchronized reconnect spikes exhaust and crash recovering signaling server |
| **QA2-04** | iOS Safari Autoplay Policy Rejection Traps Mobile Guests in Fallback | **HIGH** | `session.tsx` (L596–L602, L2240–L2246) | iPhone/iPad guests fail to display WebRTC 60 FPS video; trapped on 7 FPS fallback |
| **QA2-05** | Main-Thread PCM ScriptProcessor & Unthrottled WebSocket Audio Broadcast | **MEDIUM** | `emulator.tsx` (L130–L188), `session.tsx` (L1330–L1350) | Main-thread GC pressure, micro-stutters, and wasted server bandwidth |
| **QA2-06** | Analog Stick Diagonal Input Truncation via 0.5 Axial Deadzone | **MEDIUM** | `useGamepad.ts` (L5, L76–L87) | Dropped diagonal inputs (jumps/blocks) in Sonic, Streets of Rage, Street Fighter |
| **QA2-07** | Missing Host RTCDataChannel Close & Immediate Kick Input Sweeps | **MEDIUM** | `session.tsx` (L485–L515, L788–L800) | Stuck inputs persist for seconds on ungraceful drop or controller kick |
| **QA2-08** | Missing Explicit Track Termination on ROM Eject/Switch | **LOW** | `session.tsx` (L1591–L1600) | Browser capture streams linger in background across repeated ROM switches |

---

## 3. Detailed Root Cause Analysis & Reproduction Scenarios

---

### QA2-01: WebSocket Reconnect Tears Down Healthy P2P WebRTC Sessions
- **Severity**: **CRITICAL**
- **Location**: `artifacts/sega-party/src/pages/session.tsx` (Lines 1160–1180)
- **Root Cause Analysis**:
  In `session.tsx`, the WebSocket lifecycle and WebRTC lifecycle are coupled inside a single React `useEffect`. When `ws.onclose` fires, it sets a timeout for `setWsReconnectTick((t) => t + 1)`.
  ```typescript
  // session.tsx:1160-1179
  ws.onclose = () => {
    if (!unmounted) {
      setTimeout(() => {
        if (!unmounted) setWsReconnectTick((t) => t + 1);
      }, 2000);
    }
  };

  return () => {
    unmounted = true;
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "leave", sessionCode: code, peerId: myPeerId.current }));
    }
    ws.close();
    peerConnsRef.current.forEach((pc) => pc.close());
    peerConnsRef.current.clear();
    dataChannelsRef.current.forEach((dc) => dc.close());
    dataChannelsRef.current.clear();
    iceCandidateQueueRef.current.clear();
  };
  ```
  Because `wsReconnectTick` is in the dependency array of the `useEffect` (L1180), changing `wsReconnectTick` triggers the cleanup return function of the previous effect run!
  This cleanup function calls `peerConnsRef.current.forEach((pc) => pc.close())` and `dataChannelsRef.current.forEach((dc) => dc.close())`.
  
  In WebRTC architecture, the signaling channel is merely an out-of-band rendezvous mechanism. Once direct peer-to-peer UDP media and data channels are established between host and guest, the peer connection is completely independent of the signaling server. If the signaling proxy reboots, drops connection, or performs zero-downtime rolling deploys, the healthy gameplay stream between players is needlessly aborted!
- **Reproduction Scenario**:
  1. Host and Guest launch a 2-player session and connect over WebRTC (60 FPS video, low-latency audio).
  2. The signaling server (`api-server`) is restarted (`systemctl restart retroparty` or proxy reconnect).
  3. Client's WebSocket connection drops. `ws.onclose` schedules `wsReconnectTick + 1`.
  4. 2000ms later, the effect cleanup runs: host closes all active `RTCPeerConnection` instances.
  5. The guest screen freezes black; audio terminates; both players are disconnected from the ongoing game.

---

### QA2-02: Missing WebRTC ICE Restart on Connection Blip (`pc.restartIce()`)
- **Severity**: **HIGH**
- **Location**: `artifacts/sega-party/src/pages/session.tsx` (Lines 527–530, 645–660)
- **Root Cause Analysis**:
  WebRTC connections in real-world networks undergo transient network disruptions (e.g. Wi-Fi router channel hops, brief cellular signal dips, IP address changes when switching between 5G and Wi-Fi).
  In `session.tsx`:
  - On the host side:
    ```typescript
    pc.oniceconnectionstatechange = () => {
      loggerDebug(`Host ICE with ${guestPeerId}: ${pc.iceConnectionState}`);
      setWebrtcStatus((prev) => ({ ...prev, ice: pc.iceConnectionState }));
    };
    ```
    The host has no handler for `disconnected` or `failed`. It never attempts `pc.restartIce()`.
  - On the guest side:
    ```typescript
    pc.oniceconnectionstatechange = () => {
      setWebrtcStatus((prev) => ({ ...prev, ice: pc!.iceConnectionState }));
      if (pc!.iceConnectionState === "connected" || pc!.iceConnectionState === "completed") {
        setConnectionStatus("connected");
      } else if (pc!.iceConnectionState === "failed") {
        setConnectionStatus("error");
      }
    };
    ```
    The guest simply marks `setConnectionStatus("error")`.
  
  When an ICE candidate pair fails, WebRTC specification mandates invoking `pc.restartIce()` on the offerer (or sending an `ice-restart-request` from the answerer to the offerer), which generates a new SDP offer with new ICE credentials (`ice-ufrag` and `ice-pwd`). Because this is missing, any minor network drop results in a permanent failure. The watchdog unmasks the WebSocket fallback stream, but high-performance WebRTC never recovers unless the user hard-refreshes the page.
- **Reproduction Scenario**:
  1. Guest connects via laptop on Wi-Fi and plays at 60 FPS WebRTC.
  2. Laptop switches from 5 GHz to 2.4 GHz band or toggles Wi-Fi network.
  3. `iceConnectionState` moves from `"connected"` to `"disconnected"`, then `"failed"`.
  4. WebRTC video freezes; watchdog demotes to WebSocket fallback.
  5. WebRTC never attempts ICE restart; session remains locked in fallback mode indefinitely.

---

### QA2-03: WebSocket Reconnection Storms (Thundering Herd) Without Backoff
- **Severity**: **HIGH**
- **Location**: `artifacts/sega-party/src/pages/session.tsx` (Lines 1160–1165)
- **Root Cause Analysis**:
  The reconnection handler in `session.tsx` utilizes a flat, hardcoded 2000ms timer:
  ```typescript
  ws.onclose = () => {
    if (!unmounted) {
      setTimeout(() => {
        if (!unmounted) setWsReconnectTick((t) => t + 1);
      }, 2000);
    }
  };
  ```
  If the signaling server experiences a temporary outage or restarts, 1,000 active browser tabs will all attempt to reconnect at the exact same 2000ms cadence. Because there is no randomized jitter (`Math.random()`) and no exponential backoff multiplier (`2^attempts`), the recovering server is immediately bombarded with thousands of concurrent HTTP upgrade requests, leading to CPU spikes, WebSocket socket exhaustion, and 502/504 Bad Gateway errors.
- **Reproduction Scenario**:
  1. 50 rooms with 4 players each (200 concurrent WebSockets).
  2. Signaling server is restarted.
  3. Exactly 2000ms later, all 200 clients hit `/ws` simultaneously.
  4. Server event loop experiences latency spike; subsequent retries synchronize again at 2000ms, prolonging the outage.

---

### QA2-04: iOS Safari Autoplay Policy Rejection Traps Mobile Guests in Fallback
- **Severity**: **HIGH**
- **Location**: `artifacts/sega-party/src/pages/session.tsx` (Lines 596–602, L2240–L2246)
- **Root Cause Analysis**:
  WebKit on iOS Safari enforces an aggressive media autoplay policy: an `<video>` or `<audio>` element may only play unmuted if the `.play()` call was initiated directly inside the synchronous call stack of a user gesture (`touchend` or `click`).
  In `session.tsx`:
  1. The guest enters the room and types their nickname or taps the screen. `unlockAudio()` executes and sets `isMutedRef.current = false`.
  2. Later, when the host starts streaming, WebRTC signaling completes and `pc.ontrack` fires asynchronously.
  3. `pc.ontrack` sets `videoRef.current.muted = false` and calls `videoRef.current.play().catch(() => {})`.
  4. Because `pc.ontrack` is an asynchronous network callback (not a user gesture), iOS Safari throws:
     `NotAllowedError: The request is not allowed by the user agent or the platform in the current context`.
  5. The `.catch(() => {})` suppresses the error. The video element remains in `paused: true` state.
  6. Within 500ms, the WebRTC watchdog executes:
     ```typescript
     if ((video && video.paused) || (lastUpdate > 0 && now - lastUpdate > 1800)) {
       rtcVideoActiveRef.current = false;
       setRtcVideoActive(false);
     }
     ```
  7. The watchdog detects `video.paused === true` and hides the WebRTC video element, dropping the mobile guest to the WebSocket image fallback stream.
  8. The user on iOS is now permanently stuck on the low-framerate fallback stream without knowing why.
- **Reproduction Scenario**:
  1. Join a room from Safari on iPhone (iOS 16, 17, or 18).
  2. Tap "Join Room" button.
  3. When host starts game, WebRTC negotiates.
  4. Observe video stream: `<video>` remains paused due to `NotAllowedError`; watchdog hides video layer; guest only sees low FPS JPEG fallback stream.

---

### QA2-05: Main-Thread PCM ScriptProcessor & Unthrottled WebSocket Audio Broadcast
- **Severity**: **MEDIUM**
- **Location**: `artifacts/sega-party/src/components/emulator.tsx` (Lines 130–188), `artifacts/sega-party/src/pages/session.tsx` (Lines 1330–1350)
- **Root Cause Analysis**:
  In `emulator.tsx`, the audio tap is implemented using `createScriptProcessor(2048, 1, 1)`:
  ```typescript
  pcmTap.onaudioprocess = (e: AudioProcessingEvent) => {
    const cb = window.__onEmulatorAudioChunk;
    if (!cb) return;
    const input = e.inputBuffer.getChannelData(0);
    ...
    // Loops 2048 samples, converts to Int16, converts to string in chunks, calls btoa()
    const base64 = btoa(binary);
    cb(base64, outSampleRate);
  };
  ```
  This runs on the main browser UI thread every ~46ms.
  Furthermore, in `session.tsx`:
  ```typescript
  const handleAudioChunk = useCallback(
    (pcmBase64: string, sampleRate: number) => {
      if (
        isHost &&
        wsRef.current?.readyState === WebSocket.OPEN &&
        (participantsRef.current.length > 1 || peerConnsRef.current.size > 0)
      ) {
        wsRef.current.send(JSON.stringify({ type: "audio-chunk", ... }));
      }
    },
    [code, isHost],
  );
  ```
  While `handleVideoFrame` was updated in Workstream 3 to throttle WebSocket JPEG broadcasting when WebRTC peers are connected, `handleAudioChunk` was left unthrottled! It sends ~22 WebSocket messages per second continuously, even when all guests are actively receiving uncompressed WebAudio over WebRTC.
  This produces ~80,000 JSON payloads per hour over WebSocket, causing unnecessary garbage collection on both client and server.
- **Reproduction Scenario**:
  1. Host a game with 1 guest connected via WebRTC.
  2. Open Browser DevTools Network tab -> WS Messages.
  3. Observe continuous deluge of `audio-chunk` frames at 22 Hz despite guest receiving pristine WebRTC audio.

---

### QA2-06: Analog Stick Diagonal Input Truncation via 0.5 Axial Deadzone
- **Severity**: **MEDIUM**
- **Location**: `artifacts/sega-party/src/hooks/useGamepad.ts` (Lines 5, 76–87)
- **Root Cause Analysis**:
  In `useGamepad.ts`:
  ```typescript
  const AXIS_THRESHOLD = 0.5;
  ...
  const axisMap: Array<[string, string, string]> = [
    ["axis-0-neg", "axis-0-pos", "0"],
    ["axis-1-neg", "axis-1-pos", "1"],
  ];
  for (const [negKey, posKey, axisIdx] of axisMap) {
    const val = gp.axes[Number(axisIdx)] ?? 0;
    const negAction = mapping[negKey];
    const posAction = mapping[posKey];
    if (negAction) fireInput(`${id}-axis-${axisIdx}-neg`, negAction, val < -AXIS_THRESHOLD);
    if (posAction) fireInput(`${id}-axis-${axisIdx}-pos`, posAction, val > AXIS_THRESHOLD);
  }
  ```
  An axial threshold of `0.5` means that for an axis to register, its independent component must exceed 0.5.
  When an analog stick is pushed diagonally at an angle of 25° from the horizontal:
  - $X = \cos(25^\circ) \approx 0.906$ ($> 0.5 \rightarrow \text{Active}$)
  - $Y = \sin(25^\circ) \approx 0.422$ ($< 0.5 \rightarrow \text{Ignored!}$)
  
  The vertical direction is completely lost, even though the stick was tilted deliberately upward! The player cannot perform a high-angle diagonal jump in Sonic the Hedgehog or crouch-block in fighting games. Retro gamepads and emulators (RetroArch, Genesis Plus GX) utilize deadzones between 0.25 and 0.35, or radial deadzones with an angle threshold.
- **Reproduction Scenario**:
  1. Connect an Xbox or PlayStation controller.
  2. Boot *Sonic The Hedgehog 2*.
  3. Push analog stick diagonally up-right at a slight angle (~25° or ~65°).
  4. Sonic runs horizontally instead of jumping or looking up; diagonal input fails to register.

---

### QA2-07: Missing Host RTCDataChannel Close & Immediate Kick Input Sweeps
- **Severity**: **MEDIUM**
- **Location**: `artifacts/sega-party/src/pages/session.tsx` (Lines 485–515, L788–L800)
- **Root Cause Analysis**:
  1. **DataChannel Drop**: On the host, `const dc = pc.createDataChannel("inputs", ...)` has no `dc.onclose` or `dc.onerror` handler. If a guest loses Wi-Fi, the SCTP data channel closes almost immediately, but the host fails to sweep the guest's slot until the server's TCP WebSocket timeout triggers a `peer-left` event (up to 30–60 seconds later). During this time, any button held down by the guest stays stuck in the emulator.
  2. **Controller Kick**: When the host clicks "Kick Controller Slot" (`handleKickSlot(slot)`), it sends `slot-kick` over WebSocket, but does not immediately sweep inputs on that slot locally. The guest's held inputs remain pressed until the WebSocket server responds with `slot-state`.
- **Reproduction Scenario**:
  1. Guest holds the "Right" D-pad button to run.
  2. Host clicks "Kick" on Player 2 controller.
  3. Player 2 character continues running right for several hundred milliseconds until `slot-state` round-trip completes.

---

### QA2-08: Missing Explicit Track Termination on ROM Eject/Switch
- **Severity**: **LOW**
- **Location**: `artifacts/sega-party/src/pages/session.tsx` (Lines 1591–1600)
- **Root Cause Analysis**:
  In `handleUnloadRom`:
  ```typescript
  const handleUnloadRom = async () => {
    setIsReloadingRom(true);
    setRomPickerOpen(false);
    gameStreamRef.current = null;
    setCurrentRomUrl("");
    ...
  ```
  Setting `gameStreamRef.current = null` discards the variable reference, but does not call `track.stop()` on the active `MediaStreamTrack` objects. Chromium and Firefox keep internal capture timers active until garbage collected.
- **Reproduction Scenario**:
  1. Host switches ROMs 10 times consecutively in the same session.
  2. Browser process memory increases incrementally due to unstopped canvas capture tracks.

---

## 4. Concrete Remediation Recommendations with Drop-In Code

---

### Remediation for QA2-01: Decouple WebSocket Reconnection from WebRTC Media Plane
In `artifacts/sega-party/src/pages/session.tsx`:
Separate the WebSocket signaling lifecycle from the WebRTC peer connection lifecycle. The `useEffect` cleanup on WebSocket reconnect must **only** close the WebSocket instance, leaving `peerConnsRef` and `dataChannelsRef` intact if the P2P connection is alive. Peer connections should only be closed when the component genuinely unmounts (`session.tsx` unmount) or when the user navigates away.

```typescript
// artifacts/sega-party/src/pages/session.tsx
// Replace lines 1168-1179:

    return () => {
      unmounted = true;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "leave", sessionCode: code, peerId: myPeerId.current }));
      }
      ws.close();
      // NOTE: Do NOT close peerConnsRef or dataChannelsRef here!
      // Healthy WebRTC P2P streams must survive transient signaling reconnects.
    };
  }, [code, session?.hostId, myPlayerId, myPlayerName, session?.code, wsReconnectTick, createHostOffer, handleSignal, toast]);

  // Dedicated unmount cleanup effect for WebRTC connections
  useEffect(() => {
    return () => {
      peerConnsRef.current.forEach((pc) => {
        try { pc.close(); } catch {}
      });
      peerConnsRef.current.clear();
      dataChannelsRef.current.forEach((dc) => {
        try { dc.close(); } catch {}
      });
      dataChannelsRef.current.clear();
      iceCandidateQueueRef.current.clear();
    };
  }, []);
```

---

### Remediation for QA2-02: Implement Automatic ICE Restart & Renegotiation
In `artifacts/sega-party/src/pages/session.tsx`:
1. Add an `oniceconnectionstatechange` handler on the host that triggers `pc.restartIce()` and sends an offer with `iceRestart: true`.
2. Add a signaling message `{ type: "ice-restart-request" }` so guests can request an ICE restart from the host when their connection drops.

```typescript
// 1. In createHostOffer (session.tsx:527-531):
pc.oniceconnectionstatechange = async () => {
  loggerDebug(`Host ICE with ${guestPeerId}: ${pc.iceConnectionState}`);
  setWebrtcStatus((prev) => ({ ...prev, ice: pc.iceConnectionState }));

  if (pc.iceConnectionState === "failed") {
    console.warn(`[WebRTC] ICE failed with ${guestPeerId}, attempting ICE restart...`);
    try {
      if (typeof pc.restartIce === "function") {
        pc.restartIce();
      }
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      sendSignal(guestPeerId, {
        type: "offer",
        sdp: pc.localDescription?.toJSON() || { type: "offer", sdp: pc.localDescription?.sdp },
        isRenegotiation: true,
      });
    } catch (e) {
      console.error("[WebRTC] ICE restart failed:", e);
    }
  }
};

// 2. In guest pc setup (session.tsx:645-660):
pc.oniceconnectionstatechange = () => {
  setWebrtcStatus((prev) => ({ ...prev, ice: pc!.iceConnectionState }));
  if (pc!.iceConnectionState === "connected" || pc!.iceConnectionState === "completed") {
    setConnectionStatus("connected");
  } else if (pc!.iceConnectionState === "failed" || pc!.iceConnectionState === "disconnected") {
    setConnectionStatus("connecting");
    // Request ICE restart from Host over WebSocket signaling
    console.warn("[WebRTC] Connection failed, requesting ICE restart from host");
    sendSignal(fromPeerId, { type: "request-ice-restart" });
  }
};

// 3. In handleSignal on host (session.tsx:690+):
if (data.type === "request-ice-restart" && isHost) {
  const pc = peerConnsRef.current.get(fromPeerId);
  if (pc) {
    if (typeof pc.restartIce === "function") pc.restartIce();
    const offer = await pc.createOffer({ iceRestart: true });
    await pc.setLocalDescription(offer);
    sendSignal(fromPeerId, {
      type: "offer",
      sdp: pc.localDescription?.toJSON() || { type: "offer", sdp: pc.localDescription?.sdp },
      isRenegotiation: true,
    });
  }
}
```

---

### Remediation for QA2-03: Implement Exponential Backoff with Jitter for WebSocket Reconnection
In `artifacts/sega-party/src/pages/session.tsx`:
Add a reconnection attempt counter and calculate backoff with randomized jitter.

```typescript
// Replace lines 1160-1165 in session.tsx:
const reconnectAttemptsRef = useRef(0);

// Inside WebSocket useEffect:
ws.onopen = () => {
  reconnectAttemptsRef.current = 0; // Reset backoff on successful connection
  ...
};

ws.onclose = () => {
  if (!unmounted) {
    const attempts = reconnectAttemptsRef.current;
    reconnectAttemptsRef.current += 1;
    // Exponential backoff: min(15000, 1000 * 2^attempts) with +/- 25% jitter
    const baseDelay = Math.min(15000, 1000 * Math.pow(1.8, Math.min(attempts, 6)));
    const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
    const delay = Math.max(500, Math.floor(baseDelay + jitter));

    console.debug(`[WS] Connection closed. Reconnecting in ${delay}ms (attempt ${attempts + 1})...`);
    setTimeout(() => {
      if (!unmounted) setWsReconnectTick((t) => t + 1);
    }, delay);
  }
};
```

---

### Remediation for QA2-04: Autoplay Policy Fallback for iOS Safari
In `artifacts/sega-party/src/pages/session.tsx`:
Wrap all `video.play()` invocations in a robust fallback helper that catches `NotAllowedError`, switches the video element to muted, replays successfully, and keeps WebRTC video alive while showing the unmuting banner.

```typescript
// Add safePlay helper in session.tsx:
const safePlayVideo = useCallback((videoEl: HTMLVideoElement | null) => {
  if (!videoEl) return;
  videoEl.muted = isMutedRef.current;
  videoEl.volume = isMutedRef.current ? 0 : volumeRef.current;
  
  videoEl.play().catch((err) => {
    if (err?.name === "NotAllowedError") {
      console.warn("[audio] Unmuted autoplay blocked by browser policy. Falling back to muted video.");
      videoEl.muted = true;
      setIsMuted(true);
      isMutedRef.current = true;
      setAudioBlocked(true);
      videoEl.play().catch(() => {});
    }
  });
}, []);

// Use safePlayVideo in pc.ontrack and videoRef callback:
// Replace videoRef.current.play().catch(() => {}) with:
safePlayVideo(videoRef.current);
```

---

### Remediation for QA2-05: Throttle WebSocket Audio Broadcasting When WebRTC Is Active
In `artifacts/sega-party/src/pages/session.tsx`:
Mirror the `handleVideoFrame` throttling logic inside `handleAudioChunk` so that WebSocket audio packets are only broadcasted if at least one guest is not yet connected via WebRTC.

```typescript
// Replace lines 1330-1350 in session.tsx:
const handleAudioChunk = useCallback(
  (pcmBase64: string, sampleRate: number) => {
    if (!isHost || wsRef.current?.readyState !== WebSocket.OPEN) return;

    const guests = participantsRef.current.filter((p) => p.peerId !== myPeerId.current);
    if (guests.length === 0 && peerConnsRef.current.size === 0) return;

    // Only broadcast audio over WebSocket if a guest still needs fallback
    let anyGuestNeedsFallback = false;
    if (guests.length > 0) {
      anyGuestNeedsFallback = guests.some((guest) => {
        const pc = peerConnsRef.current.get(guest.peerId);
        if (!pc) return true;
        const isConnected =
          pc.connectionState === "connected" ||
          pc.iceConnectionState === "connected" ||
          pc.iceConnectionState === "completed";
        return !isConnected;
      });
    }

    if (!anyGuestNeedsFallback) return;

    wsRef.current.send(
      JSON.stringify({
        type: "audio-chunk",
        sessionCode: code,
        pcm: pcmBase64,
        sampleRate,
      }),
    );
  },
  [code, isHost],
);
```

---

### Remediation for QA2-06: Calibrate Gamepad Deadzone to 0.28 with Clean Diagonal Activation
In `artifacts/sega-party/src/hooks/useGamepad.ts`:
Lower `AXIS_THRESHOLD` to `0.28` (industry standard for retro emulation) to enable clean diagonal inputs without accidental stick drift.

```typescript
// artifacts/sega-party/src/hooks/useGamepad.ts
// Replace line 5:
const AXIS_THRESHOLD = 0.28;
```

---

### Remediation for QA2-07: Add Host DataChannel Close Handler & Immediate Kick Sweep
In `artifacts/sega-party/src/pages/session.tsx`:
1. Attach `dc.onclose` and `dc.onerror` in `createHostOffer` to sweep inputs immediately when a peer's input channel terminates.
2. In `handleKickSlot(slot)`, invoke `sweepSlotInputs(slot)` immediately before sending the network message.

```typescript
// 1. In createHostOffer (session.tsx:490+):
dc.onclose = () => {
  console.debug(`[DataChannel] Inputs channel closed for guest ${guestPeerId}`);
  for (let s = 1; s <= 4; s++) {
    if (slotAssignmentsRef.current[s]?.peerId === guestPeerId) {
      sweepSlotInputs(s);
    }
  }
};
dc.onerror = () => {
  for (let s = 1; s <= 4; s++) {
    if (slotAssignmentsRef.current[s]?.peerId === guestPeerId) {
      sweepSlotInputs(s);
    }
  }
};

// 2. In handleKickSlot (session.tsx:788-799):
const handleKickSlot = useCallback(
  (slot: number) => {
    // Immediately release all held inputs locally on the host
    sweepSlotInputs(slot);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "slot-kick",
          sessionCode: code,
          slot,
        }),
      );
    }
  },
  [code, sweepSlotInputs],
);
```

---

### Remediation for QA2-08: Explicit MediaStream Track Stoppage on ROM Eject
In `artifacts/sega-party/src/pages/session.tsx`:
In `handleUnloadRom`, stop all tracks on `gameStreamRef.current` before nullifying.

```typescript
// session.tsx:1594
if (gameStreamRef.current) {
  gameStreamRef.current.getTracks().forEach((track) => {
    try { track.stop(); } catch {}
  });
  gameStreamRef.current = null;
}
```

---

## 5. Verification & Test Plan

1. **Signaling Server Restart Test**:
   - Establish a 2-player game session over WebRTC.
   - Restart `api-server` process in terminal.
   - Verify that gameplay continues uninterrupted during the 2-second reconnect window and that both clients smoothly resynchronize without tearing down P2P video/audio.
2. **Wi-Fi Toggle / ICE Restart Test**:
   - Toggle Wi-Fi or disconnect Ethernet on guest.
   - Verify `request-ice-restart` is dispatched and host generates an `iceRestart: true` offer.
   - Verify WebRTC stream recovers without requiring a browser refresh.
3. **Thundering Herd Load Test**:
   - Simulate 100 concurrent WebSocket drops.
   - Verify reconnect distribution is smoothed over 1–15 seconds via exponential backoff and jitter.
4. **Mobile iOS Safari Autoplay Test**:
   - Join room from an iOS Safari device.
   - Verify that video autoplays in muted state if unmuted play is rejected, displaying the "Click Screen to Enable Audio" banner instead of falling back to WebSocket 7 FPS mode.
5. **Gamepad Diagonal Registration Test**:
   - Connect physical analog gamepad.
   - Verify that 45°, 25°, and 65° stick angles both trigger simultaneous horizontal and vertical inputs cleanly.
