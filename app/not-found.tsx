import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main-content" className="empty-state container">
      <span className="section-kicker">404 / Not found</span>
      <h1>This link leads nowhere.</h1>
      <p>Check the full URL, or start with a new payment request.</p>
      <Link href="/create" className="button primary">
        Create a Payment Link
      </Link>
    </main>
  );
}
