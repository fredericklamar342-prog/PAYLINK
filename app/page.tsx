import Link from "next/link";
import { PaymentDemo } from "@/components/payment/payment-demo";
import { Icon } from "@/components/ui/icon";
export default function Home() {
  return (
    <main id="main-content" className="home-page">
      <section className="hero container">
        <div className="hero-copy">
          <div className="intro-label">
            <span className="network-glyph" />
            Payment requests on Monad Testnet
          </div>
          <h1>
            Request a payment.
            <br />
            Share a link.
          </h1>
          <p className="hero-description">
            For freelancers and anyone splitting a bill: put the amount, purpose,
            and wallet address in one link. Your payer reviews it before paying.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/create">
              Create a Payment Link <Icon name="arrow" />
            </Link>
            <a className="text-link" href="#how-it-works">
              See how it works <Icon name="arrow" size={16} />
            </a>
          </div>
          <div className="hero-notes">
            <span>
              <Icon name="check" size={15} />
              No account needed
            </span>
            <span>
              <Icon name="check" size={15} />
              Funds go straight to you
            </span>
          </div>
          <p className="hero-testnet-note">
            Testnet requests only. Payment collection is not enabled for new links.
          </p>
        </div>
        <PaymentDemo />
      </section>
      <div className="value-strip container">
        <p>
          From your request<br /><strong>to their wallet.</strong>
        </p>
        <span><Icon name="link" /> Share a link or QR code</span>
        <span><Icon name="wallet" /> Paid directly to your wallet</span>
        <span><Icon name="shield" /> Receipt checked onchain</span>
      </div>
      <section className="how-section container" id="how-it-works">
        <div className="section-heading">
          <div>
            <span className="section-kicker">From request to receipt</span>
            <h2>Create. Share. Get paid.</h2>
          </div>
          <p>
            A payment request your payer can review,
            from the first detail to the final receipt.
          </p>
        </div>
        <div className="steps">
          {[
            [
              "01",
              "Create",
              "Set the amount and payment details.",
              "Add the recipient wallet, purpose, and an optional expiry.",
            ],
            [
              "02",
              "Share",
              "Send your payment link or QR code.",
              "In a message, an email, or across the table.",
            ],
            [
              "03",
              "Get paid",
              "The payer reviews the details, connects a wallet, and confirms.",
              "The transaction is checked onchain before a receipt is shown.",
            ],
          ].map(([n, title, text, detail]) => (
            <article key={n}>
              <span className="step-number">{n}</span>
              <h3>{title}</h3>
              <p>{text}</p>
              <p className="small muted">{detail}</p>
            </article>
          ))}
        </div>
      </section>
      <section id="security" className="security-section container">
        <div className="security-copy">
          <span className="security-icon">
            <Icon name="shield" size={27} />
          </span>
          <h2>
            Know exactly
            <br />
            what you’re signing.
          </h2>
          <p>
            Clear details before you approve. A verifiable receipt after you
            pay. Your money goes directly from your wallet to theirs.
          </p>
          <ul className="trust-list">
            <li>
              <Icon name="check" size={17} />
              No custody of your funds
            </li>
            <li>
              <Icon name="check" size={17} />
              Every payment needs your approval
            </li>
            <li>
              <Icon name="check" size={17} />
              Confirmation checked onchain
            </li>
          </ul>
        </div>
        <div className="review-example">
          <div className="row-between">
            <h3>Before you approve</h3>
            <Icon name="shield" />
          </div>
          <dl className="details-list">
            <div>
              <dt>Amount</dt>
              <dd>5.00 USDC</dd>
            </div>
            <div>
              <dt>Recipient</dt>
              <dd className="mono">0x84F2…92AC</dd>
            </div>
            <div>
              <dt>Network</dt>
              <dd>Monad Testnet</dd>
            </div>
            <div>
              <dt>Payment purpose</dt>
              <dd>Website development</dd>
            </div>
          </dl>
          <p className="review-sentence">
            Example: <strong>5 USDC</strong> on <strong>Monad Testnet</strong> to{" "}
            <span className="mono">0x84F2…92AC</span>.
          </p>
          <p className="small muted">
            USDC illustration only. Your wallet shows the final network fee.
          </p>
        </div>
      </section>
      <section className="closing-section container">
        <div>
          <h2>
            Your next payment starts with a link.
          </h2>
          <p>Set the details. Share the request. No account needed.</p>
        </div>
        <Link href="/create" className="button primary">
          Create a Payment Link <Icon name="arrow" />
        </Link>
      </section>
    </main>
  );
}
