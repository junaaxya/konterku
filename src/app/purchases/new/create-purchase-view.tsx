"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Plus,
  Trash,
  WarningCircle,
  Truck,
  HandCoins,
  Wallet,
} from "@phosphor-icons/react"

import { formatRupiah } from "@/lib/money"
import { createPurchaseAction } from "../actions"

type SupplierOption = {
  readonly id: string
  readonly name: string
}

type ProductOption = {
  readonly id: string
  readonly name: string
  readonly sku: string | null
  readonly unit: string
  readonly stockQuantity: number
  readonly averageCost: string
}

type AccountOption = {
  readonly id: string
  readonly name: string
  readonly type: string
}

type Props = {
  readonly suppliers: readonly SupplierOption[]
  readonly products: readonly ProductOption[]
  readonly accounts: readonly AccountOption[]
  readonly initialSupplierId?: string | undefined
}

type LineItem = {
  id: string
  productId: string
  quantity: number
  unitCost: string
}

export function CreatePurchaseView({
  suppliers,
  products,
  accounts,
  initialSupplierId,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [supplierId, setSupplierId] = useState(
    initialSupplierId || suppliers[0]?.id || "",
  )
  const [isCredit, setIsCredit] = useState(false)
  const [accountId, setAccountId] = useState(accounts[0]?.id || "")
  const [dueDate, setDueDate] = useState("")
  const [notes, setNotes] = useState("")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [items, setItems] = useState<LineItem[]>([
    {
      id: "line-1",
      productId: products[0]?.id || "",
      quantity: 1,
      unitCost: products[0]?.averageCost || "0",
    },
  ])

  const handleProductChange = (lineId: string, newProductId: string) => {
    const selectedProd = products.find((p) => p.id === newProductId)
    setItems((prev) =>
      prev.map((item) =>
        item.id === lineId
          ? {
              ...item,
              productId: newProductId,
              unitCost: selectedProd?.averageCost || item.unitCost,
            }
          : item,
      ),
    )
  }

  const handleQtyChange = (lineId: string, qty: number) => {
    setItems((prev) =>
      prev.map((item) => (item.id === lineId ? { ...item, quantity: qty } : item)),
    )
  }

  const handleCostChange = (lineId: string, cost: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === lineId ? { ...item, unitCost: cost } : item)),
    )
  }

  const handleAddLine = () => {
    const nextId = `line-${Date.now()}`
    setItems((prev) => [
      ...prev,
      {
        id: nextId,
        productId: products[0]?.id || "",
        quantity: 1,
        unitCost: products[0]?.averageCost || "0",
      },
    ])
  }

  const handleRemoveLine = (lineId: string) => {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((i) => i.id !== lineId))
  }

  const calculatedTotal = items.reduce((acc, item) => {
    const cost = BigInt(item.unitCost || "0")
    return acc + cost * BigInt(item.quantity)
  }, 0n)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!supplierId) {
      setErrorMsg("Pilih supplier terlebih dahulu.")
      return
    }

    if (!isCredit && !accountId) {
      setErrorMsg("Pilih akun pembayaran untuk pembelian tunai.")
      return
    }

    if (items.some((i) => !i.productId || i.quantity <= 0)) {
      setErrorMsg("Setiap baris produk harus memilih barang dan jumlah > 0.")
      return
    }

    startTransition(async () => {
      const res = await createPurchaseAction({
        supplierId,
        isCredit,
        accountId: !isCredit ? accountId : undefined,
        dueDate: isCredit && dueDate ? dueDate : undefined,
        notes: notes || undefined,
        items: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitCost: i.unitCost || "0",
        })),
      })

      if (res.success) {
        router.push(`/purchases/${res.data.id}`)
      } else {
        setErrorMsg(res.error)
      }
    })
  }

  if (suppliers.length === 0) {
    return (
      <div style={{ maxWidth: "32rem", margin: "2rem auto", textAlign: "center" }} className="card">
        <Truck size={48} weight="thin" style={{ margin: "0 auto 0.75rem", display: "block", color: "var(--muted)" }} />
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 0.5rem" }}>Belum Ada Supplier Terdaftar</h2>
        <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: "0 0 1.25rem" }}>
          Sebelum mencatat faktur pembelian, daftarkan minimal 1 distributor / vendor.
        </p>
        <Link href="/suppliers" className="btn btn-primary" style={{ minHeight: "44px" }}>
          Tambah Supplier Sekarang
        </Link>
      </div>
    )
  }

  if (products.length === 0) {
    return (
      <div style={{ maxWidth: "32rem", margin: "2rem auto", textAlign: "center" }} className="card">
        <WarningCircle size={48} weight="thin" style={{ margin: "0 auto 0.75rem", display: "block", color: "var(--amber)" }} />
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: "0 0 0.5rem" }}>Katalog Produk Masih Kosong</h2>
        <p style={{ fontSize: "0.875rem", color: "var(--muted)", margin: "0 0 1.25rem" }}>
          Daftarkan barang dagangan terlebih dahulu di halaman Inventaris agar dapat dipilih dalam faktur pembelian.
        </p>
        <Link href="/inventory" className="btn btn-primary" style={{ minHeight: "44px" }}>
          Buka Inventaris Produk
        </Link>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Link
          href="/purchases"
          className="btn btn-secondary"
          style={{ minHeight: "44px", minWidth: "44px", padding: "0.5rem", display: "grid", placeItems: "center" }}
        >
          <ArrowLeft size={18} />
        </Link>
        <div>
          <p className="eyebrow" style={{ margin: 0 }}>FAKTUR PEMBELIAN</p>
          <h1 className="page-title" style={{ margin: 0 }}>Catat Pembelian Supplier</h1>
        </div>
      </div>

      {errorMsg && (
        <div style={{ background: "var(--rose-bg)", color: "var(--rose)", padding: "0.75rem 1rem", borderRadius: "8px", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <WarningCircle size={20} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
        <div className="card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>1. Data Supplier & Pembayaran</h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
            <div>
              <label className="label" htmlFor="supplier-select">
                Pilih Supplier <span style={{ color: "var(--rose)" }}>*</span>
              </label>
              <select
                id="supplier-select"
                className="input-field"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                style={{ minHeight: "44px" }}
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Metode Pembayaran <span style={{ color: "var(--rose)" }}>*</span></label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <button
                  type="button"
                  className={`btn ${!isCredit ? "btn-primary" : "btn-secondary"}`}
                  style={{ minHeight: "44px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
                  onClick={() => setIsCredit(false)}
                >
                  <Wallet size={18} />
                  <span>Tunai (Cash)</span>
                </button>
                <button
                  type="button"
                  className={`btn ${isCredit ? "btn-primary" : "btn-secondary"}`}
                  style={{ minHeight: "44px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
                  onClick={() => setIsCredit(true)}
                >
                  <HandCoins size={18} />
                  <span>Tempo (Hutang)</span>
                </button>
              </div>
            </div>
          </div>

          {!isCredit ? (
            <div>
              <label className="label" htmlFor="account-select">
                Bayar Menggunakan Akun Kas / Bank <span style={{ color: "var(--rose)" }}>*</span>
              </label>
              <select
                id="account-select"
                className="input-field"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                style={{ minHeight: "44px" }}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.type})
                  </option>
                ))}
              </select>
              <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem", display: "block" }}>
                Saldo akun terpilih akan berkurang otomatis sesuai total faktur pembelian.
              </span>
            </div>
          ) : (
            <div style={{ background: "var(--amber-bg)", padding: "1rem", borderRadius: "6px", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--amber)" }}>
                <HandCoins size={20} />
                <strong style={{ fontSize: "0.875rem" }}>Faktur Pembelian Tempo (Hutang Usaha)</strong>
              </div>
              <p style={{ fontSize: "0.8125rem", color: "var(--ink)", margin: 0 }}>
                Pembelian ini akan menambah stok barang dagangan dan secara otomatis membentuk kewajiban Hutang Usaha ({formatRupiah(calculatedTotal)}) kepada supplier terkait tanpa mengurangi saldo kas saat ini.
              </p>
              <div>
                <label className="label" htmlFor="due-date-input">Tanggal Jatuh Tempo (Opsional)</label>
                <input
                  id="due-date-input"
                  type="date"
                  className="input-field"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  style={{ minHeight: "44px", background: "white" }}
                />
              </div>
            </div>
          )}

          <div>
            <label className="label" htmlFor="purchase-notes">Catatan Pembelian (Opsional)</label>
            <input
              id="purchase-notes"
              type="text"
              placeholder="Contoh: No faktur cetak supplier #INV-2026/09"
              className="input-field"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{ minHeight: "44px" }}
            />
          </div>
        </div>

        <div className="card" style={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, margin: 0 }}>2. Rincian Barang Pembelian ({items.length} Baris)</h2>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ minHeight: "44px", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
              onClick={handleAddLine}
            >
              <Plus size={16} weight="bold" />
              <span>Tambah Baris</span>
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {items.map((item, idx) => {
              const selectedProduct = products.find((p) => p.id === item.productId)
              const lineCost = BigInt(item.unitCost || "0")
              const lineSubtotal = lineCost * BigInt(item.quantity)

              return (
                <div
                  key={item.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr 1.5fr auto",
                    gap: "0.5rem",
                    alignItems: "end",
                    padding: "0.75rem",
                    border: "1px solid var(--line)",
                    borderRadius: "6px",
                  }}
                >
                  <div>
                    <label className="label" style={{ fontSize: "0.75rem" }}>Produk #{idx + 1}</label>
                    <select
                      className="input-field"
                      value={item.productId}
                      onChange={(e) => handleProductChange(item.id, e.target.value)}
                      style={{ minHeight: "44px" }}
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.sku ? `(${p.sku})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label" style={{ fontSize: "0.75rem" }}>
                      Jumlah ({selectedProduct?.unit || "pcs"})
                    </label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      className="input-field"
                      value={item.quantity}
                      onChange={(e) => handleQtyChange(item.id, parseInt(e.target.value, 10) || 1)}
                      style={{ minHeight: "44px" }}
                    />
                  </div>

                  <div>
                    <label className="label" style={{ fontSize: "0.75rem" }}>Biaya Modal / Unit (Rp)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      className="input-field"
                      value={item.unitCost}
                      onChange={(e) => handleCostChange(item.id, e.target.value)}
                      style={{ minHeight: "44px" }}
                    />
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.25rem", display: "block" }}>
                      Subtotal: {formatRupiah(lineSubtotal)}
                    </span>
                  </div>

                  <div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{
                        minHeight: "44px",
                        minWidth: "44px",
                        padding: "0.5rem",
                        display: "grid",
                        placeItems: "center",
                        color: items.length > 1 ? "var(--rose)" : "var(--muted)",
                      }}
                      onClick={() => handleRemoveLine(item.id)}
                      disabled={items.length <= 1}
                      aria-label="Hapus baris"
                    >
                      <Trash size={18} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "0.5rem",
              padding: "1rem",
              background: "var(--paper)",
              borderRadius: "6px",
              border: "1px solid var(--line)",
            }}
          >
            <div>
              <span style={{ fontSize: "0.8125rem", color: "var(--muted)", display: "block" }}>Total Nilai Pembelian</span>
              <span style={{ fontSize: "0.75rem", color: isCredit ? "var(--amber)" : "var(--primary-dark)", fontWeight: 600 }}>
                {isCredit ? "Kewajiban Hutang Usaha Baru" : "Akan dipotong dari akun kas"}
              </span>
            </div>
            <strong style={{ fontSize: "1.5rem", color: "var(--ink)" }}>
              {formatRupiah(calculatedTotal)}
            </strong>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
          <Link
            href="/purchases"
            className="btn btn-secondary"
            style={{ minHeight: "44px", display: "inline-flex", alignItems: "center" }}
          >
            Batal
          </Link>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ minHeight: "44px", minWidth: "160px" }}
            disabled={isPending || calculatedTotal <= 0n}
          >
            {isPending ? "Memproses Faktur..." : "Simpan Faktur Pembelian"}
          </button>
        </div>
      </form>
    </div>
  )
}
