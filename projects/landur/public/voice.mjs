// Interpreta el dictado de una factura completa y devuelve campos listos para
// completar el formulario. Es una función pura: no toca el DOM, no guarda nada y
// no inventa importes. Lo que no entiende queda vacío y se informa como advertencia,
// porque un importe mal escuchado es un error contable y no una errata.
//
// Cómo está hecho: el texto se "pliega" (sin tildes, en minúsculas) conservando la
// longitud exacta, de modo que cualquier recorte se aplica sobre los índices del
// original. Así el concepto final conserva las tildes y las mayúsculas del dictado.
//
// Límite conocido: "12.500" se lee como doce mil quinientos por la convención es-UY.
// Una cifra ambigua se muestra igual antes de guardar para que la persona la revise.

const MONTHS = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12
};

const SMALL = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17,
  dieciocho: 18, diecinueve: 19, veinte: 20, veintiuno: 21, veintidos: 22, veintitres: 23, veinticuatro: 24,
  veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30,
  cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
  cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500,
  seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900
};

const CURRENCIES = [
  { code: 'USD', re: /\b(dolares|dolar|usd)\b/ },
  { code: 'BRL', re: /\b(reales|brl)\b/ },
  { code: 'UYU', re: /\b(pesos|peso|uyu)\b/ }
];

const KIND_HINTS = [
  { kind: 'sale', re: /\b(vendi|vendo|venta|facture a|le facture)\b/ },
  { kind: 'obligation', re: /\b(debo|deuda|quede debiendo|queda debiendo|pendiente|a pagar|sin pagar)\b/ },
  { kind: 'expense', re: /\b(pague|compre|gasto|gaste|factura|recibo)\b/ }
];

// Palabras que no forman parte del concepto: verbos de registro, artículos,
// conectores, monedas, muletillas de cortesía y palabras propias del tipo de operación.
const STOPWORDS = new Set([
  'eh', 'em', 'bueno', 'ok', 'okay', 'dale', 'listo', 'gracias', 'pues', 'entonces', 'vale', 'bien',
  'registra', 'registrar', 'registrame', 'anota', 'anotar', 'anotame', 'carga', 'cargar', 'cargame',
  'agrega', 'agregar', 'agregame', 'pone', 'poner', 'poneme', 'pasame', 'ingresa', 'ingresar',
  'apunta', 'apuntar', 'apuntame', 'guarda', 'guardame',
  'pague', 'pago', 'pagos', 'pagamos', 'compre', 'compro', 'compramos', 'vendi', 'vendo', 'vendimos',
  'gaste', 'gasto', 'gastos', 'gastamos', 'abone', 'abonar', 'cobre', 'cobro', 'transferi', 'deposite',
  'debo', 'deuda', 'deudas', 'pendiente', 'factura', 'facturas',
  'recibo', 'comprobante', 'venta', 'ventas',
  'un', 'una', 'unos', 'unas', 'el', 'la', 'los', 'las', 'lo',
  'de', 'del', 'por', 'con', 'para', 'a', 'en', 'que', 'se', 'no', 'y', 'o',
  'pesos', 'peso', 'dolares', 'dolar', 'reales', 'uyu', 'usd', 'brl',
  'uruguayos', 'americanos', 'brasilenos', 'centesimos', 'centavos'
]);

const TOTAL_WORDS = new Set(['total', 'importe', 'monto']);
const CURRENCY_WORDS = new Set(['pesos', 'peso', 'dolares', 'dolar', 'reales', 'uyu', 'usd', 'brl']);
const CENTS_WORDS = new Set(['centesimos', 'centavos']);
// Palabras que anuncian el importe: «total 500», «por 3.000».
const AMOUNT_KEYWORDS = new Set(['total', 'importe', 'monto', 'por']);
// Muletillas que no son cifra ni concepto: una palabra («eh», «eeeh», «mmm», «hmm») o una frase.
const FILLER_TOKEN = /^(e+h*|e+m+|m+|a+h+|o+h+|u+h+|h+m+)$/;
const FILLER_PHRASE = /\b(?:o sea|a ver|como que|por ejemplo|digamos|viste|sabes|che)\b/g;
// Aproximaciones: «como» y «tipo» solo cuentan si van justo delante de la cifra.
const APPROX_BEFORE = [['como'], ['tipo'], ['mas', 'o', 'menos'], ['aprox'], ['aproximadamente'], ['unos'], ['unas']];
const APPROX_PHRASE = /\bo algo asi\b/g;

const PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

