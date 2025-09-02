import 'dotenv/config';
import { Address, beginCell, toNano } from '@ton/core';
import { TonClient, WalletContractV4, internal } from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { compile } from '@ton-community/blueprint';

// tiny argv parser
const args = process.argv.slice(2);
const getArg = (k: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};

async function main() {
  const network = (getArg('--network') || 'testnet').toLowerCase();

  // endpoints
  const endpoints: Record<string, string> = {
    testnet: 'https://testnet.toncenter.com/api/v2/jsonRPC',
    mainnet: 'https://toncenter.com/api/v2/jsonRPC'
  };

  const endpoint = endpoints[network] || endpoints.testnet;
  const apiKey = process.env.TON_API_KEY || process.env.TONCENTER_API_KEY || undefined;

  const mnemonic = (process.env.MNEMONIC || process.env.TON_MNEMONIC || '').trim();
  if (!mnemonic) throw new Error('Missing MNEMONIC (set repo secret TON_MNEMONIC)');

  const client = new TonClient({ endpoint, apiKey });

  // wallet from mnemonic
  const keyPair = await mnemonicToPrivateKey(mnemonic.split(/\s+/));
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keyPair.publicKey });
  const walletOpened = client.open(wallet);

  console.log('Network:', network);
  console.log('Wallet:', wallet.address.toString());

  // ensure wallet exists (seqno throws if not)
  await walletOpened.getSeqno().catch(async () => {
    console.log('Deploying wallet (first-time)...');
    await walletOpened.sendDeploy(keyPair.secretKey);
  });

  // compile market.fc
  const codeCell = await compile('market'); // contracts/market.fc
  const dataCell = beginCell()
    .storeAddress(wallet.address) // admin/owner
    .storeDict(null)              // placeholder for listings map
    .endCell();

  const contractAddr = Address.compute({ code: codeCell, data: dataCell });
  console.log('Contract (expected):', contractAddr.toString());

  // send deploy
  await walletOpened.sendTransfer({
    secretKey: keyPair.secretKey,
    messages: [internal({
      to: contractAddr,
      value: toNano('0.05'),
      init: { code: codeCell, data: dataCell },
      body: beginCell().endCell()
    })]
  });

  console.log('Deploy sent. Explorer address:', contractAddr.toString());
}

main().catch(e => { console.error(e); process.exit(1); });
