import { routePartykitRequest } from "partyserver";
import { Room } from "./room";

export { Room };

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://karaoke-friends-web.vercel.app",
];

function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Upgrade",
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

export default {
  async fetch(request: Request, env: Record<string, unknown>): Promise<Response> {
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: getCorsHeaders(origin) });
    }

    const response = await routePartykitRequest(request, env);
    if (response) {
      // WebSocket upgrades return status 101 — don't wrap them in a new Response
      // or the upgrade gets destroyed
      if (response.status === 101) {
        return response;
      }
      const headers = new Headers(response.headers);
      for (const [key, value] of Object.entries(getCorsHeaders(origin))) {
        headers.set(key, value);
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};
