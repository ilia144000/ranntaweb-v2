
import { pool } from './db';
export async function isIndexed(token: string){
  const q = await pool.query('SELECT 1 FROM nft_images WHERE token=$1 LIMIT 1', [token]);
  return q.rows.length > 0;
}
