# RANNTA ARCA Marketplace Contract

A minimal NFT marketplace contract for TON.

### Features
- List NFT with fixed price
- Cancel listing
- Buy NFT with TON
- Automatic royalty & marketplace fee split

### Operations
- `0x01` → List (nft, seller, price, royaltyBps, creator)
- `0x02` → Cancel (nft)
- `0x03` → Buy (nft)

### Notes
- Royalty is in basis points (e.g. 500 = 5%)
- Marketplace fee is fixed at 2.5%
- NFT transfer (TIP-4) must be integrated
