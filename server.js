const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('VIRAL BD 362 — Own Server API is running! 🚀');
});

app.get('/api/videos', (req, res) => {
  res.json([]); 
});

app.get('/api/settings', (req, res) => {
  res.json({});
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
