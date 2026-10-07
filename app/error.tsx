"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" className="empty-state container">
      <h1>Something didn’t load.</h1>
      <p>
        Please try again. If you already signed a payment, check your wallet
        before sending another.
      </p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
