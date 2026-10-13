/*
 * Round-trip test for the locale-aware linking helpers in src/seo/linking.js.
 *
 * The helper bodies are lifted verbatim out of the real source and run against
 * the real locales module and the real @react-navigation/core resolvers, so this
 * test cannot drift away from what ships.
 *
 * This exists because the URL layer is the one part of this app with no type
 * checking and no test coverage: a mismatch between the linking config and the
 * prerenderer's route list fails only when a customer opens a link.
 */
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');

const APP = path.join(__dirname, '..');
const {
  getPathFromState: gpfsDefault,
  getStateFromPath: gsfpDefault,
} = require('@react-navigation/core');

/** Evaluate the top-level declarations of an ESM module as a plain script. */
function loadPlainModule(relPath, exportNames) {
  const src = fs.readFileSync(path.join(APP, relPath), 'utf8');
  const ast = parser.parse(src, { sourceType: 'module' });
  const body = ast.program.body
    .map((n) => (n.type === 'ExportNamedDeclaration' ? n.declaration : n))
    .filter((n) => n && (n.type === 'FunctionDeclaration' || n.type === 'VariableDeclaration'))
    .map((n) => src.slice(n.start, n.end).replace(/^export\s+/, ''))
    .join('\n');
  return new Function(`${body}\nreturn { ${exportNames.join(', ')} };`)();
}

const L = loadPlainModule('src/i18n/locales.js', [
  'DEFAULT_LOCALE',
  'isSupportedLocale',
  'pathWithLocale',
  'stripLocaleFromPath',
]);

// --- lift the helpers out of src/seo/linking.js ------------------------------
const linkSrc = fs.readFileSync(path.join(APP, 'src/seo/linking.js'), 'utf8');
const ast = parser.parse(linkSrc, { sourceType: 'module', plugins: ['jsx'] });

function lift(name) {
  const node = ast.program.body.find((n) => n.type === 'FunctionDeclaration' && n.id.name === name);
  if (!node) throw new Error(`helper missing from linking.js: ${name}`);
  return linkSrc.slice(node.start, node.end);
}

function liftConst(name) {
  const node = ast.program.body.find(
    (n) => n.type === 'VariableDeclaration' && new RegExp(`^const ${name}\\b`).test(linkSrc.slice(n.start, n.end))
  );
  if (!node) throw new Error(`const missing from linking.js: ${name}`);
  return linkSrc.slice(node.start, node.end);
}

const factory = new Function(
  'L',
  'GPF',
  'GSP',
  [
    'const isWeb = false;',
    liftConst('URL_HIDDEN_PARAMS'),
    'const { DEFAULT_LOCALE, isSupportedLocale, pathWithLocale, stripLocaleFromPath } = L;',
    'const getPathFromStateDefault = GPF;',
    'const getStateFromPathDefault = GSP;',
    lift('currentLocale'),
    lift('prefixLocale'),
    lift('unprefixLocale'),
    lift('stripUrlHiddenParams'),
    lift('getPathFromState'),
    lift('getStateFromPath'),
  ].join('\n') +
    '\nreturn { getPathFromState, getStateFromPath, prefixLocale, stripUrlHiddenParams };'
);

const H = factory(L, gpfsDefault, gsfpDefault);

// --- read the real linking config straight out of the source -----------------
const linkingDecl = ast.program.body.find(
  (n) =>
    n.type === 'ExportNamedDeclaration' &&
    n.declaration &&
    n.declaration.type === 'VariableDeclaration' &&
    (n.declaration.declarations || []).some((d) => d.id.name === 'linking')
);
// The slice keeps whatever line endings the working-tree file has; with
// core.autocrlf enabled that is CRLF on Windows while the committed blob is LF.
// Normalise before matching (and before `new Function` below) so the test is
// line-ending agnostic instead of depending on the checkout's eol settings.
const slice = linkSrc.slice(linkingDecl.start, linkingDecl.end).replace(/\r\n/g, '\n');
const configMatch = /config:\s*(\{[\s\S]*?\n {2}\}),\n\}/.exec(slice);
if (!configMatch) throw new Error('could not extract config from linking.js');
const config = new Function(
  `return ${configMatch[1].replace(/^\s*config:\s*/, '').replace(/:\s*'https?:\/\/[^']*'/g, ":'https://site.test'").replace(/,?\s*'http:\/\/localhost:8081'/g, '')};`
)();

