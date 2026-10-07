export default function Layout({ children, footer }) {
  return (
    <div className="page">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">₱</span>
          <span>
            <strong>Fare Checker</strong>
            <small>Panabo City</small>
          </span>
        </div>
      </header>
      <main className="wrap">{children}</main>
      {footer && <footer className="footer">{footer}</footer>}
    </div>
  )
}