// Pliega sin cambiar la longitud: cada carácter se reemplaza por uno solo, así los
// índices del texto plegado siguen siendo válidos sobre el original.
export function fold(text) {
  const source = String(text ?? '');
  let out = '';
  for (const char of source) {
    const lower = char.toLowerCase();
    if (lower.length !== char.length) { out += char; continue; }
    if (char.charCodeAt(0) < 128) { out += lower; continue; }
    // Ojo: la base de "Ñ" en NFD es "N", así que también hay que pasarla a minúscula.
    const base = char.normalize('NFD');
    const plain = base ? base[0].toLowerCase() : '';
    out += plain.length === char.length && plain.charCodeAt(0) < 128 ? plain : lower;
  }
  return out;
}

// Escalas: "mil millones" no es mil más un millón, es mil veces un millón. Por eso
// cada escala absorbe los grupos de orden menor ya acumulados ("mil quinientos
// millones" = 1.500 millones) y "billon" entra como 10^12.
const SCALES = { mil: 1000, millon: 1000000, millones: 1000000, billon: 1000000000000, billones: 1000000000000 };

const bare = token => token.replace(PUNCTUATION, '');
const isNumberWord = token => Object.hasOwn(SMALL, token) || Object.hasOwn(SCALES, token);
// Conector que no cambia la cifra: "treinta y cinco mil" son 35.000, no 5.000.
const isConnector = token => token === 'y';

// Tope del servidor en unidades menores enteras (9.999.999.999.999,99). Una cifra
// mayor no se recorta ni se inventa: el campo queda vacío y se avisa.
export const MAX_CENTS = 999999999999999;

// Suma una corrida de palabras numéricas. Devuelve null si algún token no es un número.
export function wordsToNumber(tokens) {
  const groups = []; // [{ value, scale }], de mayor a menor
  let current = 0, seen = false;
  for (const token of tokens) {
    if (isConnector(token)) continue;
    if (/^\d+$/.test(token)) { current += Number(token); seen = true; continue; }
    if (Object.hasOwn(SMALL, token)) { current += SMALL[token]; seen = true; continue; }
    const scale = SCALES[token];
    if (scale === undefined) return null;
    seen = true;
    let value = current;
    while (groups.length && groups[groups.length - 1].scale < scale) {
      const lower = groups.pop();
      value += lower.value * lower.scale;
    }
    groups.push({ value: value || 1, scale });
    current = 0;
  }
  return seen ? groups.reduce((sum, group) => sum + group.value * group.scale, current) : null;
}

// Convención es-UY: el punto separa miles y la coma decimales.
export function digitsToCents(raw) {
  const text = String(raw ?? '').replace(/\s/g, '');
  if (!text) return null;
  let whole, fraction = '';
  // Espacios de miles: es-UY usa el punto («100.000»), pero el dictado y el teclado del iPhone
  // también escriben «100,000», y eso se leía como decimal: «100,000» quedaba en 100,00. Si todos
  // los grupos intermedios tienen tres dígitos, el separador es de miles; un tramo final de uno
  // o dos dígitos sigue siendo decimal («1.234,56» y «12,5» no cambian).
  const grouped = /^(\d{1,3})((?:[.,]\d{3})+)(?:[.,](\d{1,2}))?$/.exec(text);
  // «0,005» no es un espacio de miles: con la parte entera en cero el último tramo es decimal
  // y con tres dígitos no llega a ser un importe válido, así que se rechaza como antes.
  if (grouped && grouped[1] !== '0') {
    whole = grouped[1] + grouped[2].replace(/[.,]/g, ''); fraction = grouped[3] || '';
  } else if (/^\d+(?:,\d{1,2})?$/.test(text)) {
    [whole, fraction = ''] = text.split(',');
  } else if (/^\d+\.\d{1,2}$/.test(text)) {
    [whole, fraction = ''] = text.split('.');
  } else if (/^\d+$/.test(text)) {
    whole = text;
  } else return null;
  const cents = Number(whole) * 100 + Number((fraction.padEnd(2, '0') || '0'));
  return Number.isSafeInteger(cents) && cents > 0 && cents <= MAX_CENTS ? cents : null;
}

const iso = date => date.toISOString().slice(0, 10);
const shift = (today, days) => { const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return iso(d); };
const spanOf = match => ({ start: match.index, end: match.index + match[0].length });
const mask = (text, span) => span ? text.slice(0, span.start) + ' '.repeat(span.end - span.start) + text.slice(span.end) : text;

function tokenize(text) {
  const list = [];
  const re = /\S+/g;
  let match;
  while ((match = re.exec(text))) list.push({ value: match[0], start: match.index, end: match.index + match[0].length });
  return list;
}

// Acepta "el 24 de octubre", "24/10", "24-10-2026", "hoy", "ayer".
function findDate(text, today) {
  const relative = text.match(/\b(antes de ayer|anteayer|ayer|hoy)\b/);
  const long = text.match(/\b(?:el\s+)?(\d{1,2})\s+de\s+([a-z]+)(?:\s+de(?:l)?\s+(\d{4}))?\b/);
  const short = text.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/);
  // Una fecha explícita gana sobre una relativa.
  if (long && MONTHS[long[2]]) {
    const date = buildLong(long, today);
    if (date) return { date, span: spanOf(long) };
  }
  if (short) {
    const date = buildShort(short, today);
    if (date) return { date, span: spanOf(short) };
  }
  if (relative) return { date: buildRelative(relative[1], today), span: spanOf(relative) };
  return { date: null, span: null };
}

