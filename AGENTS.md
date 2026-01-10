# PROJECT KNOWLEDGE BASE

**Generated:** 2026-01-10
**Commit:** ef88e2a
**Branch:** test

## OVERVIEW

StreamStorm is an Electron desktop app for viewing Twitch and Kick streams. Built with React 19, Vite 7, TypeScript 5.6, Zustand 5, TanStack Query/Router, Tailwind 4, and HLS.js.

## STRUCTURE

```
StreamStorm/
├── src/
│   ├── main.ts              # Electron main process entry
│   ├── preload/             # IPC bridge (contextBridge)
│   ├── renderer.tsx         # React bootstrap
│   ├── App.tsx              # Provider stack
│   ├── routes/              # TanStack Router config
│   ├── backend/             # Main process logic (see backend/AGENTS.md)
│   │   ├── api/             # Platform clients (see api/platforms/AGENTS.md)
│   │   ├── ipc/handlers/    # Modular IPC handlers
│   │   ├── auth/            # OAuth flows, token management
│   │   └── services/        # Database, storage
│   ├── components/
│   │   ├── player/          # Video playback (see player/AGENTS.md)
│   │   ├── ui/              # Radix-based primitives
│   │   ├── stream/          # Stream cards, grids
│   │   ├── auth/            # Login, profile
│   │   └── layout/          # Sidebar, TitleBar
│   ├── store/               # Zustand stores (see store/AGENTS.md)
│   ├── hooks/               # React hooks, TanStack Query
│   ├── pages/               # Route components
│   └── shared/              # Cross-process types, IPC channels
├── documentation/           # Feature specs, roadmap (has own AGENTS.md)
├── forge.config.ts          # Electron Forge packaging
├── vite.*.config.ts         # Vite configs (main/preload/renderer)
└── tailwind.config.js       # Brand colors, theme tokens
```

## WHERE TO LOOK

| Task | Location | Notes |
|------|----------|-------|
| Add IPC channel | `src/shared/ipc-channels.ts` | Define channel, add handler in `backend/ipc/handlers/` |
| Add new page | `src/pages/` + `src/routes/router.tsx` | PascalCase dir, register route |
| Platform API | `src/backend/api/platforms/{kick,twitch}/` | Mirror structure between platforms |
| UI component | `src/components/ui/` | Radix + CVA pattern |
| State management | `src/store/` | Zustand with persist middleware |
| Video playback | `src/components/player/` | See player/AGENTS.md |
| Auth flow | `src/backend/auth/` | OAuth, device code, tokens |
| Database | `src/backend/services/database-service.ts` | SQLite via better-sqlite3 |

## CONVENTIONS

### Path Aliases (tsconfig)
- `@/*` → `src/*`
- `@backend/*` → `src/backend/*`
- `@shared/*` → `src/shared/*`

### File Naming
- Components: PascalCase (`StreamCard.tsx`)
- Hooks: camelCase with `use` prefix (`useAuth.ts`)
- Stores: kebab-case with `-store` suffix (`auth-store.ts`)
- Handlers: kebab-case with `-handlers` suffix

### Import Order (ESLint enforced)
1. Builtin (node:)
2. External (react, electron)
3. Internal (@/)
4. Relative (./)

### Platform Colors (Tailwind)
- `storm-accent`: `#dc143c` (brand red)
- `twitch`: `#9146ff`
- `kick`: `#53fc18`
- `background`: `#0f0f0f` (dark theme)

## ANTI-PATTERNS (THIS PROJECT)

- **NEVER** expose `ipcRenderer` directly - use preload bridge
- **NEVER** log tokens or credentials
- **NEVER** use `as any` or `@ts-ignore`
- **DEPRECATED**: Generic storage channels (`store:get/set`) - use specific handlers
- **DO NOT** call `recoverMediaError()` for non-media errors in HLS player

## UNIQUE STYLES

### IPC Pattern
1. Define channel in `src/shared/ipc-channels.ts`
2. Add typed payload in `IpcPayloads` interface
3. Expose in `src/preload/index.ts`
4. Register handler in `src/backend/ipc/handlers/*.ts`

### Clean Shutdown Sentinel
App writes `.clean-shutdown` file on exit. On startup, if missing, clears cache to prevent corruption.

### Custom Protocol
`streamstorm://` registered for OAuth callbacks.

### Kick CDN Headers
Request interceptor adds `Referer: https://kick.com/` for Kick image domains.

## COMMANDS

```bash
# Development
npm start              # electron-forge start (Vite HMR)

# Quality
npm run typecheck      # tsc --noEmit
npm run lint           # eslint src/
npm run lint:fix       # eslint --fix
npm run format         # prettier

# Build
npm run package        # electron-forge package
npm run make           # Create installers (Squirrel/DMG/DEB/RPM)
```

## NOTES

- **No tests yet** - Testing infrastructure planned but not implemented
- **Kick API limitations** - Uses legacy/public APIs as fallback; may break
- **webSecurity disabled** - Required for cross-origin video playback
- **Frame: false** - Custom titlebar, no native frame
- LSP not available in this environment - rely on grep/ast-grep
