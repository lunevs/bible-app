// Генерация PNG-иконок PWA без внешних зависимостей (чистый Node + zlib).
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', 'public');
fs.mkdirSync(outDir, { recursive: true });

const crcTable = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const t = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crc]);
}
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const BG = [47, 93, 138]; // #2f5d8a
const GOLD = [233, 196, 106]; // #e9c46a
const BG2 = [36, 72, 112];

function drawIcon(size, { maskable = false, radius = 0.22 } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const cx = size / 2;
  const scale = maskable ? 0.72 : 1;
  const rPx = radius * size;

  // Крест (в пропорциях стороны иконки).
  const vW = 0.15 * size * scale;
  const vH = 0.56 * size * scale;
  const hW = 0.42 * size * scale;
  const hH = 0.15 * size * scale;
  const crossTop = (size - vH) / 2;
  const crossLeft = (size - vW) / 2;
  const barY = crossTop + vH * 0.28;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;

      // Фон с закруглением.
      let inside = true;
      if (radius > 0) {
        const dx = Math.max(rPx - x, x - (size - 1 - rPx), 0);
        const dy = Math.max(rPx - y, y - (size - 1 - rPx), 0);
        if (dx * dx + dy * dy > rPx * rPx) inside = false;
      }
      if (!inside) {
        buf[i + 3] = 0;
        continue;
      }

      // Лёгкий вертикальный градиент.
      const t = y / size;
      const bg = [
        Math.round(BG[0] + (BG2[0] - BG[0]) * t),
        Math.round(BG[1] + (BG2[1] - BG[1]) * t),
        Math.round(BG[2] + (BG2[2] - BG[2]) * t),
      ];

      const inVert = x >= crossLeft && x < crossLeft + vW && y >= crossTop && y < crossTop + vH;
      const inHorz =
        x >= (size - hW) / 2 && x < (size + hW) / 2 && y >= barY && y < barY + hH;

      const color = inVert || inHorz ? GOLD : bg;
      buf[i] = color[0];
      buf[i + 1] = color[1];
      buf[i + 2] = color[2];
      buf[i + 3] = 255;
    }
  }
  return buf;
}

function write(file, size, opts) {
  const png = encodePNG(size, size, drawIcon(size, opts));
  fs.writeFileSync(path.join(outDir, file), png);
  console.log(`Иконка ${file} (${size}x${size})`);
}

write('icon-192.png', 192, {});
write('icon-512.png', 512, {});
write('maskable-512.png', 512, { maskable: true, radius: 0 });
write('apple-touch-icon.png', 180, { radius: 0.16 });
console.log('Готово.');
