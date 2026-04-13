# WebWallet Extension (MetaMask-like demo)

This repo contains a **Chrome/Brave extension** wallet (Manifest V3) with a MetaMask-style flow:

- Create / recover wallet (BIP39)
- Set password (vault is **encrypted** and stored in `chrome.storage.local`)
- Lock / unlock
- Accounts for **Ethereum** (BIP44 `m/44'/60'/0'/0/index`) and **Solana** (`m/44'/501'/index'/0'`)

## Build

```bash
npm install
npm run build
```

The extension build output will be in `extension/dist/`.

## Load in Chrome / Brave

- Go to `chrome://extensions`
- Enable **Developer mode**
- Click **Load unpacked**
- Select the folder `extension/dist`

## Develop (hot reload)

```bash
npm run dev
```

Note:
- If you open the dev server in a normal tab, you’ll see an error like “Not running in an extension context” — that’s expected.
- For extensions, hot reload isn’t the same as web apps. For quickest iteration:
- run `npm run build` after changes
- in `chrome://extensions`, click **Reload** on the extension

