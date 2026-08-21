export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
  ],
};

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
  | { type: "join"; sessionCode: string; role: "host" | "guest"; peerId: string; playerName: string; romName?: string }
  | { type: "room-state"; hostPeerId: string | null; romName: string | null; slots: SlotState; peers: ParticipantInfo[] }
  | { type: "slot-claim"; sessionCode: string; slot: number }
  | { type: "slot-release"; sessionCode: string; slot?: number }
  | { type: "slot-state"; slots: SlotState }
  | { type: "chat"; id?: string; sessionCode?: string; senderId?: string; senderName?: string; text: string; timestamp?: number; isSystem?: boolean }
  | { type: "rom-change"; sessionCode: string; romName: string }
  | { type: "rom-info"; romName: string }
  | { type: "signal"; sessionCode: string; targetPeerId: string; data: unknown; fromPeerId?: string }
  | { type: "voice-signal"; sessionCode: string; targetPeerId: string; data: unknown; fromPeerId?: string }
  | { type: "leave"; sessionCode: string; peerId: string }
  | { type: "host-info"; hostPeerId: string }
  | { type: "peer-joined"; peerId: string; playerName?: string; role: string }
  | { type: "participant-joined"; peerId: string; playerName: string; role: string }
  | { type: "peer-left"; peerId: string; playerName?: string }
  | { type: "error"; message: string }
  | { type: "no-host" };

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

