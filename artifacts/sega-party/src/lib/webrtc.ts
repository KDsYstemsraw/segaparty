export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function getWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/ws`;
}

export type SignalMessage =
  | { type: "join"; sessionCode: string; role: "host" | "guest"; peerId: string }
  | { type: "signal"; sessionCode: string; targetPeerId: string; data: unknown }
  | { type: "leave"; sessionCode: string; peerId: string }
  | { type: "host-info"; hostPeerId: string }
  | { type: "peer-joined"; peerId: string; role: string }
  | { type: "peer-left"; peerId: string }
  | { type: "no-host" };

export interface InputEvent {
  type: "keydown" | "keyup";
  key: string;
  keyCode: number;
  code: string;
}
