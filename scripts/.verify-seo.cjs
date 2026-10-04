// Static sanity checks across the SEO wiring. Not shipped.
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

let failures = 0;
const fail = (m) => {
  console.log('  FAIL ' + m);
  failures += 1;
};
const norm = (p) => p.replace(/\\/g, '/');

/* ---- load a locale module as plain data ---- */
function localeData(file) {
  const src = fs.readFileSync(file, 'utf8');
  const body = src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1);
  // `new Function` returns a function; its RETURN value is the module object.
  const build = new Function(`return (${body});`);
  return build();
}
function flatten(o, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(o)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') out.push(...flatten(v, key));
    else out.push(key);
  }
  return out;
}
const get = (o, key) => key.split('.').reduce((a, k) => (a == null ? a : a[k]), o);

const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) files.push(norm(p));
  }
})('src');

/* ---- 1. every file parses ---- */
console.log('1. parse');
for (const f of files) {
  try {
    parser.parse(fs.readFileSync(f, 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
  } catch (e) {
    fail(`${f} :: ${e.message}`);
  }
}
console.log(`   ${files.length} files parsed, ${failures} failure(s) so far`);

/* ---- 2. locale key parity ---- */
console.log('2. i18n key parity');
const arO = localeData('src/i18n/strings/ar.js');
const enO = localeData('src/i18n/strings/en.js');
const arKeys = flatten(arO);
const enKeys = flatten(enO);
const enSet = new Set(enKeys);
const arSet = new Set(arKeys);
if (arKeys.length < 100) fail(`ar catalogue looks empty (${arKeys.length} keys) - loader is broken`);
if (enKeys.length < 100) fail(`en catalogue looks empty (${enKeys.length} keys) - loader is broken`);
const onlyAr = arKeys.filter((k) => !enSet.has(k));
const onlyEn = enKeys.filter((k) => !arSet.has(k));
console.log(`   ar=${arKeys.length} en=${enKeys.length}`);
if (onlyAr.length) fail('missing in en: ' + onlyAr.join(', '));
if (onlyEn.length) fail('missing in ar: ' + onlyEn.join(', '));
if (!onlyAr.length && !onlyEn.length) console.log('   parity OK');

/* ---- 3. every t('x.y') resolves ---- */
console.log('3. t() references resolve');
const refs = new Set();
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) refs.add(m[1]);
}
const unresolved = [...refs].filter((k) => !arSet.has(k));
// `refs` is a Set: it has `.size`, not `.length`.
console.log(`   ${refs.size} distinct keys referenced`);
if (refs.size < 20) fail(`only ${refs.size} t() calls matched - the regex is probably broken`);
if (unresolved.length) fail('unresolved t(): ' + unresolved.join(', '));
else console.log('   all resolve');

/* ---- 4. placeholder parity ---- */
console.log('4. {{placeholder}} parity');
const ph = (s) => [...String(s).matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]).sort().join(',');
let phMismatch = 0;
for (const key of arKeys) {
  if (!enSet.has(key)) continue;
  if (ph(get(arO, key)) !== ph(get(enO, key))) {
    fail(`${key}: ar [${ph(get(arO, key))}] != en [${ph(get(enO, key))}]`);
    phMismatch += 1;
  }
}
if (!phMismatch) console.log('   placeholder sets match across all keys');

