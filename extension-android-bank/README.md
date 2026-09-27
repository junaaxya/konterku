# KONTERKU Android Bank Connector Extension (Firefox Android)

Browser add-on for shop tablets/phones running Firefox for Android. Reads live balance from authenticated KlikBCA or IB BRI sessions and safely transmits normalized balances to the local KONTERKU server over Wi-Fi/LAN.

## Features
- **Scoped Permissions**: Only runs on configured banking domains (`https://*.klikbca.com/*`, `https://*.bri.co.id/*`) and local private LAN IP ranges (`http://192.168.*.*/*`, `http://10.*.*.*/*`, `http://172.16-31.*.*/*`).
- **Zero Credential Capture**: Does not access or transmit passwords, PINs, OTPs, or session cookies.
- **LAN Pairing**: Authenticates securely to the Windows KONTERKU server using a unique pairing token (`ktk_...`).
- **Confirmation UX**: Displays detected bank name, account identifier, and balance for user verification before transmitting.
- **Gecko Android Compatibility**: Explicit `browser_specific_settings` with ID `bank-connector@konterku.local` and `strict_min_version: 115.0`.

## Installation / Distribution Methods on Firefox Android

There are two primary distribution methods on Firefox for Android:

### Method A: Mozilla Add-ons (AMO) Custom Add-on Collection (Recommended for Production / Non-developer users)
1. Firefox for Android (stable & beta) supports extensions via **Custom Add-on Collections**.
2. Create an account on `addons.mozilla.org` (AMO), upload the signed `.xpi` (or self-hosted listed add-on), and add it to a public collection (e.g. `User: konterku`, `Collection: shop-tools`).
3. On the Android tablet:
   - Open Firefox > Settings > About Firefox.
   - Tap the Firefox logo 5 times to unlock Developer options.
   - Go to Settings > Custom Add-on collection.
   - Enter your collection owner ID and collection name.
   - Firefox will automatically install the KONTERKU Bank Connector add-on.

### Method B: Web-ext / Temporary Add-on (Development / Sideloading)
1. On PC, run:
   ```bash
   pnpm build:extension
   ```
   Generates `dist-extension/konterku-bank-connector-v1.0.0.xpi`.
2. Connect Android tablet via USB / Wi-Fi with USB debugging enabled.
3. Open `about:debugging` on Firefox desktop or use `web-ext run --target=firefox-android` to install directly to the device.

## Daily Usage Flow
1. In KONTERKU web app (`/accounts`), select your Bank account (e.g. BCA or BRI).
2. Click **"Aktifkan Konektor Ekstensi Android"** -> copy the **Token Pairing**.
3. In Firefox Android:
   - Open extension popup: enter **Server URL** (`http://<WINDOWS-PC-LAN-IP>:3000`), **Account ID**, and **Token Pairing** -> tap **Simpan Pengaturan**.
4. Log into KlikBCA (`klikbca.com`) or IB BRI (`ib.bri.co.id`) manually in another tab (completing 2FA/OTP/CAPTCHA normally).
5. Open extension popup -> tap **"1. Periksa Saldo Tab Ini"** -> verify balance -> tap **"2. Konfirmasi & Kirim ke Server"**.
6. The Windows KONTERKU server immediately writes an `ExternalBalanceSnapshot` (`source = LOCAL_SYNC`) and updates reconciliation & dashboard.
