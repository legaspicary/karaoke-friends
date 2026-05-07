# Karaoke Friends - Design Spec

## Overview

A browser-based karaoke app for small friend groups (2-6 people). One person at a time takes the "DJ/singer" role — they share a Chrome tab playing a YouTube karaoke video and sing along. The app captures their tab audio + mic, applies voice effects locally, mixes them into a single synchronized stream, and sends it to all other participants via WebRTC. Other participants listen and watch the shared screen.

The core value proposition: unlike Discord screen sharing (where the sharer hears no latency but everyone else hears delayed audio), this app uses sender-side mixing to ensure all listeners receive a perfectly synchronized voice + music stream.

## Target Users

- A specific friend group (2-6 people)
- No public access, no accounts needed
- All participants expected to be on desktop Chrome
- Comfortable with basic screen-sharing (Discord-level technical ability)

## Core Concepts

### DJ/Singer Role

- Any participant can take the DJ role
- The DJ shares their Chrome tab (YouTube) once per "set" (5-6 songs typically)
- They navigate between songs within the shared tab — no need to re-share
- The DJ is usually also the singer
- When done with their set, they stop sharing and another person takes over
- Only one DJ at a time

### Sender-Side Audio Mix

The DJ/singer's browser captures two audio sources simultaneously:
1. **Tab audio** via `getDisplayMedia()` — the YouTube karaoke backing track
2. **Microphone** via `getUserMedia()` — the singer's voice

These are routed through a Web Audio API graph:
- Mic → GainNode → AudioWorklet (effects: reverb, echo, pitch) → Mixer
- Tab audio → GainNode → Mixer
- Mixer → splits to:
  - (a) Local speakers (zero-latency monitoring for the singer)
  - (b) `MediaStreamDestination` → WebRTC peer connections (to all listeners)

Because mixing happens locally before encoding, **listeners always receive voice + music in perfect sync**. The latency they experience is uniform and consistent — like watching a live stream with a slight delay.

### Casual Group Singing

Other participants can unmute and sing along. Their voice travels P2P to everyone else. There will be some desync between their voice and the DJ's music stream (network-dependent, typically 80-200ms). This is acceptable — it's the same experience as singing along from the audience at a real karaoke bar. No latency equalization is attempted for non-DJ singers in the MVP.

## Features

### MVP (v1)

1. **Room creation & joining**
   - Create a room → get a shareable link (and/or 6-character alphanumeric room code)
   - Join via link or code — no account needed
   - Rate limiting on join endpoint to prevent code brute-forcing
   - Enter a display name on join
   - Room persists while at least one person is connected

2. **Screen + audio sharing (DJ role)**
   - "Take the mic" button to become DJ
   - Triggers `getDisplayMedia()` for tab audio + video
   - Triggers `getUserMedia()` for microphone
   - Sender-side mix via Web Audio API
   - Mixed audio + screen video sent to all peers via WebRTC
   - "Drop the mic" button to release DJ role

3. **Voice effects**
   - Three toggleable effects (on/off, no knobs):
     - **Reverb** — convolution reverb with a single preset (small hall)
     - **Echo** — delay node, single preset (~200ms delay, 40% feedback)
   - Stretch goal: **Auto-tune** — pitch correction via phase vocoder AudioWorklet (complex DSP, deferred to v2 to de-risk MVP timeline)
   - Effects applied locally before mixing/sending
   - Toggle state visible to the singer only (others just hear the result)

4. **Song queue**
   - Any participant can add songs to the queue (paste YouTube URL or just a title as a label)
   - Manual ordering — drag to reorder
   - Current song highlighted
   - DJ manually advances to next song (the queue is informational, not automated)
   - Queue state managed by the Durable Object, synced to all clients

