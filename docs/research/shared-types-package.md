# Shared Types Package — `@karaoke-friends/shared`

> Created 2026-05-12. Documents the monorepo shared types strategy.

## Problem

The project had two identical `messages.ts` files:
- `packages/party/src/messages.ts` (server)
- `apps/web/src/lib/signaling/messages.ts` (client)

Both defined `Song`, `Participant`, `ClientMessage`, `ServerMessage`. Any change needed to be made twice. This is a maintenance time bomb — message format drift between server and client causes silent runtime bugs.

## Solution

Created `packages/shared/` as the single source of truth:

```
packages/shared/
  package.json         # @karaoke-friends/shared, private, exports ./src/index.ts
  src/
    index.ts           # re-exports from messages.ts
    messages.ts        # Song, Participant, ClientMessage, ServerMessage
  tsconfig.json
```

Both `apps/web` and `packages/party` depend on `@karaoke-friends/shared` via workspace protocol.

## How It Works

- **No build step** — `"main"` and `"types"` both point to `./src/index.ts` (raw TypeScript)
- Works because both consumers (Next.js and Cloudflare Workers) have their own TS compilation
- Turborepo handles the dependency graph automatically
- TypeScript path resolution follows the `exports` field in package.json

## Package.json

```json
{
  "name": "@karaoke-friends/shared",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

## Import Pattern

```typescript
// In both apps/web and packages/party:
import type { Song, ClientMessage, ServerMessage, Participant } from "@karaoke-friends/shared";
```

## What's Defined

- `Song` — queue item with id, title, url, addedBy, singerName, votes, addedAt, durationSeconds
- `Participant` — peer in a room with id and name
- `ClientMessage` — union type of all client → server messages
- `ServerMessage` — union type of all server → client messages

## Adding New Types

1. Add the type to `packages/shared/src/messages.ts`
2. Export it from `packages/shared/src/index.ts`
3. Both packages see it immediately — no build step needed