function buildLong(match, today) {
  const day = Number(match[1]), month = MONTHS[match[2]];
  const year = match[3] ? Number(match[3]) : inferYear(month, day, today);
  return validDate(year, month, day);
}
function buildShort(match, today) {
  const day = Number(match[1]), month = Number(match[2]);
  let year = match[3] ? Number(match[3]) : inferYear(month, day, today);
  if (year < 100) year += 2000;
  return validDate(year, month, day);
}
function buildRelative(word, today) {
  if (word === 'hoy') return today;
  return shift(today, word === 'ayer' ? -1 : -2);
}
// Sin año explícito, una fecha a más de un mes vista pertenece al año anterior.
function inferYear(month, day, today) {
  const current = new Date(today + 'T12:00:00Z');
  const year = current.getUTCFullYear();
  const candidate = Date.UTC(year, month - 1, day);
  return candidate - Date.UTC(year, current.getUTCMonth(), current.getUTCDate()) > 31 * 86400000 ? year - 1 : year;
}
function validDate(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return iso(date);
}

// «80 mil», «2 mil 500», «1 millón 200 mil»: cifras mezcladas con una escala, como las dictan
// iOS y Android. Se reemplazan por la cifra completa («80000») rellenando con espacios para
// que los índices del texto no cambien, y se devuelve la zona reemplazada para que el importe
// la consuma entera. Solo se suman cifras de tres dígitos tras una escala: «80 mil por 2 rollos»
// no convierte el 2 en parte del importe.
function expandScaledDigits(text) {
  const regions = [];
  // «1,5 millones», «2,5 mil»: un decimal corto seguido de una escala.
  const withDecimals = text.replace(/\b(\d+)[,.](\d{1,2})\s+(millones|millon|mil)\b/g, (match, whole, fraction, word, start) => {
    const value = Math.round(Number(`${whole}.${fraction}`) * SCALES[word]);
    const digits = String(value);
    if (!Number.isSafeInteger(value * 100) || value * 100 > MAX_CENTS || digits.length > match.length) return match;
    regions.push({ start, end: start + match.length });
    return digits.padStart(match.length);
  });
  const list = tokenize(withDecimals);
  let out = withDecimals, i = 0;
  while (i < list.length) {
    const run = [];
    let hasDigit = false, hasScale = false, j = i;
    for (; j < list.length; j++) {
      const token = bare(list[j].value);
      const prev = run.length ? bare(list[run[run.length - 1]].value) : '';
      const digit = /^\d+$/.test(token);
      // «100mil» pegado: el reconocedor a veces no separa la cifra de su escala.
      const glued = /^(\d{1,7})(mil|millon|millones)$/.exec(token);
      const accepted = digit
        ? (run.length === 0 ? token.length <= 4 : Object.hasOwn(SCALES, prev) && token.length === 3)
        : glued ? (run.length === 0 || Object.hasOwn(SCALES, prev))
        : isNumberWord(token) || (isConnector(token) && run.length > 0 && j + 1 < list.length && isNumberWord(bare(list[j + 1].value)));
      if (!accepted) break;
      run.push(j);
      if (digit || glued) hasDigit = true;
      if (Object.hasOwn(SCALES, token) || glued) hasScale = true;
    }
    if (hasDigit && hasScale) {
      const value = wordsToNumber(run.flatMap(k => {
        const said = bare(list[k].value), split = /^(\d{1,7})(mil|millon|millones)$/.exec(said);
        return split ? [split[1], split[2]] : [said];
      }));
      const start = list[run[0]].start, end = list[run[run.length - 1]].end;
      const digits = String(value);
      if (value && Number.isSafeInteger(value * 100) && value * 100 <= MAX_CENTS && digits.length <= end - start) {
        out = out.slice(0, start) + digits.padStart(end - start) + out.slice(end);
        regions.push({ start, end });
      }
    }
    i = Math.max(j, i + 1);
  }
  return { text: out, regions };
}

