/**
 * Unit tests for the core pricing functions.
 * Run: node --test tests/pricing.test.mjs
 *
 * Strategy: concatenate data.js + ui.js + cajas.js into a single vm script
 * so that `const` bindings declared in data.js (CONFIG, PW_TARIFA, etc.) are
 * in the same lexical scope as functions in the other two files — which is
 * exactly how the browser sees them when all three are loaded as <script> tags.
 * The final line `this._data = {...}` exposes the data constants to this test
 * file through the vm context object (the only way to read `const` bindings
 * from outside a vm script).
 */
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const ctx = createContext({});
const src =
  ['data.js', 'ui.js', 'cajas.js']
    .map(f => readFileSync(resolve(root, f), 'utf8'))
    .join('\n') +
  // Expose const bindings (invisible outside the script) via ctx object
  '\nthis._data = { CONFIG, PW_TARIFA, CEVA_TARIFA, CEVA_PRT, PRT_KG_BREAKS };';

runInContext(src, ctx, { filename: 'pricing-bundle' });

const { CONFIG, PW_TARIFA, CEVA_TARIFA, CEVA_PRT, PRT_KG_BREAKS } = ctx._data;
const { calcPalletways, calcCeva, calcCevaByKg, calcCevaPrt, getPwZonaPrt } = ctx;

// ── helpers ──────────────────────────────────────────────────────────────────

function near(a, b, msg = '') {
  assert.ok(Math.abs(a - b) < 0.001, `${msg} got ${a}, expected ${b}`);
}

// ── calcPalletways ────────────────────────────────────────────────────────────

describe('calcPalletways', () => {
  // PW_TARIFA[1] = { A: 34.33, B: 28.00, C: 38.00 }
  // CONFIG.PW_PORTE_PCT = 0.047

  test('devuelve null para una zona que no existe', () => {
    assert.equal(calcPalletways(2, 2.0, 99), null);
  });

  test('2 palés, 2.0 m → 1 postura exacta, sin suelto', () => {
    // pairs=1, leftover=0 → subtotal = 1×C = 38.00, total = 38.00×1.047
    const res = calcPalletways(2, 2.0, 1);
    assert.ok(res);
    assert.equal(res.totalSEL, 1);
    assert.equal(res.extra, null);
    near(res.total, PW_TARIFA[1].C * (1 + CONFIG.PW_PORTE_PCT));
  });

  test('1 palé, 0.70 m → suelto mini quarter (≤80 cm)', () => {
    // pairs=0, leftover=0.70 ≤ 0.80 → tipo A
    const res = calcPalletways(1, 0.70, 1);
    assert.ok(res);
    assert.equal(res.totalSEL, 0);
    assert.equal(res.extra?.tipo, 'Mini Quarter (≤80cm)');
    near(res.total, PW_TARIFA[1].A * (1 + CONFIG.PW_PORTE_PCT));
  });

  test('3 palés, 2.90 m → 1 postura + suelto quarter (0.80 < 0.90 ≤ 1.10)', () => {
    // pairs=1, leftover=0.90 → tipo B
    const res = calcPalletways(3, 2.90, 1);
    assert.ok(res);
    assert.equal(res.totalSEL, 1);
    assert.equal(res.extra?.tipo, 'Quarter (≤110cm)');
    near(res.total, (PW_TARIFA[1].C + PW_TARIFA[1].B) * (1 + CONFIG.PW_PORTE_PCT));
  });

  test('3 palés, 3.50 m → 2 posturas (leftover 1.50 > 1.10 → extra postura)', () => {
    // pairs=1, leftover=1.50 > 1.10 → totalSEL becomes 2, no extra
    const res = calcPalletways(3, 3.50, 1);
    assert.ok(res);
    assert.equal(res.totalSEL, 2);
    assert.equal(res.extra, null);
    near(res.total, 2 * PW_TARIFA[1].C * (1 + CONFIG.PW_PORTE_PCT));
  });

  test('zona 9 (alta): resultado numérico correcto', () => {
    // PW_TARIFA[9] = { A: 75.86, B: 93.73, C: 111.97 }
    // 4 palés, 4.0 m → 2 posturas exactas
    const res = calcPalletways(4, 4.0, 9);
    assert.ok(res);
    near(res.total, 2 * PW_TARIFA[9].C * (1 + CONFIG.PW_PORTE_PCT));
  });

  test('recargo de porte se calcula sobre el subtotal', () => {
    const res = calcPalletways(2, 2.0, 1);
    near(res.porte, res.subtotal * CONFIG.PW_PORTE_PCT);
    near(res.total, res.subtotal + res.porte);
  });
});

