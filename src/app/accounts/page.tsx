import Link from "next/link"
import {
  Bank,
  Money,
  DeviceMobile,
  CreditCard,
  DotsThreeCircle,
} from "@phosphor-icons/react/dist/ssr"

import {
  getAccountBalance,
  listAccountLedgerEntries,
  listAccounts,
} from "@/features/accounts/account-ledger"
import { getAccountIntegrationInfo } from "@/features/accounts/provider-integration"
import { listAccountReconciliations } from "@/features/accounts/cash-reconciliation"
import {
  getAccountReconciliationSummary,
  listExternalTransactionsWithCandidates,
} from "@/features/accounts/external-reconciliation"
import { formatRupiah } from "@/lib/money"
import { CreateAccountForm } from "./create-account-form"
import { CashReconciliationForm } from "./cash-reconciliation-form"
import { ManageAccountForm } from "./manage-account-form"
import { ExternalBalanceManager } from "./external-balance-manager"
import { AccountReconciliationView } from "./account-reconciliation-view"

const accountTypeLabels = {
  CASH: "Kas",
  BANK: "Bank",
  EWALLET: "E-wallet",
  QRIS: "QRIS",
  OTHER: "Lainnya",
} as const

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
})

export const dynamic = "force-dynamic"

type AccountsPageProps = {
  searchParams: Promise<{ akun?: string | string[] }>
}

