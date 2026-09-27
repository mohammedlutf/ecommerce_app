const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'assets');
const files = fs.readdirSync(dir).filter((f) => /\.(png|jpg|jpeg)$/i.test(f)).sort();

function pngInfo(file) {
  const buf = fs.readFileSync(file);
  if (buf.length < 24) return { error: 'too small to be a PNG (' + buf.length + ' bytes)' };
  const sig = buf.subarray(0, 8);
  const isPng = sig.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (!isPng) return { error: 'not a PNG (bad signature)' };
  const type = buf.subarray(12, 16).toString('ascii');
  if (type !== 'IHDR') return { error: 'missing IHDR, found ' + type };
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bitDepth: buf[24],
    colorType: buf[25],
  };
}

console.log('file'.padEnd(24) + 'size'.padStart(12) + 'dimensions'.padStart(16) + '  notes');
console.log('-'.repeat(78));
for (const f of files) {
  const p = path.join(dir, f);
  const bytes = fs.statSync(p).size;
  const info = pngInfo(p);
  let dims = 'n/a';
  let note = '';
  if (info.error) {
    note = '*** ' + info.error;
  } else {
    dims = info.width + ' x ' + info.height;
    const ratio = info.width / info.height;
    note = 'ratio ' + ratio.toFixed(3);
    if (ratio > 1.2) note += ' (landscape)';
    else if (ratio < 0.83) note += ' (tall/portrait)';
    else note += ' (square)';
    if (info.colorType === 6) note += ', has alpha';
    if (bytes < 2000) note += ', *** SUSPICIOUSLY SMALL';
  }
  console.log(f.padEnd(24) + String(bytes).padStart(12) + dims.padStart(16) + '  ' + note);
}
