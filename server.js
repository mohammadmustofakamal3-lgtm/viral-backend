const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const SITE = (process.env.SITE_URL || 'https://viral362.site').replace(/\/$/, '');
const SITE_NAME = 'VIRAL BD 362';
const DATA_DIR = process.env.DATA_DIR || __dirname;
const DB_FILE = path.join(DATA_DIR, 'database.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const SECRET = process.env.SECRET || ADMIN_PASSWORD || 'change-me';
const PUBLIC = path.join(__dirname, 'public');
const COLLECTIONS = ['videos', 'filters', 'links', 'direct_links', 'ad_codes'];

/* ---------- ডেটাবেস (JSON ফাইল) ---------- */
let db = { videos: [], filters: [], links: [], direct_links: [], ad_codes: [], settings: {} };
try {
  if (fs.existsSync(DB_FILE)) db = Object.assign(db, JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
} catch (e) { console.error('database.json পড়া যায়নি:', e.message); }

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const tmp = DB_FILE + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(db));
      fs.renameSync(tmp, DB_FILE);
    } catch (e) { console.error('সেভ ব্যর্থ:', e.message); }
  }, 300);
}
const uid = () => crypto.randomBytes(4).toString('hex');

/* ---------- হেল্পার ---------- */
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const slugify = s => String(s || '').normalize('NFKC').toLowerCase()
  .replace(/[^\p{L}\p{N}\p{M}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'video';
const videoPath = v => `/video/${encodeURIComponent((v.slug ? slugify(v.slug) : slugify(v.name)) + '-' + v.id)}`;
const catName = id => (db.filters.find(f => f.id === id) || {}).name || '';
const sortedVideos = () => [...db.videos].sort((a, b) => {
  const oa = a.order != null && a.order !== '' ? Number(a.order) : 999999;
  const ob = b.order != null && b.order !== '' ? Number(b.order) : 999999;
  return oa !== ob ? oa - ob : (b.created_at || 0) - (a.created_at || 0);
});
const autoDesc = v => `${v.name} — Bangla viral video দেখুন, শেয়ার করুন ও ডাউনলোড করুন ${SITE_NAME}-এ।`;

/* ---------- এডমিন টোকেন ---------- */
const sign = exp => crypto.createHmac('sha256', SECRET).update(String(exp)).digest('hex');
const makeToken = () => { const exp = Date.now() + 7 * 24 * 3600 * 1000; return exp + '.' + sign(exp); };
function validToken(t) {
  const [exp, sig] = String(t || '').split('.');
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  const good = sign(exp);
  return sig.length === good.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good));
}
function auth(req, res, next) {
  const t = (req.headers.authorization || '').replace(/^Bearer /, '');
  return validToken(t) ? next() : res.status(401).json({ error: 'unauthorized' });
}
const attempts = new Map();

/* ---------- অ্যাপ ---------- */
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => { res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204); next(); });

/* ---------- পাবলিক API ---------- */
app.get('/api/data', (req, res) => {
  const s = db.settings || {};
  res.set('Cache-Control', 'public, max-age=30');
  res.json({
    videos: sortedVideos().map(v => ({ ...v, path: videoPath(v) })),
    filters: db.filters,
    links: db.links,
    direct_links: db.direct_links.map(d => d.url).filter(Boolean),
    ad_codes: db.ad_codes.filter(a => a.active !== false),
    settings: { tutorial_id: s.tutorial_id || '', vast_enabled: s.vast_enabled === true, vast_url: s.vast_url || '' }
  });
});

