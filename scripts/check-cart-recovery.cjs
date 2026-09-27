const babel = require('@babel/core');
const fs = require('fs');
const path = require('path');
const Module = require('module');

const root = path.join(__dirname, '..');

const store = new Map();
const AsyncStorage = {
  getItem: async (k) => (store.has(k) ? store.get(k) : null),
  setItem: async (k, v) => { store.set(k, v); },
  removeItem: async (k) => { store.delete(k); },
};

function loadCartRecovery() {
  const out = babel.transformFileSync(path.join(root, 'src/utils/cartRecovery.js'), {
    presets: ['babel-preset-expo'],
  });
  const tmp = path.join(root, '.cartRecovery.tmp.cjs');
  fs.writeFileSync(tmp, out.code);

  const origLoad = Module._load;
  Module._load = function (request) {
    if (request === '@react-native-async-storage/async-storage') return AsyncStorage;
    return origLoad.apply(this, arguments);
  };
  try {
    delete require.cache[require.resolve(tmp)];
    return require(tmp);
  } finally {
    Module._load = origLoad;
    fs.unlinkSync(tmp);
  }
}

let bad = 0;
const ok = (label, cond, extra) => {
  if (cond) console.log('  ok   ' + label);
  else {
    bad++;
    console.log('  FAIL ' + label + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : ''));
  }
};
const eq = (label, actual, expected) =>
  ok(label, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected });

(async () => {
  const cr = loadCartRecovery();
  const A = '967771234567@yemen.local';
  const B = '967770000000@yemen.local';

  console.log('line normalisation:');
  eq('drops lines with no item_code', cr.normaliseLines([{ qty: 1 }]), []);
  eq('drops zero / negative / NaN quantities',
    cr.normaliseLines([{ item_code: 'X', qty: 0 }, { item_code: 'Y', qty: -2 }, { item_code: 'Z', qty: 'abc' }]), []);
  eq('merges duplicate item_code + uom instead of sending two lines',
    cr.normaliseLines([
      { item_code: 'X', qty: 1, uom: 'قطعة' },
      { item_code: 'X', qty: 2, uom: 'قطعة' },
    ]), [{ item_code: 'X', qty: 3, uom: 'قطعة' }]);
  eq('keeps the same item under different UOMs as separate lines',
    cr.normaliseLines([
      { item_code: 'X', qty: 1, uom: 'قطعة' },
      { item_code: 'X', qty: 4, uom: 'كرتونة' },
    ]), [{ item_code: 'X', qty: 1, uom: 'قطعة' }, { item_code: 'X', qty: 4, uom: 'كرتونة' }]);
  eq('coerces string quantities from the server', cr.normaliseLines([{ item_code: 'X', qty: '2.5' }]),
    [{ item_code: 'X', qty: 2.5, uom: null }]);

  console.log('\nround trip:');
  const cart = [
    { item_code: '22100011', qty: 1, uom: 'كيلو جرام', rate: 9000 },
    { item_code: '22100151', qty: 2, uom: 'قطعة', rate: 500 },
  ];
  ok('saves a snapshot', await cr.saveCartSnapshot(A, cart) === true);
  const back = await cr.readCartSnapshot(A);
  eq('reads the same lines back', back.lines, [
    { item_code: '22100011', qty: 1, uom: 'كيلو جرام' },
    { item_code: '22100151', qty: 2, uom: 'قطعة' },
  ]);

  console.log('\ncross-account safety:');
  ok('account B has no snapshot of its own', (await cr.readCartSnapshot(B)) === null);
  ok('account A still has hers', (await cr.readCartSnapshot(A)) !== null);
  await cr.clearCartSnapshot(A);
  ok('clearing A does not touch B', (await cr.readCartSnapshot(A)) === null && (await cr.readCartSnapshot(B)) === null);
  eq('storage keys are per-customer', cr.snapshotKeyFor(A) !== cr.snapshotKeyFor(B), true);
  eq('key is case/whitespace insensitive so one account cannot fork into two',
    cr.snapshotKeyFor('  User@Example.com '), cr.snapshotKeyFor('user@example.com'));

  console.log('\nstale snapshots are refused:');
  await cr.saveCartSnapshot(A, cart);
  const raw = JSON.parse(store.get(cr.snapshotKeyFor(A)));
  store.set(cr.snapshotKeyFor(A), JSON.stringify({ ...raw, savedAt: raw.savedAt - (8 * 24 * 60 * 60 * 1000) }));
  ok('a snapshot older than the max age is ignored', (await cr.readCartSnapshot(A)) === null);
  store.set(cr.snapshotKeyFor(A), JSON.stringify({ ...raw, savedAt: raw.savedAt - (60 * 1000) }));
  ok('a one minute old snapshot is still accepted', (await cr.readCartSnapshot(A)) !== null);

  console.log('\ncorrupt / empty input never resurrects a cart:');
  store.set(cr.snapshotKeyFor(A), '{not json');
  ok('unparseable JSON is ignored', (await cr.readCartSnapshot(A)) === null);
  store.set(cr.snapshotKeyFor(A), JSON.stringify({ savedAt: Date.now(), lines: [] }));
  ok('a snapshot with no lines is ignored', (await cr.readCartSnapshot(A)) === null);
  store.set(cr.snapshotKeyFor(A), JSON.stringify({ lines: cart }));
  ok('a snapshot with no timestamp is ignored', (await cr.readCartSnapshot(A)) === null);

  console.log('\nsaving an empty cart clears any old snapshot:');
  await cr.saveCartSnapshot(A, cart);
  ok('snapshot exists', (await cr.readCartSnapshot(A)) !== null);
  await cr.saveCartSnapshot(A, []);
  ok('emptying the cart removes it, so it cannot be "restored" later',
    (await cr.readCartSnapshot(A)) === null);
  ok('no snapshot is written without an identity', (await cr.saveCartSnapshot(null, cart)) === false);

  console.log('\nno temp files left behind:');
  ok('clean', !fs.existsSync(path.join(root, '.cartRecovery.tmp.cjs')));

  console.log(bad ? '\nRESULT: ' + bad + ' failure(s)' : '\nRESULT: all checks passed');
  process.exit(bad ? 1 : 0);
})();
