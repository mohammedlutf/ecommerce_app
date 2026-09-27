const babel = require('@babel/core');
const fs = require('fs');
const path = require('path');
const Module = require('module');

const root = path.join(__dirname, '..');

function loadModule(relPath, stubs = {}) {
  const out = babel.transformFileSync(path.join(root, relPath), { presets: ['babel-preset-expo'] });
  const tmp = path.join(root, '.' + path.basename(relPath) + '.tmp.cjs');
  fs.writeFileSync(tmp, out.code);

  const origLoad = Module._load;
  const calls = [];
  Module._load = function (request, parent, isMain) {
    for (const [key, value] of Object.entries(stubs)) {
      if (request === key || request.endsWith(key)) return value;
    }
    return origLoad.apply(this, arguments);
  };
  try {
    delete require.cache[require.resolve(tmp)];
    const mod = require(tmp);
    return { mod, calls };
  } finally {
    Module._load = origLoad;
    fs.unlinkSync(tmp);
  }
}

let bad = 0;
const eq = (label, got, want) => {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) {
    bad++;
    console.log('  FAIL ' + label + '\n        got  ' + a + '\n        want ' + b);
  } else {
    console.log('  ok   ' + label);
  }
};

const D = '@yemen.local';

// ---- combined number helper -------------------------------------------------
const { mod: countries } = loadModule('src/constants/countries.js');
const { toCombinedDigits, toFullPhone, DEFAULT_COUNTRY } = countries;
const byCode = (c) => countries.COUNTRIES.find((x) => x.code === c);

console.log('combined number:');
eq('yemen 967 + 771234567', toCombinedDigits(byCode('YE'), '771234567'), '967771234567');
eq('egypt 20 + 1012345678', toCombinedDigits(byCode('EG'), '1012345678'), '201012345678');
eq('strips spaces/dashes', toCombinedDigits(byCode('EG'), '10 123-456 78'), '201012345678');
eq('no plus sign', toFullPhone(byCode('YE'), '771234567'), '+967771234567');
eq('empty national -> empty', toCombinedDigits(byCode('YE'), ''), '');
eq('default is yemen', DEFAULT_COUNTRY.code, 'YE');

// ---- login candidates -------------------------------------------------------
const stub = { frappeCall: async () => ({}), clearSession: async () => {} };
const { mod: authModule } = loadModule('src/api/auth.js', { './client': stub });
const { buildLoginCandidates } = authModule;
const auth = authModule.AuthAPI;

console.log('\nlogin candidates (order matters, duplicates removed):');
eq(
  'yemen: combined then national (last9 collapses into national)',
  buildLoginCandidates('967771234567', '771234567'),
  ['967771234567' + D, '771234567' + D]
);
eq(
  'egypt: combined, national, last9 (all distinct)',
  buildLoginCandidates('201012345678', '1012345678'),
  ['201012345678' + D, '1012345678' + D, '012345678' + D]
);
eq(
  'usa: combined, national, last9',
  buildLoginCandidates('12025550123', '2025550123'),
  ['12025550123' + D, '2025550123' + D, '025550123' + D]
);
eq('short number dedupes', buildLoginCandidates('9671234', '1234'), ['9671234' + D, '1234' + D]);
eq('formats normalised', buildLoginCandidates('967 771 234 567', '771-234-567'), [
  '967771234567' + D,
  '771234567' + D,
]);
eq('empty input -> no candidates', buildLoginCandidates('', ''), []);
eq('first candidate is always the combined number', buildLoginCandidates('967771234567', '771234567')[0], '967771234567' + D);

// ---- login fallback behaviour ----------------------------------------------
const attempts = [];
stub.frappeCall = async (method, args) => {
  attempts.push({ method, args, usr: args && args.usr });
  const plan = stub.plan.shift();
  if (plan && plan.fail) throw new Error(plan.fail);
  return { ok: true };
};

const plan = (list) => {
  stub.plan = list;
  attempts.length = 0;
};

(async () => {
  console.log('\nlogin fallback:');

  plan([{ fail: 'Invalid login credentials' }, { ok: true }]);
  const ok = await auth.login('967771234567', '771234567', 'secret');
  eq('falls back to legacy key and succeeds', ok, { ok: true });
  eq('made 2 attempts', attempts.length, 2);
  eq('attempt 1 = combined', attempts[0].usr, '967771234567' + D);
  eq('attempt 2 = legacy national', attempts[1].usr, '771234567' + D);
  eq('sends pwd on every attempt', attempts.every((a) => a.method === 'login'), true);

  plan([{ fail: 'Invalid login credentials' }, { fail: 'Invalid login credentials' }]);
  let thrown = null;
  try {
    await auth.login('967771234567', '771234567', 'bad');
  } catch (e) {
    thrown = e;
  }
  eq('all fail -> stops after 2 for yemen', attempts.length, 2);
  eq('all fail -> surfaces the FIRST error', thrown && thrown.message, 'Invalid login credentials');

  plan([{ fail: 'Network request failed' }, { ok: true }]);
  thrown = null;
  try {
    await auth.login('967771234567', '771234567', 'secret');
  } catch (e) {
    thrown = e;
  }
  eq('network error aborts immediately', attempts.length, 1);
  eq('network error is rethrown as-is', thrown && thrown.message, 'Network request failed');

  plan([{ fail: 'timeout' }, { ok: true }]);
  thrown = null;
  try {
    await auth.login('201012345678', '1012345678', 'secret');
  } catch (e) {
    thrown = e;
  }
  eq('timeout aborts immediately', attempts.length, 1);

  plan([]);
  thrown = null;
  try {
    await auth.login('', '', 'secret');
  } catch (e) {
    thrown = e;
  }
  eq('empty number -> no request sent', attempts.length, 0);
  eq('empty number -> friendly error', thrown && thrown.message, 'يرجى إدخال رقم الهاتف');

  // ---- register payload -----------------------------------------------------
  console.log('\nregister payload:');
  plan([]);
  await auth.register('201012345678', 'Ahmed', 'secret');
  eq('method is register_user_by_phone', attempts[0].method, 'ecommerce.www.login.register_user_by_phone');
  eq('sends combined number, not truncated', attempts[0].args.phone, '201012345678');
  eq('sends name and password', [attempts[0].args.full_name, attempts[0].args.new_password], ['Ahmed', 'secret']);
  eq('no leftover country_code field', 'country_code' in attempts[0].args, false);
  eq('no leftover full_phone field', 'full_phone' in attempts[0].args, false);

  plan([]);
  await auth.register('967 771 234 567', 'Ahmed', 'secret');
  eq('register normalises formatting', attempts[0].args.phone, '967771234567');

  console.log(bad ? '\nRESULT: ' + bad + ' failure(s)' : '\nRESULT: all checks passed');
  process.exit(bad ? 1 : 0);
})();
