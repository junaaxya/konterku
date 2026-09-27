# KONTERKU — Application Flow

## 1. Product Flow Principle

The application is designed around one rule:

> Record the business event once, then derive the financial records automatically.

The user should not:

1. perform a transaction,
2. print a receipt,
3. open another page,
4. manually re-enter the same transaction.

One business action should create all required records.

---

## 2. Daily User Flow

```text
Open KONTERKU
     ↓
Dashboard
     ↓
New Transaction
     ↓
Choose Transaction Type
     ↓
Fill Required Information
     ↓
Review
     ↓
Save Transaction
     ↓
Create Ledger Entries
     ↓
Calculate Profit
     ↓
Update Dashboard/Reports
     ↓
Print Receipt (optional)
     ↓
Done
```

---

## 3. Main Navigation

Mobile-first navigation:

```text
Dashboard
Transaksi
Riwayat
Laporan
Pengaturan
```

Secondary operations:

```text
Pemasukan
Pengeluaran
Akun Kas
```

These can live under transaction/dashboard actions instead of becoming too many bottom-navigation items.

---

## 4. Dashboard Flow

Dashboard should answer immediately:

- Berapa saldo saya?
- Hari ini uang masuk berapa?
- Hari ini uang keluar berapa?
- Profit hari ini berapa?
- Ada berapa transaksi?
- Transaksi terbaru apa?

Suggested dashboard:

```text
┌─────────────────────────────┐
│ KONTERKU                    │
├─────────────────────────────┤
│ Saldo Total                 │
│ Rp10.600.000                │
│                             │
│ Pemasukan   Pengeluaran     │
│ Rp850.000   Rp310.000       │
│                             │
│ Profit Hari Ini             │
│ Rp125.000                   │
│                             │
│ [ + Transaksi Baru ]        │
│                             │
│ Akun                        │
│ Cash       Rp3.250.000      │
│ BCA        Rp4.400.000      │
│ BRI        Rp2.100.000      │
│ QRIS       Rp850.000        │
│                             │
│ Transaksi Terbaru           │
└─────────────────────────────┘
```

Do not use "income" to mean total transaction volume.

---

## 5. New Transaction Flow

### Step 1 — Choose Type

```text
Pulsa
Paket Data
Token PLN
PPOB
Transfer Bank
Tarik Tunai
Top Up E-Wallet
Penjualan Barang
Lainnya
```

Use large touch-friendly cards/buttons.

---

### Step 2 — Transaction Form

Only show fields relevant to the selected transaction.

Common fields:

```text
Keterangan
Nominal
Biaya / Modal
Harga ke Pelanggan
Biaya Admin
Akun Sumber
Akun Tujuan / Pembayaran
Catatan (optional)
```

Do not show every field for every transaction type.

---

### Step 3 — Review

Before committing:

```text
Transfer Bank

Nominal Transfer     Rp500.000
Biaya Admin          Rp5.000
Pelanggan Bayar      Rp505.000

Masuk ke:
Cash                 +Rp505.000

Keluar dari:
BCA                  -Rp500.000

Estimasi Profit       Rp5.000

[ Batal ] [ Simpan & Cetak ]
```

This review screen is important for transactions that move money between multiple accounts.

---

### Step 4 — Commit

The server must commit the transaction atomically.

Pseudo-flow:

```text
BEGIN DATABASE TRANSACTION

create Transaction

create LedgerEntry(s)

validate ledger consistency

COMMIT

return saved transaction
```

Only after successful commit may the application offer/trigger receipt printing.

---

## 6. Pulsa Flow

User:

```text
Transaksi Baru
→ Pulsa
```

Fields:

```text
Provider
Nomor HP (optional but recommended)
Nominal pulsa
Modal
Harga jual
Pembayaran ke akun
```

Example:

```text
Provider: Telkomsel
Nominal:  Rp50.000
Modal:    Rp48.500
Jual:     Rp52.000
Bayar:    Cash
```

System:

```text
Transaction:
gross = 52000
cost = 48500
profit = 3500

Ledger:
Cash IN 52000
```

Result:

```text
Transaction saved
Dashboard updated
Receipt available
```

---

## 7. Bank Transfer Flow

User:

```text
Transaksi Baru
→ Transfer Bank
```

Fields:

```text
Nominal transfer
Bank/account source
Customer payment account
Admin fee charged
Description/reference
```

Example:

