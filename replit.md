# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **WebSocket**: `ws` package for WebRTC signaling

## Artifacts

### Sega Party (`artifacts/sega-party`)
- React + Vite frontend
- Preview path: `/`
- Retro arcade multiplayer game party app
- Host uploads a Sega Genesis ROM and streams it to guests via WebRTC
- Guests see the game stream and can send inputs over WebRTC data channels

### API Server (`artifacts/api-server`)
- Express 5 backend
- Preview path: `/api` (also serves `/ws`)
- REST API for session management
- WebSocket server at `/ws` for WebRTC peer signaling

## Architecture

The multiplayer system works as follows:
1. **Host** creates a session via `POST /api/sessions` — gets a 6-char code and their player ID
2. **Guests** join via `POST /api/sessions/:code/join` — get their player ID and session data
3. Both host and guests connect to WebSocket at `/ws` for WebRTC signaling
4. Host streams their game canvas via `RTCPeerConnection` with `captureStream()`
5. Guests receive the stream and display it in a `<video>` element
6. Guest keyboard/gamepad inputs are sent over WebRTC data channels to the host

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `pnpm --filter @workspace/sega-party run dev` — run frontend locally

## Database Schema

- `sessions` table: stores game sessions with players (JSON), code, hostId, maxPlayers

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
