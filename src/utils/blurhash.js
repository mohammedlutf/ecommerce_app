/**
 * Pure-JS blurhash decoder and PNG encoder.
 *
 * The app deliberately ships no native blurhash or image-caching module (see
 * OVERHAUL_PLAN.md), so a product's stored `blurhash` is turned into a tiny PNG
 * data URI entirely in JavaScript. A ~32x32 PNG is a few kilobytes, is cached
 * by the platform image cache like any other URI, and instantly gives a card a
 * plausible, correctly-coloured placeholder while the real photo downloads.
 *
 * The encoder writes the PNG's zlib stream using *stored* (uncompressed) deflate
 * blocks, which is a valid zlib stream and needs no deflate implementation.
 */

const DIGITS =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';

const DIGIT_LOOKUP = (() => {
  const map = new Array(128).fill(-1);
  for (let i = 0; i < DIGITS.length; i += 1) map[DIGITS.charCodeAt(i)] = i;
  return map;
})();

function decode83(text) {
  let value = 0;
  for (let i = 0; i < text.length; i += 1) {
    const digit = DIGIT_LOOKUP[text.charCodeAt(i)];
    if (digit < 0) return -1;
    value = value * 83 + digit;
  }
  return value;
}

function sRGBToLinear(value) {
  const v = value / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function linearTosRGB(value) {
  const v = Math.max(0, Math.min(1, value));
  const scaled = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055;
  return Math.round(scaled * 255);
}

function signPow(value, exponent) {
  return Math.sign(value) * Math.abs(value) ** exponent;
}

function decodeDC(value) {
  return [
    sRGBToLinear(value >> 16),
    sRGBToLinear((value >> 8) & 255),
    sRGBToLinear(value & 255),
  ];
}

function decodeAC(value, maximumValue) {
  const quantR = Math.floor(value / (19 * 19));
  const quantG = Math.floor(value / 19) % 19;
  const quantB = value % 19;
  return [
    signPow((quantR - 9) / 9, 2) * maximumValue,
    signPow((quantG - 9) / 9, 2) * maximumValue,
    signPow((quantB - 9) / 9, 2) * maximumValue,
  ];
}

/**
 * Decode a blurhash string into RGBA pixels.
 *
 * @returns {Uint8ClampedArray|null} `width * height * 4` bytes, or null when the
 *   hash is missing or malformed.
 */
export function decodeBlurhash(blurhash, width, height, punch = 1) {
  if (!blurhash || typeof blurhash !== 'string' || blurhash.length < 6) return null;

  const sizeFlag = decode83(blurhash[0]);
  const numY = Math.floor(sizeFlag / 9) + 1;
  const numX = (sizeFlag % 9) + 1;

  const quantisedMaximumValue = decode83(blurhash[1]);
  const maximumValue = (quantisedMaximumValue + 1) / 166;

  const colors = new Array(numX * numY);
  for (let i = 0; i < colors.length; i += 1) {
    if (i === 0) {
      const value = decode83(blurhash.substring(2, 6));
      if (value < 0) return null;
      colors[i] = decodeDC(value);
    } else {
      const start = 4 + i * 2;
      const value = decode83(blurhash.substring(start, start + 2));
      if (value < 0) return null;
      colors[i] = decodeAC(value, maximumValue * punch);
    }
  }

  const bytesPerRow = width * 4;
  const pixels = new Uint8ClampedArray(bytesPerRow * height);

  // The cosine terms depend only on the axis, so they are computed once each
  // instead of once per pixel per component.
  const cosX = new Float32Array(width * numX);
  const cosY = new Float32Array(height * numY);
  for (let x = 0; x < width; x += 1) {
    for (let i = 0; i < numX; i += 1) cosX[i * width + x] = Math.cos((Math.PI * x * i) / width);
  }
  for (let y = 0; y < height; y += 1) {
    for (let j = 0; j < numY; j += 1) cosY[j * height + y] = Math.cos((Math.PI * y * j) / height);
  }

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let j = 0; j < numY; j += 1) {
        for (let i = 0; i < numX; i += 1) {
          const basis = cosX[i * width + x] * cosY[j * height + y];
          const color = colors[i + j * numX];
          r += color[0] * basis;
          g += color[1] * basis;
          b += color[2] * basis;
        }
      }
      const index = 4 * x + y * bytesPerRow;
      pixels[index] = linearTosRGB(r);
      pixels[index + 1] = linearTosRGB(g);
      pixels[index + 2] = linearTosRGB(b);
      pixels[index + 3] = 255;
    }
  }

  return pixels;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function adler32(bytes) {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    a = (a + bytes[i]) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function pngChunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** zlib stream wrapping `data` in stored (uncompressed) deflate blocks. */
function zlibStored(data) {
  const blockSize = 65535;
  const blocks = Math.max(1, Math.ceil(data.length / blockSize));
  const out = new Uint8Array(2 + blocks * 5 + data.length + 4);
  let o = 0;
  out[o++] = 0x78; // CMF: deflate, 32K window
  out[o++] = 0x01; // FLG (chosen so the header is a multiple of 31)
  for (let i = 0; i < blocks; i += 1) {
    const start = i * blockSize;
    const len = Math.min(blockSize, data.length - start);
    out[o++] = i === blocks - 1 ? 1 : 0; // BFINAL | BTYPE=00
    out[o++] = len & 0xff;
    out[o++] = (len >> 8) & 0xff;
    out[o++] = ~len & 0xff;
    out[o++] = (~len >> 8) & 0xff;
    out.set(data.subarray(start, start + len), o);
    o += len;
  }
  const checksum = adler32(data);
  out[o++] = (checksum >>> 24) & 0xff;
  out[o++] = (checksum >>> 16) & 0xff;
  out[o++] = (checksum >>> 8) & 0xff;
  out[o++] = checksum & 0xff;
  return out.subarray(0, o);
}

function pngFromRGBA(rgba, width, height) {
  const bytesPerRow = width * 4;
  const raw = new Uint8Array((bytesPerRow + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (bytesPerRow + 1)] = 0; // filter: none
    raw.set(
      rgba.subarray(y * bytesPerRow, (y + 1) * bytesPerRow),
      y * (bytesPerRow + 1) + 1
    );
  }

  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, width);
  ihdrView.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // bytes 10-12 (compression, filter, interlace) stay zero

  const parts = [
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlibStored(raw)),
    pngChunk('IEND', new Uint8Array(0)),
  ];

  let total = 0;
  for (const part of parts) total += part.length;
  const png = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    png.set(part, offset);
    offset += part.length;
  }
  return png;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64FromBytes(bytes) {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? B64[b2 & 63] : '=';
  }
  return out;
}

// Decoding a hash costs a small amount of CPU, and the same product reappears
// on every scroll tick, so results are memoised. Bounded so a long catalogue
// session cannot grow the map without limit.
const CACHE_LIMIT = 300;
const cache = new Map();

/**
 * A `data:image/png;base64,...` placeholder for a blurhash, or null.
 *
 * Safe to call with anything: a missing or malformed hash yields null and the
 * caller falls back to its own placeholder.
 */
export function blurhashToDataUri(blurhash, width = 32, height = 32) {
  if (!blurhash || typeof blurhash !== 'string') return null;

  const key = `${blurhash}:${width}x${height}`;
  if (cache.has(key)) return cache.get(key);

  let uri = null;
  try {
    const pixels = decodeBlurhash(blurhash, width, height);
    if (pixels) uri = `data:image/png;base64,${base64FromBytes(pngFromRGBA(pixels, width, height))}`;
  } catch {
    uri = null;
  }

  if (cache.size >= CACHE_LIMIT) cache.clear();
  cache.set(key, uri);
  return uri;
}

export default blurhashToDataUri;
