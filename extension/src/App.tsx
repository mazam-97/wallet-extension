import { useEffect, useMemo, useState } from "react";
import { generateMnemonic, validateMnemonic } from "@scure/bip39";
import { wordlist as englishWordlist } from "@scure/bip39/wordlists/english.js";
import { Eye, EyeOff, Lock, Plus, RefreshCw, Shield, Sparkles, Wallet } from "lucide-react";
import type { Account, Chain } from "./shared/types";
import { rpc } from "./shared/rpc";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-3">
      <div className="text-base font-extrabold tracking-tight text-slate-900">{title}</div>
      {subtitle ? <div className="mt-0.5 text-sm font-medium text-slate-600">{subtitle}</div> : null}
    </div>
  );
}

function truncateMiddle(s: string, left = 6, right = 4) {
  if (s.length <= left + right + 3) return s;
  return `${s.slice(0, left)}…${s.slice(-right)}`;
}

function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  className,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none select-none";
  const v =
    variant === "primary"
      ? "bg-slate-900 text-white shadow-sm hover:bg-slate-800 active:bg-slate-900"
      : variant === "danger"
        ? "bg-red-600 text-white shadow-sm hover:bg-red-700"
        : "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50";
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={cx(base, v, className)}>
      {children}
    </button>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "password";
  className?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      type={type}
      className={cx(
        "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200",
        className,
      )}
    />
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="rounded-xl bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      title="Copy"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function PrivateKeyToggle({ value }: { value: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-start justify-between gap-2 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
      <div className="min-w-0">
        <div className="text-xs font-semibold text-slate-600">Private key</div>
        <div className="mt-1 break-all font-mono text-[11px] text-slate-900">
          {show ? value : "•••• •••• •••• •••• •••• •••• ••••"}
        </div>
      </div>
      <button
        className="rounded-lg bg-white p-1.5 text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 hover:text-slate-900"
        onClick={() => setShow((s) => !s)}
        aria-label="Toggle private key"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

type Screen = "loading" | "onboarding" | "unlock" | "wallet";

