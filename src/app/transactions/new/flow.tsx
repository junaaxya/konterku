"use client"

import { useState } from "react"
import {
  DeviceMobile,
  Globe,
  Lightning,
  Receipt,
  Bank,
  Money,
  CreditCard,
  Bag,
  DotsThreeCircle,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Eye,
} from "@phosphor-icons/react"

import { formatRupiah } from "@/lib/money"
import { createCounterTransactionAction } from "./actions"

type AccountOption = {
  readonly id: string
  readonly name: string
  readonly type: string
}

type CustomerOption = {
  readonly id: string
  readonly name: string
  readonly phone: string | null
}

type ProductOption = {
  readonly id: string
  readonly name: string
  readonly sku: string | null
  readonly unit: string
  readonly stockQuantity: number
  readonly sellingPrice: string
  readonly averageCost: string
}

type Props = {
  readonly accounts: readonly AccountOption[]
  readonly customers?: readonly CustomerOption[] | undefined
  readonly products?: readonly ProductOption[] | undefined
}

type CategoryType =
  | "PULSA"
  | "DATA_PACKAGE"
  | "PLN_TOKEN"
  | "PPOB"
  | "BANK_TRANSFER"
  | "CASH_WITHDRAWAL"
  | "EWALLET_TOPUP"
  | "PRODUCT_SALE"
  | "OTHER"

const categoryMeta: Record<
  CategoryType,
  { title: string; subtitle: string; icon: typeof DeviceMobile; colorClass: string }
> = {
  PULSA: { title: "Pulsa", subtitle: "Isi ulang pulsa reguler", icon: DeviceMobile, colorClass: "blue" },
  DATA_PACKAGE: { title: "Paket Data", subtitle: "Kuota internet all operator", icon: Globe, colorClass: "blue" },
  PLN_TOKEN: { title: "Token PLN", subtitle: "Listrik prabayar", icon: Lightning, colorClass: "amber" },
  PPOB: { title: "PPOB", subtitle: "Tagihan BPJS, PDAM, pascabayar", icon: Receipt, colorClass: "amber" },
  BANK_TRANSFER: { title: "Transfer Bank", subtitle: "Kirim uang antar bank pelanggan", icon: Bank, colorClass: "blue" },
  CASH_WITHDRAWAL: { title: "Tarik Tunai", subtitle: "Tarik tunai dari ATM/QRIS", icon: Money, colorClass: "emerald" },
  EWALLET_TOPUP: { title: "Top Up E-Wallet", subtitle: "DANA, GoPay, OVO, ShopeePay", icon: CreditCard, colorClass: "violet" },
  PRODUCT_SALE: { title: "Penjualan Barang", subtitle: "Aksesoris, kartu perdana, dll", icon: Bag, colorClass: "slate" },
  OTHER: { title: "Lainnya", subtitle: "Transaksi konter lainnya", icon: DotsThreeCircle, colorClass: "slate" },
}