// ── calcCeva (España, palés) ──────────────────────────────────────────────────

describe('calcCeva', () => {
  // CEVA_TARIFA['MADRID'] = [4.60,5.43,6.18,6.95,7.85,8.74,9.47,10.19,11.14,12.42, 0.107,0.088,0.065,0.062]
  // CONFIG.CEVA_RECARGO_PCT = 0.107

  test('devuelve null para una provincia desconocida', () => {
    assert.equal(calcCeva(1, 1.0, 'NARNIA'), null);
  });

  test('MADRID, peso ≤10 kg → tarifa fija (índice 0)', () => {
    // 1 palé, 0.04 m → round(0.04×250)=10 kg → índice 0 (≤10 kg) → precio fijo
    const res = calcCeva(1, 0.04, 'MADRID');
    assert.ok(res);
    assert.equal(res.totalKg, 10);
    const base = CEVA_TARIFA['MADRID'][0]; // 4.60
    near(res.basePrice, base);
    near(res.total, base * (1 + CONFIG.CEVA_RECARGO_PCT));
  });

  test('MADRID, 1 palé, 1.0 m → 250 kg → tarifa por kg (rango 101–500)', () => {
    const res = calcCeva(1, 1.0, 'MADRID');
    assert.ok(res);
    assert.equal(res.totalKg, 250);
    const base = 250 * CEVA_TARIFA['MADRID'][10]; // 0.107 €/kg
    near(res.basePrice, base);
    near(res.total, base * (1 + CONFIG.CEVA_RECARGO_PCT));
  });

  test('el recargo se aplica sobre el precio base', () => {
    const res = calcCeva(1, 1.0, 'BARCELONA');
    near(res.surcharge, res.basePrice * CONFIG.CEVA_RECARGO_PCT);
    near(res.total, res.basePrice + res.surcharge);
  });

  test('BARCELONA y MADRID coinciden para mismo peso (ambos en el mismo rango por kg)', () => {
    // Verifica que se usan las tarifas de cada provincia, no una genérica
    const bcn = calcCeva(1, 1.0, 'BARCELONA');
    const mad = calcCeva(1, 1.0, 'MADRID');
    assert.notEqual(bcn.total, mad.total);
  });
});

// ── calcCevaByKg (modo cajas) ─────────────────────────────────────────────────

describe('calcCevaByKg', () => {
  // CEVA_TARIFA['BARCELONA'] = [5.28,6.56,7.76,8.99,10.34,..., 0.149,0.128,0.103,0.100]
  // KG_BREAKS = [10,20,30,40,50,60,70,80,90,100]

  test('devuelve null para una provincia desconocida', () => {
    assert.equal(calcCevaByKg('NARNIA', 37.5), null);
  });

  test('BARCELONA, 37.5 kg → precio fijo (bracket ≤40, índice 3)', () => {
    // 37.5 ≤ 40 → KG_BREAKS.findIndex(b => 37.5 <= b) = 3 → tarifa[3] = 8.99
    const res = calcCevaByKg('BARCELONA', 37.5);
    assert.ok(res);
    const base = CEVA_TARIFA['BARCELONA'][3]; // 8.99
    near(res.basePrice, base);
    near(res.total, base * (1 + CONFIG.CEVA_RECARGO_PCT));
  });

  test('BARCELONA, 150 kg → tarifa por kg (rango 101–500, índice 10)', () => {
    // 150 > 100 → tarifa[10] = 0.149
    const res = calcCevaByKg('BARCELONA', 150);
    assert.ok(res);
    const base = 150 * CEVA_TARIFA['BARCELONA'][10]; // 0.149 €/kg
    near(res.basePrice, base);
    near(res.total, base * (1 + CONFIG.CEVA_RECARGO_PCT));
  });

  test('MADRID, peso exactamente en límite de bracket (100 kg)', () => {
    // 100 kg ≤ 100 → findIndex = 9 → tarifa[9] = 12.42
    const res = calcCevaByKg('MADRID', 100);
    assert.ok(res);
    const base = CEVA_TARIFA['MADRID'][9]; // 12.42
    near(res.basePrice, base);
  });

  test('el recargo se aplica sobre el precio base', () => {
    const res = calcCevaByKg('MADRID', 50);
    near(res.surcharge, res.basePrice * CONFIG.CEVA_RECARGO_PCT);
    near(res.total, res.basePrice + res.surcharge);
  });
});

