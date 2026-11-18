// El dictado de una factura completa se prueba sobre la función pura, sin navegador.
// Lo que se verifica es que reconozca bien y, sobre todo, que no invente un importe
// cuando no lo entiende: un número mal escuchado es un error contable.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSpokenInvoice, wordsToNumber, digitsToCents, fold, amountFromText } from '../public/voice.mjs';

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

test('las cifras enormes se leen por su escala: mil millones no es mil más un millón', () => {
  assert.equal(wordsToNumber(['mil', 'millones']), 1000000000);
  assert.equal(wordsToNumber(['dos', 'mil', 'millones']), 2000000000);
  assert.equal(wordsToNumber(['mil', 'quinientos', 'millones']), 1500000000);
  assert.equal(wordsToNumber(['veinte', 'mil', 'millones']), 20000000000);
  assert.equal(wordsToNumber(['un', 'billon']), 1000000000000);
  assert.equal(wordsToNumber(['un', 'millon', 'doscientos', 'mil']), 1200000);
  assert.equal(wordsToNumber(['noventa', 'y', 'nueve', 'mil']), 99000, 'la «y» no corta la cifra');
  assert.equal(say('pagué dos mil millones de pesos de la planta').amountText, '2000000000.00');
  assert.equal(say('pagué mil quinientos millones').amountText, '1500000000.00');
  assert.equal(say('pagué noventa y nueve mil pesos de flete').amountText, '99000.00');
  assert.equal(say('registré un billón de pesos').amountText, '1000000000000.00');
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

test('el vencimiento solo consume su fecha: un importe dicho después se conserva', () => {
  for (const frase of [
    'deuda con el proveedor de embalaje vence el 30 de octubre por 3.400 pesos',
    'deuda con el proveedor de embalaje vence el 30 de octubre por tres mil cuatrocientos pesos',
    'deuda con el proveedor de embalaje vence el 30 de octubre 3 mil 400 pesos'
  ]) {
    const result = say(frase);
    assert.equal(result.due, '2026-10-30', frase);
    assert.equal(result.amountText, '3400.00', frase);
    assert.equal(result.concept, 'Proveedor de embalaje', frase);
  }
  // Si la fecha del vencimiento no se entiende, se avisa pero no se traga el importe.
  const sinFecha = say('deuda con el proveedor de embalaje vence pronto por 3.400 pesos');
  assert.equal(sinFecha.due, null);
  assert.equal(sinFecha.amountText, '3400.00');
  assert.ok(sinFecha.warnings.some(w => /vencimiento/.test(w)));
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

test('una cifra seguida de «mil» o «millón» se lee completa: «80 mil» son 80.000, no 80 ni 1.000', () => {
  // iOS y Android dictan a menudo mezclando dígitos y escala. Quedarse con el 80 (o con el
  // «mil» suelto) guarda un importe equivocado sin avisar.
  const cases = [
    ['80 mil pesos en comida', '80000.00'],
    ['gasté 80 mil en publicidad', '80000.00'],
    ['pagué por 80 mil el alquiler', '80000.00'],
    ['$ 80 mil de envíos', '80000.00'],
    ['80 mil quinientos pesos de luz', '80500.00'],
    ['compré filamento por 2 mil 500', '2500.00'],
    ['1 millón 200 mil pesos de alquiler', '1200000.00'],
    ['3 millones de capital', '3000000.00']
  ];
  for (const [said, amount] of cases) {
    const result = say(said);
    assert.equal(result.amountText, amount, said);
    assert.equal(result.warnings.includes('No reconocí un importe. Escribilo a mano: es el dato que más cuidado necesita.'), false, said);
  }
  assert.equal(say('80 mil pesos en comida').concept, 'Comida');
});

test('un dígito suelto cerca de «mil» no se pega al importe de otra cosa', () => {
  // «2 rollos» no es la cola de «80 mil»: solo se suman grupos de tres dígitos tras la escala.
  assert.equal(say('80 mil pesos por 2 rollos de filamento').amountText, '80000.00');
  assert.equal(say('3 rollos de filamento por 1500 pesos').amountText, '1500.00');
});

test('una cifra con decimales y escala («1,5 millones», «2,5 mil») se lee completa', () => {
  assert.equal(say('1,5 millones de capital').amountText, '1500000.00');
  assert.equal(say('2,5 mil pesos de nafta').amountText, '2500.00');
  assert.equal(say('2,5 mil pesos de nafta').concept, 'Nafta');
});

test('una cifra con coma de miles se lee completa: «100,000» son 100.000 y no 100', () => {
  // El dictado del iPhone escribe la coma de miles y se leía como decimal: «100,000» quedaba
  // en 100,00 sin avisar. El espacio de miles se reconoce con coma o con punto.
  const cases = [
    ['pagué 100,000 pesos de flete', '100000.00'],
    ['pagué 100,000 de flete', '100000.00'],
    ['pagué 180,000 pesos', '180000.00'],
    ['pagué 250,000 pesos de alquiler', '250000.00'],
    ['pagué 1,000,000 pesos de la planta', '1000000.00'],
    ['pagué 1.000,00 pesos', '1000.00'],
    ['pagué 12,5 pesos', '12.50']
  ];
  for (const [said, amount] of cases) assert.equal(say(said).amountText, amount, said);
  assert.equal(digitsToCents('100,000'), 10000000);
  assert.equal(digitsToCents('1,000,000'), 100000000);
  assert.equal(digitsToCents('12,5'), 1250, 'la coma decimal se conserva');
  assert.equal(digitsToCents('100,00'), 10000);
});

test('cualquier cifra hasta un millón se lee completa, con dígitos o con palabras', () => {
  const cases = [
    ['pagué 150 mil pesos', '150000.00'],
    ['pagué 150,000 pesos', '150000.00'],
    ['pagué doscientos cincuenta mil pesos', '250000.00'],
    ['pagué quinientos mil pesos', '500000.00'],
    ['pagué setecientos veinticinco mil pesos', '725000.00'],
    ['pagué novecientos noventa y nueve mil pesos', '999000.00'],
    ['pagué 999.999 pesos', '999999.00'],
    ['pagué un millón de pesos', '1000000.00'],
    ['pagué 1.000.000 pesos', '1000000.00'],
    ['pagué 100mil pesos', '100000.00'],
    ['pagué 250mil pesos', '250000.00']
  ];
  for (const [said, amount] of cases) assert.equal(say(said).amountText, amount, said);
});

test('un importe que entra al campo como texto («25 mil») se interpreta completo', () => {
  // El dictado del sistema escribe la frase dentro del campo de importe, y ahí se descartaba
  // todo lo que no fueran dígitos: «25 mil» quedaba en 25. Ahora usa las mismas reglas.
  const cases = [
    ['25 mil', '25000.00'],
    ['100 mil', '100000.00'],
    ['150 mil', '150000.00'],
    ['veinticinco mil', '25000.00'],
    ['ciento cincuenta mil', '150000.00'],
    ['1,5 millones', '1500000.00'],
    ['60,000', '60000.00'],
    ['1.800', '1800.00'],
    ['3500', '3500.00'],
    ['25,50', '25.50'],
    ['$ 150 mil', '150000.00']
  ];
  for (const [said, amount] of cases) assert.equal(amountFromText(said), amount, said);
  assert.equal(amountFromText('sin importe'), '');
  assert.equal(amountFromText('0'), '');
});

test('si el campo traía un valor viejo, vale la última cifra dictada y nunca una mezcla', () => {
  // Regresión: «20500.0025 mil» (un valor previo pegado a lo dictado) terminaba en 20.500 porque
  // se descartaban las letras y se guardaba el número que quedaba. Con texto manda el intérprete.
  assert.equal(amountFromText('20500.00 25 mil'), '25000.00');
  assert.equal(amountFromText('20500.0025 mil'), '');
  assert.equal(amountFromText('20 mil 500'), '20500.00', 'una sola frase con escala suma sus partes');
  assert.equal(amountFromText('3500 25 mil'), '25000.00');
});

test('la coma dicha como palabra separa los decimales y no parte el importe', () => {
  // Regresión (audio del 17/11): «3.143 coma 70» guardaba 70 y dejaba «3.143 coma» en el concepto.
  const cases = [
    ['compré papelería 3.143 coma 70', '3143.70'],
    ['compré papelería 3143 coma 70', '3143.70'],
    ['papelería 3.143 coma 70 pesos', '3143.70'],
    ['papelería $3.143 coma 70', '3143.70'],
    ['papelería 3.143 coma setenta', '3143.70'],
    ['papelería tres mil ciento cuarenta y tres coma setenta', '3143.70'],
    ['papelería 3 mil 143 coma 70', '3143.70'],
    ['papelería 12 coma 5', '12.50'],
    ['papelería doce coma cinco', '12.50'],
    ['papelería 12 coma 05', '12.05'],
    ['papelería doce coma cero cinco', '12.05'],
    ['papelería 980 coma setenta y cinco', '980.75']
  ];
  for (const [said, amount] of cases) {
    const result = say(said);
    assert.equal(result.amountText, amount, said);
    assert.equal(result.concept, 'Papelería', `concepto de «${said}»`);
    assert.equal(amountFromText(said.replace(/^(compré )?papelería /, '')), amount, `campo: ${said}`);
  }
});

test('una coma que no está entre una cifra y sus decimales no inventa importe', () => {
  assert.equal(amountFromText('coma 70'), '70.00', 'sin parte entera queda la cifra suelta, como antes');
  // Tres decimales no son centavos: antes se guardaba 123 descartando 3.143. Mejor vacío y aviso.
  const odd = say('papelería 3.143 coma 123');
  assert.equal(odd.amountText, '');
  assert.ok(odd.warnings.some(w => w.includes('importe')));
  assert.equal(amountFromText('3.143 coma 123'), '');
  assert.equal(amountFromText('doce coma ciento veinte'), '');
  assert.equal(amountFromText('0 coma 0'), '');
});

test('una muletilla dentro de la cifra no la corta', () => {
  const papeleria = say('eh compré papelería tres mil eh ciento cuarenta y tres pesos');
  assert.equal(papeleria.amountText, '3143.00');
  assert.equal(papeleria.concept, 'Papelería');
  const nafta = say('pagué eeeh 500 pesos de nafta');
  assert.equal(nafta.amountText, '500.00');
  assert.equal(nafta.concept, 'Nafta');
  assert.equal(amountFromText('tres mil mmm quinientos'), '3500.00');
});

test('«con» entre cifras son los decimales', () => {
  const dicho = say('pagué quinientos con cincuenta pesos de nafta');
  assert.equal(dicho.amountText, '500.50');
  assert.equal(dicho.concept, 'Nafta');
  const cifras = say('pagué 500 con 50 de nafta');
  assert.equal(cifras.amountText, '500.50');
  assert.equal(cifras.concept, 'Nafta');
  const centesimos = say('pagué 500 pesos con 50 centésimos de nafta');
  assert.equal(centesimos.amountText, '500.50');
  assert.equal(centesimos.concept, 'Nafta');
  // «con» que no está entre dos números es parte de la frase, no decimales.
  const deuda = say('cargá una deuda con el proveedor de embalaje por 3.400 pesos');
  assert.equal(deuda.amountText, '3400.00');
  assert.equal(deuda.concept, 'Proveedor de embalaje');
  assert.equal(amountFromText('500 con 50'), '500.50');
});

test('dos importes distintos dejan el importe vacío y avisan', () => {
  const dosImportes = [
    'pagué 1.500 pesos y 300 pesos de luz',
    'pagué 2 coma 5 y 3 coma 10 de papelería',
    'pagué 1 coma 5 coma 6 de papelería',
    'pagué 3.143,00 coma 70 de papelería',
    'pagué 1.234,56 coma 7 de papelería',
    'papelería 3 143 coma 70'
  ];
  for (const said of dosImportes) {
    const result = say(said);
    assert.equal(result.amountText, '', said);
    assert.equal(result.cents, null, said);
    assert.ok(result.warnings.some(w => w.includes('importe')), `aviso de «${said}»`);
  }
  const primero = say(dosImportes[0]);
  assert.ok(primero.warnings.some(w => w.includes('más de un importe')));
});

test('una cifra con moneda gana sobre cantidades sueltas', () => {
  assert.equal(say('80 mil pesos por 2 rollos de filamento').amountText, '80000.00');
  assert.equal(say('compré 12 cajas por 3.000 pesos').amountText, '3000.00');
  assert.equal(say('3 rollos de filamento por 1500 pesos').amountText, '1500.00');
});

test('una corrección dicha vale la última cifra y no ensucia el concepto', () => {
  const correcciones = [
    'compré papelería 3.143 perdón 3.144 pesos',
    'compré papelería 3.143 digo 3.144',
    'compré papelería 3.143 no 3.144',
    'compré papelería 3.143 mejor dicho 3.144'
  ];
  for (const said of correcciones) {
    const result = say(said);
    assert.equal(result.amountText, '3144.00', said);
    assert.equal(result.concept, 'Papelería', `concepto de «${said}»`);
    assert.ok(!result.warnings.some(w => w.includes('más de un importe')), `sin aviso de dos importes en «${said}»`);
  }
});

test('un importe aproximado se toma y se avisa', () => {
  const tipo = say('a ver pagué tipo 500 pesos de nafta');
  assert.equal(tipo.amountText, '500.00');
  assert.equal(tipo.concept, 'Nafta');
  assert.ok(tipo.warnings.some(w => w.includes('aproximado')));

  const pico = say('pagué mil quinientos pesos y pico de luz');
  assert.equal(pico.amountText, '1500.00');
  assert.equal(pico.concept, 'Luz');
  assert.ok(pico.warnings.some(w => w.includes('aproximado')));

  const comoAlgo = say('pagué como 500 pesos de nafta o algo así');
  assert.equal(comoAlgo.amountText, '500.00');
  assert.equal(comoAlgo.concept, 'Nafta');
  assert.ok(comoAlgo.warnings.some(w => w.includes('aproximado')));

  const masMenos = say('pagué más o menos 800 pesos de nafta');
  assert.equal(masMenos.amountText, '800.00');
  assert.equal(masMenos.concept, 'Nafta');
  assert.ok(masMenos.warnings.some(w => w.includes('aproximado')));

  const exacto = say('pagué 500 pesos de nafta');
  assert.ok(!exacto.warnings.some(w => w.includes('aproximado')));
});

test('las muletillas no quedan en el concepto', () => {
  const casos = [
    ['o sea compré papelería por 500 pesos viste', 'Papelería', '500.00'],
    ['che anotá que pagué 800 de internet', 'Internet', '800.00'],
    ['este pagué el flete 500 pesos', 'Flete', '500.00'],
    ['mmm pagué la luz por 2.300 pesos', 'Luz', '2300.00'],
    ['pagué 500 pesos de nafta y nada', 'Nafta', '500.00'],
    ['pagué 500 pesos de nafta digamos', 'Nafta', '500.00'],
    ['pagué 500 pesos de nafta, ¿sabés?', 'Nafta', '500.00'],
    ['pagué 500 pesos de nafta no sé', 'Nafta', '500.00'],
    ['pagué 1500 pesos uruguayos de luz', 'Luz', '1500.00'],
    ['pagué 2300 pesos de UTE bueno', 'UTE', '2300.00'],
    ['bueno, anotame que gastamos 900 pesos en café, gracias', 'Café', '900.00']
  ];
  for (const [said, concept, amount] of casos) {
    const result = say(said);
    assert.equal(result.concept, concept, `concepto de «${said}»`);
    assert.equal(result.amountText, amount, `importe de «${said}»`);
  }
});

test('las palabras que parecen muletillas en el medio del nombre se conservan', () => {
  const result = say('gasto de este mes 500 pesos');
  assert.equal(result.concept, 'Este mes');
  assert.equal(result.amountText, '500.00');
});

test('el campo de importe mantiene la última cifra dictada', () => {
  assert.equal(amountFromText('20500.00 25 mil'), '25000.00');
});

test('la revisión final: corrección lejos del marcador, nombres con «mira» y moneda en medio del concepto', () => {
  // Corrección: solo salen el importe corregido y el marcador; el concepto se conserva.
  const corregido = say('pagué 500 pesos de nafta no 300');
  assert.equal(corregido.amountText, '300.00');
  assert.equal(corregido.concept, 'Nafta');
  // «mira» es muletilla al principio, no dentro de un nombre propio.
  assert.equal(say('pagué 500 pesos a Mira Digital').concept, 'Mira Digital');
  assert.equal(say('mirá, pagué 500 pesos de nafta').concept, 'Nafta');
  // La palabra de moneda sale junto con su cifra aunque quede en medio de la frase.
  assert.equal(say('vendí a unos clientes 2.000 pesos de remeras').concept, 'Clientes de remeras');
  assert.equal(say('vendí a unos clientes 2.000 pesos uruguayos de remeras').concept, 'Clientes de remeras');
});

test('las marcas con palabras de muletilla no se truncan', () => {
  // El artículo del borde se recorta como siempre («la luz» → «Luz»); lo que no se pierde es el nombre.
  assert.equal(say('gasto de La Nada Bar por 620 pesos').concept, 'Nada Bar');
  assert.equal(say('bueno pagué la Nada 500 pesos').concept, 'Nada');
  assert.equal(say('Mira Digital 4500 pesos').concept, 'Mira Digital');
  assert.equal(say('Mirá Digital 4500 pesos').concept, 'Mirá Digital');
  assert.equal(say('mirá pagué 500 pesos de nafta').concept, 'Nafta');
  assert.equal(say('pagué 500 pesos de nafta y nada').concept, 'Nafta');
  assert.equal(say('pagué 500 pesos de nafta, nada más').concept, 'Nafta');
});

test('revisión adversarial: centavos con «y», porcentajes, total y segundo importe', () => {
  // «pesos y 89 centavos»: los centavos dichos con su palabra valen tal cual.
  assert.equal(say('pagué 4.567 pesos y 89 centavos de luz').amountText, '4567.89');
  assert.equal(say('pagué 4.567 pesos y 89 centavos de luz').concept, 'Luz');
  assert.equal(say('pagué 500 pesos con 5 centésimos de nafta').amountText, '500.05');
  assert.equal(say('pagué 500 pesos con 50 centésimos de nafta').amountText, '500.50');
  assert.equal(say('pagué treinta y cinco pesos de pan').amountText, '35.00');
  // Lo que hay que calcular no se adivina.
  for (const said of ['me deben la mitad de 800 pesos', 'pagué el 15% de 800 pesos de comisión', 'pagué el 15 por ciento de 800 pesos']) {
    const result = say(said);
    assert.equal(result.amountText, '', said);
    assert.ok(result.warnings.some(w => w.includes('importe')), said);
  }
  // Dos importes: precio unitario y total, o dos gastos en la misma frase.
  for (const said of ['5 cajas a 300 pesos, total 1500', 'pagué 500 pesos, total 1.500', 'gasté 300 pesos de nafta y 200 de peaje',
    'pagué 500 pesos de hielo y 300 de carbón', 'pagué 60 200 pesos de luz', 'pagué 1 eh 500 pesos de luz']) {
    const result = say(said);
    assert.equal(result.amountText, '', said);
    assert.ok(result.warnings.some(w => w.includes('más de un importe')), said);
  }
  // Las cantidades sin «de» siguen sin competir con el importe.
  assert.equal(say('compré 12 cajas por 3.000 pesos').amountText, '3000.00');
  assert.equal(say('factura 1234 por 500 pesos de flete').amountText, '500.00');
  // Una negación al principio se avisa.
  assert.ok(say('no pagué 500 pesos de luz').warnings.some(w => w.includes('«no»')));
});

test('un precio por unidad se toma y se avisa que puede no ser el total', () => {
  for (const said of ['compré 10 lápices de 50 pesos', 'compré 5 cajas a 300 pesos', 'compré 5 cajas a 300 pesos cada una']) {
    const result = say(said);
    assert.ok(result.warnings.some(w => w.includes('por unidad')), said);
  }
  for (const said of ['compré 3 kilos de yerba por 450 pesos', 'gasté 80 pesos en 2 cafés', 'pagué 300 pesos de nafta'])
    assert.ok(!say(said).warnings.some(w => w.includes('por unidad')), said);
});
