export type Chain = "ethereum" | "solana";

export type Account = {
  id: string; // chain:index
  chain: Chain;
  index: number;
  name: string;
  publicKey: string; // address for eth, base58 pubkey for solana
  privateKey: string; // hex for eth, base58 secretKey for solana
  derivationPath: string;
};

export type VaultDataV1 = {
  version: 1;
  createdAt: number;
  mnemonic: string;
  nextIndex: Record<Chain, number>;
};

