# AGENTS.md — KONTERKU

This file defines how AI coding agents should work in this repository.

## Mission

Build KONTERKU as a reliable, local-first financial recording application for a small counter/shop.

The priorities are:

1. Financial correctness.
2. Simple daily usage.
3. Reliability.
4. Local-network operation.
5. Maintainability.
6. Visual polish.

Do not optimize visual polish at the expense of financial correctness.

---

## Required Reading

Before making changes, read:

1. `ARCHITECTURE.md`
2. `FLOW.md`
3. `RULES.md`
4. Existing source code relevant to the task
5. Existing Prisma schema and migrations

Treat these documents as repository contracts.

If code and documentation conflict, identify the conflict before expanding the implementation.

---

## Fixed Technical Direction

Unless explicitly changed by the owner:

```text
Next.js
TypeScript
App Router
Tailwind CSS
shadcn/ui
PostgreSQL
Prisma
Zod
Recharts
Docker Compose
```

Architecture:

```text
Modular monolith
Local-first
LAN-only MVP
Mobile-first UI
Ledger-backed financial records
```

Do not introduce:

```text
NestJS
Express
Redis
Kafka
RabbitMQ
Supabase
Firebase
Clerk
Auth0
microservices
public cloud dependency
```

without an explicit requirement.

---

## Core Domain Invariant

A business transaction and money movement are related but not identical.

Example:

```text
Bank transfer amount: Rp500,000
Admin fee:            Rp5,000

Cash:
+ Rp505,000

BCA:
- Rp500,000

Profit:
Rp5,000
```

Never report Rp505,000 as profit.

Every account movement must be represented by ledger entries.

---

## Money Handling

All Rupiah amounts are integer values.

Correct:

```ts
const amount = 500000;
```

Do not use:

```ts
const amount = 500000.50;
```

Do not perform financial logic using floating-point currency.

The server owns authoritative calculations.

---

## Work Style

For every task:

### 1. Inspect

Read existing implementation before writing code.

Identify:

- affected modules.
- database schema.
- existing patterns.
- relevant tests.

### 2. Plan

Use a small vertical implementation plan.

Example:

```text
1. Add schema
2. Add domain service
3. Add validation
4. Add server action
5. Add UI
6. Add tests
7. Run checks
```

Do not produce a huge speculative roadmap unless asked.

### 3. Implement

Make the smallest complete change that satisfies the requested phase.

Avoid unrelated refactors.

### 4. Verify

Run relevant checks.

Expected baseline as the project matures:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

If commands differ, inspect `package.json`.

For schema changes also validate Prisma/migrations.

Never claim verification that was not actually run.

### 5. Report

At the end, report:

```text
Changed:
- ...

Verified:
- ...

Not done:
- ...
```

Keep the report factual.

---

## Phase Discipline

Do not jump ahead.

Recommended build order:

### Phase 0 — Foundation

- Next.js project.
- TypeScript strict.
- Tailwind/shadcn.
- Prisma.
- PostgreSQL.
- Docker Compose.
- Environment validation.
- Basic app shell.
- Health check.
- Test setup.

### Phase 1 — Accounts + Ledger

- Account model.
- LedgerEntry model.
- Opening balance.
- Account list.
- Balance calculation.
- Domain tests.

Acceptance:

- User can create/manage accounts.
- Balance is derived correctly from ledger.
- No transaction-category features yet.

### Phase 2 — Generic Financial Transactions

- Transaction model.
- Generic income.
- Generic expense.
- Atomic ledger writes.
- Transaction history.
- Cancellation/reversal.
- Tests.

Acceptance:

- Money movements are auditable.
- Completed transactions are not hard-deleted.
- Cancellation preserves history.

### Phase 3 — Counter Transactions

Add category flows:

- Pulsa.
- Data package.
- PLN token.
- PPOB.
- Bank transfer.
- Cash withdrawal.
- E-wallet top-up.
- Product sale.
- Other.

Each flow should reuse the same core transaction/ledger engine.

Do not create isolated financial systems per category.

### Phase 4 — Dashboard + Reports

- Daily metrics.
- Account balances.
- Transaction count.
- Profit.
- Date-range reports.
- Category breakdown.

