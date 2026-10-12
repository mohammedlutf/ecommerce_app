// Detects identifiers used but never bound: the "X is not defined" class of
// runtime error that @babel/parser cannot see, because a missing import is
// perfectly valid syntax.
//
//   node scripts/.verify-scope.cjs [dir]
//
// Three text representations are needed, because each stage needs a different
// thing removed:
//
//   raw     - everything. Only the import patterns use this, since they must
//             match the module path between quotes.
//   noComm  - comments removed, strings kept. Declaration patterns run on this:
//             prose containing the words "let", "var" or "const" would otherwise
//             be parsed as declarations.
//   code    - comments AND strings removed. The usage scan runs on this so that
//             "Facebook" or "YER" inside a string is not read as a reference.
//
// Known limitations (all produce false *positives*, never miss a real bug):
//   - JSX text content is indistinguishable from identifiers, so a capitalised
//     word in visible text is reported.
//   - React Navigation prop names such as ListEmptyComponent look like
//     identifiers but need no binding.
//   - JSX tag names are assumed bound.
const fs = require('fs');
const path = require('path');

const GLOBALS = new Set([
  'React', 'Fragment', 'Component', 'PureComponent', 'StrictMode', 'Suspense',
  'JSON', 'Math', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'RegExp',
  'Error', 'TypeError', 'RangeError', 'SyntaxError', 'Promise', 'Set', 'Map', 'WeakMap',
  'WeakSet', 'Symbol', 'Proxy', 'Reflect', 'Intl', 'URL', 'URLSearchParams',
  'AbortController', 'fetch', 'console', 'window', 'document', 'globalThis', 'navigator',
  'location', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
  'requestAnimationFrame', 'cancelAnimationFrame', 'process', 'module', 'exports',
  'require', 'undefined', 'NaN', 'Infinity', 'isNaN', 'isFinite', 'parseInt', 'parseFloat',
  'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI', 'structuredClone',
  'Image', 'Event', 'CustomEvent', 'Headers', 'Request', 'Response', 'FormData', 'Blob',
  'ArrayBuffer', 'Uint8Array', 'TextEncoder', 'TextDecoder',
]);

const HOOKS = [
  'useState', 'useEffect', 'useLayoutEffect', 'useMemo', 'useCallback', 'useRef',
  'useContext', 'useReducer', 'useImperativeHandle', 'useDebugValue', 'useDeferredValue',
  'useTransition', 'useId', 'useSyncExternalStore', 'useInsertionEffect',
];

/** Remove comments only. Strings are preserved. */
function stripComments(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    if (c === '/' && next === '/') {
      while (i < n && src[i] !== '\n') i += 1;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      out += c;
      i += 1;
      while (i < n) {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] || ''); i += 2; continue; }
        out += src[i];
        if (src[i] === q) { i += 1; break; }
        i += 1;
      }
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

/** Remove comments and string/template literals. */
function stripAll(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  // A `/` can only open a regex literal where a division cannot appear.
  const regexOk = new Set(['(', '=', ',', ':', '[', '!', '&', '|', '?', '{', '}', ';', '\n', '+', '-', '*', '%', '<', '>', '~', '^']);
  let lastSignificant = '\n';
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];

    if (c === '/' && next === '/') { while (i < n && src[i] !== '\n') i += 1; continue; }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    if (c === '/' && regexOk.has(lastSignificant)) {
      // regex literal - consume to the closing unescaped slash
      i += 1;
      let inClass = false;
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === '[') inClass = true;
        else if (src[i] === ']') inClass = false;
        else if (src[i] === '/' && !inClass) { i += 1; break; }
        else if (src[i] === '\n') break;
        i += 1;
      }
      while (i < n && /[gimsuyvd]/.test(src[i])) i += 1;
      lastSignificant = '/';
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const q = c;
      i += 1;
      while (i < n) {
        if (src[i] === '\\') { i += 2; continue; }
        if (src[i] === q) { i += 1; break; }
        if (src[i] === '\n') out += '\n';
        i += 1;
      }
      lastSignificant = 'v';
      continue;
    }
    out += c;
    if (!/\s/.test(c)) lastSignificant = c;
    i += 1;
  }
  return out;
}

