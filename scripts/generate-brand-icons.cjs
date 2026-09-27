const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* ------------------------------------------------------------------ PNG in */

function decodePng(file) {
  const buf = fs.readFileSync(file);
  if (!buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    throw new Error(file + ': not a PNG');
  }
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  const bitDepth = buf[24];
  const colorType = buf[25];
  if (bitDepth !== 8) throw new Error('unsupported bit depth ' + bitDepth);
  if (buf[28] !== 0) throw new Error('interlaced PNG not supported');
  if (colorType !== 6) throw new Error('expected RGBA, got colour type ' + colorType);

  const ch = 4;
  const idat = [];
  let off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.subarray(off + 4, off + 8).toString('ascii');
    if (type === 'IDAT') idat.push(buf.subarray(off + 8, off + 8 + len));
    if (type === 'IEND') break;
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  let pos = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[pos++];
    const line = raw.subarray(pos, pos + stride);
    pos += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? cur[x - ch] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= ch ? prev[x - ch] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 0xff;
    }
  }
  return { w, h, ch, data: out };
}

/* ----------------------------------------------------------------- PNG out */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  ihdr[10] = 0;  // deflate
  ihdr[11] = 0;  // adaptive filtering
  ihdr[12] = 0;  // no interlace

  const stride = w * 4;
  const raw = Buffer.alloc(h * (stride + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* -------------------------------------------------------------- compositing */

/**
 * Bilinear resample of an RGBA image, done in premultiplied space so
 * transparent pixels cannot bleed dark halos into the edges of the mark.
 */
function resample(src, dw, dh) {
  const out = Buffer.alloc(dw * dh * 4);
  const sx = src.w / dw;
  const sy = src.h / dh;

  for (let y = 0; y < dh; y++) {
    const fy = Math.min(src.h - 1, Math.max(0, (y + 0.5) * sy - 0.5));
    const y0 = Math.floor(fy);
    const y1 = Math.min(src.h - 1, y0 + 1);
    const wy = fy - y0;

    for (let x = 0; x < dw; x++) {
      const fx = Math.min(src.w - 1, Math.max(0, (x + 0.5) * sx - 0.5));
      const x0 = Math.floor(fx);
      const x1 = Math.min(src.w - 1, x0 + 1);
      const wx = fx - x0;

      let r = 0, g = 0, b = 0, a = 0;
      for (const [yy, wyy] of [[y0, 1 - wy], [y1, wy]]) {
        for (const [xx, wxx] of [[x0, 1 - wx], [x1, wx]]) {
          const i = (yy * src.w + xx) * 4;
          const sa = src.data[i + 3] / 255;
          const wgt = wxx * wyy * sa; // premultiplied
          r += src.data[i] * wgt;
          g += src.data[i + 1] * wgt;
          b += src.data[i + 2] * wgt;
          a += wxx * wyy;
        }
      }
      const o = (y * dw + x) * 4;
      if (a > 0) {
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
      }
      out[o + 3] = Math.round(a * 255);
    }
  }
  return { w: dw, h: dh, ch: 4, data: out };
}

/** Draw `mark` centred on a `size`x`size` canvas over an optional background. */
function compose(mark, size, boxFraction, bg) {
  const target = Math.round(size * boxFraction);
  const ratio = Math.min(target / mark.w, target / mark.h);
  const dw = Math.max(1, Math.round(mark.w * ratio));
  const dh = Math.max(1, Math.round(mark.h * ratio));
  const scaled = resample(mark, dw, dh);

  const canvas = Buffer.alloc(size * size * 4);
  if (bg) {
    for (let i = 0; i < size * size; i++) {
      canvas[i * 4] = bg[0];
      canvas[i * 4 + 1] = bg[1];
      canvas[i * 4 + 2] = bg[2];
      canvas[i * 4 + 3] = 255;
    }
  }

  const ox = Math.round((size - dw) / 2);
  const oy = Math.round((size - dh) / 2);

  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const si = (y * dw + x) * 4;
      const sa = scaled.data[si + 3] / 255;
      if (sa <= 0) continue;
      const di = ((y + oy) * size + (x + ox)) * 4;
      if (bg) {
        // Source-over onto an opaque background.
        canvas[di] = Math.round(scaled.data[si] * sa + canvas[di] * (1 - sa));
        canvas[di + 1] = Math.round(scaled.data[si + 1] * sa + canvas[di + 1] * (1 - sa));
        canvas[di + 2] = Math.round(scaled.data[si + 2] * sa + canvas[di + 2] * (1 - sa));
      } else {
        canvas[di] = scaled.data[si];
        canvas[di + 1] = scaled.data[si + 1];
        canvas[di + 2] = scaled.data[si + 2];
        canvas[di + 3] = scaled.data[si + 3];
      }
    }
  }
  return { w: size, h: size, ch: 4, data: canvas };
}

function solid(size, rgb) {
  const buf = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    buf[i * 4] = rgb[0];
    buf[i * 4 + 1] = rgb[1];
    buf[i * 4 + 2] = rgb[2];
    buf[i * 4 + 3] = 255;
  }
  return { w: size, h: size, ch: 4, data: buf };
}

const hexToRgb = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

/* -------------------------------------------------------------------- main */

const assets = path.join(__dirname, '..', 'assets');
const source = path.join(assets, 'icon-source.png');

if (!fs.existsSync(source)) {
  console.error('missing ' + source);
  process.exit(1);
}

const MINT = hexToRgb('#E7F6EC');
const mark = decodePng(source);
console.log('source icon-source.png: ' + mark.w + 'x' + mark.h);

const jobs = [
  // iOS / legacy launcher icon: opaque, no alpha (iOS rejects icons with alpha).
  { file: 'icon.png', img: compose(mark, 1024, 0.76, MINT) },
  // Android adaptive foreground: transparent, mark inside the ~66% safe zone.
  { file: 'adaptive-icon.png', img: compose(mark, 1024, 0.62, null) },
  // Adaptive background: flat mint, matches the splash and primaryContainer.
  { file: 'adaptive-icon-bg.png', img: solid(1024, MINT) },
  // The previous favicon was a 1x1 placeholder.
  { file: 'favicon.png', img: compose(mark, 64, 0.76, MINT) },
];

for (const job of jobs) {
  const png = encodePng(job.img.w, job.img.h, job.img.data);
  const dest = path.join(assets, job.file);
  fs.writeFileSync(dest, png);
  console.log('  wrote ' + job.file.padEnd(22) + job.img.w + 'x' + job.img.h + '  ' + png.length + ' bytes');
}

console.log('done');
