import { deflateSync } from 'node:zlib';

// PNG real de un píxel, construido en el momento.
//
// Los comprobantes se validan por sus bytes y el navegador tiene que poder decodificarlos:
// un PNG firmado pero ilegible pasa la validación del servidor, no se puede recortar en el
// teléfono y tampoco se puede mostrar. Por eso el archivo de prueba se genera y no se pega
// como texto: un base64 copiado de memoria puede venir truncado y hacer fallar pruebas que
// en realidad están bien.
const table = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
const crc = bytes => {
  let c = -1;
  for (const byte of bytes) c = table[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc(body), 8 + data.length);
  return out;
};
export function pngBytes(width = 1, height = 1) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;   // bits por muestra
  header[9] = 6;   // RGBA
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) raw[y * (1 + width * 4)] = 0; // filtro 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
export const PNG_BASE64 = () => pngBytes().toString('base64');
