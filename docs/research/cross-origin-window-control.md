# Cross-Origin Window Control — Dead End

> Researched 2026-05-12. This documents why `window.open()` was abandoned for YouTube playback.

## The Problem

We wanted to open a YouTube video in a managed browser tab and navigate it to different URLs as songs change. This would let the DJ see the full YouTube UI and the app would just control which URL is loaded.

## What We Tried

### Approach 1: `window.open()` + `location.href`
```typescript
const win = window.open(url, "karaoke-playback");
// Later, to change songs:
win.location.href = newUrl; // FAILS silently
```

Once the window navigates to `youtube.com`, it becomes cross-origin. The Same-Origin Policy blocks all access to `win.location`, `win.document`, etc. The assignment doesn't throw — it just does nothing.

### Approach 2: Named window reuse
```typescript
// First song:
window.open("https://youtube.com/watch?v=abc", "karaoke-playback");
// Next song — same window name should reuse the tab:
window.open("https://youtube.com/watch?v=def", "karaoke-playback");
```

This **opens a new tab** instead of reusing the existing one. Browser behavior is inconsistent — some browsers reuse, most don't after the first navigation. User confirmed: "it still opens up a new tab."

### Approach 3: Intermediate proxy page
Open our own page that iframes YouTube. This adds unnecessary complexity and YouTube blocks embedding via `X-Frame-Options` on most pages (except the `/embed/` endpoint, which is exactly what the IFrame Player API provides).

## Why It's Unfixable

The Same-Origin Policy is a fundamental browser security boundary. There is no:
- API to navigate a cross-origin window
- Permission the user can grant to allow it
- Browser extension API available from web content
- postMessage protocol YouTube supports for navigation

## The Solution

Embed YouTube inline using the **YouTube IFrame Player API**. This gives us:
- Full programmatic control (`loadVideoById`, play/pause/stop)
- Event listeners (`onStateChange` for end detection)
- TOS-compliant embedding
- No popup blocker issues

See: `youtube-iframe-player-api.md` for implementation details.

## Lesson

If you need to control video playback across songs, embed it — don't try to control a separate window.
