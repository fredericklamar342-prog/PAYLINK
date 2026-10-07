import type { ReactNode } from "react";
import { displayAmount, shortAddress } from "@/lib/payments";
import type { PaymentStatus, TokenSymbol } from "@/lib/types";
import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/ui/status-badge";

export interface TicketProps {
  amount: string;
  token: TokenSymbol;
  recipient: string;
  recipientName?: string;
  description: string;
  preview?: boolean;
  status?: PaymentStatus;
  children?: ReactNode;
}
export function PaymentTicket({
  amount,
  token,
  recipient,
  recipientName,
  description,
  preview,
  status = "unpaid",
  children,
}: TicketProps) {
  return (
    <article
      className="payment-ticket"
      aria-label={preview ? "Payment ticket preview" : "Payment request"}
    >
      <div className="ticket-top">
        <span className="eyebrow">Payment request</span>
        <span className="ticket-symbol" aria-hidden="true">
          ↗
        </span>
      </div>
      <div className="ticket-body">
        <div className="recipient-row">
          <span className="avatar" aria-hidden="true">
            {recipientName
              ? recipientName
                  .trim()
                  .split(/\s+/)
                  .map((s) => s[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()
              : "↗"}
          </span>
          <div>
            <span className="small muted">Payment to</span>
            <h2>
              {recipientName ||
                (recipient ? shortAddress(recipient) : "Your recipient")}
            </h2>
          </div>
        </div>
        <p className="ticket-description">
          {description || "What’s this payment for?"}
        </p>
        <div className="ticket-amount">
          {displayAmount(amount)} <span>{token}</span>
        </div>
        <div className="ticket-meta">
          <span className="network-line">
            <span className="network-glyph" />
            MONAD <span className="testnet-tag">Testnet</span>
          </span>
          <span className="small muted">
            {preview ? "Example request" : "Direct to wallet"}
          </span>
        </div>
      </div>
      <div className="ticket-perforation" aria-hidden="true" />
      <div className="ticket-bottom">
        <div className="ticket-wallet">
          <span className="small muted">Recipient wallet</span>
          <span className="mono">
            {recipient ? shortAddress(recipient) : "0x…"}
          </span>
        </div>
        {!preview && <StatusBadge status={status} />}
        {children}
        <p className="ticket-assurance">
          <Icon name="shield" size={15} />
          {preview
            ? "You review. You approve. You pay."
            : "Your wallet. Your approval. Always."}
        </p>
      </div>
    </article>
  );
}
