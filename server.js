const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const app = express();

app.use(cors());
app.use(express.json());

const DB_FILE = path.join(__dirname, 'database.json');

// ডেটাবেস থেকে ডেটা পড়ার ফাংশন
function getDatabase() {
    if (!fs.existsSync(DB_FILE)) return { videos: [] };
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
}

// হোম পেজ
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// আলাদা ভিডিও পেজ (SEO)
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

// ডেটা পাঠানোর API
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
