# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A vanilla JS PWA (Progressive Web App) that compares shipping rates between two Spanish carriers — **Palletways** and **CEVA** — for pallets and boxes destined for Spain and Portugal. No build tools, no npm, no framework. Open `index.html` directly in a browser to run.

The app has two main views:
- **Calculator** (`index.html`) — real-time rate comparison tool for Spain + Portugal shipping.
- **Dashboard** (`Dashboard.html`) — analytics & history viewer (React-based, shows all past calculations with filtering, charts, and trends).

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
data.js → state.js → historial.js → ui.js → calcular.js → cajas.js
```

| File | Responsibility |
|------|---------------|
| `index.html` | Calculator UI (pallets & boxes modes), Firebase auth overlay, mode tabs for switching views. |
| `data.js` | **Single source of truth for all tariff tables and geographic maps.** Edit only this file to update prices or zones. |
| `state.js` | Global `state` object `{ prov, zona, country, cpPrt }`, country-switching UI, Portugal CP resolution logic. |
| `historial.js` | Daily history via `localStorage` (key `transportes_historial`), max 50 entries/day, UI panel. |
| `ui.js` | Province autocomplete, CP→province lookup, inline validation, `calcPalletways()`, `calcCeva()`, `renderPW()`, `renderCEVA()`. |
| `calcular.js` | Main `calcular()` entry point (España + Portugal pallets), CSV/XLS export helpers `downloadCSV` / `downloadXLS`. |
| `cajas.js` | Boxes mode: `setMode()`, `calcularCajas()`, separate `stateCajas` object, cajas-specific province search, cajas exports. |
| `Dashboard.html` | Analytics dashboard (React-based). Reads live history from `localStorage`, renders KPIs, charts, and filterable table. Firebase auth guard included. |
| `login.html` | Google Sign-In UI with Firebase auth. Checks `authorized_users` collection before allowing access. |
| `splash.html` | Loading screen shown during auth verification and app boot. |
| `sw.js` | Service Worker for offline PWA. Cache-first for local assets (v17+), cache-then-network for fonts. Caches `Dashboard.html`. |
| `styles.css` | Shared styles for calculator (modes, forms, results, historial panel). |
| `manifest.json` | PWA metadata (app name, icons, colors). |

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
- **`fmt(n)`** in `ui.js` formats euros as `"1.234,56 €"` (Spanish locale). Use it for all monetary display.
- The historial stores one object per calculation and caps the daily array at 50 entries.

## Authentication & Security

- **Firebase project**: `transporte-99482` (configured in `index.html` and `Dashboard.html`).
- **Login flow**: `login.html` → verify in Firestore `authorized_users` collection → `splash.html` (loading) → `index.html` (calculator).
- **Dashboard access**: Same auth guard as calculator; `Dashboard.html` includes an embedded module script that checks `authorized_users` before showing content.
- **Session persistence**: Firebase SDK maintains session across page reloads via browser cookies/indexedDB.
- **Logout**: Button in header calls `signOutUser()`, clears session, redirects to `login.html`.

## Dashboard Integration

**Data Flow:**
- Calculator (`index.html`) saves each computation to `localStorage` key `transportes_historial` (daily-keyed object).
- Dashboard (`Dashboard.html`) reads the same key on load and via `storage` event listener (cross-tab updates).
- Dashboard transforms flat historial entries into a normalized format for charting (KPIs, line charts, donut breakdowns, filterable table).

**Live Sync:**
- If a user calculates in one browser tab and switches to Dashboard in another, the Dashboard auto-refreshes when the calculator writes to `localStorage`.
- The `storage` event listener in Dashboard's component `componentDidMount()` triggers a state update and re-renders charts.

**Chart Libraries:**
- Embedded via unpkg CDN (no npm): React 18.3.1, ReactDOM 18.3.1, Chart.js 4, Babel (for JSX transpilation).
- DC Runtime (`cde523f8-...` in manifest) handles React mounting and component lifecycle.

**Offline Mode:**
- Dashboard is cached by Service Worker (cache-first strategy).
- If the user is offline, the Dashboard shows cached version with last-synced history from `localStorage`.
- Firebase requests fail gracefully (no new auth checks), but cached data is still visible.