// «3.143 coma 70», «doce coma cinco», «12 coma cero cinco»: el dictado escribe la coma decimal
// como palabra. Sin esto la parte entera quedaba en el concepto y el importe era solo «70».
// Se reescribe como «3143,70» rellenando con espacios para conservar los índices, y se devuelve
// la zona para que el importe la consuma entera. Los decimales son uno o dos dígitos (o palabras
// hasta noventa y nueve): «coma 123» no son centavos y se deja como estaba.
// «con» hace lo mismo cuando está entre dos cifras («500 con 50», «quinientos con cincuenta»).
// Si «con» no tiene cifras a ambos lados es parte de la frase («deuda con el proveedor») y se ignora.
function expandSpokenComma(text) {
  const list = tokenize(text);
  const regions = [];
  let out = text, ambiguous = false;
  const word = i => (i >= 0 && i < list.length ? bare(list[i].value) : '');
  for (let c = 1; c + 1 < list.length; c++) {
    const separator = word(c);
    // «y» solo separa decimales con la palabra de centavos después: «4.567 pesos y 89 centavos».
    if (separator !== 'coma' && separator !== 'con' && separator !== 'y') continue;
    if (separator === 'y' && !CENTS_WORDS.has(word(c + 2)) && !CENTS_WORDS.has(word(c + 3))) continue;
    const isComma = separator === 'coma';
    // «500 pesos con 50 centésimos»: la moneda dicha antes del separador se conserva junto a la cifra.
    const currency = CURRENCY_WORDS.has(word(c - 1)) ? word(c - 1) : '';
    const left = currency ? c - 2 : c - 1;
    if (left < 0) continue;
    // Parte entera: una cifra («3.143», «3143») o una corrida de palabras numéricas.
    let wholeCents = null, from = left;
    const before = word(left);
    if (/^\d[\d.,]*$/.test(before)) {
      const cents = digitsToCents(before);
      const decimals = /[.,]\d{1,2}$/.test(before);
      // «3.143,00 coma 70»: la parte entera ya trae decimales, no se sabe qué coma vale.
      if (decimals && isComma) { ambiguous = true; continue; }
      if (cents && cents % 100 === 0 && !decimals) {
        // «3 143 coma 70»: «143» puede ser el final de otra cifra («3 143» no es 3.143 ni 3 y 143).
        if (isComma && /^\d{3}$/.test(before) && /^\d{1,3}$/.test(word(left - 1))) { ambiguous = true; continue; }
        wholeCents = cents;
      }
    } else {
      let k = left;
      while (k >= 0 && (isNumberWord(word(k)) || (isConnector(word(k)) && k > 0 && isNumberWord(word(k - 1))))) k--;
      if (k + 1 <= left && !isConnector(word(k + 1))) {
        const value = wordsToNumber(list.slice(k + 1, left + 1).map(token => bare(token.value)));
        if (value) { wholeCents = value * 100; from = k + 1; }
      }
    }
    if (wholeCents === null) continue;
    // Decimales.
    let fraction = null, to = c + 1;
    const after = word(c + 1);
    if (/^\d{1,2}$/.test(after)) {
      fraction = after.length === 1 ? Number(after) * 10 : Number(after);
    } else if (after === 'cero' && c + 2 < list.length && /^(?:\d|uno|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)$/.test(word(c + 2))) {
      const unit = word(c + 2);
      fraction = /^\d$/.test(unit) ? Number(unit) : SMALL[unit];
      to = c + 2;
    } else if (Object.hasOwn(SMALL, after) && SMALL[after] < 100) {
      let end = c + 1;
      if (SMALL[after] >= 30 && SMALL[after] % 10 === 0 && c + 3 < list.length && isConnector(word(c + 2))
        && Object.hasOwn(SMALL, word(c + 3)) && SMALL[word(c + 3)] < 10) end = c + 3;
      const value = wordsToNumber(list.slice(c + 1, end + 1).map(token => bare(token.value)));
      fraction = end === c + 1 && value < 10 ? value * 10 : value;
      to = end;
    }
    if (fraction === null || fraction > 99) {
      // Hubo «<cifra> coma <número>» pero los decimales no son centavos («coma 123»): no se adivina.
      if (isComma && (/^\d+$/.test(after) || isNumberWord(after))) ambiguous = true;
      continue;
    }
    // «2 coma 5 coma 6»: dos comas seguidas no dicen cuál es la decimal.
    if (isComma && word(to + 1) === 'coma') { ambiguous = true; continue; }
    if (separator === 'y' && !CENTS_WORDS.has(word(to + 1))) continue;
    // Con «centavos»/«centésimos» la cifra vale tal cual: «5 centésimos» son 0,05 y no 0,50.
    if (CENTS_WORDS.has(word(to + 1))) {
      const said = list.slice(c + 1, to + 1).map(token => bare(token.value));
      const literal = said.length === 1 && /^\d{1,2}$/.test(said[0]) ? Number(said[0]) : wordsToNumber(said.filter(w => w !== 'cero'));
      if (literal !== null && literal <= 99) fraction = literal;
      to++;
    }
    const cents = wholeCents + fraction;
    if (!cents || !Number.isSafeInteger(cents) || cents > MAX_CENTS) continue;
    const digits = `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}${currency ? ` ${currency}` : ''}`;
    const start = list[from].start, end = list[to].end;
    if (digits.length > end - start) continue;
    out = out.slice(0, start) + digits.padStart(end - start) + out.slice(end);
    regions.push({ start, end });
    c = to;
  }
  return { text: out, regions, ambiguous };
}

