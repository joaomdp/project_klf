# AGENTS.md

This file guides agentic coding assistants working in this repository.
It summarizes how to build/run the app and the expected code conventions.

## Repository layout
- Frontend (Vite + React): project root
- Backend API (Node/Express): `api/`

## Commands

### Frontend (root)
- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Preview build: `npm run preview`
- Lint: not configured
- Tests: not configured
- Run a single test: not available (no test runner configured)

### Backend API (`api/`)
- Install: `npm install`
- Dev server: `npm run dev`
- Build: `npm run build`
- Start built server: `npm run start`
- Tests: `npm test` (placeholder, no tests implemented)
- Run a single test: not available (no test runner configured)

### Backend utility scripts (`api/`)
- `npm run db:diagnose`
- `npm run db:rebalance`
- `npm run db:fix-urls`
- `npm run db:update-champions`
- `npm run db:update-configs`
- `npm run db:seed-rounds`
- `npm run db:add-analyst-rating`
- `npm run db:validate`
- `npm run db:seed-all`
- `npm run test-riot-api`
- `npm run import-round`
- `npm run import-season`
- `npm run list-db`
- `npm run verify-mappings`

## Environment
- Frontend uses Vite env, see `vite.config.ts` for `GEMINI_API_KEY` exposure.
- Backend uses `.env` in `api/` for Supabase and other secrets.
- Do not hardcode secrets; use environment variables.

## Code style guidelines

### General
- Use TypeScript for new code; avoid `any` when possible.
- Keep functions small and focused; prefer pure helpers when reasonable.
- Avoid dead code and unused state; delete rather than comment out.
- Prefer early returns to reduce nesting.
- Keep UI logic in components and data access in services.

### Imports
- Group imports: external libraries first, then local modules.
- Use path alias `@/` where it improves clarity (configured in `tsconfig.json`).
- Use named imports over default when available.

### React
- Use function components and React hooks.
- Keep hooks near the top of the component.
- Prefer `useCallback` for handlers passed deep into props.
- Keep render branches simple; factor out small components if needed.
- Avoid side effects in render; use `useEffect` for side effects.

### State and data flow
- Keep a single source of truth for derived values (use helpers).
- Recalculate derived values (like totals) in one helper and reuse.
- When persisting user data, update local state and persist together.

### Types
- Define shared types in `types.ts`.
- Use precise literal unions for enums and string unions.
- Keep DTO shapes aligned with backend responses.
- Avoid casting unless necessary; explain why in code if used.

### Naming conventions
- camelCase for variables and functions.
- PascalCase for components, types, and classes.
- UPPER_SNAKE_CASE for constants.
- Use descriptive handler names: `handleSave`, `handleLoginSuccess`.

### Error handling and logging
- Catch async errors in services and return safe defaults where needed.
- Use `console.error` for errors, `console.warn` for recoverable issues.
- Avoid swallowing errors silently; surface to UI via toasts when relevant.

### Backend API
- Keep business logic in `api/src/services`.
- Keep route handlers thin; validate inputs early.
- Use `supabase` client from `api/src/config/supabase`.
- Return consistent JSON: `{ success: boolean, ... }`.

### Data and persistence
- Frontend uses Supabase REST and backend API; keep contracts aligned.
- Do not change database schema without updating both sides.
- When reading/writing user data, ensure auth token is present.

### Formatting
- Match existing formatting (2-space indent).
- Keep JSX props on multiple lines when long.
- Avoid extremely long lines in JSX/TS; wrap for readability.

## Tooling notes
- There is no linting or unit test runner configured.
- Prefer running `npm run build` after significant frontend changes.
- For backend changes, run `npm run build` in `api/` when relevant.

## Repo rules
- No Cursor or Copilot instruction files present at time of writing.
