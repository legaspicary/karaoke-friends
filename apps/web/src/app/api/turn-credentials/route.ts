import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/turn-credentials
 *
 * Returns ICE server configuration for WebRTC peer connections.
 *
 * MVP: STUN-only config. Twilio TURN integration is stubbed below —
 * set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN env vars to activate it.
 *
 * Expected request body: { roomCode: string }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: { roomCode?: string } = {};
  try {
    body = (await request.json()) as { roomCode?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.roomCode || typeof body.roomCode !== "string") {
    return NextResponse.json(
      { error: "roomCode is required" },
      { status: 400 }
    );
  }

  // TODO: Twilio TURN integration
  // When TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are set, call:
  //   POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Tokens.json
  // and merge the returned iceServers with the STUN servers below.
  //
  // Example (uncomment and fill in):
  // if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  //   const sid = process.env.TWILIO_ACCOUNT_SID;
  //   const token = process.env.TWILIO_AUTH_TOKEN;
  //   const twilioRes = await fetch(
  //     `https://api.twilio.com/2010-04-01/Accounts/${sid}/Tokens.json`,
  //     {
  //       method: "POST",
  //       headers: {
  //         Authorization: "Basic " + btoa(`${sid}:${token}`),
  //       },
  //     }
  //   );
  //   const twilioData = await twilioRes.json();
  //   return NextResponse.json({ iceServers: twilioData.ice_servers });
  // }

  return NextResponse.json({
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  });
}