// Expande primero las escalas con cifras («3 mil 143») y después la coma dicha.
function expandSpoken(text) {
  const scaled = expandScaledDigits(text);
  const comma = expandSpokenComma(scaled.text);
  // «3 mil 143 coma 70»: la parte entera ya venía de una escala; la zona de la coma la incluye
  // para que «3 mil» no quede suelto en el concepto.
  const overlaps = (a, b) => a.start < b.end && a.end > b.start;
  const regions = comma.regions.map(region => scaled.regions.filter(other => overlaps(region, other))
    .reduce((acc, other) => ({ start: Math.min(acc.start, other.start), end: Math.max(acc.end, other.end) }), region));
  return { text: comma.text, ambiguous: comma.ambiguous, regions: [...scaled.regions.filter(other => !regions.some(region => overlaps(region, other))), ...regions] };
}

function findAmount(text, list) {
  const patterns = [
    /\$\s*([\d.,]+)/,
    /([\d.,]+)\s*(?:pesos|peso|dolares|dolar|reales|uyu|usd|brl)\b/,
    /\b(?:total|importe|monto|por)\s+\$?\s*([\d.,]+)/
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const cents = match && digitsToCents(match[1]);
    if (cents) return { cents, span: spanOf(match) };
  }
  // Cifra dicha con palabras: se toma la última corrida, que es donde suele caer
  // el importe cuando el concepto va primero.
  const runs = [];
  let start = -1;
  for (let i = 0; i <= list.length; i++) {
    const token = i < list.length ? bare(list[i].value) : '';
    // La "y" solo mantiene la corrida cuando está entre dos números.
    const number = i < list.length && (isNumberWord(token) || (isConnector(token) && start !== -1 && i + 1 < list.length && isNumberWord(bare(list[i + 1].value))));
    if (number && start === -1) start = i;
    if (!number && start !== -1) { runs.push([start, i]); start = -1; }
  }
  for (const [from, to] of runs.reverse()) {
    const value = wordsToNumber(list.slice(from, to).map(token => bare(token.value)));
    const cents = value ? value * 100 : 0;
    if (cents && Number.isSafeInteger(cents) && cents <= MAX_CENTS)
      return { cents, span: { start: list[from].start, end: list[to - 1].end } };
  }
  // Cifra suelta sin moneda ni preposición: el número completo con sus separadores y, si hay
  // más de uno, el último (donde cae lo último que se dictó cuando el campo ya traía un valor).
  // Antes «100,000» se cortaba en «100». Sigue exigiendo más de un dígito para no tomar un
  // ordinal suelto como importe.
  const loose = [...text.matchAll(/\b\d[\d.,]*\d\b/g)].reverse().find(match => digitsToCents(match[0]));
  const cents = loose ? digitsToCents(loose[0]) : null;
  return cents ? { cents, span: { start: loose.index, end: loose.index + loose[0].length } } : { cents: null, span: null };
}

// Muletillas que no son cifra ni concepto («eh», «mmm», «o sea», «viste»). Se enmascaran en
// cualquier lugar, también dentro de una cifra: «tres mil eh ciento» sigue siendo una sola cifra.
function maskFillers(text) {
  // «mirá», «escuchá», «fijate» llaman la atención solo al empezar o seguidos de una coma:
  // en «a Mira Digital» son parte de un nombre.
  // Al empezar sin coma solo cuentan si sigue un verbo o palabra vacía («mirá pagué»): «Mira Digital
  // 4500» es una marca.
  const list = tokenize(text);
  const attention = (token, i) => /^(?:mira|escucha|fijate)$/.test(bare(token.value))
    && (/,$/.test(token.value) || (i === 0 && STOPWORDS.has(bare(list[1]?.value ?? ''))));
  const spans = list.filter((token, i) => FILLER_TOKEN.test(bare(token.value)) || attention(token, i))
    .map(token => ({ start: token.start, end: token.end }));
  for (const match of text.matchAll(FILLER_PHRASE)) spans.push(spanOf(match));
  // «nada» cierra la frase («… y nada», «nada más»); en el medio puede ser un nombre («La Nada Bar»).
  const closing = /\b(?:y nada|nada mas|nada)\b[^\p{L}\p{N}]*$/u.exec(text);
  if (closing) spans.push(spanOf(closing));
  return { text: spans.reduce((out, span) => mask(out, span), text), spans };
}

