const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/** Minimal PNG decoder: 8-bit, non-interlaced, colour types 2 (RGB) and 6 (RGBA). */
function decodePng(file) {
  const buf = fs.readFileSync(file);
  const sigOk = buf
    .subarray(0, 8)
    .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (!sigOk) throw new Error('not a PNG');

  const ihdr = {};
  ihdr.width = buf.readUInt32BE(16);
  ihdr.height = buf.readUInt32BE(20);
  ihdr.bitDepth = buf[24];
  ihdr.colorType = buf[25];
  ihdr.interlace = buf[28];

  if (ihdr.bitDepth !== 8) throw new Error('unsupported bit depth ' + ihdr.bitDepth);
  if (ihdr.interlace !== 0) throw new Error('interlaced PNG not supported');
  if (ihdr.colorType !== 2 && ihdr.colorType !== 6) {
    throw new Error('unsupported colour type ' + ihdr.colorType);
  }

  const channels = ihdr.colorType === 6 ? 4 : 3;
  const idat = [];
  let offset = 8;
  while (offset < buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString('ascii');
    if (type === 'IDAT') idat.push(buf.subarray(offset + 8, offset + 8 + len));
    if (type === 'IEND') break;
    offset += 12 + len;
  }

  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = ihdr.width * channels;
  const out = Buffer.alloc(ihdr.height * stride);

  let pos = 0;
  for (let y = 0; y < ihdr.height; y++) {
    const filter = raw[pos++];
    const line = raw.subarray(pos, pos + stride);
    pos += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;

    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 0xff;
    }
  }

  return { ...ihdr, channels, data: out };
}

function analyse(file) {
  const img = decodePng(file);
  const { width: w, height: h, channels, data } = img;
  const at = (x, y, c) => data[y * w * channels + x * channels + c];

  let visible = 0;
  let opaque = 0;
  let minX = w, maxX = -1, minY = h, maxY = -1;
  const alphaHist = new Array(9).fill(0);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = channels === 4 ? at(x, y, 3) : 255;
      alphaHist[Math.min(8, a >> 5)]++;
      if (a > 8) {
        visible++;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      if (a === 255) opaque++;
    }
  }

  const total = w * h;
  // The band that a `cover` crop keeps: the middle 50% of the shorter axis.
  const cx0 = Math.floor(w * 0.25), cx1 = Math.floor(w * 0.75);
  const cy0 = Math.floor(h * 0.25), cy1 = Math.floor(h * 0.75);
  let centreVisible = 0;
  for (let y = cy0; y < cy1; y++) {
    for (let x = cx0; x < cx1; x++) {
      const a = channels === 4 ? at(x, y, 3) : 255;
      if (a > 8) centreVisible++;
    }
  }
  const centreTotal = (cx1 - cx0) * (cy1 - cy0);

  // Corner transparency tells us whether the artwork bleeds to the edges.
  const corner = (x, y) => (channels === 4 ? at(x, y, 3) : 255);

  return {
    file: path.basename(file),
    w,
    h,
    hasAlpha: channels === 4,
    visiblePct: (visible / total) * 100,
    opaquePct: (opaque / total) * 100,
    bbox: maxX < 0 ? null : { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
    bboxPct: maxX < 0 ? null : { x: (minX / w) * 100, y: (minY / h) * 100, w: ((maxX - minX + 1) / w) * 100, h: ((maxY - minY + 1) / h) * 100 },
    centreVisiblePct: (centreVisible / centreTotal) * 100,
    alphaHist,
    corners: {
      topLeft: corner(0, 0),
      topRight: corner(w - 1, 0),
      bottomLeft: corner(0, h - 1),
      bottomRight: corner(w - 1, h - 1),
      topCentre: corner(w >> 1, 0),
      bottomCentre: corner(w >> 1, h - 1),
    },
  };
}

const dir = path.join(__dirname, '..', 'assets');
const targets = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['splash.png', 'icon.png', 'adaptive-icon.png', 'adaptive-icon-bg.png'];

for (const name of targets) {
  const p = path.join(dir, name);
  if (!fs.existsSync(p)) {
    console.log('missing: ' + name);
    continue;
  }
  let r;
  try {
    r = analyse(p);
  } catch (e) {
    console.log(name + ': ' + e.message);
    continue;
  }
  console.log('=== ' + r.file + '  ' + r.w + 'x' + r.h + (r.hasAlpha ? '  RGBA' : '  RGB'));
  console.log('  visible pixels      : ' + r.visiblePct.toFixed(1) + '%   fully opaque: ' + r.opaquePct.toFixed(1) + '%');
  console.log('  content bbox        : ' + (r.bbox ? `x${r.bbox.x} y${r.bbox.y} ${r.bbox.w}x${r.bbox.h}  (= ${r.bboxPct.x.toFixed(0)}%,${r.bboxPct.y.toFixed(0)}% offset, ${r.bboxPct.w.toFixed(0)}%x${r.bboxPct.h.toFixed(0)}% of frame)` : 'EMPTY / fully transparent'));
  console.log('  middle 50% band     : ' + r.centreVisiblePct.toFixed(1) + '% visible  <- what a `cover` crop shows');
  console.log('  corner alpha        : TL=' + r.corners.topLeft + ' TR=' + r.corners.topRight + ' BL=' + r.corners.bottomLeft + ' BR=' + r.corners.bottomRight + ' TC=' + r.corners.topCentre + ' BC=' + r.corners.bottomCentre);
  console.log('');
}
