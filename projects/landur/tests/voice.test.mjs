// El dictado de una factura completa se prueba sobre la función pura, sin navegador.
// Lo que se verifica es que reconozca bien y, sobre todo, que no invente un importe
// cuando no lo entiende: un número mal escuchado es un error contable.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSpokenInvoice, wordsToNumber, digitsToCents, fold } from '../public/voice.mjs';

const today = '2026-10-27';
const say = (text, options = {}) => parseSpokenInvoice(text, { today, ...options });

test('una factura dictada completa llena tipo, concepto, importe, moneda y fecha', () => {
  const result = say('factura de proveedor de materiales por 4.200 pesos del 24 de octubre');
  assert.equal(result.ok, true);
  assert.equal(result.kind, 'expense');
  assert.equal(result.concept, 'Proveedor de materiales');
  assert.equal(result.amountText, '4200.00');
  assert.equal(result.cents, 420000);
  assert.equal(result.currency, 'UYU');
  assert.equal(result.date, '2026-10-24');
  assert.deepEqual(result.warnings, []);
});

test('el concepto conserva las tildes del dictado y no arrastra fecha ni importe', () => {
  const result = say('gasté 980,50 pesos en envíos del 3 de octubre');
  assert.equal(result.concept, 'Envíos');
  assert.equal(result.amountText, '980.50');
  assert.equal(result.date, '2026-10-03');
  for (const leaked of ['980', 'octubre', '3 de'])
    assert.ok(!result.concept.includes(leaked), `el concepto no debe contener "${leaked}"`);
});

test('los conectores internos del nombre se conservan, los de los extremos no', () => {
  assert.equal(say('cargá una deuda con el proveedor de embalaje por 3.400 pesos').concept, 'Proveedor de embalaje');
  assert.equal(say('pagué 1.250 pesos de publicidad hoy').concept, 'Publicidad');
  assert.equal(say('eh, bueno, dos mil pesos de flete').concept, 'Flete');
});

test('importes dichos con palabras', () => {
  assert.equal(say('anotá un gasto de mil doscientos pesos de ayer').amountText, '1200.00');
  assert.equal(say('vendí dos mil quinientos pesos de iluminación').amountText, '2500.00');
  assert.equal(say('registrá el alquiler por un millón doscientos mil pesos').amountText, '1200000.00');
  assert.equal(wordsToNumber(['mil']), 1000);
  assert.equal(wordsToNumber(['cien', 'mil']), 100000);
  assert.equal(wordsToNumber(['veinticinco']), 25);
  assert.equal(wordsToNumber(['dos', 'mil', 'quinientos']), 2500);
  assert.equal(wordsToNumber(['mil', 'pesos']), null, 'una palabra que no es número corta la corrida');
});

test('la cifra suelta no se corta por el separador de miles', () => {
  // Regresión: "12.500" se leía como "12" y guardaba 12,00.
  assert.equal(say('12.500').amountText, '12500.00');
  assert.equal(say('gasté 12.5 en fletes').amountText, '12.50');
  assert.equal(digitsToCents('1.234,56'), 123456);
  assert.equal(digitsToCents('12.500'), 1250000);
  assert.equal(digitsToCents('0,005'), null, 'más de dos decimales no es un importe');
  assert.equal(digitsToCents('1e3'), null);
  assert.equal(digitsToCents(''), null);
});

test('la moneda hablada manda y la del formulario solo se usa si no se dijo', () => {
  assert.equal(say('pagué 250 dólares de hosting').currency, 'USD');
  assert.equal(say('gasto de 3.200 reales del 05/10').currency, 'BRL');
  assert.equal(say('compré insumos por $ 12.500').currency, '', 'sin moneda hablada no se inventa una');
  assert.equal(say('pagué 100 de flete', { currency: 'BRL' }).currency, 'BRL');
});

test('fechas relativas, largas, cortas y con año', () => {
  assert.equal(say('pagué 100 pesos hoy').date, '2026-10-27');
  assert.equal(say('pagué 100 pesos ayer').date, '2026-10-26');
  assert.equal(say('pagué 100 pesos anteayer').date, '2026-10-25');
  assert.equal(say('pagué 100 pesos del 05/10').date, '2026-10-05');
  assert.equal(say('pagué 100 pesos del 24 de octubre de 2025').date, '2025-10-24');
  // Sin año, una fecha a más de un mes vista se interpreta como del año anterior.
  assert.equal(parseSpokenInvoice('factura del 24 de diciembre', { today: '2026-01-05' }).date, '2025-12-24');
  // Una fecha imposible no se acepta.
  assert.equal(say('pagué 100 pesos del 31 de febrero').date, null);
});

test('el vencimiento no reemplaza a la fecha de la operación', () => {
  const result = say('cargá una deuda con el proveedor de embalaje por 3.400 pesos del 24 de octubre que vence el 30 de octubre');
  assert.equal(result.kind, 'obligation');
  assert.equal(result.date, '2026-10-24');
  assert.equal(result.due, '2026-10-30');
  assert.equal(result.amountText, '3400.00');
});

test('nunca inventa un importe: sin cifra, el campo queda vacío y se avisa', () => {
  const result = say('factura de proveedor sin importe');
  assert.equal(result.cents, null);
  assert.equal(result.amountText, '');
  assert.equal(result.understood.amount, false);
  assert.ok(result.warnings.some(w => /importe/i.test(w)));
});

test('sin concepto reconocible también se avisa en vez de dejar un texto vacío', () => {
  const result = say('gasto de 3.200 pesos del 05/10');
  assert.equal(result.concept, '');
  assert.equal(result.understood.concept, false);
  assert.ok(result.warnings.some(w => /concepto/i.test(w)));
});

test('un dictado vacío no produce un formulario a medio llenar', () => {
  const result = say('   ');
  assert.equal(result.ok, false);
  assert.equal(result.cents, undefined);
  assert.ok(result.warnings.length);
});

test('el tipo de registro solo se propone cuando el dictado lo dice', () => {
  assert.equal(say('vendí dos mil quinientos pesos de iluminación').kind, 'sale');
  assert.equal(say('quedé debiendo 500 pesos de flete').kind, 'obligation');
  assert.equal(say('pagué 500 pesos de flete').kind, 'expense');
  assert.equal(say('registrá 500 pesos de flete').kind, null, 'registrar no define el tipo');
});

test('fold pliega sin cambiar la longitud, para poder recortar el original', () => {
  for (const text of ['Iluminación en envíos', 'Añil Ñandú', 'factura Nº 3', 'ñandú y más', '']) {
    assert.equal(fold(text).length, text.length, text);
  }
  assert.equal(fold('Iluminación'), 'iluminacion');
  assert.equal(fold('AÑO 2026'), 'ano 2026');
});
