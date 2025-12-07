# AGENTS.md

This is the canonical entrypoint for AI coding agents (e.g., Amp) working in this repository. It provides a concise project overview and points to the nearest per-folder AGENTS.md files that contain the actionable, context-specific rules.

## Project Overview

FreeTube is a private YouTube client built on Electron that allows users to watch YouTube videos without ads or tracking.

- Frontend: Vue 3, Vue Router, Vuex
- Build: Webpack, TypeScript (in migration)
- Backend: Electron (main process), NeDB database
- Video: Shaka Player, YouTubeI.js API client
- Styling: SCSS, FontAwesome icons

Directory structure:
- /src/renderer: Vue.js frontend (views, components, store)
- /src/main: Electron main process
- /src/preload: Electron preload scripts
- /src/datastores: Database modules (NeDB)
- /documentation: Feature specs and migration guides

## Development Commands

Use npm for scripts.

```bash
npm run dev          # Start Electron app in development mode
npm run build        # Build production release
npm run pack         # Pack all webpack bundles
npm run lint         # Run ESLint and stylelint
npm run lint-fix     # Auto-fix linting issues
npm run type-check   # TypeScript type checking

# Type checking (supports incremental migration)
npm run type-check:renderer  # Frontend Vue components
npm run type-check:backend   # Main process TypeScript

# Debugging
npm run debug        # Start with remote debugging enabled
```

Environment variables:
- Standard Electron environment (no backend API keys needed for basic development)
- YouTubeI.js handles API interactions internally

## Verification Gates

- Typecheck: `npm run type-check`
- Lint: `npm run lint`
- Build: `npm run pack` (webpack bundles)
- Production Build: `npm run build`
- Tests: (none currently configured)

## Use the Nearest AGENTS.md (closest-wins)

To keep agent context minimal, each major folder can have its own AGENTS.md. Agents should read the nearest file in the directory tree first (closest wins), then fall back to this root file.

- Documentation rules: [documentation/AGENTS.md](documentation/AGENTS.md)

Future AGENTS.md locations as the project grows:
- /src/renderer: (planned for Vue component conventions)
- /src/main: (planned for Electron main process patterns)
- /_scripts: (planned for build script guidelines)

## Working With Features

- Active work: /documentation/features/active/
- Completed: /documentation/features/completed/
- Planned: /documentation/features/planned/

When implementing a feature:
- Check the active spec and progress docs
- Reuse patterns from completed features

## Research and Web Search

**Always use Exa MCP tools for any research, web searches, or deep research tasks - DO NOT use any other search methods.**

The Exa MCP provides AI-powered search capabilities with intelligent content extraction and synthesis. It offers superior results compared to traditional search engines by understanding context and delivering relevant, structured information tailored for development tasks.

Available Exa MCP tools:
- `web_search_exa`: General web searches with live crawling and content scraping
- `deep_researcher_start` + `deep_researcher_check`: Comprehensive AI-powered research with multi-source analysis
- `get_code_context_exa`: Programming-specific searches for APIs, libraries, and SDKs
- `company_research_exa`: Business and organization information
- `linkedin_search_exa`: Professional profiles and company pages
- `crawling_exa`: Extract full content from specific URLs

## Notes
- The detailed per-area rules (TypeScript migration patterns, Vue component conventions, Electron IPC patterns, database schemas) will live in subfolder AGENTS.md files as they are created.
- For discovery and precedence behavior, see the "closest-wins" approach above.

