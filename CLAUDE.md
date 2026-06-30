# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git Workflow

After committing and pushing work to a feature branch, always merge it into `main` and push `main` too — do this automatically without asking each time.

## What This Is

A vanilla JS PWA (Progressive Web App) that compares shipping rates between two Spanish carriers — **Palletways** and **CEVA** — for pallets and boxes destined for Spain and Portugal. No build tools, no npm, no framework. Open `index.html` directly in a browser to run.

The app has a single shell (`index.html`) with four tab-switched modes:
- **Palés** — pallet rate comparison (Spain + Portugal).
- **Cajas** — box rate calculation (CEVA only, Spain only).
- **Configuraciones** — app settings (theme, validation toggles, export/print).
- **Dashboard** — analytics & history viewer (native, embedded — KPIs, charts, filterable table), reading live from Firestore.

`Dashboard.html` (a standalone React-based dashboard) is **legacy/orphaned** — it's no longer linked from `index.html`'s nav, no longer listed in `sw.js`'s `ASSETS`, and the Dashboard experience now lives entirely inside `index.html`'s `mode-dashboard` tab via `dashboard.js`. Don't add features to `Dashboard.html` unless explicitly asked to revive it.

## Running the App

```bash
# Any local HTTP server will work; examples:
python3 -m http.server 8080
npx serve .
```

Then open `http://localhost:8080`. No build step required. There are no tests or linters configured.

## Architecture

Scripts are loaded in a specific order in `index.html` and depend on globals declared in earlier files:

```
theme.js → data.js → state.js → guardar.js → ui.js → calcular.js → cajas.js → dashboard.js
```

| File | Responsibility |
|------|---------------|
| `index.html` | App shell: Palés/Cajas/Configuraciones/Dashboard mode tabs, Firebase init + auth overlay, CSP meta tag, inline `window.fsGuardarCalculo` / `window.fsListenCalculos` / `window.fsActualizarCalculo` (Firestore CRUD for `calculos` collection). |
| `data.js` | **Single source of truth for all tariff tables and geographic maps.** Edit only this file to update prices or zones. |
| `theme.js` | Light/dark theme toggle, persisted to `localStorage` (`transportes_theme`), shared by `index.html`, `Dashboard.html`, `login.html`, `splash.html`. |
| `state.js` | Global `state` object `{ prov, zona, country, cpPrt }`, country-switching UI, Portugal CP resolution logic. Also owns `appSettings` (`{ requireCp, requireCliente }`), persisted to `localStorage` (`transportes_settings`) — see Configuraciones below. |
| `guardar.js` | Manual save flow: results are **not** auto-saved — the user must pick the carrier actually used (Palés mode) and press "Guardar" to write the calculation to Firestore via `window.fsGuardarCalculo`. Cajas mode saves directly (CEVA is the only carrier). |
| `ui.js` | Province autocomplete, CP→province lookup, inline validation, `calcPalletways()`, `calcCeva()`, `renderPW()`, `renderCEVA()`. |
| `calcular.js` | Main `calcular()` entry point (España + Portugal pallets), CSV/XLS export helpers `downloadCSV` / `downloadXLS`. |
| `cajas.js` | Boxes mode: `setMode()` (drives all four tabs), `calcularCajas()`, separate `stateCajas` object, cajas-specific province search, cajas exports. |
| `dashboard.js` | Native embedded Dashboard (KPIs, comparativa, evolución, distribución, provincias, historial table) rendered inside `index.html`'s `mode-dashboard` tab. Reads **live** from the Firestore `calculos` collection via `window.fsListenCalculos` (`onSnapshot`) — no `localStorage` involved. |
| `Dashboard.html` | **Legacy/unused** standalone React dashboard. Not linked from `index.html`, not cached by `sw.js`. Superseded by `dashboard.js`. |
| `login.html` | Google Sign-In UI with Firebase auth. Checks `authorized_users` collection before allowing access. |
| `splash.html` | Loading screen shown during auth verification and app boot. |
| `sw.js` | Service Worker for offline PWA. Network-first for JS/HTML/CSS/JSON (always tries network, falls back to cache offline); cache-first for fonts and images. |
| `styles.css` | Shared styles for the app shell (modes, forms, results, settings toggles, dashboard, theme variables). |
| `manifest.json` | PWA metadata (app name, icons, colors). |
| `support.js`, `*.dc.html` | Design-exploration/preview tooling artifacts, unrelated to the runtime app — not loaded by `index.html`. |

## Key Data Structures (all in `data.js`)