export default function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [error, setError] = useState<string>("");

  const [onbMode, setOnbMode] = useState<"create" | "recover">("create");
  const [mnemonic, setMnemonic] = useState<string>("");
  const [mnemonicInput, setMnemonicInput] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [password2, setPassword2] = useState<string>("");
  const [unlockPassword, setUnlockPassword] = useState<string>("");

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tab, setTab] = useState<Chain>("ethereum");
  const [revealedMnemonic, setRevealedMnemonic] = useState<string>("");
  const [revealedOpen, setRevealedOpen] = useState(false);

  useEffect(() => {
    (async () => {
      const s = await rpc({ type: "vault_status" });
      if (s.ok === false) {
        setError(s.error);
        setScreen("onboarding");
        return;
      }
      setScreen(s.result.exists ? "unlock" : "onboarding");
    })();
  }, []);

  const visibleAccounts = useMemo(
    () => accounts.filter((a) => a.chain === tab).sort((a, b) => a.index - b.index),
    [accounts, tab],
  );

  async function refreshAccounts() {
    const res = await rpc({ type: "accounts_list" });
    if (res.ok === false) {
      setError(res.error);
      return;
    }
    setAccounts(res.result.accounts);
  }

  async function goWallet() {
    setError("");
    setScreen("wallet");
    await refreshAccounts();
  }

  async function onCreateOrRecover() {
    setError("");
    const selectedMnemonic =
      onbMode === "create" ? mnemonic.trim() : mnemonicInput.trim().replace(/\s+/g, " ");
    if (!selectedMnemonic) {
      setError("Recovery phrase is required.");
      return;
    }
    if (!validateMnemonic(selectedMnemonic, englishWordlist)) {
      setError("That recovery phrase is not valid.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== password2) {
      setError("Passwords do not match.");
      return;
    }

    const res = await rpc({ type: "vault_create", mnemonic: selectedMnemonic, password });
    if (res.ok === false) {
      setError(res.error);
      return;
    }
    await goWallet();
  }

  async function onUnlock() {
    setError("");
    const res = await rpc({ type: "vault_unlock", password: unlockPassword });
    if (res.ok === false) {
      setError(res.error);
      return;
    }
    await goWallet();
  }

  async function onLock() {
    await rpc({ type: "vault_lock" });
    setAccounts([]);
    setRevealedMnemonic("");
    setRevealedOpen(false);
    setUnlockPassword("");
    setScreen("unlock");
  }

  async function onAddAccount() {
    setError("");
    const res = await rpc({ type: "account_add", chain: tab });
    if (res.ok === false) {
      setError(res.error);
      return;
    }
    // refresh list (also supports future ordering changes)
    await refreshAccounts();
  }

  async function onRevealMnemonic() {
    setError("");
    const res = await rpc({ type: "vault_reveal_mnemonic" });
    if (res.ok === false) {
      setError(res.error);
      return;
    }
    setRevealedMnemonic(res.result.mnemonic);
    setRevealedOpen(true);
  }

  return (
    <div className="min-h-[600px] w-[360px] bg-slate-50 text-slate-900">
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
              <Wallet size={18} />
            </div>
            <div className="leading-tight">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                WebWallet
              </div>
              <div className="text-lg font-extrabold tracking-tight">Wallet</div>
            </div>
          </div>
          {screen === "wallet" ? (
            <Button variant="secondary" onClick={onLock} className="px-3">
              <Lock size={16} />
              Lock
            </Button>
          ) : null}
        </div>
      </div>

      <div className="p-4">

      {error ? (
        <div className="mb-3 rounded-xl border border-red-200/70 bg-red-50/80 px-3 py-2 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {screen === "loading" ? (
        <Card className="text-sm text-slate-700">Loading…</Card>
      ) : null}

      {screen === "onboarding" ? (
        <Card>
          <SectionTitle
            title={onbMode === "create" ? "Create a new wallet" : "Import existing wallet"}
            subtitle="Securely manage Ethereum and Solana accounts."
          />
          <div className="mb-3 flex gap-2">
            <button
              className={cx(
                "flex-1 rounded-xl px-3 py-2.5 text-sm font-extrabold transition",
                onbMode === "create"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50",
              )}
              onClick={() => setOnbMode("create")}
            >
              Create
            </button>
            <button
              className={cx(
                "flex-1 rounded-xl px-3 py-2.5 text-sm font-extrabold transition",
                onbMode === "recover"
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50",
              )}
              onClick={() => setOnbMode("recover")}
            >
              Recover
            </button>
          </div>

          {onbMode === "create" ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="mt-0.5 rounded-xl bg-white p-2 text-slate-800 ring-1 ring-slate-200">
                  <Shield size={16} />
                </div>
                <div>
                  <div className="text-sm font-extrabold text-slate-900">Protect your phrase</div>
                  <div className="mt-0.5 text-xs font-semibold text-slate-600">
                    Never share it. Anyone with it can take your funds.
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={async () => {
                    setError("");
                    const m = generateMnemonic(englishWordlist);
                    setMnemonic(m);
                  }}
                  className="flex-1"
                >
                  <RefreshCw size={16} />
                  Generate
                </Button>
                <Button
                  variant="secondary"
                  onClick={async () => {
                    if (!mnemonic) return;
                    await navigator.clipboard.writeText(mnemonic);
                  }}
                  className="px-3"
                  disabled={!mnemonic}
                >
                  Copy
                </Button>
              </div>

              <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-extrabold text-slate-700">Recovery phrase</div>
                  <div className="text-[11px] font-semibold text-slate-500">
                    {mnemonic ? "12 words" : "Generate to begin"}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(mnemonic ? mnemonic.split(" ") : Array.from({ length: 12 }, () => "")).map(
                    (w, i) => (
                      <div
                        key={i}
                        className="rounded-xl bg-white px-2 py-1.5 text-[12px] font-semibold text-slate-900 shadow-sm ring-1 ring-slate-200"
                      >
                        <span className="mr-2 text-slate-400">{i + 1}.</span>
                        {w || <span className="text-slate-300">—</span>}
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
                <Sparkles size={16} className="text-slate-700" />
                Paste your 12/24-word recovery phrase
              </div>
              <textarea
                value={mnemonicInput}
                onChange={(e) => setMnemonicInput(e.target.value)}
                className="h-28 w-full resize-none rounded-2xl border border-slate-200 bg-white p-3 text-sm font-semibold outline-none placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                placeholder="recovery phrase…"
              />
            </div>
          )}

          <div className="mt-4 space-y-2">
            <div className="text-sm font-extrabold text-slate-800">Set a password</div>
            <Input value={password} onChange={setPassword} type="password" placeholder="Password" />
            <Input
              value={password2}
              onChange={setPassword2}
              type="password"
              placeholder="Confirm password"
            />
            <Button
              onClick={onCreateOrRecover}
              className="w-full"
              disabled={
                (onbMode === "create" ? !mnemonic : !mnemonicInput.trim()) ||
                !password ||
                !password2
              }
            >
              Create Wallet
            </Button>
          </div>
        </Card>
      ) : null}

      {screen === "unlock" ? (
        <Card>
          <SectionTitle title="Unlock" subtitle="Enter your password to continue." />
          <div className="mt-4 space-y-2">
            <Input
              value={unlockPassword}
              onChange={setUnlockPassword}
              type="password"
              placeholder="Password"
            />
            <Button className="w-full" onClick={onUnlock} disabled={!unlockPassword}>
              Unlock
            </Button>
          </div>
        </Card>
      ) : null}

      {screen === "wallet" ? (
        <div className="space-y-3">
          <Card className="p-3">
            <div className="flex gap-2 rounded-2xl bg-slate-100 p-1 ring-1 ring-slate-200">
              <button
                className={cx(
                  "flex-1 rounded-2xl px-3 py-2 text-sm font-extrabold transition",
                  tab === "ethereum"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-700 hover:text-slate-900 hover:bg-white rounded-2xl",
                )}
                onClick={() => setTab("ethereum")}
              >
                Ethereum
              </button>
              <button
                className={cx(
                  "flex-1 rounded-2xl px-3 py-2 text-sm font-extrabold transition",
                  tab === "solana"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-700 hover:text-slate-900 hover:bg-white rounded-2xl",
                )}
                onClick={() => setTab("solana")}
              >
                Solana
              </button>
            </div>

            <div className="mt-3 flex gap-2">
              <Button onClick={onAddAccount} className="flex-1">
                <Plus size={16} />
                Add account
              </Button>
              <Button variant="secondary" onClick={refreshAccounts} className="px-3">
                <RefreshCw size={16} />
              </Button>
            </div>

            <div className="mt-3 flex gap-2">
              <Button variant="secondary" onClick={onRevealMnemonic} className="flex-1">
                Reveal phrase
              </Button>
            </div>
          </Card>

          {revealedOpen ? (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4">
              <div className="w-full max-w-[360px] rounded-3xl bg-white p-4 shadow-2xl ring-1 ring-slate-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-extrabold">Secret Recovery Phrase</div>
                  <Button variant="secondary" className="px-3" onClick={() => setRevealedOpen(false)}>
                    Close
                  </Button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {revealedMnemonic.split(" ").map((w, i) => (
                    <div
                      key={i}
                      className="rounded-2xl bg-slate-50 px-2 py-2 text-[12px] font-semibold ring-1 ring-slate-200"
                    >
                      <span className="mr-2 text-slate-400">{i + 1}.</span>
                      {w}
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-between">
                  <div className="text-[11px] font-semibold text-slate-500">
                    Store it somewhere safe.
                  </div>
                  <CopyButton text={revealedMnemonic} />
                </div>
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            {visibleAccounts.length === 0 ? (
              <Card className="text-sm font-semibold text-slate-600">
                No accounts yet. Click “Add account”.
              </Card>
            ) : null}

            {visibleAccounts.map((a) => (
              <Card key={a.id} className="p-3">
                <div className="mb-3 h-1 w-full rounded-full bg-slate-200" />
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold">{a.name}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="font-mono text-[11px] font-semibold text-slate-600">
                          {truncateMiddle(a.publicKey, a.chain === "ethereum" ? 8 : 10, 6)}
                        </span>
                      </div>
                      <div className="mt-2 break-all font-mono text-[11px] text-slate-700">
                        {a.publicKey}
                      </div>
                    </div>
                  </div>
                  <CopyButton text={a.publicKey} />
                </div>

                <div className="mt-3">
                  <PrivateKeyToggle value={a.privateKey} />
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}
