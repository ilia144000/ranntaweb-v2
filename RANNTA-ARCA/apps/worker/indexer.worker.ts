
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { indexNft } from '../../web/lib/indexer-server';

if(!process.env.REDIS_URL){
  throw new Error('REDIS_URL is required');
}

const connection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: 1,
  enableReadyCheck: true,
});

const worker = new Worker('index-nft', async (job) => {
  const { token, contentUri } = job.data as { token:string; contentUri:string };
  return await indexNft({ token, contentUri });
}, {
  connection,
  concurrency: Number(process.env.INDEXER_CONCURRENCY || 4),
});

worker.on('completed', (job) => {
  console.log('[indexer] completed', job.id);
});
worker.on('failed', (job, err) => {
  console.error('[indexer] failed', job?.id, err);
});

console.log('[indexer] worker started');
