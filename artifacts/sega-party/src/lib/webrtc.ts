export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
  ],
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
  iceCandidatePoolSize: 2,
};

export function getStoredPlayerId(code: string): string {
  const upper = code.toUpperCase();
  return sessionStorage.getItem(`playerId_${upper}`) || "";
}

export function getStoredPlayerName(code: string): string {
  const upper = code.toUpperCase();
  return sessionStorage.getItem(`playerName_${upper}`) || "";
}

export function setStoredPlayerIdentity(code: string, playerId: string, playerName: string, isHost = false): void {
  const upper = code.toUpperCase();
  sessionStorage.setItem(`playerId_${upper}`, playerId);
  sessionStorage.setItem(`playerName_${upper}`, playerName);
  if (isHost) {
    sessionStorage.setItem(`isHost_${upper}`, "true");
  } else {
    sessionStorage.removeItem(`isHost_${upper}`);
  }
  sessionStorage.setItem("playerId", playerId);
  sessionStorage.setItem("playerName", playerName);
}

export function getStoredIsHost(code: string): boolean {
  const upper = code.toUpperCase();
  return sessionStorage.getItem(`isHost_${upper}`) === "true";
}



export function getWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/ws`;
}

export interface SlotHolder {
  peerId: string;
  playerName: string;
  isHost: boolean;
}

export type SlotState = Record<number, SlotHolder | null>;

export interface ParticipantInfo {
  peerId: string;
  playerName: string;
  role: "host" | "guest";
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export type SignalMessage =
  | { type: "join"; sessionCode: string; role: "host" | "guest"; peerId: string; playerName: string; romName?: string; core?: string; hostSecret?: string }
  | { type: "room-state"; hostPeerId: string | null; romName: string | null; slots: SlotState; peers: ParticipantInfo[] }
  | { type: "slot-claim"; sessionCode: string; slot: number }
  | { type: "slot-release"; sessionCode: string; slot?: number }
  | { type: "slot-state"; slots: SlotState }
  | { type: "chat"; id?: string; sessionCode?: string; senderId?: string; senderName?: string; text: string; timestamp?: number; isSystem?: boolean }
  | { type: "rom-change"; sessionCode: string; romName: string }
  | { type: "rom-info"; romName: string }
  | { type: "signal"; sessionCode: string; targetPeerId: string; data: unknown; fromPeerId?: string; isRenegotiation?: boolean }
  | { type: "voice-signal"; sessionCode: string; targetPeerId: string; data: unknown; fromPeerId?: string }
  | { type: "request-ice-restart"; sessionCode: string; fromPeerId?: string }
  | { type: "ice-restart-offer"; sessionCode: string; sdp: RTCSessionDescriptionInit; toPeerId: string }
  | { type: "leave"; sessionCode: string; peerId: string }
  | { type: "host-info"; hostPeerId: string }
  | { type: "peer-joined"; peerId: string; playerName?: string; role: string }
  | { type: "participant-joined"; peerId: string; playerName: string; role: string }
  | { type: "peer-left"; peerId: string; playerName?: string }
  | { type: "error"; message: string }
  | { type: "no-host" }
  | { type: "player-input"; sessionCode: string; input: PlayerInputEvent; fromPeerId?: string }
  | { type: "video-frame"; sessionCode?: string; frame: string; fromPeerId?: string; timestamp?: number }
  | { type: "audio-chunk"; sessionCode?: string; pcm: string; sampleRate: number; fromPeerId?: string };

export interface InputEvent {
  type: "keydown" | "keyup";
  key: string;
  keyCode: number;
  code: string;
}

export interface PlayerInputEvent {
  type: "keydown" | "keyup";
  playerIndex: number; // 1, 2, 3, 4
  action: string;      // "up" | "down" | "left" | "right" | "a" | "b" | "c" | "x" | "y" | "z" | "start" | "mode"
  key?: string;
  keyCode?: number;
  code?: string;
}