export function CounterTransactionFlow({ accounts, customers = [], products = [] }: Props) {
  const [category, setCategory] = useState<CategoryType | null>(null)
  const [isReviewing, setIsReviewing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [customerAccountId, setCustomerAccountId] = useState(accounts[0]?.id || "")
  const [sourceStoreAccountId, setSourceStoreAccountId] = useState(accounts[0]?.id || "")
  const [costAmount, setCostAmount] = useState("")
  const [sellingPrice, setSellingPrice] = useState("")
  const [productDesc, setProductDesc] = useState("")

  const [isCredit, setIsCredit] = useState(false)
  const [customerId, setCustomerId] = useState(customers[0]?.id || "")
  const [dueDate, setDueDate] = useState("")
  const [selectedProductId, setSelectedProductId] = useState("")
  const [productQuantity, setProductQuantity] = useState(1)

  // Bank Transfer fields
  const [sourceBankId, setSourceBankId] = useState(
    accounts.find((a) => a.type === "BANK")?.id || accounts[0]?.id || "",
  )
  const [customerPayBankId, setCustomerPayBankId] = useState(
    accounts.find((a) => a.type === "CASH")?.id || accounts[0]?.id || "",
  )
  const [transferAmount, setTransferAmount] = useState("")
  const [transferFee, setTransferFee] = useState("5000")
  const [transferDesc, setTransferDesc] = useState("")

  // Cash Withdrawal fields
  const [sourceCashId, setSourceCashId] = useState(
    accounts.find((a) => a.type === "CASH")?.id || accounts[0]?.id || "",
  )
  const [settlementAccountId, setSettlementAccountId] = useState(
    accounts.find((a) => a.type === "BANK" || a.type === "QRIS")?.id || accounts[0]?.id || "",
  )
  const [withdrawalAmount, setWithdrawalAmount] = useState("")
  const [withdrawalFee, setWithdrawalFee] = useState("5000")
  const [withdrawalDesc, setWithdrawalDesc] = useState("")

  // E-Wallet Topup fields
  const [walletSourceId, setWalletSourceId] = useState(
    accounts.find((a) => a.type === "EWALLET" || a.type === "BANK")?.id || accounts[0]?.id || "",
  )
  const [walletCustomerPayId, setWalletCustomerPayId] = useState(
    accounts.find((a) => a.type === "CASH")?.id || accounts[0]?.id || "",
  )
  const [topupAmount, setTopupAmount] = useState("")
  const [topupFee, setTopupFee] = useState("2000")
  const [topupDesc, setTopupDesc] = useState("")

  if (!category) {
    return (
      <div style={{ maxWidth: "56rem", margin: "0 auto", width: "100%" }}>
        {/* Step Indicator */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <div className="badge-online" style={{ background: "var(--primary-light)", color: "var(--primary-dark)" }}>
            <span className="dot" /> Langkah 1: Pilih Jenis Transaksi
          </div>
          <div className="badge-online" style={{ background: "var(--slate-bg)", color: "var(--muted)" }}>
            Langkah 2: Data Transaksi
          </div>
          <div className="badge-online" style={{ background: "var(--slate-bg)", color: "var(--muted)" }}>
            Langkah 3: Review
          </div>
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.25rem", margin: "0.25rem 0", fontWeight: 800 }}>Pilih Kategori Layanan</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", margin: 0 }}>
            Pilih transaksi untuk menampilkan formulir isian yang sesuai.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(15rem, 1fr))", gap: "0.875rem" }}>
          {(Object.keys(categoryMeta) as CategoryType[]).map((cat) => {
            const meta = categoryMeta[cat]
            const Icon = meta.icon
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className="card"
                style={{
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.875rem",
                  padding: "1rem",
                  transition: "all 0.15s ease",
                  border: "1px solid var(--line)",
                  background: "var(--surface)",
                }}
              >
                <span className={`icon-box ${meta.colorClass}`} style={{ width: "2.75rem", height: "2.75rem", borderRadius: "0.625rem" }}>
                  <Icon size={24} weight="duotone" />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: "0.9375rem", display: "block", color: "var(--ink)" }}>{meta.title}</strong>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", display: "block", marginTop: "0.125rem", lineHeight: 1.3 }}>
                    {meta.subtitle}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  const getAccountName = (id: string) => accounts.find((a) => a.id === id)?.name || id
  const parseBig = (val: string) => (val && /^\d+$/.test(val) ? BigInt(val) : 0n)
  const isDigitalCategory =
    category !== "PRODUCT_SALE" &&
    category !== "BANK_TRANSFER" &&
    category !== "CASH_WITHDRAWAL" &&
    category !== "EWALLET_TOPUP"

  let reviewContent = null

  if (category === "BANK_TRANSFER") {
    const tAmt = parseBig(transferAmount)
    const fee = parseBig(transferFee)
    const totalPay = tAmt + fee
    const profit = fee

    reviewContent = (
      <div className="card" style={{ background: "var(--paper)", border: "1.5px solid var(--line)", padding: "1.25rem", borderRadius: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <span className="icon-box blue" style={{ width: "2rem", height: "2rem" }}>
            <Bank size={18} weight="bold" />
          </span>
          <h3 style={{ margin: 0, fontSize: "1.0625rem", fontWeight: 800 }}>Ringkasan Pergerakan Kas</h3>
        </div>
        <dl style={{ display: "grid", gridTemplateColumns: "1fr auto", rowGap: "0.625rem", margin: 0, fontSize: "0.875rem" }}>
          <dt style={{ color: "var(--muted)" }}>Nominal Transfer</dt>
          <dd style={{ fontWeight: 700, margin: 0 }}>{formatRupiah(tAmt)}</dd>

          <dt style={{ color: "var(--muted)" }}>Biaya Admin</dt>
          <dd style={{ fontWeight: 700, margin: 0 }}>{formatRupiah(fee)}</dd>

          <dt style={{ color: "var(--ink)", fontWeight: 700 }}>Total Dibayar Pelanggan</dt>
          <dd style={{ fontWeight: 800, margin: 0, fontSize: "0.9375rem" }}>{formatRupiah(totalPay)}</dd>

          <div style={{ gridColumn: "1 / -1", borderTop: "1px dashed var(--line)", margin: "0.375rem 0" }} />

          <dt style={{ color: "var(--muted)" }}>Uang Masuk ke Akun</dt>
          <dd style={{ fontWeight: 700, margin: 0, color: "var(--primary-dark)" }}>
            + {formatRupiah(totalPay)} ({getAccountName(customerPayBankId)})
          </dd>

          <dt style={{ color: "var(--muted)" }}>Uang Keluar dari Akun</dt>
          <dd style={{ fontWeight: 700, margin: 0, color: "var(--danger)" }}>
            - {formatRupiah(tAmt)} ({getAccountName(sourceBankId)})
          </dd>

          <div style={{ gridColumn: "1 / -1", borderTop: "1px dashed var(--line)", margin: "0.375rem 0" }} />

          <dt style={{ color: "var(--muted)", fontWeight: 700 }}>Estimasi Profit Konter</dt>
          <dd style={{ fontWeight: 800, margin: 0, color: "var(--primary-dark)", fontSize: "1rem" }}>{formatRupiah(profit)}</dd>
        </dl>
      </div>
    )
  } else if (category === "CASH_WITHDRAWAL") {
    const cAmt = parseBig(withdrawalAmount)
    const fee = parseBig(withdrawalFee)
    const totalSettled = cAmt + fee
    const profit = fee

    reviewContent = (
      <div className="card" style={{ background: "var(--paper)", border: "1.5px solid var(--line)", padding: "1.25rem", borderRadius: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <span className="icon-box emerald" style={{ width: "2rem", height: "2rem" }}>
            <Money size={18} weight="bold" />
          </span>
          <h3 style={{ margin: 0, fontSize: "1.0625rem", fontWeight: 800 }}>Ringkasan Pergerakan Kas</h3>
        </div>
        <dl style={{ display: "grid", gridTemplateColumns: "1fr auto", rowGap: "0.625rem", margin: 0, fontSize: "0.875rem" }}>
          <dt style={{ color: "var(--muted)" }}>Uang Tunai Diserahkan</dt>
          <dd style={{ fontWeight: 700, margin: 0 }}>{formatRupiah(cAmt)}</dd>

          <dt style={{ color: "var(--muted)" }}>Biaya Admin</dt>
          <dd style={{ fontWeight: 700, margin: 0 }}>{formatRupiah(fee)}</dd>

          <dt style={{ color: "var(--ink)", fontWeight: 700 }}>Total Diterima Toko</dt>
          <dd style={{ fontWeight: 800, margin: 0, fontSize: "0.9375rem" }}>{formatRupiah(totalSettled)}</dd>

          <div style={{ gridColumn: "1 / -1", borderTop: "1px dashed var(--line)", margin: "0.375rem 0" }} />

          <dt style={{ color: "var(--muted)" }}>Uang Keluar (Tunai)</dt>
          <dd style={{ fontWeight: 700, margin: 0, color: "var(--danger)" }}>
            - {formatRupiah(cAmt)} ({getAccountName(sourceCashId)})
          </dd>

          <dt style={{ color: "var(--muted)" }}>Transfer / QRIS Masuk</dt>
          <dd style={{ fontWeight: 700, margin: 0, color: "var(--primary-dark)" }}>
            + {formatRupiah(totalSettled)} ({getAccountName(settlementAccountId)})
          </dd>

          <div style={{ gridColumn: "1 / -1", borderTop: "1px dashed var(--line)", margin: "0.375rem 0" }} />

          <dt style={{ color: "var(--muted)", fontWeight: 700 }}>Estimasi Profit Konter</dt>
          <dd style={{ fontWeight: 800, margin: 0, color: "var(--primary-dark)", fontSize: "1rem" }}>{formatRupiah(profit)}</dd>
        </dl>
      </div>
    )
  } else if (category === "EWALLET_TOPUP") {
    const tAmt = parseBig(topupAmount)
    const fee = parseBig(topupFee)
    const totalPay = tAmt + fee
    const profit = fee

    reviewContent = (
      <div className="card" style={{ background: "var(--paper)", border: "1.5px solid var(--line)", padding: "1.25rem", borderRadius: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <span className="icon-box violet" style={{ width: "2rem", height: "2rem" }}>
            <CreditCard size={18} weight="bold" />
          </span>
          <h3 style={{ margin: 0, fontSize: "1.0625rem", fontWeight: 800 }}>Ringkasan Pergerakan Kas</h3>
        </div>
        <dl style={{ display: "grid", gridTemplateColumns: "1fr auto", rowGap: "0.625rem", margin: 0, fontSize: "0.875rem" }}>
          <dt style={{ color: "var(--muted)" }}>Nominal Top Up</dt>
          <dd style={{ fontWeight: 700, margin: 0 }}>{formatRupiah(tAmt)}</dd>

          <dt style={{ color: "var(--muted)" }}>Biaya Admin</dt>
          <dd style={{ fontWeight: 700, margin: 0 }}>{formatRupiah(fee)}</dd>

          <dt style={{ color: "var(--ink)", fontWeight: 700 }}>Total Dibayar Pelanggan</dt>
          <dd style={{ fontWeight: 800, margin: 0, fontSize: "0.9375rem" }}>{formatRupiah(totalPay)}</dd>

          <div style={{ gridColumn: "1 / -1", borderTop: "1px dashed var(--line)", margin: "0.375rem 0" }} />

          <dt style={{ color: "var(--muted)" }}>Saldo Toko Berkurang</dt>
          <dd style={{ fontWeight: 700, margin: 0, color: "var(--danger)" }}>
            - {formatRupiah(tAmt)} ({getAccountName(walletSourceId)})
          </dd>

          <dt style={{ color: "var(--muted)" }}>Pembayaran Masuk</dt>
          <dd style={{ fontWeight: 700, margin: 0, color: "var(--primary-dark)" }}>
            + {formatRupiah(totalPay)} ({getAccountName(walletCustomerPayId)})
          </dd>

          <div style={{ gridColumn: "1 / -1", borderTop: "1px dashed var(--line)", margin: "0.375rem 0" }} />

          <dt style={{ color: "var(--muted)", fontWeight: 700 }}>Estimasi Profit Konter</dt>
          <dd style={{ fontWeight: 800, margin: 0, color: "var(--primary-dark)", fontSize: "1rem" }}>{formatRupiah(profit)}</dd>
        </dl>
      </div>
    )
  } else {
    const cost = parseBig(costAmount)
    const sell = parseBig(sellingPrice)
    const profit = sell - cost
    const customerObj = customers.find((c) => c.id === customerId)
    reviewContent = (
      <div className="card" style={{ background: "var(--paper)", border: "1.5px solid var(--line)", padding: "1.25rem", borderRadius: "0.75rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <span className={`icon-box ${categoryMeta[category].colorClass}`} style={{ width: "2rem", height: "2rem" }}>
            <Bag size={18} weight="bold" />
          </span>
          <h3 style={{ margin: 0, fontSize: "1.0625rem", fontWeight: 800 }}>Ringkasan Transaksi</h3>
        </div>
        <dl style={{ display: "grid", gridTemplateColumns: "1fr auto", rowGap: "0.625rem", margin: 0, fontSize: "0.875rem" }}>
              <dt style={{ color: "var(--muted)" }}>Modal / Biaya Kulakan</dt>
              <dd style={{ fontWeight: 700, margin: 0 }}>{formatRupiah(cost)}</dd>

              {isDigitalCategory && (
                <>
                  <dt style={{ color: "var(--muted)" }}>Saldo Toko Berkurang</dt>
                  <dd style={{ fontWeight: 700, margin: 0, color: "var(--danger)" }}>
                    - {formatRupiah(cost)} ({getAccountName(sourceStoreAccountId)})
                  </dd>
                </>
              )}

          <dt style={{ color: "var(--ink)", fontWeight: 700 }}>Harga Jual Pelanggan</dt>
          <dd style={{ fontWeight: 800, margin: 0, fontSize: "0.9375rem" }}>{formatRupiah(sell)}</dd>

          <div style={{ gridColumn: "1 / -1", borderTop: "1px dashed var(--line)", margin: "0.375rem 0" }} />

          {isCredit ? (
            <>
              <dt style={{ color: "var(--amber)", fontWeight: 700 }}>Status Pembayaran</dt>
              <dd style={{ fontWeight: 700, margin: 0, color: "var(--amber)" }}>
                Tempo / Piutang ({customerObj?.name || "Pelanggan"})
              </dd>

              <dt style={{ color: "var(--muted)" }}>Kas Masuk ke Akun</dt>
              <dd style={{ fontWeight: 700, margin: 0, color: "var(--muted)" }}>
                Rp 0 (Piutang Terbentuk)
              </dd>
            </>
          ) : (
            <>
              <dt style={{ color: "var(--muted)" }}>Kas Masuk ke Akun</dt>
              <dd style={{ fontWeight: 700, margin: 0, color: "var(--primary-dark)" }}>
                + {formatRupiah(sell)} ({getAccountName(customerAccountId)})
              </dd>
            </>
          )}

          <div style={{ gridColumn: "1 / -1", borderTop: "1px dashed var(--line)", margin: "0.375rem 0" }} />

          <dt style={{ color: "var(--muted)", fontWeight: 700 }}>Estimasi Profit Konter</dt>
          <dd style={{ fontWeight: 800, margin: 0, color: "var(--primary-dark)", fontSize: "1rem" }}>{formatRupiah(profit)}</dd>
        </dl>
      </div>
    )
  }

  const CategoryIcon = categoryMeta[category].icon

  return (
    <div style={{ maxWidth: "42rem", margin: "0 auto", width: "100%" }}>
      {/* Step Indicator */}
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => {
            setCategory(null)
            setIsReviewing(false)
          }}
          className="badge-online"
          style={{ background: "var(--slate-bg)", color: "var(--slate-fg)", border: "none", cursor: "pointer" }}
        >
          ✓ 1. {categoryMeta[category].title}
        </button>
        <div
          className="badge-online"
          style={{
            background: !isReviewing ? "var(--primary-light)" : "var(--slate-bg)",
            color: !isReviewing ? "var(--primary-dark)" : "var(--slate-fg)",
          }}
        >
          {!isReviewing ? <span className="dot" /> : "✓"} 2. Data Transaksi
        </div>
        <div
          className="badge-online"
          style={{
            background: isReviewing ? "var(--primary-light)" : "var(--slate-bg)",
            color: isReviewing ? "var(--primary-dark)" : "var(--muted)",
          }}
        >
          {isReviewing && <span className="dot" />} 3. Review & Simpan
        </div>
      </div>

      {/* Header bar with Ganti Jenis */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.25rem",
          paddingBottom: "0.75rem",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span className={`icon-box ${categoryMeta[category].colorClass}`} style={{ width: "2.5rem", height: "2.5rem" }}>
            <CategoryIcon size={22} weight="duotone" />
          </span>
          <div>
            <span className="eyebrow">{categoryMeta[category].subtitle}</span>
            <h2 style={{ margin: "0.125rem 0 0", fontSize: "1.25rem", fontWeight: 800 }}>{categoryMeta[category].title}</h2>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setCategory(null)
            setIsReviewing(false)
          }}
          className="btn btn-secondary"
          style={{ minHeight: "2.25rem", padding: "0.375rem 0.75rem", fontSize: "0.8125rem" }}
        >
          <ArrowLeft size={14} weight="bold" /> Ganti Jenis
        </button>
      </div>

      <form
        action={async (formData) => {
          if (isSubmitting) return
          setIsSubmitting(true)
          try {
            await createCounterTransactionAction(formData)
          } catch (e) {
            setIsSubmitting(false)
            throw e
          }
        }}
      >
        <input type="hidden" name="categoryType" value={category} />
        <input type="hidden" name="category" value={category} />

        {/* BANK TRANSFER FORM */}
        {category === "BANK_TRANSFER" && (
          <>
            <input type="hidden" name="sourceAccountId" value={sourceBankId} />
            <input type="hidden" name="customerPaymentAccountId" value={customerPayBankId} />
            <input type="hidden" name="transferAmount" value={transferAmount} />
            <input type="hidden" name="adminFee" value={transferFee} />
            <input type="hidden" name="description" value={transferDesc} />

            {!isReviewing ? (
              <div className="card" style={{ padding: "1.5rem" }}>
                <div className="form-grid-2col">
                  <div className="form-group">
                    <label htmlFor="source-bank-select">Akun Sumber Toko (Saldo Berkurang)</label>
                    <select
                      id="source-bank-select"
                      value={sourceBankId}
                      onChange={(e) => setSourceBankId(e.target.value)}
                      className="form-control"
                      required
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="pay-bank-select">Akun Pembayaran Pelanggan (Uang Masuk)</label>
                    <select
                      id="pay-bank-select"
                      value={customerPayBankId}
                      onChange={(e) => setCustomerPayBankId(e.target.value)}
                      className="form-control"
                      required
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="transfer-amt-input">Nominal Transfer (Rp)</label>
                    <input
                      id="transfer-amt-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      placeholder="Contoh: 500000"
                      className="form-control"
                      required
                    >
                    </input>
                  </div>

                  <div className="form-group">
                    <label htmlFor="transfer-fee-input">Biaya Admin ke Pelanggan (Rp)</label>
                    <input
                      id="transfer-fee-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={transferFee}
                      onChange={(e) => setTransferFee(e.target.value)}
                      placeholder="Contoh: 5000"
                      className="form-control"
                      required
                    />
                  </div>

                  <div className="form-group form-col-full">
                    <label htmlFor="transfer-desc-input">Keterangan Transfer & Rekening Tujuan</label>
                    <input
                      id="transfer-desc-input"
                      type="text"
                      value={transferDesc}
                      onChange={(e) => setTransferDesc(e.target.value)}
                      placeholder="Contoh: Transfer BRI 012345678 an Budi"
                      className="form-control"
                      required
                    />
                  </div>
                </div>

                <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--line)", paddingTop: "1.25rem" }}>
                  <button
                    type="button"
                    onClick={() => setIsReviewing(true)}
                    disabled={!transferAmount || !transferDesc}
                    className="btn btn-primary"
                    style={{ width: "100%" }}
                  >
                    <Eye size={18} weight="bold" /> Review Transaksi <ArrowRight size={16} weight="bold" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="card" style={{ padding: "1.5rem" }}>
                {reviewContent}
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                  <button
                    type="button"
                    onClick={() => setIsReviewing(false)}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                  >
                    <ArrowLeft size={16} weight="bold" /> Ubah Data
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                  >
                    <CheckCircle size={18} weight="bold" /> {isSubmitting ? "Menyimpan..." : "Simpan Transaksi"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* CASH WITHDRAWAL FORM */}
        {category === "CASH_WITHDRAWAL" && (
          <>
            <input type="hidden" name="sourceCashAccountId" value={sourceCashId} />
            <input type="hidden" name="customerSettlementAccountId" value={settlementAccountId} />
            <input type="hidden" name="cashAmount" value={withdrawalAmount} />
            <input type="hidden" name="adminFee" value={withdrawalFee} />
            <input type="hidden" name="description" value={withdrawalDesc} />

            {!isReviewing ? (
              <div className="card" style={{ padding: "1.5rem" }}>
                <div className="form-grid-2col">
                  <div className="form-group">
                    <label htmlFor="source-cash-select">Akun Kas Tunai Toko (Uang Keluar)</label>
                    <select
                      id="source-cash-select"
                      value={sourceCashId}
                      onChange={(e) => setSourceCashId(e.target.value)}
                      className="form-control"
                      required
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="settlement-acc-select">Akun Penerima Transfer / QRIS (Uang Masuk)</label>
                    <select
                      id="settlement-acc-select"
                      value={settlementAccountId}
                      onChange={(e) => setSettlementAccountId(e.target.value)}
                      className="form-control"
                      required
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="withdrawal-amt-input">Nominal Tarik Tunai (Rp)</label>
                    <input
                      id="withdrawal-amt-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={withdrawalAmount}
                      onChange={(e) => setWithdrawalAmount(e.target.value)}
                      placeholder="Contoh: 200000"
                      className="form-control"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="withdrawal-fee-input">Biaya Admin (Rp)</label>
                    <input
                      id="withdrawal-fee-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={withdrawalFee}
                      onChange={(e) => setWithdrawalFee(e.target.value)}
                      placeholder="Contoh: 5000"
                      className="form-control"
                      required
                    />
                  </div>

                  <div className="form-group form-col-full">
                    <label htmlFor="withdrawal-desc-input">Keterangan Tarik Tunai</label>
                    <input
                      id="withdrawal-desc-input"
                      type="text"
                      value={withdrawalDesc}
                      onChange={(e) => setWithdrawalDesc(e.target.value)}
                      placeholder="Contoh: Tarik tunai kartu debit BRI"
                      className="form-control"
                      required
                    />
                  </div>
                </div>

                <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--line)", paddingTop: "1.25rem" }}>
                  <button
                    type="button"
                    onClick={() => setIsReviewing(true)}
                    disabled={!withdrawalAmount || !withdrawalDesc}
                    className="btn btn-primary"
                    style={{ width: "100%" }}
                  >
                    <Eye size={18} weight="bold" /> Review Transaksi <ArrowRight size={16} weight="bold" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="card" style={{ padding: "1.5rem" }}>
                {reviewContent}
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                  <button
                    type="button"
                    onClick={() => setIsReviewing(false)}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                  >
                    <ArrowLeft size={16} weight="bold" /> Ubah Data
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                  >
                    <CheckCircle size={18} weight="bold" /> {isSubmitting ? "Menyimpan..." : "Simpan Transaksi"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* EWALLET TOPUP FORM */}
        {category === "EWALLET_TOPUP" && (
          <>
            <input type="hidden" name="shopSourceAccountId" value={walletSourceId} />
            <input type="hidden" name="customerPaymentAccountId" value={walletCustomerPayId} />
            <input type="hidden" name="topupAmount" value={topupAmount} />
            <input type="hidden" name="adminFee" value={topupFee} />
            <input type="hidden" name="description" value={topupDesc} />

            {!isReviewing ? (
              <div className="card" style={{ padding: "1.5rem" }}>
                <div className="form-grid-2col">
                  <div className="form-group">
                    <label htmlFor="wallet-source-select">Sumber Saldo Toko (Saldo Berkurang)</label>
                    <select
                      id="wallet-source-select"
                      value={walletSourceId}
                      onChange={(e) => setWalletSourceId(e.target.value)}
                      className="form-control"
                      required
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="wallet-pay-select">Akun Pembayaran Pelanggan (Uang Masuk)</label>
                    <select
                      id="wallet-pay-select"
                      value={walletCustomerPayId}
                      onChange={(e) => setWalletCustomerPayId(e.target.value)}
                      className="form-control"
                      required
                    >
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} ({a.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="topup-amt-input">Nominal Top Up (Rp)</label>
                    <input
                      id="topup-amt-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={topupAmount}
                      onChange={(e) => setTopupAmount(e.target.value)}
                      placeholder="Contoh: 100000"
                      className="form-control"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="topup-fee-input">Biaya Admin (Rp)</label>
                    <input
                      id="topup-fee-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={topupFee}
                      onChange={(e) => setTopupFee(e.target.value)}
                      placeholder="Contoh: 2000"
                      className="form-control"
                      required
                    />
                  </div>

                  <div className="form-group form-col-full">
                    <label htmlFor="topup-desc-input">Keterangan & Nomor Tujuan E-Wallet</label>
                    <input
                      id="topup-desc-input"
                      type="text"
                      value={topupDesc}
                      onChange={(e) => setTopupDesc(e.target.value)}
                      placeholder="Contoh: Top Up DANA 08123456789"
                      className="form-control"
                      required
                    />
                  </div>
                </div>

                <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--line)", paddingTop: "1.25rem" }}>
                  <button
                    type="button"
                    onClick={() => setIsReviewing(true)}
                    disabled={!topupAmount || !topupDesc}
                    className="btn btn-primary"
                    style={{ width: "100%" }}
                  >
                    <Eye size={18} weight="bold" /> Review Transaksi <ArrowRight size={16} weight="bold" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="card" style={{ padding: "1.5rem" }}>
                {reviewContent}
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                  <button
                    type="button"
                    onClick={() => setIsReviewing(false)}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                  >
                    <ArrowLeft size={16} weight="bold" /> Ubah Data
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                  >
                    <CheckCircle size={18} weight="bold" /> {isSubmitting ? "Menyimpan..." : "Simpan Transaksi"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* PRODUCT-LIKE FORMS (Pulsa, Paket Data, Token PLN, PPOB, Penjualan, Lainnya) */}
        {category !== "BANK_TRANSFER" && category !== "CASH_WITHDRAWAL" && category !== "EWALLET_TOPUP" && (
          <>
            {isDigitalCategory && <input type="hidden" name="costAccountId" value={sourceStoreAccountId} />}
            {!isCredit && <input type="hidden" name="customerAccountId" value={customerAccountId} />}
            <input type="hidden" name="costAmount" value={costAmount} />
            <input type="hidden" name="sellingPrice" value={sellingPrice} />
            <input type="hidden" name="description" value={productDesc} />
            <input type="hidden" name="isCredit" value={isCredit ? "true" : "false"} />
            {isCredit && <input type="hidden" name="customerId" value={customerId} />}
            {isCredit && dueDate && <input type="hidden" name="dueDate" value={dueDate} />}
            {category === "PRODUCT_SALE" && selectedProductId && (
              <input type="hidden" name="productId" value={selectedProductId} />
            )}
            {category === "PRODUCT_SALE" && selectedProductId && (
              <input type="hidden" name="quantity" value={productQuantity} />
            )}

            {!isReviewing ? (
              <div className="card" style={{ padding: "1.5rem" }}>
                <div className="form-grid-2col">
                  {category === "PRODUCT_SALE" && products.length > 0 && (
                    <>
                      <div className="form-group form-col-full">
                        <label htmlFor="product-catalog-select">Pilih Barang dari Inventaris (Opsional)</label>
                        <select
                          id="product-catalog-select"
                          value={selectedProductId}
                          onChange={(e) => {
                            const pId = e.target.value
                            setSelectedProductId(pId)
                            if (pId) {
                              const p = products.find((prod) => prod.id === pId)
                              if (p) {
                                const q = productQuantity > 0 ? productQuantity : 1
                                setCostAmount((BigInt(p.averageCost) * BigInt(q)).toString())
                                setSellingPrice((BigInt(p.sellingPrice) * BigInt(q)).toString())
                                setProductDesc(`${p.name} x${q}`)
                              }
                            }
                          }}
                          className="form-control"
                        >
                          <option value="">Input Manual (Bukan Stok Terdaftar)</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} {p.sku ? `[${p.sku}]` : ""} — Stok: {p.stockQuantity} {p.unit}
                            </option>
                          ))}
                        </select>
                      </div>

                      {selectedProductId && (
                        <div className="form-group form-col-full">
                          <label htmlFor="product-qty-input">Jumlah Unit Terjual</label>
                          <input
                            id="product-qty-input"
                            type="number"
                            min="1"
                            step="1"
                            value={productQuantity}
                            onChange={(e) => {
                              const q = parseInt(e.target.value, 10) || 1
                              setProductQuantity(q)
                              const p = products.find((prod) => prod.id === selectedProductId)
                              if (p) {
                                setCostAmount((BigInt(p.averageCost) * BigInt(q)).toString())
                                setSellingPrice((BigInt(p.sellingPrice) * BigInt(q)).toString())
                                setProductDesc(`${p.name} x${q}`)
                              }
                            }}
                            className="form-control"
                          />
                        </div>
                      )}
                    </>
                  )}

                  {isDigitalCategory && (
                    <div
                      className="form-group form-col-full"
                      style={{
                        padding: "0.75rem",
                        background: isCredit ? "var(--amber-bg)" : "var(--paper)",
                        borderRadius: "6px",
                        border: "1px solid var(--line)",
                      }}
                    >
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          cursor: "pointer",
                          fontWeight: 600,
                          fontSize: "0.875rem",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isCredit}
                          onChange={(e) => {
                            const checked = e.target.checked
                            setIsCredit(checked)
                            if (checked && customers.length > 0 && !customerId) {
                              setCustomerId(customers[0]!.id)
                            }
                          }}
                          style={{ width: "1.125rem", height: "1.125rem" }}
                        />
                        <span>Transaksi Tempo / Kredit (Catat Piutang Pelanggan)</span>
                      </label>
                    </div>
                  )}

                  {isCredit ? (
                    <>
                      <div className="form-group form-col-full">
                        <label htmlFor="customer-select">
                          Pilih Pelanggan <span style={{ color: "var(--rose)" }}>*</span>
                        </label>
                        {customers.length === 0 ? (
                          <div style={{ fontSize: "0.8125rem", color: "var(--rose)" }}>
                            Belum ada pelanggan terdaftar. Daftarkan pelanggan terlebih dahulu di menu Hutang & Piutang.
                          </div>
                        ) : (
                          <select
                            id="customer-select"
                            value={customerId}
                            onChange={(e) => setCustomerId(e.target.value)}
                            className="form-control"
                            required
                          >
                            {customers.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} {c.phone ? `(${c.phone})` : ""}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      <div className="form-group form-col-full">
                        <label htmlFor="due-date-input">Tanggal Jatuh Tempo (Opsional)</label>
                        <input
                          id="due-date-input"
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="form-control"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="form-group form-col-full">
                      <label htmlFor="customer-acc-select">Akun Pembayaran Pelanggan (Uang Masuk)</label>
                      <select
                        id="customer-acc-select"
                        value={customerAccountId}
                        onChange={(e) => setCustomerAccountId(e.target.value)}
                        className="form-control"
                        required
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.type})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {isDigitalCategory && (
                    <div className="form-group form-col-full">
                      <label htmlFor="source-store-acc-select">Akun Sumber Toko (Saldo Berkurang)</label>
                      <select
                        id="source-store-acc-select"
                        value={sourceStoreAccountId}
                        onChange={(e) => setSourceStoreAccountId(e.target.value)}
                        className="form-control"
                        required
                      >
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.type})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="form-group">
                    <label htmlFor="cost-amt-input">Modal / Biaya Kulakan (Rp, opsional)</label>
                    <input
                      id="cost-amt-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={costAmount}
                      onChange={(e) => setCostAmount(e.target.value)}
                      placeholder="Contoh: 48500 (kosongkan jika 0)"
                      className="form-control"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="sell-price-input">Harga Jual ke Pelanggan (Rp)</label>
                    <input
                      id="sell-price-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={sellingPrice}
                      onChange={(e) => setSellingPrice(e.target.value)}
                      placeholder="Contoh: 52000"
                      className="form-control"
                      required
                    />
                  </div>

                  <div className="form-group form-col-full">
                    <label htmlFor="product-desc-input">Keterangan / Detail Pesanan</label>
                    <input
                      id="product-desc-input"
                      type="text"
                      value={productDesc}
                      onChange={(e) => setProductDesc(e.target.value)}
                      placeholder="Contoh: Pulsa Telkomsel 50k - 08123456789"
                      className="form-control"
                      required
                    />
                  </div>
                </div>

                <div style={{ marginTop: "1.5rem", borderTop: "1px solid var(--line)", paddingTop: "1.25rem" }}>
                  <button
                    type="button"
                    onClick={() => setIsReviewing(true)}
                    disabled={!sellingPrice || !productDesc}
                    className="btn btn-primary"
                    style={{ width: "100%" }}
                  >
                    <Eye size={18} weight="bold" /> Review Transaksi <ArrowRight size={16} weight="bold" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="card" style={{ padding: "1.5rem" }}>
                {reviewContent}
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.5rem" }}>
                  <button
                    type="button"
                    onClick={() => setIsReviewing(false)}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                  >
                    <ArrowLeft size={16} weight="bold" /> Ubah Data
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                  >
                    <CheckCircle size={18} weight="bold" /> {isSubmitting ? "Menyimpan..." : "Simpan Transaksi"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </form>
    </div>
  )
}
