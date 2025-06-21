import 'dotenv/config';
import express from 'express';
import fetch from 'node-fetch';
import bodyParser from 'body-parser';
import cors from 'cors';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

app.post('/exchange-code', async (req, res) => {
  const { code } = req.body;

  try {
	console.log('');
	console.log('CODE:', code);
	console.log('CLIENT_ID:', process.env.CLIENT_ID);
	console.log('CLIENT_SECRET:', process.env.CLIENT_SECRET);
	console.log('REDIRECT_URI:', process.env.REDIRECT_URI);

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        redirect_uri: process.env.REDIRECT_URI,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();
    res.json(tokenData);
  } catch (err) {
    console.error('❌ Token exchange failed:', err);
    res.status(500).json({ error: 'Token exchange failed' });
  }
});

app.listen(PORT, () => {
  console.log(`🔐 Server running at http://localhost:${PORT}`);
});
