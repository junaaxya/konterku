"use client"

import { useState } from "react"
import {
  Link as LinkIcon,
  PlusCircle,
  MinusCircle,
  Prohibit,
  Check,
} from "@phosphor-icons/react"
import { formatRupiah } from "@/lib/money"
import type {
  AccountReconciliationSummary,
  ExternalTransactionWithCandidate,
} from "@/features/accounts/external-reconciliation"
import {
  matchToExistingAction,
  recordAsIncomeAction,
  recordAsExpenseAction,
  ignoreExternalAction,
} from "./reconciliation-actions"

type Props = {
  readonly summary: AccountReconciliationSummary
  readonly externalTransactions: readonly ExternalTransactionWithCandidate[]
}

type ActionModal =
  | { type: "MATCH"; externalTx: ExternalTransactionWithCandidate; targetTxId?: string | undefined }
  | { type: "INCOME"; externalTx: ExternalTransactionWithCandidate }
  | { type: "EXPENSE"; externalTx: ExternalTransactionWithCandidate }
  | { type: "IGNORE"; externalTx: ExternalTransactionWithCandidate }
  | null

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
})

export function AccountReconciliationView({ summary, externalTransactions }: Props) {
  const [modal, setModal] = useState<ActionModal>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [customDesc, setCustomDesc] = useState("")
  const [customNote, setCustomNote] = useState("")

  const openMatch = (tx: ExternalTransactionWithCandidate, candidateId?: string) => {
    setModal({ type: "MATCH", externalTx: tx, targetTxId: candidateId })
    setCustomNote("")
  }

  const openIncome = (tx: ExternalTransactionWithCandidate) => {
    setModal({ type: "INCOME", externalTx: tx })
    setCustomDesc(tx.description)
    setCustomNote("")
  }

  const openExpense = (tx: ExternalTransactionWithCandidate) => {
    setModal({ type: "EXPENSE", externalTx: tx })
    setCustomDesc(tx.description)
    setCustomNote("")
  }

  const openIgnore = (tx: ExternalTransactionWithCandidate) => {
    setModal({ type: "IGNORE", externalTx: tx })
    setCustomNote("")
  }

  const closeModal = () => {
    setModal(null)
  }

  return (
    <div style={{ marginTop: "1.5rem" }}>
      {/* Reconciliation Header Status Card */}
      <div className="card" style={{ padding: "1.25rem", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span
                className="badge-online"
                style={{
                  background:
                    summary.state === "MATCHED"
                      ? "var(--primary-light)"
                      : summary.state === "DIFFERENCE"
                      ? "#fef2f2"
                      : "var(--slate-bg)",
                  color:
                    summary.state === "MATCHED"
                      ? "var(--primary-dark)"
                      : summary.state === "DIFFERENCE"
                      ? "var(--danger)"
                      : "var(--muted)",
                  fontWeight: 800,
                  fontSize: "0.75rem",
                }}
              >
                {summary.state === "MATCHED"
                  ? "✓ COCOK (MATCHED)"
                  : summary.state === "DIFFERENCE"
                  ? "⚠ ADA SELISIH (DIFFERENCE)"
                  : "○ BELUM DISINKRON (NOT SYNCED)"}
              </span>
            </div>
            <h2 style={{ fontSize: "1.125rem", fontWeight: 800, margin: "0.5rem 0 0.25rem" }}>
              Rekonsiliasi Saldo Bank / E-Wallet
            </h2>
            <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: 0 }}>
              Audit perbandingan antara saldo internal buku besar dengan saldo riil eksternal.
            </p>
          </div>

          {summary.lastSyncedAt && (
            <div style={{ fontSize: "0.75rem", color: "var(--muted)", textAlign: "right" }}>
              <div>Sumber: {summary.source || "External"}</div>
              <div>Waktu: {dateFormatter.format(summary.lastSyncedAt)}</div>
            </div>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(10rem, 1fr))",
            gap: "0.75rem",
            marginTop: "1rem",
            padding: "0.875rem",
            background: "var(--paper)",
            borderRadius: "0.5rem",
          }}
        >
          <div>
            <span style={{ fontSize: "0.6875rem", color: "var(--muted)", display: "block" }}>Saldo Buku (Internal)</span>
            <strong style={{ fontSize: "1rem", color: "var(--ink)" }}>{formatRupiah(summary.bookBalance)}</strong>
          </div>
          <div>
            <span style={{ fontSize: "0.6875rem", color: "var(--muted)", display: "block" }}>Saldo Aktual (Eksternal)</span>
            <strong style={{ fontSize: "1rem", color: "var(--primary-dark)" }}>
              {summary.actualBalance !== null ? formatRupiah(summary.actualBalance) : "Belum ada"}
            </strong>
          </div>
          <div>
            <span style={{ fontSize: "0.6875rem", color: "var(--muted)", display: "block" }}>Selisih (Aktual - Buku)</span>
            <strong
              style={{
                fontSize: "1rem",
                color:
                  summary.difference === null
                    ? "var(--muted)"
                    : summary.difference === 0n
                    ? "var(--primary-dark)"
                    : "var(--danger)",
              }}
            >
              {summary.difference !== null ? (
                <>
                  {summary.difference > 0n ? "+" : ""}
                  {formatRupiah(summary.difference)}
                </>
              ) : (
                "-"
              )}
            </strong>
          </div>
          <div>
            <span style={{ fontSize: "0.6875rem", color: "var(--muted)", display: "block" }}>Item Belum Dicocokkan</span>
            <strong style={{ fontSize: "1rem", color: summary.unmatchedCount > 0 ? "var(--accent-dark)" : "var(--ink)" }}>
              {summary.unmatchedCount} mutasi
            </strong>
          </div>
        </div>
      </div>

      {/* External Transactions Reconciliation List */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h3 style={{ fontSize: "1rem", fontWeight: 800, margin: 0 }}>Mutasi Eksternal Rekening</h3>
            <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
              Daftar transaksi dari mutasi impor yang perlu diverifikasi
            </span>
          </div>
          <span className="eyebrow">{externalTransactions.length} mutasi</span>
        </div>

        {externalTransactions.length === 0 ? (
          <div style={{ padding: "2.5rem 1rem", textAlign: "center", color: "var(--muted)" }}>
            <p style={{ margin: 0, fontSize: "0.875rem" }}>
              Belum ada mutasi eksternal yang diimpor. Gunakan tombol &quot;Import Mutasi&quot; untuk mengunggah CSV.
            </p>
          </div>
        ) : (
          <div>
            {externalTransactions.map((tx) => {
              const isMatched = tx.matchStatus === "MATCHED"
              const isIgnored = tx.matchStatus === "IGNORED"
              const isUnmatched = tx.matchStatus === "UNMATCHED"

              return (
                <div
                  key={tx.id}
                  style={{
                    padding: "0.875rem 1.25rem",
                    borderBottom: "1px solid var(--line)",
                    background: isIgnored ? "var(--paper)" : "var(--surface)",
                    opacity: isIgnored ? 0.7 : 1,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.75rem" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <strong style={{ fontSize: "0.9375rem" }}>{tx.description}</strong>
                        {isMatched && (
                          <span className="badge-online" style={{ fontSize: "0.625rem", padding: "0.125rem 0.375rem" }}>
                            <Check size={10} weight="bold" /> Cocok
                          </span>
                        )}
                        {isIgnored && (
                          <span
                            className="badge-online"
                            style={{ background: "var(--slate-bg)", color: "var(--muted)", fontSize: "0.625rem", padding: "0.125rem 0.375rem" }}
                          >
                            Diabaikan
                          </span>
                        )}
                        {isUnmatched && (
                          <span
                            className="badge-online"
                            style={{ background: "#fffbeb", color: "#d97706", fontSize: "0.625rem", padding: "0.125rem 0.375rem" }}
                          >
                            Belum Cocok
                          </span>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: "0.75rem", fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem" }}>
                        <span>{dateFormatter.format(tx.date)}</span>
                        {tx.runningBalance !== null && <span>Saldo: {formatRupiah(tx.runningBalance)}</span>}
                        {tx.note && <span>Catatan: {tx.note}</span>}
                      </div>

                      {/* Candidate suggestion box if unmatched */}
                      {isUnmatched && tx.candidates.length > 0 && (
                        <div
                          style={{
                            marginTop: "0.5rem",
                            padding: "0.5rem 0.75rem",
                            background: "var(--paper)",
                            borderRadius: "0.375rem",
                            border: "1px solid var(--line)",
                            fontSize: "0.75rem",
                          }}
                        >
                          <span style={{ color: "var(--muted)", display: "block", marginBottom: "0.25rem" }}>
                            {tx.isAmbiguous
                              ? `Ditemukan ${tx.candidates.length} transaksi internal dengan nominal sama (Ambigu):`
                              : "Ditemukan transaksi internal yang cocok:"}
                          </span>
                          {tx.candidates.map((cand) => (
                            <div
                              key={cand.transaction.id}
                              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.25rem" }}
                            >
                              <span>
                                {cand.transaction.transactionNumber} · {cand.transaction.description} (
                                {dateFormatter.format(cand.transaction.occurredAt)})
                              </span>
                              <button
                                type="button"
                                onClick={() => openMatch(tx, cand.transaction.id)}
                                className="btn btn-secondary"
                                style={{ minHeight: "1.75rem", padding: "0.125rem 0.5rem", fontSize: "0.6875rem" }}
                              >
                                Cocokkan Ini
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: "1rem",
                          color: tx.direction === "IN" ? "var(--primary-dark)" : "var(--ink)",
                        }}
                      >
                        {tx.direction === "IN" ? "+" : tx.direction === "OUT" ? "-" : ""}
                        {formatRupiah(tx.amount)}
                      </div>

                      {/* Unmatched action buttons */}
                      {isUnmatched && (
                        <div style={{ display: "flex", gap: "0.25rem", marginTop: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            onClick={() => openIncome(tx)}
                            title="Catat sebagai Pemasukan"
                            className="btn btn-secondary"
                            style={{ minHeight: "1.75rem", padding: "0.25rem 0.5rem", fontSize: "0.6875rem" }}
                          >
                            <PlusCircle size={13} weight="bold" color="var(--primary-dark)" /> Pemasukan
                          </button>
                          <button
                            type="button"
                            onClick={() => openExpense(tx)}
                            title="Catat sebagai Pengeluaran"
                            className="btn btn-secondary"
                            style={{ minHeight: "1.75rem", padding: "0.25rem 0.5rem", fontSize: "0.6875rem" }}
                          >
                            <MinusCircle size={13} weight="bold" color="var(--danger)" /> Pengeluaran
                          </button>
                          <button
                            type="button"
                            onClick={() => openIgnore(tx)}
                            title="Abaikan / Lewati"
                            className="btn btn-secondary"
                            style={{ minHeight: "1.75rem", padding: "0.25rem 0.5rem", fontSize: "0.6875rem" }}
                          >
                            <Prohibit size={13} weight="bold" /> Abaikan
                          </button>
                        </div>
                      )}

                      {isMatched && tx.matchedTransaction && (
                        <span style={{ fontSize: "0.6875rem", color: "var(--muted)", display: "block", marginTop: "0.25rem" }}>
                          No. Tx: {tx.matchedTransaction.transactionNumber}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Confirmation Modals */}
      {modal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.6)",
            zIndex: 100,
            display: "grid",
            placeItems: "center",
            padding: "1rem",
          }}
        >
          <div className="card" style={{ maxWidth: "28rem", width: "100%", padding: "1.5rem" }}>
            {modal.type === "MATCH" && (
              <form
                action={async (formData) => {
                  if (isSubmitting) return
                  setIsSubmitting(true)
                  try {
                    await matchToExistingAction(formData)
                    closeModal()
                  } finally {
                    setIsSubmitting(false)
                  }
                }}
              >
                <input type="hidden" name="externalTransactionId" value={modal.externalTx.id} />
                <input type="hidden" name="transactionId" value={modal.targetTxId || ""} />

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  <LinkIcon size={20} weight="bold" color="var(--primary-dark)" />
                  <h3 style={{ margin: 0, fontSize: "1.0625rem", fontWeight: 800 }}>Konfirmasi Pencocokan</h3>
                </div>

                <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 0.75rem" }}>
                  Hubungkan mutasi eksternal ini dengan transaksi internal yang sudah tercatat.
                  Tidak akan membuat mutasi buku besar ganda.
                </p>

                <div style={{ background: "var(--paper)", padding: "0.75rem", borderRadius: "0.375rem", fontSize: "0.8125rem", marginBottom: "1rem" }}>
                  <div><strong>Mutasi:</strong> {modal.externalTx.description}</div>
                  <div><strong>Nominal:</strong> {formatRupiah(modal.externalTx.amount)}</div>
                </div>

                <div className="form-group">
                  <label htmlFor="match-note">Catatan Rekonsiliasi (Opsional)</label>
                  <input
                    id="match-note"
                    name="note"
                    type="text"
                    className="form-control"
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder="Contoh: Cocok dengan transaksi transfer pelanggan"
                  />
                </div>

                <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem" }}>
                  <button type="button" onClick={closeModal} className="btn btn-secondary" style={{ flex: 1 }}>
                    Batal
                  </button>
                  <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ flex: 1 }}>
                    {isSubmitting ? "Memproses..." : "Konfirmasi Cocok"}
                  </button>
                </div>
              </form>
            )}

            {modal.type === "INCOME" && (
              <form
                action={async (formData) => {
                  if (isSubmitting) return
                  setIsSubmitting(true)
                  try {
                    await recordAsIncomeAction(formData)
                    closeModal()
                  } finally {
                    setIsSubmitting(false)
                  }
                }}
              >
                <input type="hidden" name="externalTransactionId" value={modal.externalTx.id} />

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  <PlusCircle size={20} weight="bold" color="var(--primary-dark)" />
                  <h3 style={{ margin: 0, fontSize: "1.0625rem", fontWeight: 800 }}>Catat Sebagai Pemasukan</h3>
                </div>

                <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 0.75rem" }}>
                  Aksi ini akan membuat transaksi pemasukan baru di buku besar sebesar {formatRupiah(modal.externalTx.amount)}.
                </p>

                <div className="form-group">
                  <label htmlFor="income-desc">Deskripsi Pemasukan</label>
                  <input
                    id="income-desc"
                    name="description"
                    type="text"
                    required
                    className="form-control"
                    value={customDesc}
                    onChange={(e) => setCustomDesc(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="income-note">Catatan Rekonsiliasi (Opsional)</label>
                  <input
                    id="income-note"
                    name="note"
                    type="text"
                    className="form-control"
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder="Contoh: Pendapatan bunga / transfer masuk"
                  />
                </div>

                <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem" }}>
                  <button type="button" onClick={closeModal} className="btn btn-secondary" style={{ flex: 1 }}>
                    Batal
                  </button>
                  <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ flex: 1 }}>
                    {isSubmitting ? "Menyimpan..." : "Simpan Pemasukan"}
                  </button>
                </div>
              </form>
            )}

            {modal.type === "EXPENSE" && (
              <form
                action={async (formData) => {
                  if (isSubmitting) return
                  setIsSubmitting(true)
                  try {
                    await recordAsExpenseAction(formData)
                    closeModal()
                  } finally {
                    setIsSubmitting(false)
                  }
                }}
              >
                <input type="hidden" name="externalTransactionId" value={modal.externalTx.id} />

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  <MinusCircle size={20} weight="bold" color="var(--danger)" />
                  <h3 style={{ margin: 0, fontSize: "1.0625rem", fontWeight: 800 }}>Catat Sebagai Pengeluaran</h3>
                </div>

                <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 0.75rem" }}>
                  Aksi ini akan membuat transaksi pengeluaran baru di buku besar sebesar {formatRupiah(modal.externalTx.amount)}.
                </p>

                <div className="form-group">
                  <label htmlFor="expense-desc">Deskripsi Pengeluaran</label>
                  <input
                    id="expense-desc"
                    name="description"
                    type="text"
                    required
                    className="form-control"
                    value={customDesc}
                    onChange={(e) => setCustomDesc(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="expense-note">Catatan Rekonsiliasi (Opsional)</label>
                  <input
                    id="expense-note"
                    name="note"
                    type="text"
                    className="form-control"
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder="Contoh: Biaya admin bank bulanan"
                  />
                </div>

                <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem" }}>
                  <button type="button" onClick={closeModal} className="btn btn-secondary" style={{ flex: 1 }}>
                    Batal
                  </button>
                  <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ flex: 1 }}>
                    {isSubmitting ? "Menyimpan..." : "Simpan Pengeluaran"}
                  </button>
                </div>
              </form>
            )}

            {modal.type === "IGNORE" && (
              <form
                action={async (formData) => {
                  if (isSubmitting) return
                  setIsSubmitting(true)
                  try {
                    await ignoreExternalAction(formData)
                    closeModal()
                  } finally {
                    setIsSubmitting(false)
                  }
                }}
              >
                <input type="hidden" name="externalTransactionId" value={modal.externalTx.id} />

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  <Prohibit size={20} weight="bold" />
                  <h3 style={{ margin: 0, fontSize: "1.0625rem", fontWeight: 800 }}>Abaikan Mutasi Eksternal</h3>
                </div>

                <p style={{ fontSize: "0.8125rem", color: "var(--muted)", margin: "0 0 0.75rem" }}>
                  Tandai mutasi ini sebagai sudah ditinjau tanpa mempengaruhi atau mengubah buku besar keuangan.
                </p>

                <div className="form-group">
                  <label htmlFor="ignore-note">Alasan Mengabaikan</label>
                  <input
                    id="ignore-note"
                    name="note"
                    type="text"
                    className="form-control"
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder="Contoh: Bukan transaksi konter / transaksi pribadi"
                  />
                </div>

                <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem" }}>
                  <button type="button" onClick={closeModal} className="btn btn-secondary" style={{ flex: 1 }}>
                    Batal
                  </button>
                  <button type="submit" disabled={isSubmitting} className="btn btn-secondary" style={{ flex: 1 }}>
                    {isSubmitting ? "Memproses..." : "Ya, Abaikan"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