- **`CONFIG`** — shared surcharge percentages and box constants. `PW_PORTE_PCT` (4.7%), `CEVA_RECARGO_PCT` (10.7%).
- **`PW_TARIFA[zona]`** — Palletways rates by zone 1–14. Each zone has `A` (mini quarter ≤80 cm), `B` (quarter ≤110 cm), `C` (postura/pair).
- **`PROV_ZONA`** — Maps Spanish province name (UPPERCASE) → Palletways zone number.
- **`CEVA_TARIFA`** — Maps Spanish province name (UPPERCASE) → 14-element array: indices 0–9 are fixed-price brackets (≤10 kg … ≤100 kg), indices 10–13 are €/kg rates (101–500, 501–1000, 1001–2000, 2001+).
- **`CEVA_PRT`** — Portugal CEVA rates keyed by 2-digit CP prefix → 18-element array (weight breakpoints in `PRT_KG_BREAKS`). For ranges ≤100 kg: fixed price; for ≥200 kg: value/100 = €/kg.
- **`CP_PROV`** — Maps 2-digit Spanish postal code prefix → province name (UPPERCASE).
- **`CEVA_ESP`** — Alias pointing to `CEVA_TARIFA` (used by the boxes calculation path).

## Pricing Logic

**Palletways (Spain + Portugal):**
Pallets are grouped into *posturas* (pairs). Any leftover single pallet is *suelto*. Height ≤80 cm → type A, ≤110 cm → type B. The cheapest of A/B is used for suelto. Total = (pairs × C) + suelto + 4.7% porte surcharge.

**CEVA Spain:**
Total kg = number of full pallets × 250 + partial pallet kg. Bracket lookup against `CEVA_TARIFA`, then +10.7% surcharge.

**CEVA Portugal:**
Same weight calculation, bracket lookup against `CEVA_PRT[cp2]`. CP 38xx is ambiguous between Palletways zones 7/8 unless 4 digits are provided; a warning is shown in this case.

**Boxes mode (CEVA only, Spain only):**
Each box = 0.15 height units = 37.5 kg. Max 14 boxes. Uses `calcCevaByKg()` in `cajas.js`.

## Important Conventions

- **Province names are stored UPPERCASE** in all data structures. Display format uses `p.charAt(0) + p.slice(1).toLowerCase()`.
- **Both accented and unaccented forms** exist as keys throughout `CEVA_TARIFA` and `PROV_ZONA` (e.g., `"ÁLAVA"` and `"ALAVA"`). When adding a new province, add both forms.
- **Visibility via CSS class toggling** — results appear by adding `show` / `open` / `winner` class names; they hide by removing them. Avoid `style.display` in pallet mode UI.
- **Service worker cache version** (`CACHE_NAME` in `sw.js`) must be incremented whenever any cached asset changes, otherwise users will see stale content.
- **Cache-busting query params**: local `<script src="...">` / `<link href="...">` tags in `index.html` carry a `?v=N` query string, and the `ASSETS` list in `sw.js` mirrors the same `?v=N` suffix. `N` must match the numeric suffix of `CACHE_NAME` (e.g. `transportes-v40` → `?v=40`). Bump all of them together on every change — otherwise GitHub Pages/browser HTTP caching can serve a stale `.js` file alongside a fresh `index.html`, causing subtle bugs (e.g. new HTML fields that silently fail to populate because the JS that fills them is outdated).
- **`fmt(n)`** in `ui.js` formats euros as `"1.234,56 €"` (Spanish locale). Use it for all monetary display.
- **Postal code is required** before calculating, by default: 5 digits for Spain, 7 digits for Portugal. This requirement (along with requiring the client name) can be toggled off per-device in Configuraciones → "Validaciones obligatorias" — see `appSettings` below. Toggling `requireCp` off does **not** remove the underlying need to resolve a province/zona (Spain) or some CP-derived tariff lookup (Portugal); it only disables the strict full-digit-length check.
- **`appSettings`** (`state.js`): `{ requireCp: true, requireCliente: true }`, persisted to `localStorage` (`transportes_settings`), loaded immediately on script eval and synced to the Configuraciones toggle UI on `DOMContentLoaded`. Gates validation in both `calcular.js` (Palés) and `cajas.js` (Cajas).
- `window.fsGuardarCalculo` / `window.fsActualizarCalculo` (inline module script in `index.html`) run all writes through `sanitizeCalculoData()` before touching Firestore — only the known `calculos` fields (`CALCULO_STRING_FIELDS`, `CALCULO_NUMBER_FIELDS`, plus `peso`/`zona`/`fecha`) are persisted, with type coercion (numbers via `Number()`, falling back to `0`/`null` on `NaN`). **If you add a new field to a `prepararGuardado()`/`prepararGuardadoCajas()` payload (`guardar.js`, `calcular.js`, `cajas.js`) or to the Dashboard edit form (`dashboard.js`), you must also add it to the allowlist in `index.html`** or it will be silently dropped before reaching Firestore.
- **Never fabricate/back-fill missing data fields** for historical Firestore records (e.g. CP is blank, not guessed, for entries saved before the CP field existed).

