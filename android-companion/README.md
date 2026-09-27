# KONTERKU Companion (Android App Foundation)

Native Android companion application foundation for KONTERKU.

## Purpose & Architecture
- **Role**: Runs on the shop operator's Android smartphone or tablet.
- **Banking Balance Source**: Connects to supported Indonesian mobile banking applications (BRImo, myBCA, Livin', wondr, SeaBank) via a scoped Accessibility Service.
- **EPPOS Bluetooth Printing**: Manages Bluetooth SPP printing to the EPPOS EPX583-V2 58mm thermal printer.
- **LAN Communication**: Dispatches normalized balance payloads to the Windows KONTERKU server via `POST /api/connector/balance`.
- **Security Invariant**: Never captures, reads, or transmits passwords, PINs, OTPs, or authentication tokens. All values are normalized strictly to integer Rupiah.

## Project Structure
```
android-companion/
├── app/
│   ├── src/main/
│   │   ├── AndroidManifest.xml
│   │   ├── kotlin/com/konterku/companion/
│   │   │   ├── model/           # BankBalance, BalanceSyncPayload, ProviderDefinition
│   │   │   ├── reader/          # BankBalanceReader, BankProviderRegistry, MockBankBalanceReader
│   │   │   ├── service/         # BankAccessibilityService
│   │   │   ├── network/         # LanBridgeClient, SyncResult
│   │   │   └── ui/              # MainActivity
│   │   └── res/                 # Layouts, strings, network security config
│   └── src/test/kotlin/         # JUnit unit tests
├── build.gradle.kts
└── settings.gradle.kts
```

## Supported Provider Registry
- **BRI**: BRImo (`id.co.bri.brimo`)
- **BCA**: myBCA (`com.bca.mybca`), BCA mobile (`com.bca`)
- **Mandiri**: Livin' by Mandiri (`id.bmri.livin`)
- **BNI**: wondr by BNI (`id.co.bni.wondr`), BNI Mobile Banking (`id.co.bni.mobilebanking`)
- **SeaBank**: SeaBank Mobile (`com.seabank.mobile`)

## Setup & Pairing
1. Open KONTERKU on Windows PC or tablet browser (`/accounts`).
2. Select target bank account and tap **"Token"** to view the unique pairing token (`ktk_...`).
3. Open KONTERKU Companion on Android:
   - Enter Server LAN URL (e.g. `http://192.168.1.50:3000`).
   - Enter Account ID (e.g. `cm...`).
   - Enter Pairing Token (`ktk_...`).
   - Tap **Simpan Pengaturan**.
4. Enable the Accessibility Service in Android Settings.
5. In the companion app:
   - Tap **"Ambil Saldo"** to retrieve the balance detected from the active banking app.
   - Tap **"Kirim ke Server"** to transmit the normalized balance to KONTERKU.
