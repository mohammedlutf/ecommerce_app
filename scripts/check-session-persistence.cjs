const babel = require('@babel/core');
const fs = require('fs');
const path = require('path');
const Module = require('module');

const root = path.join(__dirname, '..');
const COOKIE_KEY = '@ecommerce_session_cookie';
const PROFILE_KEY = '@ecommerce_user_profile';

/* ------------------------------------------------------------------ *
 * Header strings captured verbatim from http://192.168.1.38:8000
 * ------------------------------------------------------------------ */

// GET /api/method/ping  (anonymous) — sid happens to come FIRST here.
const REAL_GUEST = [
  'sid=Guest; Expires=Sun, 04 Oct 2026 19:57:45 GMT; Max-Age=612000; HttpOnly; Path=/; SameSite=Lax',
  'system_user=no; Path=/; SameSite=Lax',
  'full_name=Guest; Path=/; SameSite=Lax',
  'user_id=Guest; Path=/; SameSite=Lax',
  'user_image=; Path=/; SameSite=Lax',
];

// GET /api/method/webshop.my_api.api.get_current_user with a dead sid.
// The server expires our cookie AND tells us the session is gone.
const REAL_EXPIRED = [
  'sid=Guest; Expires=Sun, 04 Oct 2026 20:00:10 GMT; Max-Age=612000; HttpOnly; Path=/; SameSite=Lax',
  'sid=; Expires=Sat, 26 Sep 2026 21:00:10 GMT; Path=/',
  'system_user=no; Path=/; SameSite=Lax',
  'full_name=Guest; Path=/; SameSite=Lax',
  'user_id=Guest; Path=/; SameSite=Lax',
];

/**
 * A successful login, with `sid` in the position the server happens to use for
 * an authenticated response. The exact order is a server implementation detail
 * we cannot observe without valid credentials, so every plausible order is
 * exercised — this is the class of input the old parser silently dropped.
 */
const REAL_LOGIN_ORDERS = [
  [
    'sid=8f2b1c9d4e7a6b5c0d3e2f1a9b8c7d6e; Expires=Sun, 04 Oct 2026 19:57:45 GMT; Max-Age=612000; HttpOnly; Path=/; SameSite=Lax',
    'system_user=no; Path=/; SameSite=Lax',
    'full_name=Ahmed; Path=/; SameSite=Lax',
    'user_id=967771234567@yemen.local; Path=/; SameSite=Lax',
    'user_image=; Path=/; SameSite=Lax',
  ],
  [
    'system_user=no; Path=/; SameSite=Lax',
    'full_name=Ahmed; Path=/; SameSite=Lax',
    'user_id=967771234567@yemen.local; Path=/; SameSite=Lax',
    'sid=8f2b1c9d4e7a6b5c0d3e2f1a9b8c7d6e; Expires=Sun, 04 Oct 2026 19:57:45 GMT; Max-Age=612000; HttpOnly; Path=/; SameSite=Lax',
    'user_image=; Path=/; SameSite=Lax',
  ],
  [
    'full_name=Ahmed, Ali; Path=/; SameSite=Lax', // comma inside a value
    'sid=8f2b1c9d4e7a6b5c0d3e2f1a9b8c7d6e; Expires=Sun, 04 Oct 2026 19:57:45 GMT; Max-Age=612000; HttpOnly; Path=/; SameSite=Lax',
    'user_id=967771234567@yemen.local; Path=/; SameSite=Lax',
  ],
  ['sid=8f2b1c9d4e7a6b5c0d3e2f1a9b8c7d6e; Path=/; HttpOnly'], // bare, no Expires
];

const SID = 'sid=8f2b1c9d4e7a6b5c0d3e2f1a9b8c7d6e';

/* ------------------------------------------------------------------ */

const store = new Map();
const AsyncStorage = {
  getItem: async (k) => (store.has(k) ? store.get(k) : null),
  setItem: async (k, v) => { store.set(k, v); },
  removeItem: async (k) => { store.delete(k); },
  multiRemove: async (ks) => { ks.forEach((k) => store.delete(k)); },
};

