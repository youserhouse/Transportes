# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A vanilla JS PWA (Progressive Web App) that compares shipping rates between two Spanish carriers — **Palletways** and **CEVA** — for pallets and boxes destined for Spain and Portugal. No build tools, no npm, no framework. Open `index.html` directly in a browser to run.

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
| `data.js` | **Single source of truth for all tariff tables and geographic maps.** Edit only this file to update prices or zones. |
| `state.js` | Global `state` object `{ prov, zona, country, cpPrt }`, country-switching UI, Portugal CP resolution logic. |
| `historial.js` | Daily history via `localStorage` (key `transportes_historial`), max 50 entries/day, UI panel. |
| `ui.js` | Province autocomplete, CP→province lookup, inline validation, `calcPalletways()`, `calcCeva()`, `renderPW()`, `renderCEVA()`. |
| `calcular.js` | Main `calcular()` entry point (España + Portugal pallets), CSV/XLS export helpers `downloadCSV` / `downloadXLS`. |
| `cajas.js` | Boxes mode: `setMode()`, `calcularCajas()`, separate `stateCajas` object, cajas-specific province search, cajas exports. |
| `sw.js` | Service Worker for offline PWA. Cache-first for local assets, cache-then-network for fonts. |

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
