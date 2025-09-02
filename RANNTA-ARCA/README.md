
# RANNTA ARCA — TON NFT Marketplace (Skeleton)

## Apps
- `apps/web` — Next.js frontend + API (duplicate detection, indexer, TonAPI webhook)
- `apps/worker` — BullMQ worker (indexes NFTs after mint/list)

## Quick start
```bash
pnpm install
cp .env.example .env
pnpm dev         # starts Next.js at localhost:3000
pnpm worker      # starts BullMQ worker
```