/* ---- 5. linking config ---- */
console.log('5. linking config');
const linkingSrc = fs.readFileSync('src/seo/linking.js', 'utf8');
// Strip block and line comments so prose about a route cannot be counted.
const linkingCode = linkingSrc
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
for (const r of ['HomeTab', 'ProductsTab', 'WishlistTab', 'CartTab', 'AccountTab']) {
  if (!linkingCode.includes(`${r}:`)) fail(`linking missing ${r}`);
}
const productRouteCount = (linkingCode.match(/['"]product\/:itemCode['"]/g) || []).length;
if (productRouteCount !== 1) {
  fail(`product route declared ${productRouteCount} times (must be exactly 1, else ambiguous)`);
} else {
  console.log('   exactly one product/:itemCode route');
}
const allTabs = ['HomeTab', 'ProductsTab', 'WishlistTab', 'CartTab', 'AccountTab'];
console.log('   all tabs present:', allTabs.every((r) => linkingCode.includes(`${r}:`)));

/* ---- 6. RootNavigator passes linking ---- */
console.log('6. NavigationContainer linking');
const root = fs.readFileSync('src/navigation/RootNavigator.js', 'utf8');
if (!/linking=\{linking\}/.test(root)) fail('NavigationContainer missing linking prop');
else console.log('   wired');

/* ---- 7. product opens go through the helper ---- */
console.log('7. no raw ProductDetail navigation outside the helper');
const raw = [];
for (const f of files) {
  if (f === 'src/seo/linking.js') continue;
  const src = fs.readFileSync(f, 'utf8');
  if (/navigate\(\s*'ProductDetail'/.test(src) || /\bpush\(\s*'ProductDetail'/.test(src)) raw.push(f);
}
if (raw.length) fail('raw ProductDetail navigation in: ' + raw.join(', '));
else console.log('   all product opens go through openProduct()');

/* ---- 8. screens publish head metadata ---- */
console.log('8. indexable screens publish a head');
const expected = {
  'src/screens/home/HomeScreen.js': '/',
  'src/screens/categories/CategoriesScreen.js': '/categories',
  'src/screens/products/ProductsScreen.js': '/products',
  'src/screens/products/ProductDetailScreen.js': '/product/',
  'src/screens/cart/CartScreen.js': "noindex: true",
  'src/screens/auth/LoginScreen.js': "noindex: true",
  'src/screens/account/AccountScreen.js': "noindex: true",
  'src/screens/wishlist/WishlistScreen.js': "noindex: true",
};
for (const [f, needle] of Object.entries(expected)) {
  const src = fs.readFileSync(f, 'utf8');
  if (!src.includes('useDocumentHead(')) fail(`${f} never calls useDocumentHead`);
  else if (!src.includes(needle)) fail(`${f} head missing expected "${needle}"`);
}
console.log('   all 8 screens wired');

/* ---- 9. private pages are noindex and excluded from the sitemap source ---- */
console.log('9. private routes excluded');
const pre = fs.readFileSync('scripts/prerender.mjs', 'utf8');
if (!/omit: noindex/.test(pre)) fail('prerender does not omit untranslated pages from the sitemap');
else console.log('   sitemap omits noindex pages');

/* ---- 10. breakpoint-keyed tokens cover every breakpoint ---- */
console.log('10. responsive tokens cover every breakpoint');
{
  const tokens = fs.readFileSync('src/theme/responsive.js', 'utf8');

  // `BREAKPOINT_KEYS` and the token maps are ESM, so they are read out of the
  // source rather than imported: this file is CommonJS.
  const keysMatch = tokens.match(/BREAKPOINT_KEYS\s*=\s*\[([^\]]*)\]/);
  if (!keysMatch) {
    fail('could not read BREAKPOINT_KEYS from src/theme/responsive.js');
  } else {
    const keys = keysMatch[1]
      .split(',')
      .map((k) => k.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);

    for (const name of ['GUTTER', 'GRID_GAP', 'GRID_COLUMNS']) {
      const mapMatch = tokens.match(new RegExp(`export const ${name}\\s*=\\s*\\{([^}]*)\\}`));
      if (!mapMatch) {
        fail(`${name} not found in src/theme/responsive.js`);
        continue;
      }
      const present = mapMatch[1]
        .split(',')
        .map((k) => k.split(':')[0].trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
      const missing = keys.filter((k) => !present.includes(k));
      if (missing.length) {
        // A missing entry becomes `undefined` at runtime, which propagates into
        // `useGridMetrics` as NaN columns and crashed the Products screen via
        // "columnWrapperStyle not supported for single column lists".
        fail(`${name} is missing: ${missing.join(', ')}`);
      }
    }
    if (failures === 0) console.log(`   GUTTER, GRID_GAP, GRID_COLUMNS all define ${keys.length} breakpoints`);
  }
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);