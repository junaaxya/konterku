"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Bank,
  Money,
  CreditCard,
  QrCode,
  Plus,
  ArrowsClockwise,
} from "@phosphor-icons/react"

import { formatRupiah } from "@/lib/money"
import type { AccountSummary } from "@/features/reports/report-service"
import { ManualBalanceSyncModal } from "./accounts/manual-balance-sync-modal"

type Props = {
  readonly accounts: readonly AccountSummary[]
}

type SectionConfig = {
  readonly title: string
  readonly type: "CASH" | "BANK" | "EWALLET" | "QRIS"
  readonly icon: typeof Bank
  readonly colorClass: "emerald" | "blue" | "violet" | "amber"
  readonly emptyDescription: string
}

const SECTIONS: readonly SectionConfig[] = [
  {
    title: "Saldo Kas",
    type: "CASH",
    icon: Money,
    colorClass: "emerald",
    emptyDescription: "Belum ada akun kas tunai.",
  },
  {
    title: "Saldo Bank",
    type: "BANK",
    icon: Bank,
    colorClass: "blue",
    emptyDescription: "Belum ada rekening bank (BCA, BRI, Mandiri, dll).",
  },
  {
    title: "Saldo E-Wallet",
    type: "EWALLET",
    icon: CreditCard,
    colorClass: "violet",
    emptyDescription: "Belum ada akun e-wallet (DANA, GoPay, OVO, dll).",
  },
  {
    title: "Saldo QRIS",
    type: "QRIS",
    icon: QrCode,
    colorClass: "amber",
    emptyDescription: "Belum ada akun QRIS terdaftar.",
  },
]

export function DashboardAccountBalances({ accounts }: Props) {
  const activeAccounts = accounts.filter((a) => a.isActive)
  const [syncingAccount, setSyncingAccount] = useState<{
    id: string
    name: string
    type: string
    balance: bigint
  } | null>(null)

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginBottom: "1.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p className="eyebrow">DISTRIBUSI DANA</p>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 800, margin: "0.125rem 0 0" }}>Saldo Akun Konter</h2>
        </div>
        <Link
          href="/accounts"
          style={{ fontSize: "0.8125rem", color: "var(--primary-dark)", textDecoration: "none", fontWeight: 700 }}
        >
          Kelola Semua Akun →
        </Link>
      </div>

      {SECTIONS.map((sec) => {
        const sectionAccounts = activeAccounts.filter((a) => a.type === sec.type)
        const totalSectionBalance = sectionAccounts.reduce((acc, curr) => acc + curr.balance, 0n)
        const Icon = sec.icon

        return (
          <div key={sec.type} className="card" style={{ padding: "1rem 1.125rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: sectionAccounts.length > 0 ? "0.875rem" : "0.5rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                <span className={`icon-box ${sec.colorClass}`} style={{ width: "2rem", height: "2rem", borderRadius: "0.5rem" }}>
                  <Icon size={18} weight="duotone" />
                </span>
                <span style={{ fontWeight: 800, fontSize: "0.9375rem" }}>{sec.title}</span>
                {sectionAccounts.length > 0 && (
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", fontWeight: 600 }}>
                    ({sectionAccounts.length} akun)
                  </span>
                )}
              </div>

              {sectionAccounts.length > 0 && (
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "0.6875rem", color: "var(--muted)", display: "block" }}>Total</span>
                  <strong style={{ fontSize: "0.9375rem", fontWeight: 800, color: "var(--ink)" }}>
                    {formatRupiah(totalSectionBalance)}
                  </strong>
                </div>
              )}
            </div>

            {sectionAccounts.length === 0 ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.625rem 0.75rem",
                  background: "var(--paper)",
                  borderRadius: "0.5rem",
                  fontSize: "0.8125rem",
                  color: "var(--muted)",
                }}
              >
                <span>{sec.emptyDescription}</span>
                <Link
                  href="/accounts"
                  className="btn btn-secondary"
                  style={{ minHeight: "1.875rem", padding: "0.25rem 0.625rem", fontSize: "0.75rem" }}
                >
                  <Plus size={14} weight="bold" /> Tambah Akun
                </Link>
              </div>
            ) : (
              <div className="account-slider" style={{ marginBottom: 0 }}>
                {sectionAccounts.map((acc) => {
                  const isExternalType = acc.type === "BANK" || acc.type === "EWALLET" || acc.type === "QRIS"

                  return (
                    <div
                      key={acc.id}
                      className="account-mini-card"
                      style={{
                        background: "var(--paper)",
                        minWidth: "13rem",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                      }}
                    >
                      <Link
                        href={`/accounts?akun=${acc.id}`}
                        style={{ textDecoration: "none", color: "inherit", display: "block" }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "0.6875rem", fontWeight: 700, color: "var(--muted)" }}>
                            {acc.type}
                          </span>
                          <span className="badge-online" style={{ fontSize: "0.625rem", padding: "0.125rem 0.375rem" }}>
                            Aktif
                          </span>
                        </div>
                        <div style={{ fontWeight: 800, fontSize: "0.9375rem", margin: "0.375rem 0" }}>
                          {acc.name}
                        </div>
                        <div style={{ fontSize: "1.0625rem", fontWeight: 800, color: "var(--ink)" }}>
                          {formatRupiah(acc.balance)}
                        </div>
                      </Link>

                      {isExternalType && (
                        <div style={{ borderTop: "1px dashed var(--line)", marginTop: "0.625rem", paddingTop: "0.5rem" }}>
                          <button
                            type="button"
                            onClick={() =>
                              setSyncingAccount({
                                id: acc.id,
                                name: acc.name,
                                type: acc.type,
                                balance: acc.balance,
                              })
                            }
                            className="btn btn-secondary"
                            style={{
                              width: "100%",
                              minHeight: "1.875rem",
                              padding: "0.25rem 0.5rem",
                              fontSize: "0.75rem",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "0.375rem",
                            }}
                          >
                            <ArrowsClockwise size={13} weight="bold" /> Perbarui Saldo
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}

      {syncingAccount && (
        <ManualBalanceSyncModal
          account={syncingAccount}
          isOpen={true}
          onClose={() => setSyncingAccount(null)}
        />
      )}
    </div>
  )
}
