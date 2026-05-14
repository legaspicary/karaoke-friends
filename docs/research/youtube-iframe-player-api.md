# YouTube IFrame Player API — Research Notes

> Researched 2026-05-12 during queue auto-advance implementation.

## Why We Use It

We originally used `window.open()` to open a YouTube tab and tried to navigate it between songs. This fails because **cross-origin windows cannot be controlled** — `location.href` assignment silently fails, and there is no web-standard workaround. We confirmed this through multi-agent research.

The YouTube IFrame Player API is the only viable approach for:
1. **Seamless song transitions** via `loadVideoById()` — no iframe recreation
2. **End-of-video detection** via `onStateChange` (ENDED = 0) — needed for auto-advance
3. **Programmatic control** (play, pause, stop, seek)

## How It Works

### Script Loading
- Load `https://www.youtube.com/iframe_api` once (singleton pattern)
- The script calls `window.onYouTubeIframeAPIReady` when ready
- Our `ensureYTApi()` wraps this in a Promise for clean async usage

### Player Creation
- `new YT.Player(element, options)` **replaces** the target DOM element with an iframe
- Important: the element is consumed, not wrapped. We create a child div inside a React-managed container, pass the child to the API, and the container ref stays valid.
- The player constructor can take an HTMLElement or a string ID

### Key Methods
- `player.loadVideoById(videoId)` — loads and auto-plays a new video without recreating the iframe
- `player.stopVideo()` — stops playback
- `player.destroy()` — removes the iframe from the DOM

### State Change Events
```
YT.PlayerState.ENDED     = 0   // Video finished playing
YT.PlayerState.PLAYING   = 1
YT.PlayerState.PAUSED    = 2
YT.PlayerState.BUFFERING = 3
YT.PlayerState.CUED      = 5   // Video loaded but not started
```

We listen for `ENDED` to trigger auto-advance to the next song in the queue.

## YouTube TOS Constraints

- Player must be **visible** — minimum 200x200px. Cannot be `display:none` while playing.
- Cannot overlay or obscure the player with custom controls.
- Must allow YouTube branding to show.
- We use `modestbranding: 1` and `rel: 0` to minimize UI clutter while staying compliant.

## Mobile Autoplay

- **First video** requires a user gesture (tap) due to browser autoplay policy. This is unavoidable.
- **Subsequent videos** via `loadVideoById()` auto-play without a gesture, because the initial gesture "unlocks" the audio context for the tab.
- `playsinline: 1` is needed for iOS to prevent fullscreen takeover.
- Recommendation: the DJ should manually tap "Play" or "Start Playing" for the first song. After that, auto-advance handles the rest.

## React Integration Pattern

We use a `useYouTubePlayer` hook that:
1. Takes a container `ref`, a `videoId | null`, and an `onEnded` callback
2. Creates a child div inside the container, passes it to `YT.Player`
3. On `videoId` change: calls `loadVideoById()` or `stopVideo()`
4. On unmount: calls `player.destroy()` and cleans up the container
5. Uses `onEndedRef` (ref to callback) so the latest callback is always used without recreating the player

```
Container div (React-managed, ref stays valid)
  └── Target div (created imperatively, replaced by YT with iframe)
       └── YouTube iframe (created by YT.Player)
```

## Known Issues / Gotchas

- **`display:none` on the container**: The player still works (API calls succeed), but YouTube TOS says it should be visible. We hide it when screen share is active — acceptable since no video is playing at that point (we call `stopVideo()`).
- **Player recreation**: If the container unmounts and remounts, the player is destroyed and recreated. This is fine for our use case but means playback position is lost.
- **No TypeScript types**: YouTube doesn't publish official TS types. We maintain a minimal `youtube.d.ts` in `src/types/`.
- **iframe sandbox**: The YouTube iframe runs in a separate origin. No direct DOM access.

## Alternatives Considered

| Approach | Why rejected |
|----------|-------------|
| `window.open()` + navigate | Cross-origin windows can't be navigated programmatically |
| Raw `<iframe>` with `postMessage` | YouTube's postMessage API is undocumented and fragile |
| `<video>` element with direct URL | YouTube doesn't expose direct video URLs (DRM) |
| Third-party libraries (react-youtube, etc.) | Unnecessary abstraction over a simple API; adds dependency |

## Files

- `apps/web/src/hooks/useYouTubePlayer.ts` — React hook wrapping the API
- `apps/web/src/types/youtube.d.ts` — Minimal YT type declarations
- `apps/web/src/components/room/VideoStage.tsx` — Consumer of the hook
