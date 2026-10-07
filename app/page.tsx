import Link from "next/link";
import { PaymentTicket } from "@/components/payment/payment-ticket";
import { Icon } from "@/components/ui/icon";
export default function Home() {
  return (
    <main id="main-content">
      <section className="hero container">
        <div className="hero-copy">
          <div className="intro-label">
            <span className="network-glyph" />
            Simple payments. Powered by Monad.
          </div>
          <h1>
            Payment links,
            <br />
            without the
            <br />
            crypto friction.
          </h1>
          <p className="hero-description">
            Create a payment request, share one link, and let anyone pay you on
            Monad.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/create">
              Create a Payment Link <Icon name="arrow" />
            </Link>
            <a className="text-link" href="#how-it-works">
              See how it works <span aria-hidden="true">↗</span>
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
        </div>
        <div className="hero-ticket-stage">
          <div className="ticket-stage-label">
            <span>A little link. A complete payment.</span>
            <span aria-hidden="true">↓</span>
          </div>
          <PaymentTicket
            amount="5"
            token="USDC"
            recipientName="Frederick Lamar"
            recipient="0x84f20000000000000000000000000000000092ac"
            description="Website development"
            preview
          >
            <Link href="/create" className="button primary full">
              Pay 5 USDC <Icon name="arrow" />
            </Link>
          </PaymentTicket>
          <div className="preview-caption">
            <span className="preview-pill">Preview</span>USDC example · Live
            requests use testnet MON
          </div>
        </div>
      </section>
      <div className="value-strip container">
        <p>
          Made for the moment
          <br />
          <strong>someone says “send me a link.”</strong>
        </p>
        <span>Freelance work</span>
        <span>Shared expenses</span>
        <span>Everyday payments</span>
      </div>
      <section className="how-section container" id="how-it-works">
        <div className="section-heading">
          <div>
            <span className="section-kicker">From request to receipt</span>
            <h2>
              Three steps. One less thing
              <br />
              to think about.
            </h2>
          </div>
          <p>
            No payment instructions to explain.
            <br />
            Just a link that takes care of it.
          </p>
        </div>
        <div className="steps">
          {[
            [
              "01",
              "Create",
              "Set the amount and payment details.",
              "A clear request, with everything in one place.",
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
              "A verified receipt closes the loop.",
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
            <h3>Nothing hidden. Just the details.</h3>
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
              <dd>Monad</dd>
            </div>
            <div>
              <dt>Payment purpose</dt>
              <dd>Website development</dd>
            </div>
          </dl>
          <p className="review-sentence">
            You are paying <strong>5 USDC</strong> on <strong>Monad</strong> to{" "}
            <span className="mono">0x84F2…92AC</span>.
          </p>
          <p className="small muted">
            Illustrative review. Your wallet shows the final network fee.
          </p>
        </div>
      </section>
      <section className="closing-section container">
        <div>
          <h2>
            Good work deserves
            <br />a simple way to get paid.
          </h2>
          <p>Make your first payment link in a moment.</p>
        </div>
        <Link href="/create" className="button primary">
          Create a Payment Link <Icon name="arrow" />
        </Link>
      </section>
    </main>
  );
}
