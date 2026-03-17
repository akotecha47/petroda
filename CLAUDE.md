# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server with HMR
npm run build     # Production build
npm run preview   # Preview production build
npm run lint      # Run ESLint
```

No test suite is configured yet.

## Stack

- **React 19** + **Vite 8** (beta) — using `@vitejs/plugin-react` (Babel/Fast Refresh)
- **Tailwind CSS v4** — configured via `@tailwindcss/vite` plugin (no `tailwind.config.js`; import with `@import "tailwindcss"` in CSS)
- **Supabase** (`@supabase/supabase-js`) — client initialized in `src/supabaseClient.js`, exported as `supabase`
- **React Router v7** (`react-router-dom`) — available but not yet wired up

## Architecture

This project is in early/scaffolding stage. The only source files beyond the Vite template are:

- `src/supabaseClient.js` — creates and exports the Supabase client singleton
- `src/App.jsx` — currently a connection test against the `stations` table; this will grow into the main app shell

The Supabase URL and key are hardcoded in `src/supabaseClient.js`. Move these to environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) when the project matures — Vite exposes `import.meta.env.VITE_*` variables to client code.
