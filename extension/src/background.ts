import type { RpcRequest, RpcResponse } from "./shared/rpc";
import type { Account, Chain, VaultDataV1 } from "./shared/types";
import { decryptJson, encryptJson, type EncryptedPayload } from "./lib/vault/crypto";
import { deriveAccount } from "./lib/wallet/derive";

const STORAGE_KEY = "webwallet.vault.v1";

type BackgroundState = {
  unlocked: boolean;
  vault?: VaultDataV1;
  accounts: Account[];
  password?: string;
};

const state: BackgroundState = {
  unlocked: false,
  vault: undefined,
  accounts: [],
  password: undefined,
};

async function readEncryptedVault(): Promise<EncryptedPayload | null> {
  const res = (await chrome.storage.local.get(STORAGE_KEY)) as Record<string, unknown>;
  const v = res[STORAGE_KEY];
  return v ? (v as EncryptedPayload) : null;
}

async function writeEncryptedVault(payload: EncryptedPayload): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: payload });
}

async function rebuildAccounts(vault: VaultDataV1): Promise<Account[]> {
  const ethCount = Math.max(0, vault.nextIndex.ethereum);
  const solCount = Math.max(0, vault.nextIndex.solana);
  const eth = await Promise.all(
    Array.from({ length: ethCount }, (_, i) => deriveAccount(vault.mnemonic, "ethereum", i)),
  );
  const sol = await Promise.all(
    Array.from({ length: solCount }, (_, i) => deriveAccount(vault.mnemonic, "solana", i)),
  );
  return [...eth, ...sol];
}

function ok<T extends RpcRequest["type"], R>(type: T, result: R): RpcResponse<T> {
  return { ok: true, type, result } as unknown as RpcResponse<T>;
}

function err<T extends RpcRequest["type"]>(type: T, error: string): RpcResponse<T> {
  return { ok: false, type, error };
}

chrome.runtime.onMessage.addListener((msg: RpcRequest, _sender, sendResponse) => {
  (async () => {
    try {
      if (!msg || typeof msg !== "object" || !("type" in msg)) {
        sendResponse(err("vault_status", "Bad request"));
        return;
      }

      switch (msg.type) {
        case "vault_status": {
          const exists = !!(await readEncryptedVault());
          sendResponse(ok(msg.type, { exists, unlocked: state.unlocked }));
          return;
        }

        case "vault_create": {
          const mnemonic = msg.mnemonic?.trim();
          const password = msg.password ?? "";
          if (!mnemonic) {
            sendResponse(err(msg.type, "Mnemonic required"));
            return;
          }
          if (password.length < 6) {
            sendResponse(err(msg.type, "Password must be at least 6 characters"));
            return;
          }

          const vault: VaultDataV1 = {
            version: 1,
            createdAt: Date.now(),
            mnemonic,
            nextIndex: { ethereum: 1, solana: 0 }, // start with 1 ETH account like MetaMask
          };
          const encrypted = await encryptJson(password, vault);
          await writeEncryptedVault(encrypted);

          state.unlocked = true;
          state.vault = vault;
          state.accounts = await rebuildAccounts(vault);
          state.password = password;

          sendResponse(ok(msg.type, { unlocked: true }));
          return;
        }

        case "vault_unlock": {
          const password = msg.password ?? "";
          const encrypted = await readEncryptedVault();
          if (!encrypted) {
            sendResponse(err(msg.type, "Vault not found"));
            return;
          }
          const vault = await decryptJson<VaultDataV1>(password, encrypted);
          if (vault.version !== 1 || !vault.mnemonic) {
            sendResponse(err(msg.type, "Vault corrupted"));
            return;
          }
          state.unlocked = true;
          state.vault = vault;
          state.accounts = await rebuildAccounts(vault);
          state.password = password;
          sendResponse(ok(msg.type, { unlocked: true }));
          return;
        }

        case "vault_lock": {
          state.unlocked = false;
          state.vault = undefined;
          state.accounts = [];
          state.password = undefined;
          sendResponse(ok(msg.type, { unlocked: false }));
          return;
        }

        case "vault_reveal_mnemonic": {
          if (!state.unlocked || !state.vault) {
            sendResponse(err(msg.type, "Locked"));
            return;
          }
          sendResponse(ok(msg.type, { mnemonic: state.vault.mnemonic }));
          return;
        }

        case "accounts_list": {
          if (!state.unlocked || !state.vault) {
            sendResponse(err(msg.type, "Locked"));
            return;
          }
          sendResponse(ok(msg.type, { accounts: state.accounts }));
          return;
        }

        case "account_add": {
          if (!state.unlocked || !state.vault) {
            sendResponse(err(msg.type, "Locked"));
            return;
          }
          if (!state.password) {
            sendResponse(err(msg.type, "Missing session key"));
            return;
          }
          const chain: Chain = msg.chain;
          const index = state.vault.nextIndex[chain] ?? 0;
          const account = await deriveAccount(state.vault.mnemonic, chain, index);

          const updated: VaultDataV1 = {
            ...state.vault,
            nextIndex: {
              ...state.vault.nextIndex,
              [chain]: index + 1,
            },
          };

          const encrypted = await encryptJson(state.password, updated);
          await writeEncryptedVault(encrypted);

          state.vault = updated;
          state.accounts = [...state.accounts, account];

          sendResponse(ok(msg.type, { account, vault: { nextIndex: updated.nextIndex } }));
          return;
        }
      }
    } catch (e) {
      sendResponse(
        err("vault_status", e instanceof Error ? e.message : "Unknown error") as RpcResponse,
      );
    }
  })();

  return true;
});

