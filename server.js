const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = 3000;
const MONGO_URI = 'mongodb://localhost:27017';
const DB_NAME = 'pokemontcg';
const COLLECTION_NAME = 'cards';

app.use(cors());

// API สำหรับดึงข้อมูลการ์ดทั้งหมด
app.get('/api/cards', async (req, res) => {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const cards = await db.collection(COLLECTION_NAME).find({}).toArray();
  await client.close();
  res.json(cards);
});

// เริ่มต้น API server เท่านั้น ไม่ดึงข้อมูลการ์ด
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});