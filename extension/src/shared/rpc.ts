import type { Account, Chain, VaultDataV1 } from "./types";

export type RpcRequest =
  | { type: "vault_status" }
  | { type: "vault_create"; mnemonic: string; password: string }
  | { type: "vault_unlock"; password: string }
  | { type: "vault_lock" }
  | { type: "vault_reveal_mnemonic" }
  | { type: "accounts_list" }
  | { type: "account_add"; chain: Chain };

type RpcOkMap = {
  vault_status: { exists: boolean; unlocked: boolean };
  vault_create: { unlocked: true };
  vault_unlock: { unlocked: true };
  vault_lock: { unlocked: false };
  vault_reveal_mnemonic: { mnemonic: string };
  accounts_list: { accounts: Account[] };
  account_add: { account: Account; vault: Pick<VaultDataV1, "nextIndex"> };
};

export type RpcResponse<T extends RpcRequest["type"] = RpcRequest["type"]> =
  | { ok: true; type: T; result: RpcOkMap[T] }
  | { ok: false; type: T; error: string };

export async function rpc<T extends RpcRequest["type"]>(
  request: Extract<RpcRequest, { type: T }>,
): Promise<RpcResponse<T>> {
  const runtime = (globalThis as unknown as { chrome?: typeof chrome }).chrome?.runtime;
  if (!runtime?.sendMessage) {
    return {
      ok: false,
      type: request.type,
      error:
        "Not running in an extension context. Build and load `extension/dist` via chrome://extensions.",
    } as RpcResponse<T>;
  }
  return (await runtime.sendMessage(request)) as RpcResponse<T>;
}