```text
Nominal transfer     Rp500.000
Source               BCA
Customer pays via    Cash
Admin                 Rp5.000
```

System creates:

```text
Cash IN  Rp505.000
BCA  OUT Rp500.000
Profit   Rp5.000
```

The transaction volume is Rp500,000.

Cash-in is Rp505,000.

Profit is Rp5,000.

These values must never be conflated.

---

## 8. Expense Flow

```text
Dashboard
→ Pengeluaran
→ Tambah Pengeluaran
```

Fields:

```text
Kategori
Nominal
Bayar dari akun
Keterangan
Tanggal
```

Example:

```text
Internet toko
Rp300.000
Cash
```

System:

```text
Transaction: operating expense
Ledger: Cash OUT Rp300.000
```

This affects operating profit/reporting.

---

## 9. Manual Income Flow

```text
Dashboard
→ Pemasukan
→ Tambah Pemasukan
```

Fields:

```text
Kategori
Nominal
Masuk ke akun
Keterangan
Tanggal
```

Example:

```text
Komisi provider
Rp50.000
BCA
```

System:

```text
Ledger: BCA IN Rp50.000
```

---

## 10. Transaction History Flow

```text
Riwayat
```

Capabilities:

- Search.
- Filter by date.
- Filter by category.
- Filter by account.
- Filter by status.
- View details.

Transaction detail:

```text
Transaction number
Date/time
Category
Description
Amounts
Profit
Ledger movements
Status
Receipt
Audit/cancellation data
```

---

## 11. Cancellation Flow

Financial transactions must not simply disappear.

```text
Transaction Detail
→ Batalkan Transaksi
→ Enter reason
→ Confirm
```

System:

```text
validate transaction is cancellable

BEGIN DB TRANSACTION

mark original transaction CANCELLED
create reversal ledger entries
record cancel reason/time

COMMIT
```

Example original:

```text
Cash IN Rp52.000
```

Cancellation creates:

```text
Cash OUT Rp52.000
```

This preserves history.

---

## 12. Account Flow

```text
Pengaturan / Akun
→ Daftar Akun
```

Example:

```text
Cash
BCA
BRI
Mandiri
QRIS
DANA
```

Actions:

- Add account.
- Rename account.
- Disable account.

Phase 1 records an optional opening balance only during account creation as an auditable `Saldo awal` ledger entry.

Avoid deleting an account that has ledger history.

---

## 13. Reports Flow

```text
Laporan
→ Today / Week / Month / Custom Range
```

Display:

```text
Transaction Volume
Cash In
Cash Out
Operating Expenses
Profit
Transaction Count
Profit by Category
Balance by Account
```

Charts are secondary to readable numbers.

---

## 14. Receipt Flow

After transaction commit:

```text
Transaction Saved
      ↓
Receipt Preview
      ↓
Print
```

Receipt can include:

```text
Shop name
Transaction number
Date/time
Transaction type
Description
Nominal
Admin fee
Total paid
Payment method
Footer
```

Do not expose internal profit/cost on customer receipts unless explicitly configured.

---

## 15. Failure Flows

### Database fails

```text
Save Transaction
→ DB error
→ No receipt success state
→ Show retry/error
```

### Printing fails

```text
Save Transaction
→ DB success
→ Print fails
→ Transaction remains saved
→ Show "Cetak ulang"
```

### Duplicate click

The UI must prevent accidental duplicate submission.

Use server-side idempotency where appropriate for financial commands.

---

## 16. Startup Flow

Production deployment:

```text
PC/server boot
      ↓
Docker starts
      ↓
PostgreSQL starts
      ↓
KONTERKU starts
      ↓
Health check passes
      ↓
Available on LAN
```

No manual `npm run dev` should be required in normal use.

---

## 17. Future Print Bridge Flow

Not part of first implementation unless explicitly requested.

```text
KONTERKU
→ Save transaction
→ Send print job
→ Local Print Bridge
→ ESC/POS printer
```

Print bridge responsibilities:

- Receive local trusted print command.
- Format ESC/POS.
- Send to configured printer.
- Return success/failure.

It must not:

- calculate profit,
- write financial records,
- own transaction logic.

---

## 18. Future External POS/PPOB Integration

Preferred flow:

```text
External Software
      ↓
Structured integration
      ↓
KONTERKU import/bridge
      ↓
Normalize transaction
      ↓
Create financial records
```

Never silently import uncertain financial data.

If mapping is ambiguous, require review.