function namesFromBinding(raw) {
  const out = [];
  for (const part of raw.split(',')) {
    let t = part.trim();
    if (!t) continue;
    t = t.replace(/^\.\.\./, '');
    const obj = t.match(/^\{([\s\S]*)\}/);
    const arr = t.match(/^\[([\s\S]*)\]/);
    if (obj) {
      for (const p of obj[1].split(',')) {
        const k = p.trim().split(/[:=]/)[0].trim();
        if (/^\w+$/.test(k)) out.push(k);
      }
    } else if (arr) {
      for (const p of arr[1].split(',')) {
        const k = p.trim().replace(/^\.\.\./, '');
        if (/^\w+$/.test(k)) out.push(k);
      }
    } else {
      const k = t.split('=')[0].trim();
      if (/^\w+$/.test(k)) out.push(k);
    }
  }
  return out;
}

/**
 * Names this file binds.
 *
 * @param raw    original source, for import patterns (needs quoted paths)
 * @param noComm comments removed, for every other declaration pattern
 */
function boundNames(raw, noComm) {
  const declared = new Set(GLOBALS);
  const add = (pattern, pick, src) => {
    for (const m of src.matchAll(pattern)) {
      for (const name of pick(m)) if (name && /^\w+$/.test(name)) declared.add(name);
    }
  };

  add(/import\s+([\s\S]*?)\s+from\s*['"][^'"]*['"]/g, (m) => {
    const names = [];
    const clause = m[1];
    const braces = clause.match(/\{([\s\S]*?)\}/);
    if (braces) {
      for (const part of braces[1].split(',')) {
        const t = part.trim();
        if (!t) continue;
        const as = t.split(/\s+as\s+/);
        // Both names are "declared": the original appears in the import text,
        // which the usage scan still sees.
        names.push(as[0].trim());
        if (as[1]) names.push(as[1].trim());
      }
    }
    const before = braces ? clause.replace(/\{[\s\S]*?\}/, '') : clause;
    for (const part of before.split(',')) {
      const t = part.trim();
      const ns = t.match(/^\*\s+as\s+(\w+)$/);
      if (ns) names.push(ns[1]);
      else if (/^\w+$/.test(t)) names.push(t);
    }
    return names;
  }, raw);

  // Declarations: on noComm, so prose containing "let"/"var" is not a binding.
  add(/\b(?:const|let|var)\s+([^=;]+?)\s*=/g, (m) => namesFromBinding(m[1]), noComm);
  add(/\bfunction\s*\*?\s*(\w+)/g, (m) => [m[1]], noComm);
  add(/\bclass\s+(\w+)/g, (m) => [m[1]], noComm);
  add(/\(([^()]*)\)\s*(?:=>|\{)/g, (m) => namesFromBinding(m[1]), noComm);
  add(/\b(\w+)\s*=>\s*/g, (m) => (['if', 'for', 'while', 'switch', 'catch', 'return'].includes(m[1]) ? [] : [m[1]]), noComm);

  return declared;
}

/** Capitalised identifiers genuinely referenced (not a property or object key). */
function referencedNames(src) {
  const found = new Set();
  for (const m of src.matchAll(/\b([A-Z][A-Za-z0-9_]*)\b/g)) {
    const before = src[m.index - 1] || '';
    const after = src[m.index + m[0].length] || '';
    if (before === '.') continue; // member access: React.useEffect, process.env.X
    if (after === ':') continue; // object key
    found.add(m[1]);
  }
  return found;
}

/** Hooks referenced as calls, excluding qualified `React.useEffect(...)`. */
function referencedHooks(src) {
  const found = new Set();
  for (const hook of HOOKS) {
    for (const m of src.matchAll(new RegExp(`\\b${hook}\\s*\\(`, 'g'))) {
      if ((src[m.index - 1] || '') === '.') continue;
      found.add(hook);
    }
  }
  return found;
}

// ---- lexical-scope check (AST) --------------------------------------------
//
// The regex scan above flattens the whole file into one namespace, so a `const`
// declared inside `SiteHeader` looks "declared" to a sibling function. That is
// exactly how `MegaPanel` shipped a `t is not defined` crash: `t` was bound in
// the parent component and referenced in the child. Only real scope analysis
// catches it, so this pass walks the AST and asks Babel whether each reference
// actually resolves at the point of use.
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

// Environment-provided names. Deliberately excludes RN/React component names
// (`Image`, `View`, ...): on native there is no such global, so relying on one
// is the bug, not the fix.
const AMBIENT = new Set([
  'console', 'globalThis', 'global', 'self', 'window', 'document', 'navigator',
  'location', 'history', 'screen', 'fetch', 'Headers', 'Request', 'Response',
  'FormData', 'Blob', 'File', 'FileReader', 'URL', 'URLSearchParams', 'AbortController',
  'TextEncoder', 'TextDecoder', 'crypto', 'performance', 'queueMicrotask',
  'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle',
  'matchMedia', 'IntersectionObserver', 'ResizeObserver', 'CustomEvent', 'Event',
  'HTMLElement', 'Element', 'Node', 'CSS', 'Intl',
  'Object', 'Array', 'String', 'Number', 'Boolean', 'Symbol', 'BigInt', 'Promise',
  'ArrayBuffer', 'SharedArrayBuffer', 'DataView',
  'Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array',
  'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array',
  'BigInt64Array', 'BigUint64Array',
  'Set', 'Map', 'WeakMap', 'WeakSet', 'Date', 'RegExp', 'Error', 'TypeError',
  'RangeError', 'SyntaxError', 'Proxy', 'Reflect', 'JSON', 'Math',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'encodeURIComponent',
  'decodeURIComponent', 'encodeURI', 'decodeURI', 'NaN', 'Infinity', 'undefined',
  'alert', 'confirm', 'prompt', 'setTimeout', 'clearTimeout', 'setInterval',
  'clearInterval', 'require', 'module', 'exports', 'process', '__DEV__',
  '__dirname', '__filename',
]);

/** References that resolve to nothing at the point of use. */
function scopeLeakages(src) {
  const ast = parser.parse(src, {
    sourceType: 'module',
    errorRecovery: true,
    plugins: [
      'jsx',
      'classProperties',
      'optionalChaining',
      'nullishCoalescingOperator',
      'objectRestSpread',
      'dynamicImport',
    ],
  });
  const leaks = [];
  const seen = new Set();
  const report = (node, name, kind) => {
    if (seen.has(name)) return; // one finding per name is enough to act on
    seen.add(name);
    leaks.push({ line: node.loc ? node.loc.start.line : 0, name, kind });
  };
  const check = (name, path, kind) => {
    if (!name || AMBIENT.has(name)) return;
    if (path.scope.getBinding(name)) return;
    report(path.node, name, kind);
  };

  traverse(ast, {
    ReferencedIdentifier(path) {
      check(path.node.name, path, 'reference');
    },
    // JSX component names are a separate node type, so they need their own pass.
    JSXOpeningElement(path) {
      const n = path.node.name;
      if (n && n.type === 'JSXIdentifier' && /^[A-Z]/.test(n.name)) {
        check(n.name, path, 'jsx');
      }
    },
  });
  return leaks;
}

// ---- package-export check ---------------------------------------------------
//
// `import { linking } from '@react-navigation/native'` compiled to `undefined`
// rather than failing the build: that package has no `linking` export, but
// Metro's interop produced an undefined binding and the crash only surfaced when
// a customer clicked a category. Metro does not error on a missing named export,
// so nothing else in the pipeline catches it. This resolves the real export
// lists and diffs them against what the app imports.
const PKG_ENTRY_CANDIDATES = [
  'lib/module/index.js',
  'lib/commonjs/index.js',
  'lib/module/index.ts',
  'src/index.tsx',
  'src/index.ts',
];
const exportCache = new Map();

function resolvePackageEntry(pkg) {
  for (const rel of PKG_ENTRY_CANDIDATES) {
    const p = path.join('node_modules', pkg, rel);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function collectExports(file, seen = new Set()) {
  if (exportCache.has(file)) return exportCache.get(file);
  if (seen.has(file)) return new Set();
  seen.add(file);

  const names = new Set();
  exportCache.set(file, names); // cycle guard, filled in below

  let ast;
  try {
    ast = parser.parse(fs.readFileSync(file, 'utf8'), {
      sourceType: 'module',
      errorRecovery: true,
      plugins: ['jsx', 'classProperties', 'dynamicImport'],
    });
  } catch {
    return names; // unparseable entry: report nothing rather than guess
  }

  for (const node of ast.program.body) {
    if (node.type === 'ExportNamedDeclaration') {
      const decl = node.declaration;
      if (decl) {
        if (decl.id && decl.id.name) names.add(decl.id.name);
        for (const d of decl.declarations || []) if (d.id && d.id.name) names.add(d.id.name);
      }
      for (const s of node.specifiers || []) {
        names.add(s.exported.type === 'Identifier' ? s.exported.name : s.exported.value);
      }
    } else if (node.type === 'ExportDefaultDeclaration') {
      names.add('default');
    } else if (node.type === 'ExportAllDeclaration') {
      const src = node.source.value;
      // A re-export may point at a sibling file or at a whole package. React
      // Navigation's own entry does `export * from '@react-navigation/core'`,
      // which is where most of its public API (and half the export list) comes
      // from, so bare specifiers have to be resolved into node_modules too.
      const target =
        src.startsWith('.') || src.startsWith('/')
          ? path.resolve(path.dirname(file), src)
          : resolvePackageEntry(src);
      if (target) for (const n of collectExports(target, seen)) names.add(n);
    }
  }
  return names;
}

/** Named imports pulled from `@react-navigation/*`, which we can resolve locally. */
function navPackageImports(src) {
  const found = [];
  const re = /import\s+\{([^}]*)\}\s+from\s+['"](@react-navigation\/[\w-]+)['"]/g;
  for (const m of src.matchAll(re)) {
    const names = [];
    for (const part of m[1].split(',')) {
      const t = part.trim();
      if (!t) continue;
      const as = t.split(/\s+as\s+/);
      names.push(as[0].trim());
    }
    found.push({ pkg: m[2], names: names.filter((n) => /^\w+$/.test(n)) });
  }
  return found;
}

// ---- self-test: the checker must flag a deliberately broken file ----------
const SELF_TEST = `
import React from 'react';
import { View } from 'react-native';
/** Prose that mentions let and const and var to trip a naive matcher. */
function Bad() {
  const [a, setA] = useState(1);
  const m = useMemo(() => a, [a]);
  const re = /^\\S+$/;
  React.useEffect(() => {}, []);
  return <View>{MissingThing}{m}{re}</View>;
}
`;
{
  const nc = stripComments(SELF_TEST);
  const c = stripAll(SELF_TEST);
  const d = boundNames(SELF_TEST, nc);
  const missing = [...referencedNames(c)].filter((n) => !d.has(n));
  for (const h of referencedHooks(c)) if (!d.has(h)) missing.push(h);

  const expected = ['MissingThing', 'useState', 'useMemo'];
  const absent = expected.filter((e) => !missing.includes(e));
  if (absent.length) {
    console.error(`SELF-TEST FAILED - missed ${absent.join(', ')}. Aborting so a broken checker cannot pass silently.`);
    process.exit(2);
  }
  // The checker must NOT invent these.
  const spurious = ['React', 'S', 'let', 'const', 'var'].filter((e) => missing.includes(e));
  if (spurious.length) {
    console.error(`SELF-TEST FAILED - false positives on ${spurious.join(', ')}. Aborting.`);
    process.exit(2);
  }
  console.log(`self-test OK (detects: ${missing.join(', ')}; no spurious findings)\n`);
}

// ---- self-test 2: the exact `t is not defined` shape ------------------------
// Regression guard for the shipped bug: `t` is bound in the parent component and
// referenced in a sibling, so the flat regex scan calls it "declared".
const SCOPE_TEST = `
import { Text } from 'react-native';
function Parent() {
  const { t } = useI18n();
  return <Child />;
}
function Child() {
  return <Text>{t('nav.help')}</Text>;
}
`;
{
  const flat = boundNames(SCOPE_TEST, stripComments(SCOPE_TEST));
  const leaked = scopeLeakages(SCOPE_TEST);
  const names = leaked.map((l) => l.name);
  for (const want of ['t', 'useI18n']) {
    if (!names.includes(want)) {
      console.error(
        `SCOPE SELF-TEST FAILED - expected the AST pass to report "${want}" (got: ${names.join(', ') || 'nothing'}).`
      );
      process.exit(2);
    }
  }
  if (flat.has('t')) {
console.log(
    `self-test OK - flat scan calls "t" declared (the blind spot); AST pass correctly flags it\n`
  );
}

// ---- self-test 3: a named import that does not exist ------------------------
// Regression guard for the shipped `linking is undefined` crash.
{
  const control = 'NavigationContainer';
  const fake = {
    links: [{ pkg: '@react-navigation/native', names: [control, 'linking', 'notARealExport'] }],
  };
  const entry = resolvePackageEntry('@react-navigation/native');
  const real = entry ? collectExports(entry) : new Set();
  if (real.size) {
    const flagged = fake.links[0].names.filter((n) => !real.has(n));
    if (!flagged.includes('notARealExport') || !flagged.includes('linking')) {
      console.error(
        `EXPORT SELF-TEST FAILED - expected the non-existent exports to be flagged (got: ${flagged.join(', ') || 'nothing'}).`
      );
      process.exit(2);
    }
    if (flagged.includes(control)) {
      console.error(
        `EXPORT SELF-TEST FAILED - false positive on the real export "${control}". Aborting so a noisy checker cannot pass silently.`
      );
      process.exit(2);
    }
    console.log(
      `self-test OK - export pass flags non-existent (${flagged.join(', ')}) and accepts real (${control})\n`
    );
  }
}
}

// ---- scan -----------------------------------------------------------------
const root = process.argv[2] || 'src';
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.js')) files.push(p);
  }
})(root);

