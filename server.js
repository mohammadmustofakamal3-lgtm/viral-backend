const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

const ADMIN_PASSWORD = "ViralAdmin2026!";
const DB_FILE = path.join(__dirname, 'database.json');

// ডেটাবেস রিড/রাইট ফাংশন
function getDB() {
    if (!fs.existsSync(DB_FILE)) return { videos: [], filters: [], links: [], direct_links: [], ad_codes: [], settings: {} };
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function saveDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// সিকিউরিটি চেক মিডলওয়্যার
const auth = (req, res, next) => {
    const pass = req.body.pass || req.query.pass;
    if (pass !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Unauthorized' });
    next();
};

// ১. হোম পেজ
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// ২. অ্যাডমিন পেজ
app.get('/admin', (req, res) => {
    const pass = req.query.pass;
    if (pass !== ADMIN_PASSWORD) {
        return res.send(`
            <div style="font-family:sans-serif;text-align:center;margin-top:100px;background:#0a0a1a;color:#fff;height:100vh;">
                <h2 style="color:#ef4444;">প্রবেশাধিকার নেই</h2>
                <form><input type="password" name="pass" placeholder="পাসওয়ার্ড" style="padding:10px;margin:10px;"><br>
                <button type="submit" style="padding:10px 20px;background:#8b5cf6;color:#fff;border:none;border-radius:5px;">লগইন</button></form>
            </div>
        `);
    }
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// ৩. অ্যাডমিন ডেটা নিয়ে আসা (Get All)
app.get('/api/admin/data', auth, (req, res) => res.json(getDB()));

// ৪. ভিডিও অ্যাড/এডিট
app.post('/api/admin/video', auth, (req, res) => {
    const db = getDB();
    const v = req.body;
    if (v.id && db.videos.find(x => x.id === v.id)) {
        db.videos = db.videos.map(x => x.id === v.id ? v : x);
    } else {
        v.id = "v" + Date.now();
        v.created_at = Date.now();
        db.videos.unshift(v);
    }
    saveDB(db);
    res.json({ success: true });
});

// ৫. ডেটা ডিলিট (ভিডিও, ক্যাটাগরি, অ্যাড কোড ইত্যাদি)
app.delete('/api/admin/delete', auth, (req, res) => {
    const { type, id } = req.query;
    const db = getDB();
    
    if (type === 'video') db.videos = db.videos.filter(x => x.id !== id);
    else if (type === 'filter') db.filters = db.filters.filter(x => x.id !== id);
    else if (type === 'link') db.links = db.links.filter(x => x.id !== id);
    else if (type === 'direct_link') db.direct_links = db.direct_links.filter(x => x.id !== id);
    else if (type === 'ad_code') db.ad_codes = db.ad_codes.filter(x => x.id !== id);

    saveDB(db);
    res.json({ success: true });
});

// ৬. অন্যান্য অ্যাডমিন অ্যাকশন (ক্যাটাগরি, লিংক, সেটিংস)
app.post('/api/admin/save-other', auth, (req, res) => {
    const { type, data } = req.body;
    const db = getDB();
    
    if (type === 'settings') {
        db.settings = data;
    } else {
        const arr = db[type + 's']; // e.g. filters, links, direct_links, ad_codes
        if (data.id) {
            const idx = arr.findIndex(x => x.id === data.id);
            if (idx > -1) arr[idx] = data; else arr.push(data);
        } else {
            data.id = Date.now().toString();
            arr.push(data);
        }
    }
    saveDB(db);
    res.json({ success: true });
});

// ৭. ফ্রন্টএন্ডের জন্য পাবলিক ডেটা
app.get('/api/data', (req, res) => {
    const db = getDB();
    res.json({
        videos: db.videos,
        filters: db.filters,
        links: db.links,
        direct_links: db.direct_links,
        ad_codes: db.ad_codes,
        settings: db.settings
    });
});

// ৮. SEO ভিডিও পেজ
app.get('/video/:id', (req, res) => {
    const db = getDB();
    const video = db.videos.find(v => v.id === req.params.id);
    if (!video) return res.status(404).send("<h1>ভিডিও পাওয়া যায়নি</h1>");
    
    let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    const title = video.name + " - VIRAL BD 362";
    const desc = "VIRAL BD 362-এ দেখুন " + video.name + "।";
    html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
    res.send(html);
});

const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => console.log('Server on ' + port));
