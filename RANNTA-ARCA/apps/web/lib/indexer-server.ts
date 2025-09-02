
import { pool } from '@/lib/db';
import { fetchImageFromURI } from '@/lib/dup/fetchImage';
import { normalizeImage } from '@/lib/dup/normalize';
import { sha256 } from '@/lib/dup/sha';
import { phashFromBuffer } from '@/lib/dup/imhash';
import { clipEmbed } from '@/lib/dup/embeddings';
import { hexToBigInt } from '@/lib/dup/hamming';

export async function indexNft({ token, contentUri }: { token: string; contentUri: string }){
  const raw = await fetchImageFromURI(contentUri);
  const norm = await normalizeImage(raw);
  const sha = sha256(norm.buffer);
  const phashHex = await phashFromBuffer(norm.buffer);
  const phash = hexToBigInt(phashHex);
  const clip = await clipEmbed(norm.buffer);

  await pool.query(
    'CREATE EXTENSION IF NOT EXISTS vector;'
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS nft_images (
      token TEXT PRIMARY KEY,
      sha256 BYTEA NOT NULL,
      phash  BIGINT NOT NULL,
      width  INT,
      height INT,
      mime   TEXT,
      clip_vec VECTOR(512),
      created_at TIMESTAMPTZ DEFAULT now()
    );`
  );
  await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_nft_images_sha ON nft_images (sha256);');
  await pool.query('CREATE INDEX IF NOT EXISTS idx_nft_images_phash ON nft_images (phash);');
  await pool.query("CREATE INDEX IF NOT EXISTS idx_nft_images_clip ON nft_images USING ivfflat (clip_vec vector_cosine_ops) WITH (lists = 100);");

  await pool.query(
    'INSERT INTO nft_images(token, sha256, phash, width, height, mime, clip_vec) VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (token) DO UPDATE SET sha256=EXCLUDED.sha256, phash=EXCLUDED.phash, width=EXCLUDED.width, height=EXCLUDED.height, mime=EXCLUDED.mime, clip_vec=EXCLUDED.clip_vec',
    [token, sha, phash, norm.width, norm.height, norm.mime, clip]
  );
  return { ok: true, token, mime: norm.mime };
}