let hookProblems = 0;
let reviewCount = 0;
let scopeProblems = 0;
let exportProblems = 0;

for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8');
  const noComm = stripComments(raw);
  const code = stripAll(raw);
  const declared = boundNames(raw, noComm);

  // Hard error: a named import the package does not export resolves to
  // `undefined` at runtime instead of failing the build.
  const bogusImports = [];
  for (const { pkg, names } of navPackageImports(raw)) {
    const entry = resolvePackageEntry(pkg);
    if (!entry) continue;
    const exported = collectExports(entry);
    if (!exported.size) continue; // could not read the package: stay quiet
    for (const n of names) {
      if (!exported.has(n)) bogusImports.push(`${n} (from ${pkg})`);
    }
  }
  if (bogusImports.length) {
    exportProblems += bogusImports.length;
    console.log(file);
    for (const b of bogusImports) console.log(`   NOT EXPORTED (ERROR): ${b}`);
  }

  // Hard error: a name that resolves to nothing in scope throws at render.
  const leaks = scopeLeakages(raw);
  if (leaks.length) {
    scopeProblems += leaks.length;
    console.log(file);
    for (const l of leaks) console.log(`   OUT OF SCOPE (${l.kind}, ERROR) L${l.line}: ${l.name}`);
  }

  const missing = [
    ...[...referencedNames(code)].filter((n) => !declared.has(n)),
    ...[...referencedHooks(code)].filter((n) => !declared.has(n)),
  ];
  if (!missing.length) continue;

  const uniq = [...new Set(missing)];
  // Hooks have no false-positive source, so they are hard errors.
  const hooks = uniq.filter((n) => HOOKS.includes(n));
  // Capitalised names are reported for review only: a word in JSX text
  // ("(Item Code)") is indistinguishable from a reference without a real
  // parser, so failing the build on these would be noise, not safety.
  // The AST pass above is what makes real leaks a hard failure.
  const rest = uniq.filter((n) => !HOOKS.includes(n));

  hookProblems += hooks.length;
  reviewCount += rest.length;

  if (!leaks.length && !bogusImports.length) console.log(file);
  if (hooks.length) console.log(`   MISSING IMPORT (hook, ERROR): ${hooks.join(', ')}`);
  if (rest.length) console.log(`   unreviewed (likely JSX text): ${rest.join(', ')}`);
}

console.log(
  `\n${files.length} files | ${exportProblems} bad import(s) | ${scopeProblems} out-of-scope ref(s) | ${hookProblems} hook error(s) | ${reviewCount} unreviewed identifier(s)`
);
if (exportProblems > 0) {
  console.log('FAIL - a named import is not exported by its package. It resolves to undefined at runtime.');
  process.exit(1);
}
if (scopeProblems > 0) {
  console.log('FAIL - a name is referenced with nothing in scope. This throws "X is not defined" at render.');
  process.exit(1);
}
if (hookProblems > 0) {
  console.log('FAIL - a hook is used but not imported. This throws "X is not defined" at render.');
  process.exit(1);
}
console.log('PASS - every reference and JSX component name resolves in scope.');