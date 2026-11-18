const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());

app.get('/', (req, res) => {
  res.send('Server is running perfectly!');
});

app.get('/api/videos', (req, res) => {
  res.json([]);
});

app.get('/api/settings', (req, res) => {
  res.json({});
});

const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => {
  console.log('Server running on port ' + port);
});
