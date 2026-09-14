# KONTERKU — Development Rules

These rules are mandatory for AI agents and human contributors.

## 1. Scope Discipline

- Build only the current requested phase.
- Do not implement future features "just in case".
- Do not add microservices to the MVP.
- Do not add Redis unless a concrete requirement appears.
- Do not add external SaaS dependencies for functionality that can run locally.
- Do not expose the app publicly by default.
- Do not add authentication complexity unless explicitly requested.

When uncertain, choose the simpler architecture that preserves correctness.

---

## 2. Local-First Requirement

KONTERKU must work on the local network without requiring internet access for normal financial operations.

Internet-dependent functionality must never block:

- transaction creation,
- account balances,
- history,
- reporting,
- receipt generation.

No core runtime dependency on:

- Supabase,
- Firebase,
- Clerk,
- Auth0,
- cloud database,
- hosted queue,
- cloud-only storage.

---

## 3. Financial Correctness

This is the highest-priority rule.

- Never use floating-point arithmetic for Rupiah.
- Store Rupiah as integer values.
- Every account-changing operation must generate ledger entries.
- Use database transactions for multi-record financial writes.
- Never leave a business transaction without required ledger entries.
- Never modify historical financial records silently.
- Never hard-delete completed financial transactions.
- Cancellation must preserve audit history.
- Profit and cash flow are separate concepts.
- Transaction volume and profit are separate concepts.

If a requested implementation violates these rules, stop and redesign before coding.

---

## 4. Database Rules

- Use PostgreSQL.
- Use Prisma.
- Schema changes require migrations.
- Never use `prisma db push` as the normal production migration workflow.
- Do not manually edit production data to "fix" schema problems.
- Add indexes only when justified by query patterns.
- Prefer clear relational fields over arbitrary JSON.
- JSON is allowed for category-specific metadata, not core monetary fields.

---

## 5. Transaction Rules

A financial write should resemble:

```text
validate input
→ begin DB transaction
→ create business record
→ create ledger entries
→ validate consistency
→ commit
```

Do not split dependent financial writes across unrelated requests unless necessary.

Prevent accidental double submission.

---

## 6. UI Rules

- User-facing language: Bahasa Indonesia.
- Mobile-first.
- Large touch targets.
- Fast transaction entry.
- Do not overwhelm users with accounting terminology.
- Show only fields relevant to selected transaction type.
- Important totals must be visible before confirmation.
- Dangerous actions require confirmation.
- Cancellation requires a reason.

Avoid excessive animations.

---

## 7. Code Organization

Business logic belongs in domain/feature services.

Bad:

```text
React component
  └── directly calculates financial ledger
```

Good:

```text
React UI
  ↓
server action / route
  ↓
transaction service
  ↓
ledger service
  ↓
database
```

React components should focus on presentation and interaction.

---

## 8. TypeScript Rules

- Strict TypeScript.
- Avoid `any`.
- Use explicit domain types.
- Validate untrusted runtime data with Zod.
- Do not trust client-calculated profit or totals.
- Recalculate authoritative monetary results server-side.

---

## 9. API / Server Action Rules

Client input is untrusted.

The server must validate:

- amount.
- account IDs.
- transaction category.
- required fields.
- transaction status.
- business invariants.

Do not accept authoritative values such as `profitAmount` directly from the client when the server can calculate them.

---

## 10. Error Handling

Errors must be actionable.

User-facing examples:

```text
"Gagal menyimpan transaksi. Data belum tercatat."
"Transaksi tersimpan, tetapi struk gagal dicetak."
"Saldo akun tidak mencukupi."
```

Do not expose raw database stack traces to the UI.

Log technical details server-side.

---

## 11. Printing Rules

- Saving financial data comes before printing.
- Print failure must not roll back an already successful financial transaction merely because the physical printer failed.
- Provide reprint.
- Customer receipts should not reveal internal cost/profit by default.
- Direct ESC/POS support belongs behind a printing abstraction.

---

## 12. Testing Rules

Minimum tests for financial domain logic:

- Money calculation.
- Profit calculation.
- Ledger creation.
- Transfer between accounts.
- Expense.
- Manual income.
- Transaction cancellation/reversal.
- Invalid account.
- Invalid amount.
- Duplicate submission protection where implemented.

Prioritize domain tests over screenshot/UI tests.

---

## 13. Security Rules

Even on LAN:

- Validate all inputs.
- Do not commit secrets.
- Use environment variables.
- Do not store passwords in plaintext.
- Do not expose PostgreSQL port outside what deployment requires.
- Prefer the application as the only normal database access surface.
- Sanitize/escape receipt text where applicable.

Do not assume LAN means trusted code.

---

## 14. Git Rules

Before modifying code:

- Inspect existing project structure.
- Read `AGENTS.md`.
- Read `ARCHITECTURE.md`.
- Read `FLOW.md`.
- Read `RULES.md`.

During implementation:

- Keep changes scoped.
- Avoid unrelated formatting/rewrite.
- Do not delete working code without cause.
- Keep migration files.
- Do not commit `.env`.
- Do not commit database dumps.
- Do not commit node_modules or build output.

Suggested commit style:

```text
feat(accounts): add account management
feat(transactions): add bank transfer flow
fix(ledger): prevent duplicate reversal
docs: update transaction flow
```

---

## 15. Dependency Rules

Before adding a package:

1. Check whether existing dependencies already solve the problem.
2. Prefer maintained, common packages.
3. Avoid dependency-heavy solutions for small utilities.
4. Do not introduce a new framework for one feature.

The stack is intentionally boring.

---

## 16. Docker Rules

Development may run outside Docker if convenient.

Production/local deployment should support Docker Compose.

Containers should:

- restart automatically.
- use persistent PostgreSQL volumes.
- load configuration from environment variables.
- expose only required ports.

Never put real secrets directly in `docker-compose.yml`.

---

## 17. Documentation Rules

Update documentation when behavior changes.

If implementation meaningfully changes:

- architecture → update `ARCHITECTURE.md`
- user/business flow → update `FLOW.md`
- agent/contributor convention → update `RULES.md`
- phase execution instructions → update `AGENTS.md`

Docs and code should not intentionally disagree.

---

## 18. Agent Behavior Rules

AI agents must:

- inspect before editing.
- state assumptions.
- prefer small complete vertical slices.
- run relevant tests after changes.
- report exactly what changed.
- report unresolved problems.
- not claim tests passed unless they were run.
- not invent files, APIs, printer models, or requirements.
- not silently replace agreed architecture.

If blocked by missing real-world printer/software details, implement an interface/adapter boundary and stop before inventing integration behavior.