5. **Listener experience**
   - See the DJ's shared screen (the YouTube karaoke video)
   - Hear the mixed audio stream (music + singer's voice with effects)
   - See who's in the room (participant list with online indicators)
   - Mute/unmute own mic to sing along casually

### Stretch Goals (v2)

- **Reactions** — emoji reactions (fire, clapping, sparkles) that float up on everyone's screen
- **Hype meter** — fills up as reactions come in during a song
- **Scoring** — optional, fun scoring based on audience reactions (not audio analysis)
- **Song history** — log of songs played in the session

## Architecture

### Stack

| Layer | Technology | Hosting |
|-------|-----------|---------|
| Frontend | Next.js (App Router) | Vercel (free tier) |
| Real-time server | Cloudflare Workers + Durable Objects (partyserver) | Cloudflare (free tier) |
| Media transport | WebRTC P2P mesh | Browser-to-browser |
| Audio processing | Web Audio API + AudioWorklet | Browser-local |
| STUN | Google public STUN servers | Free |
| TURN | Twilio TURN (credential API) | Pay-per-use, near-zero at this scale |

### Component Breakdown

#### 1. Next.js Frontend (Vercel)

- **Pages:**
  - `/` — Home: create room or enter room code
  - `/room/[code]` — Room: the main karaoke experience
- **Responsibilities:**
  - Room creation (generates code, creates Durable Object)
  - UI rendering (participant list, queue, effects controls, shared screen display)
  - WebRTC peer connection management
  - Web Audio API graph setup and effects processing
  - TURN credential fetching (API route that calls Twilio)
- **API Routes:**
  - `POST /api/turn-credentials` — fetch short-lived TURN credentials from Twilio, gated behind a valid room code
- **Room creation flow:** Client connects directly to the Cloudflare Worker URL with a room code. The Worker stubs the Durable Object on first connection. No Vercel-to-Cloudflare provisioning needed — the client is the bridge between the two platforms.

#### 2. Cloudflare Durable Object (partyserver)

- **One instance per room** — isolated state, WebSocket connections
- **Responsibilities:**
  - WebRTC signaling relay (SDP offers/answers, ICE candidates)
  - Room state management (participant list, who is DJ, connection status)
  - Song queue state (add, remove, reorder, current song)
  - Peer join/leave broadcasting
  - Room cleanup (auto-destroy when all participants disconnect)
- **Does NOT handle:**
  - Media routing (that's P2P)
  - Audio processing (that's browser-local)
  - Authentication (none needed)

#### 3. WebRTC P2P Mesh

- **Topology:** Full mesh for audio. The DJ sends screen video + mixed audio to all peers. Non-DJ participants send audio-only (if unmuted) to all peers.
- **Connection flow:**
  1. New peer joins → signaling server broadcasts to existing peers
  2. Each existing peer creates an RTCPeerConnection offer
  3. Offers/answers/ICE candidates relayed through the Durable Object
  4. Direct P2P connections established
- **Streams:**
  - DJ → peers: 1 video track (screen share) + 1 audio track (mixed tab audio + processed mic)
  - Non-DJ → peers: 1 audio track (processed mic, if unmuted)
- **Peer count:** Max 5 connections per client (6 person room). Audio-only streams are ~50kbps each. DJ's video stream at 720p/15fps is ~500kbps per peer = ~2.5 Mbps upload total. Feasible on residential connections.
- **ICE configuration:**
  - STUN: `stun:stun.l.google.com:19302`
  - TURN: Twilio TURN credentials (fetched via API route, short-lived)
- **Failure handling:**
  - On ICE failure: log candidate pair stats to a Vercel API endpoint
  - On peer disconnect: Durable Object broadcasts peer-left, remaining clients GC dead RTCPeerConnections
  - On DJ disconnect: DJ role released, any participant can "Take the mic"
- **Reconnection strategy:**
  - WebSocket to Durable Object: exponential backoff reconnect (1s, 2s, 4s, max 30s). On reconnect, DO sends full room state snapshot (participants, queue, DJ status) so the client resyncs.
  - WebRTC peer connections: on `iceconnectionstatechange` to `disconnected`, wait 5s for auto-recovery. If state moves to `failed`, tear down and re-negotiate via signaling server.

#### 4. Web Audio API Graph (Browser-Local)

```
getUserMedia (mic)
  → GainNode (mic volume)
  → ConvolverNode (reverb, toggled via wet/dry GainNodes)
  → DelayNode + feedback GainNode (echo, toggled via wet/dry GainNodes)
  → GainNode (processed mic)
  → summing GainNode (mixer)

getDisplayMedia (tab audio)
  → GainNode (music volume)
  → summing GainNode (mixer)

summing GainNode (mixer)
  ├→ AudioContext.destination (local monitoring — HEADPHONES REQUIRED)
  └→ MediaStreamDestination → RTCPeerConnection (sent to peers)
```

**Mixer note:** Uses a summing junction (two GainNodes feeding into one GainNode) — NOT ChannelMergerNode, which interleaves into separate channels rather than summing.

**Headphone requirement:** Local monitoring routes the mixed output (including mic) to speakers. Without headphones, the mic picks up the speaker output, creating a feedback loop. The app must:
1. Show a "Put on headphones!" prompt before enabling DJ mode
2. Default local monitoring to OFF
3. Provide a toggle to enable monitoring (with the headphone warning)

Effects are toggled by setting wet/dry GainNode values (wet=0 for off, wet=1 for on). This avoids disconnecting/reconnecting nodes which can cause audio glitches.

### Data Flow

```
┌─────────────────────────────────────────────────────────┐
│ DJ/Singer's Browser                                     │
│                                                         │
│  YouTube Tab ──getDisplayMedia──→ Tab Audio ──┐         │
│                                               ├─ Mix ──→ WebRTC P2P ──→ All Listeners
│  Microphone ──getUserMedia──→ Effects ────────┘         │
│                                    │                    │
│                                    └──→ Local Speakers  │
│                                        (monitoring)     │
└─────────────────────────────────────────────────────────┘

┌────────────────────────────────┐
│ Cloudflare Durable Object      │
│                                │
│  WebSocket signaling           │
│  Room state + queue            │
│  Peer join/leave events        │
│  (NO media passes through)     │
└────────────────────────────────┘
```

## UI Design

### Party Game Aesthetic

Casual, fun, minimal. Think Jackbox — not a music production tool.

### Home Page (`/`)

- Large centered card with two options:
  - **"Start a Party"** button → creates room, shows link + 6-character code to share
  - **"Join a Party"** input → enter code or paste link
- Fun background (gradient or subtle animation)
- No header, no nav, no footer. Just the two actions.

### Room Page (`/room/[code]`)

- **Layout:** Two-column on desktop. Left (70%): shared screen area. Right (30%): sidebar.
- **Shared screen area:**
  - When no DJ: placeholder with "No one's sharing yet — take the mic!"
  - When DJ active: the shared screen video fills this area
  - Below the video: "Take the Mic" / "Drop the Mic" button (context-dependent)
- **Sidebar:**
  - **Participants** — avatars/names with online indicator, mic status icon
  - **Song Queue** — ordered list, "Add Song" input (paste URL or type title), drag to reorder
  - **Voice Effects** (only visible when you're DJ) — three toggle buttons: Reverb, Echo, Auto-tune
- **Mobile:** Single column. Shared screen on top, collapsible sidebar as bottom sheet.

### Screen Share Guidance

When a user clicks "Take the Mic," before triggering `getDisplayMedia`:
1. Modal appears: "Share the tab playing your karaoke video"
2. Annotated screenshot showing Chrome's share dialog with the "Share tab audio" checkbox highlighted
3. "Got it, let's go" button triggers the actual browser dialog
4. After sharing: verify an audio track exists on the MediaStream. If not, show "Looks like tab audio wasn't shared — try again and check the audio checkbox"

## Platform Constraints

| Platform | DJ (share screen) | Singer (mic only) | Listener |
|----------|-------------------|-------------------|----------|
| Chrome desktop | Yes | Yes | Yes |
| Firefox desktop | No (no tab audio) | Yes | Yes |
| Safari desktop | No (no tab audio) | Yes | Yes |
| Chrome Android | No (no tab audio) | Yes | Yes |
| Safari iOS | No (no tab audio) | Limited | Yes |

The app should work for listeners and mic-only singers on all modern browsers. The DJ role requires Chrome desktop. This is acceptable for a friend group MVP.

## Observability (MVP-Level)

- ICE connection state changes logged to browser console + POST to `/api/telemetry` on failure
- Durable Object logs peer join/leave/signaling events via `console.log` (visible in Cloudflare dashboard)
- Cloudflare Analytics Engine event on room creation to track daily request budget

## Legal Protections

- Rooms are private (invite-only via link/code)
- No content is hosted, stored, or indexed by the app
- Terms of service: users are responsible for content they share
- DMCA contact/procedure documented (even though no content is hosted)
- Marketing focuses on "sing with friends" — never references copyrighted content

## Out of Scope

- User accounts / authentication
- Song search / YouTube API integration
- Audio analysis / pitch detection scoring
- Recording / playback of sessions
- More than 6 participants
- Non-Chrome DJ support
- Latency equalization for non-DJ singers
- Custom effect parameters (knobs/sliders)
