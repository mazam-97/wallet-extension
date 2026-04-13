import { mnemonicToSeed } from "@scure/bip39";
import { HDKey } from "micro-ed25519-hdkey";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { HDNodeWallet, Wallet } from "ethers";
import type { Account, Chain } from "../../shared/types";

export async function deriveAccount(mnemonic: string, chain: Chain, index: number): Promise<Account> {
  const seed = await mnemonicToSeed(mnemonic);

  if (chain === "solana") {
    const derivationPath = `m/44'/501'/${index}'/0'`;
    const root = HDKey.fromMasterSeed(seed);
    const child = root.derive(derivationPath, true);
    if (!child.privateKey) throw new Error("Failed to derive Solana private key");
    const kp = nacl.sign.keyPair.fromSeed(child.privateKey);

    return {
      id: `solana:${index}`,
      chain,
      index,
      name: `Solana Account ${index + 1}`,
      publicKey: bs58.encode(kp.publicKey),
      privateKey: bs58.encode(kp.secretKey),
      derivationPath,
    };
  }

  // MetaMask-compatible ETH BIP44: m/44'/60'/0'/0/index
  const derivationPath = `m/44'/60'/0'/0/${index}`;
  const hdNode = HDNodeWallet.fromSeed(seed);
  const child = hdNode.derivePath(derivationPath);
  const wallet = new Wallet(child.privateKey);

  return {
    id: `ethereum:${index}`,
    chain,
    index,
    name: `Ethereum Account ${index + 1}`,
    publicKey: wallet.address,
    privateKey: child.privateKey,
    derivationPath,
  };
}