// Aproximaciones: «como 500», «tipo 500», «mas o menos 800», «500 y pico», «500 o algo asi».
// El importe se conserva; los marcadores salen del concepto y después se avisa.
function findApproximate(text) {
  const list = tokenize(text);
  const word = i => (i >= 0 && i < list.length ? bare(list[i].value) : '');
  const isNumeric = w => /^\d/.test(w) || isNumberWord(w);
  const spans = [];
  for (let i = 0; i < list.length; i++) {
    const marker = APPROX_BEFORE.find(words => words.every((w, k) => word(i + k) === w));
    if (marker && isNumeric(word(i + marker.length))) spans.push({ start: list[i].start, end: list[i + marker.length - 1].end });
    if (word(i) === 'y' && (word(i + 1) === 'pico' || word(i + 1) === 'algo')) {
      const before = CURRENCY_WORDS.has(word(i - 1)) ? i - 2 : i - 1;
      if (isNumeric(word(before))) spans.push({ start: list[i].start, end: list[i + 1].end });
    }
  }
  for (const match of text.matchAll(APPROX_PHRASE)) spans.push(spanOf(match));
  return spans;
}

// Último marcador de corrección: «perdón», «digo», «corrijo», «mejor dicho», «en realidad»,
// o «no» seguido de una cifra. Devuelve su zona en el texto.
function lastCorrection(text) {
  const list = tokenize(text);
  const word = i => (i >= 0 && i < list.length ? bare(list[i].value) : '');
  let last = null;
  for (let i = 0; i < list.length; i++) {
    const w = word(i);
    const length = ['perdon', 'digo', 'corrijo'].includes(w) ? 1
      : (w === 'mejor' && word(i + 1) === 'dicho') || (w === 'en' && word(i + 1) === 'realidad') ? 2
        : w === 'no' && (/^\d/.test(word(i + 1)) || isNumberWord(word(i + 1))) ? 1
          : 0;
    if (length) last = { start: list[i].start, end: list[i + length - 1].end };
  }
  return last;
}

// Cifras candidatas a importe en un texto ya expandido. Cada una indica si va con moneda o con
// «$», si la precede una palabra de importe («por 500») y si es countable: dos dígitos o más.
// Una cifra suelta («2 rollos», «Nº 3») no cuenta sin moneda.
function amountCandidates(text) {
  const list = tokenize(text);
  const found = [];
  const add = (start, end, cents, countable) => {
    const before = text.slice(0, start);
    const prev = bare((before.replace(/[\s$]+$/, '').match(/(\S+)$/) || ['', ''])[1]);
    const next = bare((text.slice(end).match(/^\s*(\S+)/) || ['', ''])[1]);
    // La moneda dicha después («2.000 pesos uruguayos») viaja con la cifra para no quedar en el concepto.
    let tail = end;
    for (const re = /^\s*(\S+)/y; ;) {
      re.lastIndex = 0;
      const after = re.exec(text.slice(tail));
      const said = after && bare(after[1]);
      if (!said || !(CURRENCY_WORDS.has(said) || ['uruguayos', 'americanos', 'brasilenos'].includes(said))) break;
      tail += after[0].length;
    }
    found.push({
      start, end: tail, cents, countable,
      prev, next,
      currency: /\$\s*$/.test(before) || CURRENCY_WORDS.has(next),
      keyword: AMOUNT_KEYWORDS.has(prev)
    });
  };
  for (const match of text.matchAll(/\d+(?:[.,]\d+)*/g)) {
    const cents = digitsToCents(match[0]);
    if (cents) add(match.index, match.index + match[0].length, cents, match[0].replace(/\D/g, '').length >= 2);
  }
  let from = -1;
  for (let i = 0; i <= list.length; i++) {
    const token = i < list.length ? bare(list[i].value) : '';
    const number = i < list.length && (isNumberWord(token) || (isConnector(token) && from !== -1 && i + 1 < list.length && isNumberWord(bare(list[i + 1].value))));
    if (number && from === -1) from = i;
    if (!number && from !== -1) {
      const value = wordsToNumber(list.slice(from, i).map(token => bare(token.value)));
      const cents = value ? value * 100 : 0;
      if (cents && Number.isSafeInteger(cents) && cents <= MAX_CENTS) add(list[from].start, list[i - 1].end, cents, value >= 10);
      from = -1;
    }
  }
  return found;
}

