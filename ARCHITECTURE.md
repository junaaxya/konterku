# KONTERKU — Architecture

## 1. Product Goal

KONTERKU is a local-first web application for recording and understanding the financial activity of a small counter/shop (konter).

The primary goal is not complex accounting. The goal is to make daily money movement easy to record, trace, reconcile, and review.

Core principles:

- Local-first.
- Private LAN access only.
- Mobile-first UI.
- One source of truth for transactions.
- Every money movement must be traceable.
- Profit is not the same thing as cash-in.
- Avoid duplicate manual input.
- A transaction should be able to generate financial records automatically.
- The application must remain simple enough for one owner to maintain.

---

## 2. Initial Scope

The MVP manages:

- Dashboard.
- Counter transactions.
- Income.
- Expenses.
- Cash/bank/e-wallet accounts.
- Transaction history.
- Corrections and cancellation.
- Daily/weekly/monthly reports.
- Profit calculation.
- Receipt generation/printing.
- Basic settings.
- Local database backup.

The following are NOT MVP requirements:

- Public cloud hosting.
- Multi-branch.
- Complex multi-user RBAC.
- Payroll.
- Full double-entry accounting.
- CRM.
- Loyalty system.
- AI features.
- WhatsApp automation.
- OCR-based receipt parsing.
- Advanced inventory management.
- Integration with external PPOB software unless explicitly started as a later phase.

---

## 3. Technology Stack

### Application

- Next.js
- TypeScript
- App Router
- Tailwind CSS
- shadcn/ui

### Server

Use Next.js server-side capabilities for the MVP:

- Server Actions where appropriate.
- Route Handlers for explicit HTTP endpoints.
- Server Components for server-rendered screens.

Do not create a separate NestJS/Express backend for the MVP unless there is a proven requirement.

### Database

- PostgreSQL
- Prisma ORM

### Validation

- Zod

### Charts

- Recharts

### Deployment

- Docker Compose
- Node.js production build
- PostgreSQL container
- `restart: unless-stopped`

### Receipt Printing

Phase 1:
- Generate printable HTML receipt.
- Support normal browser printing.

Later phase:
- Local Print Bridge for direct thermal printer / ESC-POS printing.

---

## 4. Deployment Model

KONTERKU is intended to run on a PC/server inside the shop network.

Example:

```text
                LOCAL NETWORK / WIFI

       ┌────────────┐
       │   Phone    │
       └─────┬──────┘
             │
       ┌─────▼──────┐
       │   Browser  │
       └─────┬──────┘
             │
             │ http://192.168.1.10
             │
       ┌─────▼─────────────┐
       │     KONTERKU      │
       │      Next.js      │
       └─────┬─────────────┘
             │
       ┌─────▼─────────────┐
       │    PostgreSQL     │
       └───────────────────┘
```

The server must bind to the LAN interface, not only `localhost`.

Public internet exposure is not part of the MVP.

---

## 5. Application Boundaries

Use a modular monolith.

Suggested structure:

```text
src/
├── app/
│   ├── (dashboard)/
│   ├── transactions/
│   ├── expenses/
│   ├── income/
│   ├── accounts/
│   ├── reports/
│   └── settings/
├── components/
│   ├── ui/
│   └── shared/
├── features/
│   ├── transactions/
│   ├── ledger/
│   ├── accounts/
│   ├── reports/
│   ├── printing/
│   └── settings/
├── lib/
│   ├── db/
│   ├── money/
│   ├── dates/
│   └── validation/
└── prisma/
```

Business logic must live in feature/domain modules, not inside React components.

---

## 6. Core Domain Model

The financial model must distinguish:

1. Business transaction.
2. Money movement.
3. Profit.
4. Account balance.

A counter transaction is not automatically equivalent to income.

Example:

```text
Customer asks for bank transfer Rp500,000
Admin fee charged to customer Rp5,000

Cash received:
+ Rp505,000

Bank account:
- Rp500,000

Profit:
+ Rp5,000
```

The application must never treat Rp505,000 as profit.

---

## 7. Main Entities

### Account

Represents where money is stored.

Examples:

- Cash.
- BCA.
- BRI.
- Mandiri.
- QRIS.
- DANA.
- GoPay.

Suggested fields:

```text
id
name
type
isActive
createdAt
updatedAt
```

Opening balance is represented by a `Saldo awal` `LedgerEntry`, not a mutable `Account` balance field.

Possible account types:

```text
CASH
BANK
EWALLET
QRIS
OTHER
```

---

### Transaction

Represents the business event.

Examples:

- Pulsa.
- Paket data.
- Token PLN.
- PPOB.
- Bank transfer.
- Cash withdrawal.
- E-wallet top-up.
- Product sale.
- Other.

Suggested fields:

```text
id
transactionNumber
category
description
status
grossAmount
costAmount
feeAmount
profitAmount
paymentMethod
occurredAt
createdAt
updatedAt
cancelledAt
cancelReason
```

Statuses:

```text
COMPLETED
CANCELLED
```

Do not hard-delete financial transactions.

---

### LedgerEntry

Represents actual movement of money.

Suggested fields:

```text
id
transactionId
accountId
direction
amount
description
occurredAt
createdAt
```

Direction:

```text
IN
OUT
```

Example:

```text
Transaction: Bank transfer Rp500,000 + admin Rp5,000

Ledger:
Cash     IN   Rp505,000
BCA      OUT  Rp500,000

Profit:
Rp5,000
```

---

### Expense

Can be modeled as a transaction subtype or dedicated domain command that creates ledger entries.

Examples:

- Electricity.
- Shop supplies.
- Stock purchase.
- Bank fees.
- Internet.
- Other operational cost.

Do not create an expense implementation that bypasses the ledger.

---

### ManualIncome

For income that does not originate from normal counter transactions.

Examples:

- Miscellaneous income.
- Cashback.
- Commission.

Manual income must also create a ledger entry.

---

### Settings

Suggested categories:

- Shop profile.
- Receipt footer.
- Currency.
- Default account.
- Transaction categories.
- Printing preferences.

---

## 8. Money Rules

All money calculations must follow these rules:

- Never use JavaScript floating-point numbers for monetary arithmetic.
- Store Rupiah as integer values.
- `Rp10.000` is stored as `10000`.
- No decimal currency is required for MVP.
- Never derive account balance only from a mutable balance field without a ledger source.
- Ledger entries are the financial source of truth.

Balance formula:

```text
all IN ledger entries (including `Saldo awal`)
- all OUT ledger entries
= current balance
```

Profit is derived from the business transaction, not account movement alone.

---

## 9. Transaction Categories

Initial categories:

```text
PULSA
DATA_PACKAGE
PLN_TOKEN
PPOB
BANK_TRANSFER
CASH_WITHDRAWAL
EWALLET_TOPUP
PRODUCT_SALE
OTHER
```

Category-specific metadata may be stored in a JSON field only when the schema would otherwise become unnecessarily complex.

Common fields should remain relational columns.

---

## 10. Example Domain Behaviors

### Pulsa

Example:

```text
Cost:        Rp48,500
Sell price:  Rp52,000
Payment:     Cash
Profit:      Rp3,500
```

Ledger:

```text
Cash IN Rp52,000
```

Transaction:

```text
grossAmount  = 52000
costAmount   = 48500
profitAmount = 3500
```

If balance of an external provider account is later tracked, that should become an explicit account/ledger movement in a later phase.

---

### Bank Transfer

Example:

```text
Transfer amount: Rp500,000
Customer fee:    Rp5,000
Source account:  BCA
Customer pays:   Cash
```

Ledger:

```text
Cash IN  Rp505,000
BCA  OUT Rp500,000
```

Profit:

```text
Rp5,000
```

---

### Cash Withdrawal

Example:

```text
Customer receives: Rp1,000,000
Admin fee:         Rp10,000
Source:            Cash
Customer payment / settlement source depends on shop workflow
```

The implementation must model the real movement between accounts instead of only storing the admin fee.

---

## 11. Reports

Reports should be generated from database records.

MVP reports:

- Today.
- Custom date range.
- Weekly.
- Monthly.

Metrics:

- Gross transaction volume.
- Cash in.
- Cash out.
- Operating expenses.
- Profit.
- Transaction count.
- Profit by category.
- Account balances.

Do not mix transaction volume with revenue/profit in the UI.

Use clear Indonesian labels.

---

## 12. Data Integrity

Financial data requires stricter rules than ordinary CRUD.

Required:

- Database transactions when creating a business transaction and its ledger entries.
- No partial financial writes.
- Cancellation must create reversal entries or otherwise preserve an auditable history.
- Avoid destructive delete.
- Record timestamps.
- Validate positive monetary values.
- Validate required accounts for account-moving transactions.

Prefer consistency over convenience.

---

## 13. Authentication

For the first LAN-only personal MVP:

- Authentication may be omitted if the user explicitly accepts trusted-LAN-only usage.

However, architecture must not prevent adding simple authentication later.

Do not build OAuth, social login, organizations, roles, or permission systems in MVP.

---

## 14. Backup

At minimum:

- PostgreSQL backup command/script.
- Document restore procedure.
- Backup location configurable outside the repository.
- Never commit database backups containing real transaction data to Git.

Later:
- Scheduled automatic backup.

---

## 15. Printing Architecture

### MVP

```text
KONTERKU
   │
   ├── Save transaction
   ├── Create ledger entries
   ├── Generate receipt
   └── Browser print
```

Saving a transaction must succeed before receipt printing is considered successful.

Printing must never be the only source of transaction persistence.

### Future Direct Printing

```text
KONTERKU
   │
   ▼
Local Print Bridge
   │
   ▼
USB / LAN Thermal Printer
```

The print bridge should be a separate process and must not contain financial business logic.

---

## 16. External Software Integration

Future integrations may consume:

- Official API.
- Local database.
- Export file.
- Webhook.
- Print spool/job data only when technically and legally appropriate.

Do not start by parsing arbitrary printer output.

Preferred priority:

```text
Official API
> Structured database/export
> Local integration bridge
> Print parsing
> OCR
```

---

## 17. Non-Functional Requirements

### Mobile-first

Primary target widths:

- Phone.
- Tablet.
- Desktop.

Forms must be easy to use on a phone.

### Performance

LAN usage should feel immediate.

Avoid unnecessary client-side fetch waterfalls.

### Reliability

A failed print must not erase a recorded transaction.

A failed transaction write must not print a misleading successful receipt.

### Accessibility

- Reasonable contrast.
- Large tap targets.
- Labels on form fields.
- Confirmation for destructive/cancellation actions.

### Language

User-facing UI: Bahasa Indonesia.

Code, file names, commit messages, architecture docs: English is preferred.

---

## 18. Development Strategy

Build as a vertical slice.

Recommended order:

```text
Foundation
→ Accounts
→ Ledger
→ Generic transaction
→ Dashboard
→ Category-specific transaction flows
→ Expenses/income
→ History
→ Reports
→ Receipt printing
→ Backup
→ Polish
```

Do not implement future features early.