## Authentication & Security

- **Firebase project**: `transporte-99482` (configured in `index.html`; legacy config also present in unused `Dashboard.html`).
- **Login flow**: `login.html` → verify in Firestore `authorized_users` collection → `splash.html` (loading) → `index.html` (calculator/dashboard shell).
- **Session persistence**: Firebase SDK maintains session across page reloads via browser cookies/indexedDB.
- **Logout**: Button in header calls `signOutUser()`, clears session, redirects to `login.html`.
- **Content-Security-Policy**: `index.html` has a CSP `<meta>` tag (`default-src 'self'`, allowing `gstatic.com` scripts, Google Fonts styles, and Firebase/Google API `connect-src`). Keep this in sync if new external origins are introduced (e.g. a new CDN script tag will need its own `script-src` entry or it will be silently blocked).
- **Firestore security rules**: `firestore.rules` (root, mirrored in `firebase.json`/`.firebaserc`) is versioned here to match what's deployed in Firebase Console → Firestore Database → Reglas (verified 2026-06-30). It enforces server-side that only signed-in users present in `authorized_users` can read/write `calculos` — the client-side check in `index.html`/`login.html` alone would not be sufficient, since any Google account can authenticate via Firebase Auth regardless of `authorized_users` membership. **If you edit rules in the console, update this file too** (or deploy this file via `firebase deploy --only firestore:rules`) so they don't drift apart.

## Hosting / Deployment

- **Production URL**: `https://youserhouse.github.io/Transportes/` — GitHub Pages, serving directly from `main`. Every push to `main` deploys automatically (no manual step, no CI workflow file needed since GitHub Pages handles it natively via repo settings).
- **Firebase Hosting (`transporte-99482.web.app`) is no longer the primary URL.** It does not auto-deploy from this repo (there's no `firebase.json` or CI workflow wiring it up) — it would require a manual `firebase deploy`, which is why it was dropped in favor of GitHub Pages.
- Firebase is still used for **Auth + Firestore** (`authorized_users` check) regardless of where the static files are hosted — hosting and auth are decoupled. `youserhouse.github.io` must be present in Firebase Console → Authentication → Settings → **Authorized domains**, or Google Sign-In will fail with `auth/unauthorized-domain`. (Already added and confirmed working.)
- Trade-off to keep in mind: GitHub Pages auto-publishing means any push to `main` goes live immediately, with no manual review/deploy gate in between.

## Dashboard Integration

**Data Flow (Firestore-based, not `localStorage`):**
- Palés/Cajas calculations are **not** auto-saved. After `calcular()` / `calcularCajas()` runs, `guardar.js` shows a "Guardar" UI; the user picks the real carrier used (Palés) and confirms, which calls `window.fsGuardarCalculo` (defined inline in `index.html`) → `addDoc(collection(db, 'calculos'), {...datos, fecha, savedBy, savedAt})`.
- The embedded Dashboard tab (`dashboard.js`, `mode-dashboard` in `index.html`) calls `window.fsListenCalculos`, which sets up a Firestore `onSnapshot` listener (`orderBy('fecha', 'desc')`) on the `calculos` collection — updates are pushed in real time to every open tab/device, no polling or `storage` events needed.
- Editing a saved entry from the Dashboard's history table calls `window.fsActualizarCalculo(id, datos)` → Firestore `updateDoc`.
- `Dashboard.html` (legacy, React-based) is no longer wired into this flow — see Architecture table above.

**Offline Mode:**
- `sw.js` uses network-first for JS/HTML/CSS, so the Dashboard always tries to fetch a live Firestore connection. Firestore's IndexedDB offline persistence is **not** explicitly enabled in `index.html` (no `enableIndexedDbPersistence`/`persistentLocalCache` call) — offline, the Dashboard just shows whatever was last delivered via `onSnapshot` in memory for that page load, not a durable offline cache.