// Elige el importe de una frase. Manda la cifra con moneda o «$»; si no hay, la que trae una palabra
// de importe («por»); si no, la cifra suelta. Dos valores distintos en el mismo nivel no se adivinan:
// se devuelven como ambiguos y el importe queda vacío.
function pickAmount({ text, regions }) {
  const found = amountCandidates(text);
  const currency = found.filter(c => c.currency);
  const keyword = found.filter(c => c.keyword && c.countable);
  const plain = found.filter(c => c.countable);
  // «total 1500» compite con «300 pesos»: un total distinto del importe con moneda no se adivina.
  const strong = keyword.filter(c => TOTAL_WORDS.has(c.prev));
  let pool = currency.length ? [...currency, ...strong] : keyword.length ? keyword : plain;
  // «300 pesos de nafta y 200 de peaje»: una cifra suelta que se dice como importe («y 200», «200 de»)
  // es un segundo importe. «12 cajas» es una cantidad y no compite.
  if (pool !== plain) pool = [...pool, ...plain.filter(c => !pool.includes(c) && (c.prev === 'y' || ['de', 'en', 'para'].includes(c.next)))];
  const values = [...new Set(pool.map(c => c.cents))];
  const spans = pool.map(c => extendByRegions(c, regions));
  if (!values.length) return { cents: null, spans: [], ambiguous: null };
  if (values.length > 1) return { cents: null, spans, ambiguous: values };
  return { cents: values[0], spans, ambiguous: null };
}

// Un tramo que cae dentro de una zona reemplazada se extiende a la zona completa.
function extendByRegions(span, regions) {
  let { start, end } = span;
  for (const region of regions) {
    if (region.start < end && region.end > start) { start = Math.min(start, region.start); end = Math.max(end, region.end); }
  }
  return { start, end };
}

