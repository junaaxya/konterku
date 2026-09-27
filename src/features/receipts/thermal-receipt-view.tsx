import type { ReceiptData } from "./receipt-domain"

type ThermalReceiptViewProps = {
  readonly receipt: ReceiptData
}

export function ThermalReceiptView({ receipt }: ThermalReceiptViewProps) {
  return (
    <div className="receipt-container">
      {receipt.isCancelled && (
        <div className="cancelled-watermark">[ TRANSAKSI DIBATALKAN ]</div>
      )}

      <div className="receipt-header">
        <h1 className="receipt-title">{receipt.storeName}</h1>
        <p className="receipt-subtitle">{receipt.storeSubtitle}</p>
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.6875rem" }}>
          {receipt.networkNotice}
        </p>
      </div>

      <div className="receipt-row">
        <span>No. Transaksi:</span>
        <strong>{receipt.transactionNumber}</strong>
      </div>
      <div className="receipt-row">
        <span>Waktu:</span>
        <span>{receipt.formattedDate}</span>
      </div>
      <div className="receipt-row">
        <span>Status:</span>
        <strong>{receipt.statusText}</strong>
      </div>

      <div className="receipt-divider" />

      <div className="receipt-row">
        <span>Layanan / Item:</span>
        <strong>{receipt.category}</strong>
      </div>
      <div
        style={{
          margin: "0.25rem 0",
          fontSize: "0.75rem",
          wordBreak: "break-word",
        }}
      >
        {receipt.description}
      </div>

      <div className="receipt-divider" />

      <div className="receipt-row">
        <span>Nominal Transaksi:</span>
        <strong>{receipt.grossAmount}</strong>
      </div>

      {receipt.feeAmount && (
        <div className="receipt-row">
          <span>Biaya Admin:</span>
          <span>{receipt.feeAmount}</span>
        </div>
      )}

      <div className="receipt-divider" />

      <div className="receipt-row" style={{ fontSize: "0.9375rem" }}>
        <strong>TOTAL DIBAYAR:</strong>
        <strong>{receipt.totalPaid}</strong>
      </div>

      {receipt.paymentAccounts.length > 0 && (
        <div
          style={{
            marginTop: "0.5rem",
            fontSize: "0.6875rem",
            color: "#333333",
          }}
        >
          <div>Akun Pembayaran:</div>
          {receipt.paymentAccounts.map((account, index) => (
            <div
              key={`${account.accountName}-${index}`}
              style={{ display: "flex", justifyContent: "space-between" }}
            >
              <span>- {account.accountName}</span>
              <span>{account.amount}</span>
            </div>
          ))}
        </div>
      )}

      {receipt.isCancelled && receipt.cancelReason && (
        <div
          style={{
            marginTop: "0.75rem",
            padding: "0.375rem",
            background: "#fef2f2",
            fontSize: "0.6875rem",
            color: "#dc2626",
          }}
        >
          Alasan Batal: {receipt.cancelReason}
        </div>
      )}

      <div className="receipt-footer">
        <p style={{ margin: 0, fontWeight: 700 }}>{receipt.footerThankYou}</p>
        <p style={{ margin: "0.25rem 0 0", fontSize: "0.6875rem" }}>
          {receipt.footerNotice}
        </p>
      </div>
    </div>
  )
}
