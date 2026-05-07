/**
 * ICE configuration for WebRTC peer connections.
 *
 * For MVP: STUN only. The API route at /api/turn-credentials is wired up
 * and ready to return Twilio TURN credentials once the Twilio integration
 * is added. Switch `getIceConfig` to call that endpoint when ready.
 */

// TODO: Replace with a call to /api/turn-credentials once Twilio is configured.
export function getIceConfig(): RTCConfiguration {
  return {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };
}