// «1500» → «1.500», «250» centavos → «2,50»: como se lee el importe al usuario.
function formatPesos(cents) {
  const whole = String(Math.floor(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const fraction = cents % 100;
  return fraction ? `${whole},${String(fraction).padStart(2, '0')}` : whole;
}

// «este» es muletilla solo cuando va seguido de otra palabra vacía («este pagué»); «este mes» se queda.
function thisFillers(text) {
  const list = tokenize(text);
  return list.flatMap((token, i) => bare(token.value) === 'este' && STOPWORDS.has(bare(list[i + 1]?.value ?? ''))
    ? [{ start: token.start, end: token.end }] : []);
}

// Importe que entra al campo como texto: lo que escribe el dictado del sistema («25 mil»,
// «veinticinco mil»), lo pegado de un mensaje («60,000») o lo tipeado («1.800»). Devuelve ''
// si no hay una cifra reconocible, para no inventar un importe.
export function amountFromText(raw) {
  const text = maskFillers(fold(String(raw ?? ''))).text;
  if (!text.trim()) return '';
  // Un número con cuatro o más decimales no es un importe: el texto viene mezclado (un valor
  // viejo pegado a lo dictado). En vez de adivinar con la parte legible, no se toma nada.
  if (/\d[.,]\d{4,}/.test(text)) return '';
  const scaled = expandSpoken(text);
  if (scaled.ambiguous) return '';
  const found = findAmount(scaled.text, tokenize(scaled.text));
  return found.cents ? (found.cents / 100).toFixed(2) : '';
}

export function parseSpokenInvoice(transcript, { today = new Date().toISOString().slice(0, 10), currency = '' } = {}) {
  const original = String(transcript ?? '');
  const folded = fold(original);
  const warnings = [];
  if (!/\S/.test(folded)) return { ok: false, understood: {}, warnings: ['No se escuchó nada. Probá de nuevo o escribí los campos.'] };

  const spokenCurrency = CURRENCIES.find(c => c.re.test(folded))?.code || '';
  const kind = KIND_HINTS.find(k => k.re.test(folded))?.kind || null;

  let working = folded;
  const removed = [];
  // Cada tramo se enmascara en el texto de trabajo y se recuerda para que no llegue al concepto.
  const hide = spans => {
    for (const span of spans) { removed.push(span); working = mask(working, span); }
  };

  // Muletillas primero, para que no partan una cifra ni se cuelen en el concepto.
  const fillers = maskFillers(working);
  working = fillers.text;
  removed.push(...fillers.spans);

  // Aproximaciones: el importe se conserva, pero se avisa para revisarlo.
  const approximate = findApproximate(working);
  hide(approximate);

  // El vencimiento se separa primero para que su fecha no reemplace a la operación.
  let due = null;
  const dueClause = working.match(/\bvence\b(?:\s+el)?\s+(.+)$/);
  if (dueClause) {
    const dueDate = findDate(dueClause[1], today);
    due = dueDate.date;
    // Solo se consume «vence [el] <fecha>»: lo que se diga después (un importe, por ejemplo)
    // sigue disponible. Sin fecha legible se consume apenas «vence [el]».
    const bodyStart = dueClause.index + dueClause[0].length - dueClause[1].length;
    const span = { start: dueClause.index, end: dueDate.span ? bodyStart + dueDate.span.end : bodyStart };
    hide([span]);
    if (!due) warnings.push('Escuché un vencimiento pero no pude leer la fecha.');
  }

  const dated = findDate(working, today);
  if (dated.span) hide([dated.span]);

  // Corrección dicha: «3.143 perdón 3.144» se queda con 3.144. Solo si hay un importe después del
  // marcador; el importe corregido y el marcador salen del texto.
  const correction = lastCorrection(working);
  if (correction && pickAmount(expandSpoken(working.slice(correction.end))).cents) {
    const replaced = pickAmount(expandSpoken(working.slice(0, correction.start)));
    // Solo salen las cifras corregidas y el marcador: lo dicho entre ellos es el concepto.
    hide([...replaced.spans, correction]);
  }

  hide(thisFillers(working));

  const expansion = expandSpoken(working);
  // «la mitad de 800», «15% de 800»: el importe hay que calcularlo, no se adivina.
  const computed = /\d\s*%|\bpor ?ciento\b|\b(?:la mitad|un tercio|un cuarto|el doble|el triple)\b/.test(working);
  // «60 200 pesos», «1 eh 500»: dos cifras pegadas pueden ser una sola o dos; no se adivina.
  const split = /(?:^|\s)\d{1,3}\s+\d{3}(?![\d.,])/.test(expansion.text);
  const picked = expansion.ambiguous || computed ? { cents: null, spans: [], ambiguous: null }
    : split ? { cents: null, spans: [], ambiguous: [] } : pickAmount(expansion);
  hide(picked.spans);
  const cents = picked.cents;

  const concept = buildConcept(original, folded, removed, tokenize(folded));

  // «10 lápices de 50 pesos», «5 cajas a 300 pesos (cada una)»: una cantidad antes de un precio.
  if (cents) {
    const chosen = amountCandidates(expansion.text).find(c => c.cents === cents);
    const quantityBefore = chosen && amountCandidates(expansion.text).some(c => c.end <= chosen.start && c.cents !== cents && !c.currency);
    if (quantityBefore && (['a', 'de'].includes(chosen.prev) || /^\s*(?:\S+\s+)?cada\b/.test(expansion.text.slice(chosen.end))))
      warnings.push('Parece un precio por unidad: revisá si el importe es el total.');
  }
  if (approximate.length && cents) warnings.push('El importe parece aproximado: revisalo antes de guardar.');
  if (/^\s*no\s+(?:pague|compre|gaste|vendi|cobre|debo|abone)\b/.test(folded)) warnings.push('Escuché «no» al principio: revisá que corresponda registrarlo.');
  if (computed) warnings.push('Escuché un porcentaje o una fracción: escribí el importe final.');
  else if (expansion.ambiguous || (picked.ambiguous && !picked.ambiguous.length)) warnings.push('Escuché más de un importe o una coma dudosa. Escribí el correcto.');
  else if (picked.ambiguous) warnings.push(`Escuché más de un importe (${picked.ambiguous.slice(0, 2).map(formatPesos).join(' y ')}). Escribí el correcto.`);
  else if (!cents) warnings.push('No reconocí un importe. Escribilo a mano: es el dato que más cuidado necesita.');
  if (!concept) warnings.push('No reconocí el concepto. Escribí a qué corresponde.');

  return {
    ok: true,
    kind,
    concept,
    cents,
    amountText: cents ? (cents / 100).toFixed(2) : '',
    currency: spokenCurrency || currency || '',
    date: dated.date,
    due,
    understood: {
      concept: !!concept, amount: !!cents, date: !!dated.date, due: !!due, currency: !!spokenCurrency
    },
    warnings
  };
}

// Recorta del original los tramos ya interpretados y solo descarta las palabras
// vacías de los extremos: los conectores internos ("proveedor de materiales") se
// conservan porque forman parte del nombre.
function buildConcept(original, folded, removed, list) {
  const inside = token => removed.some(span => token.start < span.end && token.end > span.start);
  const kept = list.filter(token => !inside(token));
  const meaningful = kept.filter(token => !STOPWORDS.has(bare(token.value)));
  if (!meaningful.length) return '';
  const from = kept.indexOf(meaningful[0]), to = kept.indexOf(meaningful[meaningful.length - 1]);
  const words = kept.slice(from, to + 1)
    .filter(token => !STOPWORDS.has(bare(token.value)) || !isEdgeStopword(token, kept, from, to))
    .map(token => original.slice(token.start, token.end).replace(PUNCTUATION, ''))
    .filter(Boolean);
  const concept = words.join(' ').replace(/\s+/g, ' ').trim();
  return concept ? concept.charAt(0).toUpperCase() + concept.slice(1) : '';
}

// Una palabra vacía solo se descarta si está en un extremo del tramo elegido.
function isEdgeStopword(token, kept, from, to) {
  const index = kept.indexOf(token);
  let left = index, right = index;
  const isEmpty = entry => STOPWORDS.has(bare(entry.value));
  while (left > from && isEmpty(kept[left - 1])) left--;
  while (right < to && isEmpty(kept[right + 1])) right++;
  return left === from || right === to;
}
