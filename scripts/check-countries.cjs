const babel = require('@babel/core');
const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'src', 'constants', 'countries.js');
// Transpiled next to the project so @babel/runtime helpers resolve, then removed.
const tmp = path.join(__dirname, '..', '.countries-check.tmp.cjs');
const out = babel.transformFileSync(src, { presets: ['babel-preset-expo'] });
fs.writeFileSync(tmp, out.code);
let m;
try {
  m = require(tmp);
} finally {
  fs.unlinkSync(tmp);
}

const C = m.COUNTRIES;
let bad = 0;
const fail = (msg) => {
  bad++;
  console.log('  !! ' + msg);
};

console.log('entries: ' + C.length);

const seen = new Map();
for (const c of C) {
  if (!/^[A-Z]{2}$/.test(c.code)) fail('BAD CODE ' + JSON.stringify(c));
  if (seen.has(c.code)) fail('DUP CODE ' + c.code + ': ' + seen.get(c.code) + ' / ' + c.nameAr);
  seen.set(c.code, c.nameAr);
  if (!/^[0-9]{1,3}$/.test(c.dial)) fail('BAD DIAL ' + JSON.stringify(c));
  if (!c.nameAr || !c.name) fail('MISSING NAME ' + JSON.stringify(c));
  if (!c.flag || [...c.flag].length !== 2) fail('BAD FLAG ' + JSON.stringify(c.code));
  if ([...c.flag][0].codePointAt(0) < 0x1f1e6 || [...c.flag][1].codePointAt(0) > 0x1f1ff) {
    fail('FLAG NOT DERIVED FROM ' + c.code);
  }
}

console.log('flag samples:');
for (const code of ['YE', 'SA', 'US', 'EG', 'QA']) {
  const c = C.find((x) => x.code === code);
  console.log('  ' + c.code + ' [' + c.flag + '] +' + c.dial + '  ' + c.nameAr + '  name=' + c.name);
}

const D = m.DEFAULT_COUNTRY;
console.log('default: ' + D.code + ' [' + D.flag + '] +' + D.dial + ' ' + D.nameAr);
if (D.code !== 'YE' || D.dial !== '967') fail('default is not Yemen +967');

console.log('minDigitsFor(YE)=' + m.minDigitsFor(D) + '  minDigitsFor(US)=' + m.minDigitsFor(C.find((x) => x.code === 'US')));
console.log('toFullPhone(YE, 771234567) = ' + m.toFullPhone(D, '771234567'));
console.log('toFullPhone(EG, 10 1234 5678) = ' + m.toFullPhone(C.find((x) => x.code === 'EG'), '10 1234 5678'));

const cases = [
  ['', C.length, 'empty -> all'],
  ['يم', 2, 'substring "ym" -> Yemen + Zimbabwe (both contain it)'],
  ['اليمن', 1, 'arabic full "Yemen" -> Yemen only'],
  ['yemen', 1, 'english "yemen" -> Yemen only'],
  ['967', 1, 'dial 967 -> Yemen only'],
  ['+967', 1, 'dial +967 -> Yemen only'],
  ['saudi', 1, 'english "saudi" -> KSA only'],
  ['مصر', 1, 'arabic "Egypt" -> Egypt only'],
  ['zzzz', 0, 'no match -> empty'],
  ['1', C.filter((c) => c.dial.includes('1')).length, 'dial 1 -> +1 nations'],
];
for (const [q, expected, label] of cases) {
  const got = m.searchCountries(C, q);
  const mark = got.length === expected ? 'ok  ' : 'FAIL';
  if (got.length !== expected) {
    fail('search ' + label + ' expected ' + expected + ' got ' + got.length);
  }
  console.log('  ' + mark + ' search "' + q + '" -> ' + got.length + '  (' + label + ')');
  if (got.length !== expected) {
    console.log('        matched: ' + got.map((c) => c.code + '/' + c.nameAr).join(', '));
  }
}

console.log(bad ? 'RESULT: ' + bad + ' problem(s)' : 'RESULT: all checks passed');
process.exit(bad ? 1 : 0);
