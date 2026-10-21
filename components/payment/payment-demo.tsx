"use client";

import { useState } from "react";
import { IntentLink as Link } from "@/components/ui/intent-link";
import { PaymentTicket } from "./payment-ticket";
import { Icon } from "@/components/ui/icon";
import { useFeedbackMotion } from "@/components/ui/use-feedback-motion";

const examples = [
  { label: "Freelance work", amount: "5", description: "Website development" },
  { label: "Split a bill", amount: "12.50", description: "Your share of dinner" },
  { label: "Everyday payment", amount: "3", description: "Coffee and a catch-up" },
];

export function PaymentDemo() {
  const [selected, setSelected] = useState(0);
  const example = examples[selected];
  const ticket = useFeedbackMotion<HTMLDivElement>(String(selected));

  return (
    <div className="payment-demo">
      <div className="demo-heading">
        <span>
          <Icon name="link" size={18} /> A request, ready to share.
        </span>
        <span className="preview-pill">Interactive example</span>
      </div>
      <div className="demo-options" role="group" aria-label="Payment examples">
        {examples.map(({ label }, index) => (
          <button
            key={label}
            type="button"
            aria-pressed={selected === index}
            onClick={() => setSelected(index)}
            aria-controls="demo-ticket"
          >
            {label}
          </button>
        ))}
      </div>
      <div id="demo-ticket" className="demo-ticket" ref={ticket}>
        <PaymentTicket
          amount={example.amount}
          description={example.description}
          token="USDC"
          recipientName="Frederick Lamar"
          recipient="0x84f20000000000000000000000000000000092ac"
          preview
        >
          <Link href="/create" className="button primary full">
            Make your own payment link <Icon name="arrow" />
          </Link>
        </PaymentTicket>
      </div>
      <p className="sr-only" role="status" aria-atomic="true">
        {example.label}: {example.amount} USDC for {example.description}.
      </p>
      <p className="demo-caption">
        Illustrative USDC examples. Real requests can use testnet MON or USDC.
      </p>
      <noscript>
        <p className="demo-caption">Enable JavaScript to switch examples.</p>
      </noscript>
    </div>
  );
}