let failures = 0;
function check(label, actual, expected) {
  if (actual === expected) {
    console.log(`ok   ${label}`);
    return;
  }
  failures++;
  console.log(`FAIL ${label}`);
  console.log(`       expected: ${expected}`);
  console.log(`       actual:   ${actual}`);
}

const focused = (st) => {
  if (!st) return null;
  const tab = st.routes[0];
  // `index` is omitted when it is 0, so default rather than trusting it.
  const inner = tab.state;
  const scr = inner ? inner.routes[inner.index ?? 0] : null;
  return scr ? `${tab.name}/${scr.name}` : `${tab.name}`;
};

const productsState = (params) => ({
  index: 0,
  routes: [{ name: 'ProductsTab', state: { index: 0, routes: [{ name: 'Products', params }] } }],
});
const homeState = {
  index: 0,
  routes: [{ name: 'HomeTab', state: { index: 0, routes: [{ name: 'Home', params: {} }] } }],
};
const detailState = {
  index: 0,
  routes: [
    {
      name: 'ProductsTab',
      state: {
        index: 1,
        routes: [
          { name: 'Products', params: {} },
          { name: 'ProductDetail', params: { itemCode: 'ABC-1' } },
        ],
      },
    },
  ],
};

console.log('--- URL -> state (every prerendered path must resolve)');
const deepLinks = {
  '/ar': 'HomeTab/Home',
  '/en': 'HomeTab/Home',
  '/ar/categories': 'HomeTab/Categories',
  '/ar/products': 'ProductsTab/Products',
  '/en/products': 'ProductsTab/Products',
  '/ar/products/dairy': 'ProductsTab/Products',
  '/en/products/dairy': 'ProductsTab/Products',
  '/ar/product/ABC-1': 'ProductsTab/ProductDetail',
  '/en/product/ABC-1': 'ProductsTab/ProductDetail',
  '/ar/wishlist': 'WishlistTab/WishlistScreen',
  '/ar/cart': 'CartTab/Cart',
  '/ar/order/ORD-9': 'CartTab/OrderConfirmation',
  '/ar/account': 'AccountTab/Account',
  '/ar/login': 'AccountTab/Login',
};
for (const [url, expected] of Object.entries(deepLinks)) {
  check(url, focused(H.getStateFromPath(url, config)), expected);
}

console.log('\n--- state -> URL (locale kept, transient params dropped)');
check('home', H.getPathFromState(homeState, config), '/ar');
check('category', H.getPathFromState(productsState({ itemGroup: 'dairy' }), config), '/ar/products/dairy');
check('no category (no trailing slash)', H.getPathFromState(productsState({}), config), '/ar/products');
check(
  'search keeps query, drops seed + focusSearch',
  H.getPathFromState(productsState({ search: 'rice', seed: 1750000000000, focusSearch: undefined }), config),
  '/ar/products?search=rice'
);
check('product detail', H.getPathFromState(detailState, config), '/ar/product/ABC-1');

console.log('\n--- round trip (state -> URL -> state)');
for (const [label, st] of [
  ['home', homeState],
  ['category', productsState({ itemGroup: 'dairy' })],
  ['product', detailState],
]) {
  const url = H.getPathFromState(st, config);
  check(`${label}: ${url}`, focused(H.getStateFromPath(url, config)), focused(st));
}

console.log(
  `\n${failures === 0 ? 'PASS' : failures + ' FAILURE(S)'} - linking URL round trip`
);
process.exit(failures === 0 ? 0 : 1);