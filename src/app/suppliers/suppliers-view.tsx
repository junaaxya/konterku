"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Truck,
  Plus,
  MagnifyingGlass,
  X,
  WarningCircle,
  ArrowRight,
  Phone,
  Notebook,
} from "@phosphor-icons/react"

import { createSupplierAction } from "./actions"

export type SerializedSupplier = {
  readonly id: string
  readonly name: string
  readonly phone: string | null
  readonly notes: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

type Props = {
  readonly suppliers: readonly SerializedSupplier[]
}

export function SuppliersView({ suppliers }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [formError, setFormError] = useState<string | null>(null)

  const filtered = suppliers.filter((s) => {
    const q = searchQuery.toLowerCase()
    return (
      s.name.toLowerCase().includes(q) ||
      (s.phone && s.phone.toLowerCase().includes(q)) ||
      (s.notes && s.notes.toLowerCase().includes(q))
    )
  })

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError(null)
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      const res = await createSupplierAction(formData)
      if (res.success) {
        setShowAddModal(false)
        router.refresh()
      } else {
        setFormError(res.error)
      }
    })
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
        <div>
          <p className="eyebrow">DISTRIBUTOR & VENDOR</p>
          <h1 className="page-title">Daftar Supplier</h1>
          <p className="page-desc">Kelola data mitra distributor dan pemasok barang dagangan konter.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link
            href="/purchases"
            className="btn btn-secondary"
            style={{ minHeight: "44px", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
          >
            <Truck size={18} />
            <span>Lihat Pembelian</span>
          </Link>
          <button
            type="button"
            className="btn btn-primary"
            style={{ minHeight: "44px", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
            onClick={() => {
              setFormError(null)
              setShowAddModal(true)
            }}
          >
            <Plus size={18} weight="bold" />
            <span>Tambah Supplier</span>
          </button>
        </div>
      </div>

      <div style={{ position: "relative" }}>
        <MagnifyingGlass
          size={18}
          style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}
        />
        <input
          type="text"
          placeholder="Cari nama supplier atau nomor telepon..."
          className="input-field"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ paddingLeft: "2.25rem", minHeight: "44px" }}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--muted)" }}>
          <Truck size={48} weight="thin" style={{ margin: "0 auto 0.75rem", display: "block" }} />
          <strong style={{ display: "block", color: "var(--ink)", marginBottom: "0.25rem" }}>
            {searchQuery ? "Supplier tidak ditemukan" : "Belum ada supplier"}
          </strong>
          <p style={{ fontSize: "0.875rem", margin: 0 }}>
            {searchQuery ? "Coba gunakan kata kunci pencarian lain." : "Klik tombol 'Tambah Supplier' untuk mendaftarkan distributor baru."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {filtered.map((s) => (
            <Link
              key={s.id}
              href={`/suppliers/${s.id}`}
              className="card"
              style={{
                padding: "1rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
                textDecoration: "none",
                color: "inherit",
                minHeight: "44px",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                <strong style={{ fontSize: "1rem", color: "var(--ink)" }}>{s.name}</strong>
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.8125rem", color: "var(--muted)" }}>
                  {s.phone && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                      <Phone size={14} />
                      {s.phone}
                    </span>
                  )}
                  {s.notes && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                      <Notebook size={14} />
                      {s.notes}
                    </span>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.8125rem", color: "var(--primary-dark)", fontWeight: 600 }}>Lihat Riwayat</span>
                <ArrowRight size={18} color="var(--muted)" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {showAddModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "grid",
            placeItems: "center",
            padding: "1rem",
            zIndex: 100,
          }}
        >
          <div className="card" style={{ width: "100%", maxWidth: "28rem", padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Tambah Supplier Baru</h2>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: "0.25rem", minHeight: "44px", minWidth: "44px", display: "grid", placeItems: "center" }}
                onClick={() => setShowAddModal(false)}
                disabled={isPending}
              >
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div style={{ background: "var(--rose-bg)", color: "var(--rose)", padding: "0.75rem", borderRadius: "6px", marginBottom: "1rem", fontSize: "0.875rem", display: "flex", gap: "0.5rem" }}>
                <WarningCircle size={18} style={{ flexShrink: 0 }} />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label className="label" htmlFor="supplier-name">
                  Nama Supplier / Perusahaan <span style={{ color: "var(--rose)" }}>*</span>
                </label>
                <input
                  id="supplier-name"
                  name="name"
                  type="text"
                  required
                  placeholder="Contoh: CV Sumber Pulsa Mandiri"
                  className="input-field"
                  style={{ minHeight: "44px" }}
                />
              </div>

              <div>
                <label className="label" htmlFor="supplier-phone">Nomor Telepon / WhatsApp</label>
                <input
                  id="supplier-phone"
                  name="phone"
                  type="tel"
                  placeholder="Contoh: 08123456789"
                  className="input-field"
                  style={{ minHeight: "44px" }}
                />
              </div>

              <div>
                <label className="label" htmlFor="supplier-notes">Catatan / Keterangan</label>
                <textarea
                  id="supplier-notes"
                  name="notes"
                  rows={3}
                  placeholder="Alamat distributor, kontak sales, dll."
                  className="input-field"
                  style={{ resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ minHeight: "44px" }}
                  onClick={() => setShowAddModal(false)}
                  disabled={isPending}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ minHeight: "44px" }}
                  disabled={isPending}
                >
                  {isPending ? "Menyimpan..." : "Simpan Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