/* ---------- এডমিন API ---------- */
app.post('/api/admin/login', (req, res) => {
  const ip = req.ip, now = Date.now();
  const a = (attempts.get(ip) || []).filter(t => now - t < 15 * 60 * 1000);
  if (a.length >= 10) return res.status(429).json({ error: 'too many attempts' });
  const ok = ADMIN_PASSWORD && String(req.body.password || '') === ADMIN_PASSWORD;
  if (!ok) { a.push(now); attempts.set(ip, a); return res.status(401).json({ error: 'wrong password' }); }
  res.json({ token: makeToken() });
});
app.get('/api/admin/data', auth, (req, res) => res.json(db));
app.get('/api/admin/export', auth, (req, res) => {
  res.setHeader('Content-Disposition', 'attachment; filename="database-backup.json"');
  res.json(db);
});
app.post('/api/admin/import', auth, (req, res) => {
  const d = req.body || {};
  COLLECTIONS.forEach(c => { if (Array.isArray(d[c])) db[c] = d[c]; });
  if (d.settings && typeof d.settings === 'object') db.settings = d.settings;
  save(); res.json({ ok: true });
});
app.put('/api/admin/settings', auth, (req, res) => {
  const b = req.body || {};
  db.settings = Object.assign(db.settings || {}, {
    tutorial_id: String(b.tutorial_id || ''), vast_enabled: b.vast_enabled === true, vast_url: String(b.vast_url || '')
  });
  save(); res.json(db.settings);
});
function col(req, res, next) { COLLECTIONS.includes(req.params.col) ? next() : res.status(404).json({ error: 'not found' }); }
app.post('/api/admin/:col', auth, col, (req, res) => {
  const item = { ...req.body, id: req.body.id && req.params.col === 'filters' ? String(req.body.id) : uid() };
  if (req.params.col !== 'filters') item.id = uid();
  item.created_at = Date.now();
  db[req.params.col].push(item); save(); res.json(item);
});
app.put('/api/admin/:col/:id', auth, col, (req, res) => {
  const list = db[req.params.col], i = list.findIndex(x => x.id === req.params.id);
  if (i < 0) return res.status(404).json({ error: 'not found' });
  list[i] = { ...list[i], ...req.body, id: list[i].id, created_at: list[i].created_at, updated_at: Date.now() };
  save(); res.json(list[i]);
});
app.delete('/api/admin/:col/:id', auth, col, (req, res) => {
  db[req.params.col] = db[req.params.col].filter(x => x.id !== req.params.id);
  save(); res.json({ ok: true });
});