export default async function AccountsPage({
  searchParams,
}: AccountsPageProps) {
  const accounts = await listAccounts()
  const params = await searchParams
  const selectedId = typeof params.akun === "string" ? params.akun : undefined
  const selectedAccount = accounts.find((account) => account.id === selectedId)
  const balances = await Promise.all(
    accounts.map(async (account) => [account.id, await getAccountBalance({ accountId: account.id })] as const),
  )
  const balanceById = new Map(balances)
  const selectedIntegration = selectedAccount
    ? await getAccountIntegrationInfo(selectedAccount.id)
    : null
  const reconciliationSummary = selectedAccount && selectedAccount.type !== "CASH"
    ? await getAccountReconciliationSummary(selectedAccount.id)
    : null
  const externalTransactions = selectedAccount && selectedAccount.type !== "CASH"
    ? await listExternalTransactionsWithCandidates(selectedAccount.id, 50)
    : []
  const reconciliations = selectedAccount && selectedAccount.type === "CASH"
    ? await listAccountReconciliations(selectedAccount.id, 5)
    : []
  const ledgerEntries = selectedAccount
    ? await listAccountLedgerEntries({ accountId: selectedAccount.id, limit: 100 })
    : []

  return (
    <main className="container">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "1.25rem" }}>
        <div>
          <p className="eyebrow">PENGATURAN KAS</p>
          <h1 className="page-title">Daftar Akun</h1>
          <p className="page-desc">Kelola tempat penyimpanan uang & pantau saldo buku besar.</p>
        </div>
        <span className="badge-online">{accounts.length} akun terdaftar</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(20rem, 1fr))", gap: "1.5rem", alignItems: "start" }}>
        {/* Left Column: Accounts List */}
        <div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 800, margin: 0 }}>Semua Akun</h2>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Klik untuk lihat mutasi</span>
            </div>

            {accounts.length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
                Belum ada akun terdaftar.
              </div>
            ) : (
              <div>
                {accounts.map((account) => {
                  const isSelected = selectedAccount?.id === account.id
                  return (
                    <Link
                      key={account.id}
                      href={`/accounts?akun=${account.id}`}
                      className="tx-item"
                      style={{
                        background: isSelected ? "var(--primary-light)" : "var(--surface)",
                        borderLeft: isSelected ? "4px solid var(--primary-dark)" : "4px solid transparent",
                      }}
                    >
                      <span
                        className={`icon-box ${
                          account.type === "BANK"
                            ? "blue"
                            : account.type === "CASH"
                            ? "emerald"
                            : account.type === "EWALLET"
                            ? "violet"
                            : account.type === "QRIS"
                            ? "amber"
                            : "slate"
                        }`}
                        style={{ width: "2.5rem", height: "2.5rem" }}
                      >
                        {account.type === "BANK" ? (
                          <Bank size={20} weight="duotone" />
                        ) : account.type === "CASH" ? (
                          <Money size={20} weight="duotone" />
                        ) : account.type === "QRIS" ? (
                          <DeviceMobile size={20} weight="duotone" />
                        ) : account.type === "EWALLET" ? (
                          <CreditCard size={20} weight="duotone" />
                        ) : (
                          <DotsThreeCircle size={20} weight="duotone" />
                        )}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <strong style={{ fontSize: "0.9375rem" }}>{account.name}</strong>
                          <span style={{ fontWeight: 800, fontSize: "0.9375rem", color: "var(--ink)" }}>
                            {formatRupiah(balanceById.get(account.id) ?? 0n)}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                          <span>{accountTypeLabels[account.type]}</span>
                          <span style={{ color: account.isActive ? "var(--primary-dark)" : "var(--muted)", fontWeight: 600 }}>
                            {account.isActive ? "● Aktif" : "○ Nonaktif"}
                          </span>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Add / Manage Account Forms */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Add Account Card */}
          <div className="card">
            <h2 style={{ fontSize: "1.125rem", fontWeight: 800, margin: "0 0 0.25rem" }}>Tambah Akun Baru</h2>
            <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 1rem" }}>
              Saldo awal dicatat sebagai entri pembuka di buku besar.
            </p>

            <CreateAccountForm />
          </div>

          {/* Edit Selected Account */}
          {selectedAccount && (
            <div className="card">
              <h2 style={{ fontSize: "1.125rem", fontWeight: 800, margin: "0 0 0.25rem" }}>Kelola {selectedAccount.name}</h2>
              <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 1rem" }}>
                Ganti nama atau ubah status keaktifan akun.
              </p>

              <div
                style={{
                  background: "var(--paper)",
                  border: "1px solid var(--line)",
                  borderRadius: "0.5rem",
                  padding: "0.75rem 0.875rem",
                  marginBottom: "1rem",
                  fontSize: "0.8125rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.375rem" }}>
                  <span style={{ color: "var(--muted)" }}>Saldo Buku Besar:</span>
                  <strong style={{ color: "var(--ink)", fontWeight: 800 }}>
                    {formatRupiah(balanceById.get(selectedAccount.id) ?? 0n)}
                  </strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--muted)" }}>Integrasi Provider:</span>
                  {selectedIntegration?.isConnected ? (
                    <span className="badge-online" style={{ fontSize: "0.6875rem", padding: "0.125rem 0.5rem" }}>
                      ● {selectedIntegration.providerName}
                    </span>
                  ) : (
                    <span style={{ color: "var(--muted)", fontStyle: "italic", fontSize: "0.75rem" }}>
                      Belum terhubung
                    </span>
                  )}
                </div>

                {selectedIntegration?.isConnected && (
                  <div style={{ borderTop: "1px dashed var(--line)", marginTop: "0.5rem", paddingTop: "0.5rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--muted)" }}>No. Rekening / ID:</span>
                      <span style={{ fontWeight: 700 }}>{selectedIntegration.externalAccountId}</span>
                    </div>
                  </div>
                )}

                <div style={{ borderTop: "1px dashed var(--line)", marginTop: "0.5rem", paddingTop: "0.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "var(--muted)" }}>Saldo Aktual:</span>
                    <span style={{ fontWeight: 800, color: "var(--primary-dark)", fontSize: "0.9375rem" }}>
                      {selectedIntegration?.latestActualBalance != null
                        ? formatRupiah(selectedIntegration.latestActualBalance)
                        : "Belum ada saldo aktual"}
                    </span>
                  </div>

                  {selectedIntegration?.latestSnapshotAt && (
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.25rem", fontSize: "0.75rem", color: "var(--muted)" }}>
                      <span>Sumber & Waktu:</span>
                      <span>
                        {selectedIntegration.latestSource === "MANUAL"
                          ? "Manual"
                          : selectedIntegration.latestSource === "IMPORT"
                          ? "Import CSV"
                          : selectedIntegration.latestSource === "LOCAL_SYNC"
                          ? "Local Bank Connector"
                          : "Provider Sync"}{" "}
                        · {dateFormatter.format(selectedIntegration.latestSnapshotAt)}
                      </span>
                    </div>
                  )}

                  {selectedIntegration?.latestActualBalance != null && (() => {
                    const bookBalance = balanceById.get(selectedAccount.id) ?? 0n
                    const diff = selectedIntegration.latestActualBalance - bookBalance
                    return (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginTop: "0.375rem",
                          paddingTop: "0.375rem",
                          borderTop: "1px dashed var(--line)",
                        }}
                      >
                        <span style={{ color: "var(--muted)" }}>Selisih (Aktual - Buku):</span>
                        <strong style={{ color: diff === 0n ? "var(--primary-dark)" : "var(--danger)" }}>
                          {diff > 0n ? "+" : ""}{formatRupiah(diff)}
                        </strong>
                      </div>
                    )
                  })()}
                </div>

                {selectedAccount.type !== "CASH" && (
                  <ExternalBalanceManager
                    accountId={selectedAccount.id}
                    accountName={selectedAccount.name}
                    accountType={selectedAccount.type}
                    bookBalance={balanceById.get(selectedAccount.id) ?? 0n}
                    latestActualBalance={selectedIntegration?.latestActualBalance}
                    lastSyncedAt={selectedIntegration?.latestSnapshotAt}
                  />
                )}
              </div>

              {selectedAccount.type === "CASH" && (
                <CashReconciliationForm
                  accountId={selectedAccount.id}
                  systemBalance={balanceById.get(selectedAccount.id) ?? 0n}
                />
              )}

              <div style={{ marginTop: "1rem" }}>
                <ManageAccountForm account={selectedAccount} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Selected Account Reconciliation History */}
      {selectedAccount && selectedAccount.type === "CASH" && reconciliations.length > 0 && (
        <div className="card" style={{ marginTop: "1.5rem", padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 800, margin: 0 }}>Riwayat Rekonsiliasi Fisik</h2>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Audit perbandingan kas fisik vs sistem</span>
            </div>
            <span className="eyebrow">{reconciliations.length} catatan</span>
          </div>

          <div>
            {reconciliations.map((rec) => (
              <div key={rec.id} className="tx-item">
                <span className={`tx-badge ${rec.difference === 0n ? "in" : "out"}`}>
                  {rec.difference === 0n ? "✓" : "!"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: "0.875rem" }}>
                      Fisik: {formatRupiah(rec.physicalAmount)} (Sistem: {formatRupiah(rec.systemBalance)})
                    </strong>
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: "0.875rem",
                        color: rec.difference === 0n ? "var(--primary-dark)" : "var(--danger)",
                      }}
                    >
                      Selisih: {rec.difference > 0n ? "+" : ""}{formatRupiah(rec.difference)}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.125rem" }}>
                    <span>{rec.note || "Tanpa catatan"}</span>
                    <span>{dateFormatter.format(rec.reconciledAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Account External Reconciliation View (Bank / E-Wallet / QRIS) */}
      {selectedAccount && selectedAccount.type !== "CASH" && reconciliationSummary && (
        <AccountReconciliationView
          summary={reconciliationSummary}
          externalTransactions={externalTransactions}
        />
      )}

      {/* Selected Account Ledger History */}
      {selectedAccount && (
        <div className="card" style={{ marginTop: "1.5rem", padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h2 style={{ fontSize: "1rem", fontWeight: 800, margin: 0 }}>Riwayat Mutasi: {selectedAccount.name}</h2>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Buku besar akun</span>
            </div>
            <span className="eyebrow">{ledgerEntries.length} entri</span>
          </div>

          {ledgerEntries.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--muted)" }}>
              Belum ada mutasi buku besar untuk akun ini.
            </div>
          ) : (
            <div>
              {ledgerEntries.map((entry) => (
                <div key={entry.id} className="tx-item">
                  <span className={`tx-badge ${entry.direction === "IN" ? "in" : "out"}`}>
                    {entry.direction === "IN" ? "＋" : "−"}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "0.875rem" }}>{entry.description}</strong>
                      <span style={{ fontWeight: 800, fontSize: "0.875rem", color: entry.direction === "IN" ? "var(--primary-dark)" : "var(--ink)" }}>
                        {entry.direction === "IN" ? "+" : "−"}{formatRupiah(entry.amount)}
                      </span>
                    </div>
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                      {dateFormatter.format(entry.occurredAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  )
}
