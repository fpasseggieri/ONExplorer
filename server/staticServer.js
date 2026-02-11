const express = require('express');
const path = require('path');

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 3000;
const buildDir = path.join(__dirname, '..', 'build');

app.use(express.static(buildDir, { index: false }));

app.get('*', (req, res) => {
  res.sendFile(path.join(buildDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Static frontend running on port ${PORT}`);
});