/* ---------- SEO: পেজ তৈরি ---------- */
function shell(head, body, extra) {
  let html;
  try { html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8'); }
  catch (e) { return '<h1>index.html পাওয়া যায়নি (public ফোল্ডারে রাখুন)</h1>'; }
  return html.replace('<!--SEO_HEAD-->', head).replace('<!--SEO_BODY-->', body)
    .replace('<!--SEO_DATA-->', extra || '');
}
function metaHead({ title, desc, url, image, keywords, type, ld }) {
  return `<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${keywords ? `<meta name="keywords" content="${esc(keywords)}">` : ''}
<meta name="robots" content="index, follow, max-image-preview:large, max-video-preview:-1">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="${type || 'website'}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:locale" content="bn_BD">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
${image ? `<meta property="og:image" content="${esc(image)}">` : ''}
<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
${image ? `<meta name="twitter:image" content="${esc(image)}">` : ''}
${ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` : ''}`;
}
const linkList = list => '<ul>' + list.map(v => `<li><a href="${videoPath(v)}">${esc(v.name)}</a></li>`).join('') + '</ul>';
const send = (res, html, status) => res.status(status || 200).set('Content-Type', 'text/html; charset=utf-8').send(html);

app.get('/', (req, res) => {
  const title = `${SITE_NAME} — Bangla Viral Video দেখুন ও ডাউনলোড করুন`;
  const desc = `${SITE_NAME} — Bangla viral video, ট্রেন্ডিং ও নতুন ভাইরাল ভিডিও একসাথে। সহজে দেখুন, শেয়ার করুন ও ডাউনলোড করুন।`;
  const ld = { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE_NAME, url: SITE + '/', inLanguage: 'bn' };
  const body = `<div id="seo-content"><h1>${SITE_NAME} — Bangla Viral Video</h1><p>${esc(desc)}</p>${linkList(sortedVideos().slice(0, 40))}</div>`;
  send(res, shell(metaHead({ title, desc, url: SITE + '/', ld }), body));
});

app.get('/category/:id', (req, res) => {
  const f = db.filters.find(x => x.id === req.params.id);
  if (!f) return send(res, shell('<title>পাওয়া যায়নি</title><meta name="robots" content="noindex">', '<div id="seo-content"><h1>পেজ পাওয়া যায়নি</h1></div>'), 404);
  const list = sortedVideos().filter(v => v.category === f.id);
  const title = `${f.name} — Bangla Viral Video | ${SITE_NAME}`;
  const desc = `${f.name} ক্যাটাগরির বাংলা ভাইরাল ভিডিও দেখুন ও ডাউনলোড করুন। মোট ${list.length}টি ভিডিও।`;
  const url = `${SITE}/category/${encodeURIComponent(f.id)}`;
  const body = `<div id="seo-content"><h1>${esc(f.name)}</h1><p>${esc(desc)}</p>${linkList(list.slice(0, 60))}</div>`;
  send(res, shell(metaHead({ title, desc, url }), body, `<script>window.__CATEGORY__=${JSON.stringify(f.id)}</script>`));
});

app.get('/video/:slug', (req, res) => {
  const id = String(req.params.slug).split('-').pop();
  const v = db.videos.find(x => x.id === id);
  if (!v) return send(res, shell('<title>ভিডিও পাওয়া যায়নি</title><meta name="robots" content="noindex">', '<div id="seo-content"><h1>ভিডিও পাওয়া যায়নি</h1><a href="/">হোমে ফিরুন</a></div>'), 404);
  const canonicalPath = videoPath(v);
  if (decodeURIComponent(canonicalPath.slice(7)) !== req.params.slug) return res.redirect(301, canonicalPath);
  const url = SITE + canonicalPath;
  const title = v.seo_title || `${v.name} — ${SITE_NAME}`;
  const desc = (v.seo_desc || v.description || autoDesc(v)).slice(0, 300);
  const cat = catName(v.category);
  const ld = {
    '@context': 'https://schema.org', '@type': 'VideoObject',
    name: v.name, description: desc, thumbnailUrl: [v.image_url].filter(Boolean),
    uploadDate: new Date(v.created_at || Date.now()).toISOString(), url, inLanguage: 'bn'
  };
  const related = sortedVideos().filter(x => x.id !== v.id && (!v.category || x.category === v.category)).slice(0, 8);
  const body = `<div id="seo-content"><article><h1>${esc(v.name)}</h1>
${v.image_url ? `<img src="${esc(v.image_url)}" alt="${esc(v.name)}" width="480" height="270">` : ''}
<p>${esc(v.description || autoDesc(v))}</p>
${cat ? `<p>ক্যাটাগরি: <a href="/category/${encodeURIComponent(v.category)}">${esc(cat)}</a></p>` : ''}
<h2>আরও ভিডিও</h2>${linkList(related)}</article></div>`;
  const data = `<script>window.__VIDEO_ID__=${JSON.stringify(v.id)}</script>`;
  send(res, shell(metaHead({ title, desc, url, image: v.image_url, keywords: v.keywords, type: 'video.other', ld }), body, data));
});

/* ---------- sitemap ও robots ---------- */
app.get('/sitemap.xml', (req, res) => {
  const iso = t => new Date(t || Date.now()).toISOString();
  const urls = [`<url><loc>${SITE}/</loc><changefreq>hourly</changefreq><priority>1.0</priority></url>`];
  db.filters.forEach(f => urls.push(`<url><loc>${esc(SITE + '/category/' + encodeURIComponent(f.id))}</loc><changefreq>daily</changefreq><priority>0.7</priority></url>`));
  sortedVideos().forEach(v => urls.push(`<url><loc>${esc(SITE + videoPath(v))}</loc><lastmod>${iso(v.updated_at || v.created_at)}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`));
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`);
});
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\n\nSitemap: ${SITE}/sitemap.xml\n`);
});

/* ---------- এডমিন পেজ ও স্ট্যাটিক ফাইল ---------- */
app.get('/admin', (req, res) => {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.sendFile(path.join(PUBLIC, 'admin.html'));
});
app.use(express.static(PUBLIC, { index: false, maxAge: '1h' }));
app.use((req, res) => res.redirect(302, '/'));

app.listen(PORT, () => console.log('সার্ভার চালু, পোর্ট ' + PORT));
