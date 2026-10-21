import { IntentLink as Link } from "@/components/ui/intent-link";
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
            Get Paid in Crypto.
            <br />
            Just Share a Link.
          </h1>
          <p className="hero-description">
            An amount. A recipient. One clear request.
            Share a link or QR code, and let your payer review every detail.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/create">
              Create a Payment Link <Icon name="arrow" />
            </Link>
            <a className="text-link" href="#how-it-works">
              How It Works <Icon name="arrow" size={16} />
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
            Monad Testnet only. MON and USDC are test tokens with no real monetary value.
          </p>
        </div>
        <PaymentDemo />
      </section>
      <section className="how-section container" id="how-it-works">
        <div className="section-heading">
          <div>
            <span className="section-kicker">A simple payment journey</span>
            <h2>Create. Share. Pay.</h2>
          </div>
          <p>
            From your first detail to their wallet.
            Clear at every step, with approval always in their hands.
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
              "Pay",
              "The payer reviews the details, connects a wallet, and approves.",
              "A submitted transaction stays pending until independently verified.",
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
      <section className="token-section container" aria-labelledby="token-heading">
        <div className="section-heading compact-heading">
          <div>
            <span className="section-kicker">Supported testnet tokens</span>
            <h2 id="token-heading">Choose MON or USDC.</h2>
          </div>
          <p>Both tokens run on Monad Testnet. They are for demonstration and have no real monetary value.</p>
        </div>
        <div className="token-grid">
          <article className="token-card">
            <span className="token-mark">M</span>
            <div><h3>MON</h3><p>Native testnet token used for payments and network fees.</p></div>
          </article>
          <article className="token-card">
            <span className="token-mark token-mark-usdc">$</span>
            <div><h3>USDC</h3><p>Testnet USDC transfer. MON is still required for the network fee.</p></div>
          </article>
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
            Clear details before you approve. Your wallet shows the transaction,
            and funds move directly to the listed recipient address.
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
              Submitted hashes link to the Monad explorer
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