function loadFrappe() {
  const out = babel.transformFileSync(path.join(root, 'src/api/frappe.js'), {
    presets: ['babel-preset-expo'],
  });
  const tmp = path.join(root, '.frappe.tmp.cjs');
  fs.writeFileSync(tmp, out.code);

  class FakeAxios {
    constructor() {
      this.defaults = {};
      this.interceptors = { response: { use() { } } };
    }
  }

  const origLoad = Module._load;
  Module._load = function (request) {
    if (request === 'frappe-js-sdk') {
      return { FrappeApp: class { constructor() { this.axios = new FakeAxios(); } } };
    }
    if (request === '@react-native-async-storage/async-storage') return AsyncStorage;
    if (request === 'react-native') return { Platform: { OS: 'android' } };
    if (request === './sessionKeys') return { USER_STORAGE_KEY: PROFILE_KEY };
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
const eq = (l, a, e) => ok(l, JSON.stringify(a) === JSON.stringify(e), { actual: a, expected: e });

(async () => {
  const f = loadFrappe();

  console.log('1. a login response is captured whatever the cookie order:');
  for (let i = 0; i < REAL_LOGIN_ORDERS.length; i++) {
    store.clear();
    await f.saveSessionCookie(REAL_LOGIN_ORDERS[i]);
    ok(`login header order #${i + 1} persists the sid`, store.get(COOKIE_KEY) === SID, store.get(COOKIE_KEY));
    ok(`  and reports a live session`, f.hasSessionCookie() === true);
  }

  console.log('\n2. cold start: the persisted sid is reloaded and re-attached:');
  store.clear();
  await f.saveSessionCookie(REAL_LOGIN_ORDERS[1]);
  // Simulate a process restart: module state is gone, AsyncStorage survives.
  const restarted = loadFrappe();
  ok('  fresh process sees no session before init', restarted.hasSessionCookie() === false);
  await restarted.initSession();
  ok('  initSession rehydrates the sid from AsyncStorage', restarted.hasSessionCookie() === true);

  console.log('\n3. anonymous traffic during restore cannot destroy it:');
  for (const [label, headers] of [
    ['ping', REAL_GUEST],
    ['cart (array)', REAL_GUEST],
    ['cart (joined by ", ")', REAL_GUEST.join(', ')],
    ['cart (joined by "; ")', REAL_GUEST.join('; ')],
  ]) {
    await restarted.saveSessionCookie(headers);
    ok(`  ${label} keeps the session`, store.get(COOKIE_KEY) === SID, store.get(COOKIE_KEY));
  }

  console.log('\n4. an expired session is cleared instead of looping on a dead cookie:');
  await restarted.saveSessionCookie(REAL_EXPIRED);
  ok('  dead sid is dropped', store.get(COOKIE_KEY) === undefined, store.get(COOKIE_KEY));
  ok('  hasSessionCookie() is false', restarted.hasSessionCookie() === false);
  await restarted.saveSessionCookie(REAL_EXPIRED);
  ok('  a second expired response is harmless', restarted.hasSessionCookie() === false);

  console.log('\n5. the profile key is the one clearSession() actually removes:');
  store.set(COOKIE_KEY, SID);
  store.set(PROFILE_KEY, JSON.stringify({ email: '967771234567@yemen.local' }));
  await restarted.clearSession();
  ok('  cookie cleared', store.get(COOKIE_KEY) === undefined);
  ok('  cached profile cleared (keys no longer drift apart)', store.get(PROFILE_KEY) === undefined, store.get(PROFILE_KEY));

  console.log('\n6. malformed / hostile input never throws or fakes a session:');
  for (const [label, input] of [
    ['null', null],
    ['undefined', undefined],
    ['empty array', []],
    ['empty string', ''],
    ['no sid at all', ['system_user=no; Path=/']],
    ['not an array', 'system_user=no; Path=/'],
    ['garbage', ';;;,,,'],
  ]) {
    let threw = null;
    try {
      await restarted.saveSessionCookie(input);
    } catch (e) {
      threw = e.message;
    }
    ok(`  ${label} handled without throwing`, threw === null, threw);
  }
  ok('  no bogus session was created', restarted.hasSessionCookie() === false);

  console.log('\n7. a re-login after expiry works cleanly:');
  store.clear();
  await restarted.saveSessionCookie(REAL_EXPIRED);
  await restarted.saveSessionCookie(REAL_LOGIN_ORDERS[0]);
  ok('  new sid stored', store.get(COOKIE_KEY) === SID, store.get(COOKIE_KEY));
  ok('  session live again', restarted.hasSessionCookie() === true);

  console.log('\n8. the old parser is proven to have failed these inputs:');
  const oldParse = (setCookie) => {
    if (!setCookie) return null;
    const s = Array.isArray(setCookie) ? setCookie.join(',') : setCookie;
    const m = s.match(/(?:^|,\s*)sid=([^;,\s]+)/);
    return m ? `sid=${m[1]}` : null;
  };
  ok('  old parser dropped the deletion cookie', oldParse(REAL_EXPIRED) === 'sid=Guest');
  ok('  ...and would have re-saved it as the live session', oldParse(REAL_EXPIRED) !== null);

  console.log(bad ? '\nRESULT: ' + bad + ' failure(s)' : '\nRESULT: all checks passed');
  process.exit(bad ? 1 : 0);
})();
