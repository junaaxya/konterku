const navigationItems = [
  "Dashboard",
  "Transaksi",
  "Riwayat",
  "Laporan",
  "Pengaturan",
] as const;

export default function HomePage() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand" aria-label="KONTERKU">
          <span className="brand-mark" aria-hidden="true">
            K
          </span>
          <div>
            <p className="brand-name">KONTERKU</p>
            <p className="brand-subtitle">Ruang kerja konter</p>
          </div>
        </div>
        <span className="local-status">
          <span className="status-dot" aria-hidden="true" />
          Siap lokal
        </span>
      </header>

      <main className="page-content">
        <section className="welcome-card" aria-labelledby="page-title">
          <p className="eyebrow">FASE 0 · FONDASI</p>
          <h1 id="page-title">KONTERKU siap<br />dibangun.</h1>
          <p className="welcome-copy">
            Ruang kerja lokal untuk operasional konter yang rapi dan sederhana.
            Fitur akan ditambahkan bertahap pada fase berikutnya.
          </p>
          <div className="readiness-note" role="status">
            <span className="note-mark" aria-hidden="true">✦</span>
            <div>
              <strong>Fondasi siap digunakan</strong>
              <span>Belum ada data untuk ditampilkan.</span>
            </div>
          </div>
        </section>

        <section className="navigation-section" aria-labelledby="navigation-title">
          <div className="section-heading">
            <p className="section-label">RUANG KERJA</p>
            <h2 id="navigation-title">Menu utama</h2>
          </div>
          <p className="section-description">
            Menu akan aktif saat fitur tersedia.
          </p>
          <nav aria-label="Menu utama">
            <ul className="navigation-list">
              {navigationItems.map((item) => (
                <li key={item}>
                  <button className="navigation-item" type="button" disabled>
                    <span>{item}</span>
                    <span className="navigation-state">Segera</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </section>
      </main>

      <footer className="site-footer">
        <span>Private · Jaringan lokal</span>
        <span aria-hidden="true">/</span>
        <span>v0.1 · Fondasi</span>
      </footer>
    </div>
  );
}
