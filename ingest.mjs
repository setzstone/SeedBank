// SeedBank ingest. Runs in GitHub Actions when a "grain" issue gets the "approved" label.
// Reads the issue body (an issue-form render), validates the SS1 share code, pulls the
// attached images down and resizes them, then appends the grain to grains.json.
import { inflateRawSync } from 'node:zlib';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';

const body = process.env.ISSUE_BODY || '';
const fail = (msg) => { writeFileSync('.ingest-error', msg); console.error(msg); process.exit(1); };

// ── 1. Parse the issue form. Fields render as "### Label\n\nvalue".
function field(label) {
  const m = body.match(new RegExp(`### ${label}\\s*\\n+([\\s\\S]*?)(?=\\n### |$)`));
  return m ? m[1].trim() : '';
}
const codeRaw = field('Share code').replace(/^```\w*\n?|```$/g, '').trim();
const code = (codeRaw.match(/SS1:[A-Za-z0-9_-]+/) || [])[0];
if (!code) fail('no SS1 share code found in the issue');
const source = field('Found in').replace(/_No response_/, '').trim() || 'Cymatist';
const video = (field('Video \\(optional\\)').match(/https?:\/\/\S+/) || [''])[0].replace(/_No response_/, '');
const notesField = field('Notes \\(optional\\)').replace(/_No response_/, '').trim();
const imageUrls = [...field('Screenshots').matchAll(/https?:\/\/[^\s)"'<>]+/g)].map(m => m[0])
  .filter(u => process.env.ALLOW_ANY_HOST || /github|githubusercontent/.test(u));
if (!imageUrls.length) fail('no screenshots attached');

// ── 2. Decode and validate the code.
let payload;
try {
  let b64 = code.slice(4).replace(/-/g, '+').replace(/_/g, '/'); b64 += '='.repeat((4 - b64.length % 4) % 4);
  payload = JSON.parse(inflateRawSync(Buffer.from(b64, 'base64')).toString('utf8'));
} catch (e) { fail('share code did not decode: ' + e.message); }
const p = payload.p || {}, v = payload.v || {}, c = payload.c || {};
const COORD = ['freeEnergy', 'resolution', 'inversion', 'halfLife', 'scaleDepth', 'coherence', 'equilibrium', 'temperature', 'viscosity', 'mass'];
for (const k of COORD) if (!Number.isFinite(p[k])) fail(`share code is missing coordinate "${k}"`);

// Same hash the games use for SS-XXXXXX. Do not change.
const HASH_KEYS = [...COORD, 'tempo', 'hue', 'sat', 'lightness', 'opacity', 'trailLen', 'bgGlow', 'bgBlur', 'offsetX', 'offsetY', 'offsetZ', 'billboardOffset'];
function coordHash(pp) {
  let h = '';
  for (const k of HASH_KEYS) { const x = pp[k]; if (x === undefined) continue; h += x < 1 ? x.toFixed(2) : x < 100 ? Math.round(x * 10) / 10 : Math.round(x); }
  let n = 0; for (let i = 0; i < h.length; i++) n = ((n << 5) - n) + h.charCodeAt(i) | 0;
  return 'SS-' + Math.abs(n).toString(36).toUpperCase().slice(0, 8);
}
const coordId = coordHash({ ...p, ...v });

const name = String(payload.n || '').trim().slice(0, 80) || 'Untitled ' + coordId;
const authorName = String(payload.a || '').trim().slice(0, 40) || process.env.ISSUE_USER || '';
const notes = String(payload.d || '').trim().slice(0, 1200) || notesField.slice(0, 1200);

// ── 3. Registry + slug.
const registry = existsSync('grains.json') ? JSON.parse(readFileSync('grains.json', 'utf8')) : {};
if (Object.values(registry).some(g => g.coordId === coordId)) fail(`this coordinate is already planted as ${coordId}`);
let slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || coordId.toLowerCase();
if (registry[slug]) slug += '-' + coordId.toLowerCase().slice(3, 7);

// ── 4. Images: hero at 1600 wide, extras at 1600, a 240px blur-up thumb inlined as base64.
mkdirSync('img', { recursive: true });
const images = [];
for (let i = 0; i < Math.min(imageUrls.length, 12); i++) {
  const res = await fetch(imageUrls[i], { headers: { 'User-Agent': 'seedbank-ingest' } });
  if (!res.ok) fail(`could not download image ${i + 1} (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const file = `img/${slug}${i === 0 ? '' : '-' + i}.jpg`;
  try {
    await sharp(buf).rotate().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 86, mozjpeg: true }).toFile(file);
    await sharp(buf).rotate().jpeg({ quality: 92, chromaSubsampling: '4:4:4', mozjpeg: true }).toFile(file.replace(/\.jpg$/, '.full.jpg'));
  }
  catch (e) { fail(`attachment ${i + 1} isn't an image I can read (${e.message})`); }
  images.push('./' + file);
}
const thumbBuf = await sharp(readFileSync(images[0].slice(2))).resize({ width: 240 }).jpeg({ quality: 70 }).toBuffer();
const thumb = 'data:image/jpeg;base64,' + thumbBuf.toString('base64');

// ── 5. Write.
registry[slug] = {
  slug, name, coordId, authorName, source, notes, video, code, thumb,
  hero: images[0], images: images.slice(1),
  params: p, optics: v,
  camDist: c.d, camPosArr: c.p, camQuatArr: c.q,
  submittedBy: process.env.ISSUE_USER || '', issue: Number(process.env.ISSUE_NUMBER) || 0,
  date: new Date().toISOString().slice(0, 10),
};
writeFileSync('grains.json', JSON.stringify(registry, null, 1));
writeFileSync('.ingest-slug', slug);
console.log('planted', slug, coordId, images.length, 'images');
