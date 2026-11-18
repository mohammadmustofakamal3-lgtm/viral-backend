const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ==========================================
// 🔐 অ্যাডমিন পাসওয়ার্ড (তুমি ইচ্ছেমতো বদলাতে পারো)
// ==========================================
const ADMIN_PASSWORD = "ViralAdmin2026!"; 

const DB_FILE = path.join(__dirname, 'database.json');

function getDatabase() {
    if (!fs.existsSync(DB_FILE)) return { videos: [] };
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
}

function saveDatabase(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// ১. হোম পেজ
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ২. অ্যাডমিন পেজ (পাসওয়ার্ড চেক)
app.get('/admin', (req, res) => {
    const pass = req.query.pass;
    if (pass !== ADMIN_PASSWORD) {
        return res.status(401).send(`
            <div style="font-family:sans-serif;text-align:center;margin-top:100px;">
                <h2 style="color:red;">প্রবেশাধিকার নেই (401)</h2>
                <p>অ্যাডমিন প্যানেলে ঢুকতে পাসওয়ার্ড প্রয়োজন।</p>
                <form>
                    <input type="password" name="pass" placeholder="পাসওয়ার্ড দিন" style="padding:10px;margin-top:10px;">
                    <button type="submit" style="padding:10px 20px;margin-top:10px;">লগইন</button>
                </form>
            </div>
        `);
    }
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// ৩. নতুন ভিডিও সেভ করা (API)
app.post('/api/add-video', (req, res) => {
    const { name, video_link, image_url, category, pass } = req.body;
    
    // সিকিউরিটি চেক
    if (pass !== ADMIN_PASSWORD) return res.status(401).json({ error: 'অননুমোদিত অ্যাক্সেস' });
    if (!name || !video_link) return res.status(400).json({ error: 'নাম এবং ভিডিও লিংক দিতে হবে' });

    const db = getDatabase();
    const newVideo = {
        id: "v" + Date.now(),
        name: name,
        video_link: video_link,
        image_url: image_url || "",
        category: category || "all",
        created_at: Date.now()
    };
    
    db.videos.unshift(newVideo); 
    saveDatabase(db);
    res.json({ success: true, video: newVideo });
});

// ৪. ভিডিও ডিলিট করা (API)
app.delete('/api/delete-video/:id', (req, res) => {
    const pass = req.query.pass;
    if (pass !== ADMIN_PASSWORD) return res.status(401).json({ error: 'অননুমোদিত অ্যাক্সেস' });

    const db = getDatabase();
    const videoId = req.params.id;
    const initialLength = db.videos.length;
    db.videos = db.videos.filter(v => v.id !== videoId);
    
    if (db.videos.length === initialLength) return res.status(404).json({ error: 'ভিডিও পাওয়া যায়নি' });
    
    saveDatabase(db);
    res.json({ success: true });
});

// ৫. আলাদা ভিডিও পেজ (SEO)
app.get('/video/:id', (req, res) => {
    const db = getDatabase();
    const video = db.videos.find(v => v.id === req.params.id);
    
    if (!video) return res.status(404).send("<h1>ভিডিওটি খুঁজে পাওয়া যায়নি</h1>");

    let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    const title = video.name + " - VIRAL BD 362";
    const desc = "VIRAL BD 362-এ দেখুন " + video.name + "। বাংলা ভাইরাল ভিডিও ডাউনলোড করুন।";
    
    html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
    html = html.replace(/<meta name="description" content=".*?">/, `<meta name="description" content="${desc}">`);
    html = html.replace('</head>', `<script type="application/ld+json">{"@context":"https://schema.org","@type":"VideoObject","name":"${video.name}","description":"${desc}","thumbnailUrl":"${video.image_url}","uploadDate":"${new Date(video.created_at).toISOString()}","contentUrl":"${video.video_link}"}</script></head>`);

    res.send(html);
});

// ৬. ডেটা পাঠানোর API
app.get('/api/videos', (req, res) => {
    const db = getDatabase();
    res.json(db.videos);
});
app.get('/api/settings', (req, res) => res.json({}));
app.get('/api/links', (req, res) => res.json([]));
app.get('/api/ads', (req, res) => res.json([]));

const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => {
    console.log('Server running on port ' + port);
});
