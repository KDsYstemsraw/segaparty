const http = require('http');
const { spawn } = require('child_process');
const path = require('path');
const WebSocket = require(path.resolve(__dirname, 'artifacts/api-server/node_modules/ws'));

const PORT = 4099;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const WS_URL = `ws://127.0.0.1:${PORT}/ws`;

async function runTest() {
  console.log('--- Starting Sega Party End-to-End Verification ---');

  // Spawn server process
  const server = spawn('node', ['artifacts/api-server/dist/index.mjs'], {
    cwd: path.resolve(__dirname),
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  server.stdout.on('data', (d) => process.stdout.write(`[Server] ${d}`));
  server.stderr.on('data', (d) => process.stderr.write(`[Server ERR] ${d}`));

  let serverExited = false;
  server.on('exit', (code) => {
    serverExited = true;
    console.log(`[Server] exited with code ${code}`);
  });

  function cleanup() {
    if (!serverExited) {
      console.log('Terminating test server...');
      server.kill();
    }
  }

  // Helper: wait for HTTP server to respond
  async function waitForServer(timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        await new Promise((resolve, reject) => {
          const req = http.get(`${BASE_URL}/api/healthz`, (res) => {
            if (res.statusCode === 200) resolve();
            else reject(new Error(`Status ${res.statusCode}`));
          });
          req.on('error', reject);
          req.setTimeout(500, () => {
            req.destroy();
            reject(new Error('Timeout'));
          });
        });
        console.log('Server is healthy and responding on port', PORT);
        return;
      } catch (e) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    throw new Error('Server failed to start within timeout');
  }

  try {
    await waitForServer();

    // 1. POST /api/sessions creates a session
    console.log('\n[Test 1] POST /api/sessions: creating session...');
    const sessionRes = await postJson(`${BASE_URL}/api/sessions`, {
      hostName: 'SonicHost',
      maxPlayers: 4
    });
    if (sessionRes.status !== 201) {
      throw new Error(`Expected status 201, got ${sessionRes.status}: ${JSON.stringify(sessionRes.data)}`);
    }
    const sessionCode = sessionRes.data.code;
    const hostPlayerId = sessionRes.data.playerId;
    if (!sessionCode || sessionCode.length !== 6) {
      throw new Error(`Invalid session code: ${sessionCode}`);
    }
    console.log(`✓ Session created successfully: code=${sessionCode}, hostId=${hostPlayerId}`);

    // 2. POST /api/sessions/:code/join joins as Player 2
    console.log(`\n[Test 2] POST /api/sessions/${sessionCode}/join: joining session...`);
    const joinRes = await postJson(`${BASE_URL}/api/sessions/${sessionCode}/join`, {
      playerName: 'TailsGuest'
    });
    if (joinRes.status !== 200) {
      throw new Error(`Expected status 200, got ${joinRes.status}: ${JSON.stringify(joinRes.data)}`);
    }
    const guestPlayer = (joinRes.data.session?.players || joinRes.data.players)?.find((p) => p.name === 'TailsGuest');
    if (!guestPlayer || guestPlayer.playerIndex !== 2) {
      throw new Error(`Expected guest to be Player 2, got: ${JSON.stringify(guestPlayer)}`);
    }
    console.log(`✓ Guest joined successfully as Player 2 (id=${joinRes.data.playerId})`);

    // 3. GET /roms/sonic2_demo.bin returns 200, 32768 bytes, and "SEGA MEGA DRIVE " at byte 0x0100
    console.log('\n[Test 3] GET /roms/sonic2_demo.bin: verifying ROM header and size...');
    const romRes = await getBuffer(`${BASE_URL}/roms/sonic2_demo.bin`);
    if (romRes.status !== 200) {
      throw new Error(`Expected 200 for ROM, got ${romRes.status}`);
    }
    if (romRes.buffer.length !== 32768) {
      throw new Error(`Expected 32768 bytes, got ${romRes.buffer.length}`);
    }
    const headerMagic = romRes.buffer.toString('ascii', 0x0100, 0x0110);
    if (headerMagic !== 'SEGA MEGA DRIVE ') {
      throw new Error(`Expected 'SEGA MEGA DRIVE ', got '${headerMagic}'`);
    }
    console.log(`✓ ROM verified: 32768 bytes, magic='${headerMagic}' at offset 0x0100`);

    // 4. GET /emulatorjs/missing-file.json returns 404 (not index.html)
    console.log('\n[Test 4] GET /emulatorjs/missing-file.json: verifying 404 for missing static file...');
    const missingRes = await getBuffer(`${BASE_URL}/emulatorjs/missing-file.json`);
    if (missingRes.status !== 404) {
      throw new Error(`Expected 404 for missing JSON file, got ${missingRes.status}`);
    }
    console.log(`✓ Missing static asset returned 404 correctly (not SPA index.html)`);

    // 5. Connect two WebSocket clients for Host and Guest
    console.log('\n[Test 5] WebSocket 2-Player Signaling & Relays: connecting Host and Guest...');
    const hostPeerId = 'host-peer-' + Math.random().toString(36).slice(2, 8);
    const guestPeerId = 'guest-peer-' + Math.random().toString(36).slice(2, 8);

    const hostWs = new WebSocket(WS_URL);
    const guestWs = new WebSocket(WS_URL);

    await Promise.all([
      new Promise((res) => hostWs.on('open', res)),
      new Promise((res) => guestWs.on('open', res))
    ]);
    console.log('✓ Both WebSockets connected to /ws');

    // Setup message collectors
    const hostMsgs = [];
    const guestMsgs = [];
    hostWs.on('message', (data) => {
      try { hostMsgs.push(JSON.parse(data.toString())); } catch {}
    });
    guestWs.on('message', (data) => {
      try { guestMsgs.push(JSON.parse(data.toString())); } catch {}
    });

    // 5a. Join room
    hostWs.send(JSON.stringify({
      type: 'join',
      sessionCode,
      role: 'host',
      peerId: hostPeerId,
      playerName: 'SonicHost'
    }));

    await new Promise((r) => setTimeout(r, 100));

    guestWs.send(JSON.stringify({
      type: 'join',
      sessionCode,
      role: 'guest',
      peerId: guestPeerId,
      playerName: 'TailsGuest'
    }));

    // Wait for slot-state with guestPeerId assigned to slot 2
    console.log('Verifying automatic controller slot assignment (Host -> Slot 1, Guest -> Slot 2)...');
    let guestAssigned = false;
    const slotDeadline = Date.now() + 4000;
    while (Date.now() < slotDeadline) {
      const allMsgs = [...guestMsgs, ...hostMsgs];
      for (const m of allMsgs) {
        if ((m.type === 'slot-state' || m.type === 'room-state') && m.slots) {
          if (m.slots[1]?.peerId === hostPeerId && m.slots[2]?.peerId === guestPeerId) {
            guestAssigned = true;
            break;
          }
        }
      }
      if (guestAssigned) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!guestAssigned) {
      throw new Error(`Auto-assignment failed. HostMsgs: ${JSON.stringify(hostMsgs)}, GuestMsgs: ${JSON.stringify(guestMsgs)}`);
    }
    console.log(`✓ Slot state confirmed: Slot 1=${hostPeerId} (Host), Slot 2=${guestPeerId} (Guest)`);

    // 5b. Verify video-frame and audio-chunk relay from Host to Guest
    console.log('Testing video-frame & audio-chunk WebSocket relay (Host -> Guest)...');
    const testVideoFrame = 'data:image/jpeg;base64,TESTFRAME12345';
    const testAudioPcm = 'TESTPCMCHUNK67890';
    hostWs.send(JSON.stringify({
      type: 'video-frame',
      sessionCode,
      frame: testVideoFrame,
      timestamp: Date.now()
    }));
    hostWs.send(JSON.stringify({
      type: 'audio-chunk',
      sessionCode,
      pcm: testAudioPcm,
      sampleRate: 22050
    }));

    let receivedVideo = false;
    let receivedAudio = false;
    const mediaDeadline = Date.now() + 3000;
    while (Date.now() < mediaDeadline) {
      for (const m of guestMsgs) {
        if (m.type === 'video-frame' && m.frame === testVideoFrame && m.fromPeerId === hostPeerId) {
          receivedVideo = true;
        }
        if (m.type === 'audio-chunk' && m.pcm === testAudioPcm && m.sampleRate === 22050 && m.fromPeerId === hostPeerId) {
          receivedAudio = true;
        }
      }
      if (receivedVideo && receivedAudio) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!receivedVideo || !receivedAudio) {
      throw new Error(`Media relay failed. receivedVideo=${receivedVideo}, receivedAudio=${receivedAudio}`);
    }
    console.log('✓ Host video-frame and audio-chunk received by Guest via WebSocket relay');

    // 5c. Verify player-input relay from Guest to Host
    console.log('Testing player-input WebSocket relay (Guest -> Host)...');
    guestWs.send(JSON.stringify({
      type: 'player-input',
      sessionCode,
      input: {
        type: 'keydown',
        playerIndex: 2,
        action: 'right',
        key: 'ArrowRight',
        keyCode: 39,
        code: 'ArrowRight'
      }
    }));

    let receivedInput = false;
    const inputDeadline = Date.now() + 3000;
    while (Date.now() < inputDeadline) {
      for (const m of hostMsgs) {
        if (m.type === 'player-input' && m.fromPeerId === guestPeerId) {
          if (m.input?.playerIndex === 2 && m.input?.action === 'right') {
            receivedInput = true;
            break;
          }
        }
      }
      if (receivedInput) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!receivedInput) {
      throw new Error(`Player-input relay failed. HostMsgs: ${JSON.stringify(hostMsgs)}`);
    }
    console.log('✓ Guest player-input received by Host via WebSocket relay (playerIndex=2, action=right)');

    hostWs.close();
    guestWs.close();

    console.log('\n======================================================');
    console.log('🎉 ALL 6 END-TO-END INTEGRATION TESTS PASSED CLEANLY!');
    console.log('======================================================\n');
  } finally {
    cleanup();
  }
}

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const postData = JSON.stringify(body);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function getBuffer(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: 'GET'
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({ status: res.statusCode, buffer: Buffer.concat(chunks) });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

runTest().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
