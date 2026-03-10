# StockLens Frontend

Week 1 frontend for StockLens: React + Vite + TypeScript + Tailwind, wired to the Django API for JWT auth.

## Install

```bash
npm install
```

## Run The Dev Server

```bash
npm run dev
```

The app runs on `http://localhost:5173`.

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Repo-level equivalents from the project root:

```bash
make lint
make test
make build
```

## Environment Variables

Create `frontend/.env.local` with:

```bash
VITE_API_URL=http://localhost:8000
```

If `VITE_API_URL` is omitted locally, relative `/api/*` requests still work through the Vite proxy. Production deploys should set the explicit backend URL.

## Backend API Wiring / CORS

- Frontend calls `/api/v1/auth/*`
- Vite proxies `/api` to `http://localhost:8000`
- Django should allow `FRONTEND_URL=http://localhost:5173`
- Week 1 auth is JWT-only; there is no cookie auth path

## Auth Flow Summary

- Signup/login return `{ access, refresh, user }`
- Access token stays in Zustand memory only
- Refresh token and user snapshot `{ id, email }` are persisted in `localStorage`
- On reload, the user is restored immediately and the client refreshes the access token silently in the background
- On refresh failure, the client clears auth state and falls back to an unauthenticated session

## Key Frontend Entry Points

- `src/App.tsx` — providers and dev-only React Query devtools
- `src/router.tsx` — route graph and protected-route placement
- `src/api/client.ts` — axios client, auth header injection, 401 refresh retry
- `src/hooks/useAuthBootstrap.ts` — persisted-auth restore and silent refresh
- `src/store/authStore.ts` — in-memory access token + persisted user coordination
- `src/store/uiStore.ts` — dark-mode persistence
- `src/pages/LoginPage.tsx` and `src/pages/SignupPage.tsx` — auth forms
- `src/components/layout/AppLayout.tsx` — global app shell