// ── calcCevaPrt (Portugal) ────────────────────────────────────────────────────

describe('calcCevaPrt', () => {
  // CEVA_PRT[11] = [21.2,21.82,24.13,27.2,29.5,32.74,34.78,36.78,38.95,42.17,
  //                 30.6,27.75,26.75,24.04,20.51,19.81,18.03,17.55]
  // PRT_KG_BREAKS = [10,20,24,30,40,50,60,70,80,90,100,200,300,400,500,1000,1500,2000]

  test('devuelve null para un CP desconocido (prefijo 99)', () => {
    assert.equal(calcCevaPrt(1, 1.0, '9900000'), null);
  });

  test('CP 1100000, 10 kg (≤10) → precio fijo (índice 0)', () => {
    // round(0.04×250)=10, findIndex(b => 10<=b)=0, kgBreak=10 ≤ 100 → fijo
    const res = calcCevaPrt(1, 0.04, '1100000');
    assert.ok(res);
    assert.equal(res.totalKg, 10);
    assert.equal(res.cp2, 11);
    const base = CEVA_PRT[11][0]; // 21.2
    near(res.basePrice, base);
    near(res.total, base * (1 + CONFIG.CEVA_RECARGO_PCT));
  });

  test('CP 1100000, 250 kg → tarifa por kg (índice 12, bracket 300)', () => {
    // round(1.0×250)=250, findIndex(b => 250<=b)=12 (b=300), kgBreak=300 > 100
    // basePrice = 250 × (tableVal/100) = 250 × (26.75/100)
    const res = calcCevaPrt(1, 1.0, '1100000');
    assert.ok(res);
    assert.equal(res.totalKg, 250);
    const tableVal = CEVA_PRT[11][12]; // 26.75
    near(res.basePrice, 250 * (tableVal / 100));
    near(res.total, res.basePrice * (1 + CONFIG.CEVA_RECARGO_PCT));
  });

  test('el recargo se aplica sobre el precio base', () => {
    const res = calcCevaPrt(2, 1.5, '2600000');
    near(res.surcharge, res.basePrice * CONFIG.CEVA_RECARGO_PCT);
    near(res.total, res.basePrice + res.surcharge);
  });
});

// ── getPwZonaPrt ──────────────────────────────────────────────────────────────

describe('getPwZonaPrt', () => {
  test('CP con prefijo 11 (10–19) → zona 7', () => {
    assert.equal(getPwZonaPrt('11'), 7);
  });

  test('CP con prefijo 26 (26–29) → zona 7', () => {
    assert.equal(getPwZonaPrt('26'), 7);
  });

  test('CP con prefijo 51 → zona 8 (por defecto)', () => {
    assert.equal(getPwZonaPrt('51'), 8);
  });

  test('CP 38 sin 4 dígitos → zona 8 (ambiguo, avisa en UI)', () => {
    assert.equal(getPwZonaPrt('38'), 8);
  });

  test('CP 3865 (3860–3899) → zona 7', () => {
    assert.equal(getPwZonaPrt('3865'), 7);
  });
});
