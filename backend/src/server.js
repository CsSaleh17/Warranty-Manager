const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const app = require('./app');
const port = Number(process.env.PORT) || 3000;

app.listen(port, () => {
  console.log(`Warranty Manager API listening on http://localhost:${port}`);
});
