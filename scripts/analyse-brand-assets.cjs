const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function decodePng(file) {
  const buf = fs.readFileSync(file);
  if (!buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    throw new Error('not a PNG');
  }
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  const bitDepth = buf[24];
  const colorType = buf[25];
  if (bitDepth !== 8 || buf[28] !== 0 || (colorType !== 2 && colorType !== 6)) {
    throw new Error('unsupported PNG layout');
  }
  const ch = colorType === 6 ? 4 : 3;
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

const hex = (r, g, b) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();

// ---- dominant colour of a fully opaque image ---------------------------------
function dominant(p) {
  const { w, h, ch, data } = decodePng(p);
  const counts = new Map();
  for (let i = 0; i < w * h; i++) {
    const r = data[i * ch], g = data[i * ch + 1], b = data[i * ch + 2];
    const key = (r >> 3 << 10) | (g >> 3 << 5) | (b >> 3);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  return top.map(([key, n]) => {
    const r = ((key >> 10) & 31) << 3, g = ((key >> 5) & 31) << 3, b = (key & 31) << 3;
    return { hex: hex(r, g, b), pct: ((n / (w * h)) * 100).toFixed(1) };
  });
}

// ---- tight bbox of genuinely solid content ---------------------------------
function solidBBox(p, threshold) {
  const { w, h, ch, data } = decodePng(p);
  let minX = w, maxX = -1, minY = h, maxY = -1, n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = ch === 4 ? data[y * w * ch + x * ch + 3] : 255;
      if (a >= threshold) {
        n++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0
    ? null
    : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, count: n, pct: ((n / (w * h)) * 100).toFixed(1) };
}

const a = (f) => path.join(__dirname, '..', 'assets', f);

const args = process.argv.slice(2);
if (args.length) {
  console.log('dominant colours:');
  for (const f of args) {
    console.log('  ' + f + ':');
    for (const c of dominant(a(f))) console.log('    ' + c.hex + '  ' + c.pct + '%');
  }
  process.exit(0);
}

console.log('splash.png dominant colours:');
for (const c of dominant(a('splash.png'))) console.log('  ' + c.hex + '  ' + c.pct + '%');

console.log('\nicon.png solid content (threshold sweep):');
for (const t of [1, 32, 128, 200, 250]) {
  const b = solidBBox(a('icon.png'), t);
  console.log(
    '  alpha>=' + String(t).padEnd(4) + (b
      ? `bbox ${b.w}x${b.h} at (${b.x},${b.y})  aspect ${(b.w / b.h).toFixed(2)}  covers ${b.pct}%`
      : 'none')
  );
}

console.log('\nicon.png vs adaptive-icon.png:');
const ib = solidBBox(a('icon.png'), 128);
const ab = solidBBox(a('adaptive-icon.png'), 128);
console.log('  icon.png        solid bbox: ' + JSON.stringify(ib));
console.log('  adaptive-icon   solid bbox: ' + JSON.stringify(ab));
if (ab) {
  console.log('  adaptive content as % of 1024 frame: ' + ((ab.w / 1024) * 100).toFixed(0) + '% wide, ' + ((ab.h / 1024) * 100).toFixed(0) + '% tall');
  console.log('  (Android masks to the inner ~66%, so content should sit inside the middle ~66% and be centred)');
}
