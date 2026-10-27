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
// conectores, monedas y palabras propias del tipo de operación.
const STOPWORDS = new Set([
  'eh', 'em', 'bueno', 'ok', 'dale', 'listo',
  'registra', 'registrar', 'anota', 'anotar', 'carga', 'cargar', 'agrega', 'agregar',
  'pone', 'poner', 'pasame', 'ingresa', 'ingresar', 'apunta', 'apuntar',
  'pague', 'pago', 'pagos', 'compre', 'compro', 'vendi', 'vendo', 'gaste', 'gasto', 'gastos',
  'abone', 'abonar', 'debo', 'deuda', 'deudas', 'pendiente', 'factura', 'facturas',
  'recibo', 'comprobante', 'venta', 'ventas',
  'un', 'una', 'unos', 'unas', 'el', 'la', 'los', 'las', 'lo',
  'de', 'del', 'por', 'con', 'para', 'a', 'en', 'que',
  'pesos', 'peso', 'dolares', 'dolar', 'reales', 'uyu', 'usd', 'brl'
]);

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

const bare = token => token.replace(PUNCTUATION, '');
const isNumberWord = token => Object.hasOwn(SMALL, token) || token === 'mil' || token === 'millon' || token === 'millones';

// Suma una corrida de palabras numéricas. Devuelve null si algún token no es un número.
export function wordsToNumber(tokens) {
  let total = 0, current = 0, seen = false;
  for (const token of tokens) {
    if (Object.hasOwn(SMALL, token)) { current += SMALL[token]; seen = true; continue; }
    if (token === 'mil') { total += (current || 1) * 1000; current = 0; seen = true; continue; }
    if (token === 'millon' || token === 'millones') { total += (current || 1) * 1000000; current = 0; seen = true; continue; }
    return null;
  }
  return seen ? total + current : null;
}

// Convención es-UY: el punto separa miles y la coma decimales.
export function digitsToCents(raw) {
  const text = String(raw ?? '').replace(/\s/g, '');
  if (!text) return null;
  let whole, fraction = '';
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(text)) {
    const [w, f = ''] = text.split(',');
    whole = w.replace(/\./g, ''); fraction = f;
  } else if (/^\d+(?:,\d{1,2})?$/.test(text)) {
    [whole, fraction = ''] = text.split(',');
  } else if (/^\d+\.\d{1,2}$/.test(text)) {
    [whole, fraction = ''] = text.split('.');
  } else if (/^\d+$/.test(text)) {
    whole = text;
  } else return null;
  const cents = Number(whole) * 100 + Number((fraction.padEnd(2, '0') || '0'));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
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
    const number = i < list.length && isNumberWord(bare(list[i].value));
    if (number && start === -1) start = i;
    if (!number && start !== -1) { runs.push([start, i]); start = -1; }
  }
  for (const [from, to] of runs.reverse()) {
    const value = wordsToNumber(list.slice(from, to).map(token => bare(token.value)));
    if (value) return { cents: value * 100, span: { start: list[from].start, end: list[to - 1].end } };
  }
  // Cifra suelta sin moneda ni preposición. Se exige más de un dígito para no
  // tomar un ordinal suelto como importe: antes se prefiere no reconocer nada.
  const loose = text.match(/\b(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d{2,}(?:[.,]\d{1,2})?)\b/);
  const cents = loose && digitsToCents(loose[1]);
  return cents ? { cents, span: spanOf(loose) } : { cents: null, span: null };
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

  // El vencimiento se separa primero para que su fecha no reemplace a la operación.
  let due = null;
  const dueClause = working.match(/\bvence\b(?:\s+el)?\s+(.+)$/);
  if (dueClause) {
    due = findDate(dueClause[1], today).date;
    const span = { start: dueClause.index, end: folded.length };
    removed.push(span); working = mask(working, span);
    if (!due) warnings.push('Escuché un vencimiento pero no pude leer la fecha.');
  }

  const dated = findDate(working, today);
  if (dated.span) { removed.push(dated.span); working = mask(working, dated.span); }

  const amountMatch = findAmount(working, tokenize(working));
  if (amountMatch.span) { removed.push(amountMatch.span); working = mask(working, amountMatch.span); }

  const concept = buildConcept(original, folded, removed, tokenize(folded));
  const cents = amountMatch.cents;

  if (!cents) warnings.push('No reconocí un importe. Escribilo a mano: es el dato que más cuidado necesita.');
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
