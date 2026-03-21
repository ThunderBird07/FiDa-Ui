# FiDa UI

Frontend prototype for the FiDa financial dashboard.

## What is included

- Dedicated auth and dashboard pages:
	- `login.html`
	- `register.html`
	- `index.html` (dashboard)
- Supabase email/password authentication
- Session-based redirect flow:
	- unauthenticated users are redirected to `login.html`
	- authenticated users can access `index.html`
- Dashboard data loading from backend endpoints:
	- `GET /v1/profile`
	- `GET /v1/categories`
	- `GET /v1/transactions`
- Summary cards (income, expense, net, transaction count)
- Spending-by-category chart bars
- Recent transactions table

## Quick start

1. Serve this folder with any static server, or open `login.html` directly.
2. Register from `register.html` or login from `login.html`.
3. On successful auth, the app redirects to `index.html`.

Default configuration is embedded from backend context:
- Backend base URL: `http://fida.local`
- Supabase URL and anon key are preconfigured in frontend scripts.

## Authentication notes

- The app uses `@supabase/supabase-js` via CDN.
- Supabase access token is sent as backend Bearer token.
- Login/register use email + password.
- Register flow handles both modes:
	- instant session (redirect to dashboard)
	- email confirmation required (redirect to login with message)

## Notes

- This is intentionally frontend-only and keeps backend/domain logic on the FastAPI side.
- Session token and selected backend URL are stored in `localStorage` for convenience.
- Current dashboard cards are still computed client-side from transactions until backend summary endpoints are added.
