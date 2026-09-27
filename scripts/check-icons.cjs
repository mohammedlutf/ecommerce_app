const path = require('path');

const mapPath = path.join(
  __dirname,
  '..',
  'node_modules',
  '@expo',
  'vector-icons',
  'build',
  'vendor',
  'react-native-vector-icons',
  'Fonts',
  'Ionicons.json'
);

let glyphs;
try {
  glyphs = require(mapPath);
} catch (e) {
  // Newer @expo/vector-icons keeps the map in a different place.
  const alt = path.join(__dirname, '..', 'node_modules', '@expo', 'vector-icons', 'build', 'vendor', 'react-native-vector-icons', 'glyphmaps', 'Ionicons.json');
  glyphs = require(alt);
}

const needed = ['chevron-down', 'close', 'search', 'close-circle', 'checkmark', 'alert-circle-outline', 'phone-portrait-outline', 'lock-closed-outline', 'person-outline', 'eye-outline', 'eye-off-outline'];

let bad = 0;
for (const name of needed) {
  const ok = Object.prototype.hasOwnProperty.call(glyphs, name);
  if (!ok) bad++;
  console.log((ok ? 'ok   ' : 'MISS ') + name);
}
console.log('glyphmap entries: ' + Object.keys(glyphs).length);
console.log(bad ? 'RESULT: ' + bad + ' missing icon(s)' : 'RESULT: all icon names valid');
process.exit(bad ? 1 : 0);
