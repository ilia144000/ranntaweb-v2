
import { NextRequest } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || '', { maxRetriesPerRequest: 1, enableReadyCheck: true });

export async function assertAuth(req: NextRequest){
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const expected = process.env.WEBHOOK_TOKEN || '';
  if(!expected || token !== expected) throw new Error('Unauthorized');
}

export async function verifySignature(rawBody: string, header: string | null){
  const secret = process.env.WEBHOOK_SECRET || '';
  if(!secret) return;
  if(!header) throw new Error('Missing signature');
  const sig = createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(sig, 'hex');
  const b = Buffer.from(header, 'hex');
  if(a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('Invalid signature');
}

export async function assertRateLimit(key: string, max = 120, windowSec = 60){
  const bucket = `rl:${key}:${Math.floor(Date.now()/ (windowSec*1000))}`;
  const count = await redis.incr(bucket);
  if(count === 1) await redis.expire(bucket, windowSec);
  if(count > max) throw new Error('Too Many Requests');
}