### Phase 5 — Receipt Printing

- Receipt template.
- Print preview.
- Browser print.
- Reprint.

Do not implement direct ESC/POS bridge yet unless specifically requested.

### Phase 6 — Local Deployment + Backup

- Production Docker Compose.
- Auto restart.
- Persistent volumes.
- LAN documentation.
- PostgreSQL backup/restore.

### Later — Direct Printer / External Software Integration

Only after the owner provides actual printer/software details.

---

## Schema Design Guidance

Expected core entities:

```text
Account
Transaction
LedgerEntry
Setting
```

Additional supporting entities are allowed when justified.

Use enums carefully.

Do not make the schema prematurely generic.

Prefer explicit fields for:

- amount.
- account.
- date.
- category.
- status.
- cost.
- fee.
- profit.

Use JSON only for category-specific metadata.

---

## Server-Side Financial Command Pattern

Preferred structure:

```ts
export async function createSomething(input: unknown) {
  const parsed = schema.parse(input);

  return db.$transaction(async (tx) => {
    // Load required records.
    // Validate domain invariants.
    // Calculate authoritative amounts.
    // Create Transaction.
    // Create LedgerEntry records.
    // Return normalized result.
  });
}
```

Do not perform the critical ledger write from client code.

---

## Cancellation Pattern

Never:

```text
DELETE /transactions/:id
```

for completed financial records.

Preferred behavior:

```text
Original transaction:
COMPLETED → CANCELLED

Create reversal ledger entries.

Store:
cancelledAt
cancelReason
```

If implementation chooses another auditable method, document it first.

---

## UI Guidance

Target user interface language: Bahasa Indonesia.

Preferred tone:

- short.
- clear.
- practical.

Examples:

```text
Transaksi Baru
Simpan & Cetak
Pemasukan
Pengeluaran
Saldo
Profit
Riwayat
Batalkan Transaksi
Cetak Ulang
```

Avoid forcing accounting vocabulary on the user.

Mobile usability is mandatory.

---

## Design Guidance

Keep the design:

- clean.
- modern.
- dense enough for operational use.
- large enough for touch interaction.

Avoid:

- excessive gradients.
- decorative dashboards with little information.
- giant empty desktop layouts.
- animations that slow transaction entry.

---

## Printing Guidance

MVP printing:

```text
transaction saved
→ receipt generated
→ browser print
```

Printing failure should allow reprint.

Do not save a transaction only after a successful physical print.

Future print bridge:

```text
web app
→ local print adapter
→ ESC/POS
```

Keep this adapter separate from domain logic.

---

## Local Network Requirements

Production must be usable from another device on the same LAN.

Do not configure production to listen only on `127.0.0.1`.

Document how to access the service via the server's LAN IP.

Do not make the application publicly internet-accessible by default.

---

## Environment Variables

Use `.env.example`.

Expected categories may include:

```text
DATABASE_URL
APP_HOST
APP_PORT
```

Later printer-specific variables may be added.

Never commit `.env`.

---

## Testing Priorities

Highest-value tests:

1. Ledger balances.
2. Bank transfer math.
3. Profit calculations.
4. Expense movement.
5. Manual income.
6. Reversal/cancellation.
7. Server validation.
8. Duplicate/invalid submissions.

UI tests are useful but secondary.

---

## Stop Conditions

Stop and ask/report instead of inventing behavior when implementation requires unknown real-world details such as:

- printer brand/model.
- ESC/POS compatibility.
- USB vs LAN printing.
- third-party PPOB software.
- proprietary API.
- exact legacy receipt format.

Create interfaces/stubs only when useful, clearly marked as not implemented.

---

## Definition of Done

A task is done only when:

- requested behavior is implemented.
- domain invariants are preserved.
- relevant tests/checks pass.
- no obvious unfinished placeholder remains in the requested scope.
- documentation is updated if necessary.
- the final report states what was and was not verified.

---

## Owner Intent

This is a practical private tool, not a portfolio architecture exercise.

Favor:

```text
boring
clear
correct
easy to maintain
```

over:

```text
clever
distributed
over-generalized
prematurely scalable
```
