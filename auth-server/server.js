import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import nacl from 'tweetnacl';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(express.json());

const {
  PORT = 8787,
  CORS_ORIGIN = '*',
  TOKEN_TTL_SECONDS = 86400,
  NONCE_TTL_SECONDS = 300
} = process.env;

app.use(cors({ origin: CORS_ORIGIN }));

const nonces = new Map();   // nonce -> expMs
const sessions = new Map(); // token -> { address, exp }

function issueToken(address) {
  const token = crypto.randomBytes(24).toString('hex');
  const exp = Math.floor(Date.now() / 1000) + Number(TOKEN_TTL_SECONDS);
  sessions.set(token, { address, exp });
  return { token, exp };
}

function verifyEd25519({ messageUtf8, signatureB64, publicKeyHex }) {
  const msg = new TextEncoder().encode(messageUtf8);
  const sig = Buffer.from(signatureB64, 'base64');
  const pk = Buffer.from(publicKeyHex.replace(/^0x/i, ''), 'hex');
  return nacl.sign.detached.verify(msg, sig, pk);
}

// 1) issue challenge
app.get('/auth/challenge', (_req, res) => {
  const nonce = uuidv4();
  const expMs = Date.now() + Number(NONCE_TTL_SECONDS) * 1000;
  nonces.set(nonce, expMs);
  res.json({ nonce, exp: Math.floor(expMs / 1000) });
});

// 2) verify signature
app.post('/auth/verify', (req, res) => {
  const { address, publicKey, nonce, signature, prefix } = req.body || {};
  if (!address || !publicKey || !nonce || !signature) {
    return res.status(400).json({ ok: false, error: 'missing_fields' });
  }
  const exp = nonces.get(nonce);
  if (!exp || Date.now() > exp) {
    return res.status(400).json({ ok: false, error: 'nonce_expired' });
  }

  const text = `${prefix || 'RANNTA ARCA login'}\nnonce:${nonce}`;
  const ok = verifyEd25519({ messageUtf8: text, signatureB64: signature, publicKeyHex: publicKey });
  if (!ok) return res.status(400).json({ ok: false, error: 'invalid_signature' });

  nonces.delete(nonce);
  const { token, exp: tokenExp } = issueToken(address);
  res.json({ ok: true, token, exp: tokenExp, address });
});

// 3) example protected
app.get('/auth/me', (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const s = sessions.get(token);
  if (!s) return res.status(401).json({ ok: false, error: 'unauthorized' });
  if (Math.floor(Date.now() / 1000) > s.exp) {
    sessions.delete(token);
    return res.status(401).json({ ok: false, error: 'session_expired' });
  }
  res.json({ ok: true, address: s.address });
});

app.listen(Number(PORT), () => console.log(`Auth server on http://localhost:${PORT}`));
