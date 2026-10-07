import { PayLinkLogo } from "@/components/branding/logo";
import { WalletButton } from "@/components/wallet/wallet-button";
import Link from "next/link";
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <PayLinkLogo />
        <nav aria-label="Main navigation">
          <Link href="/#how-it-works">How it works</Link>
          <Link href="/#security">Security</Link>
        </nav>
        <WalletButton />
      </div>
    </header>
  );
}
export function SiteFooter() {
  return (
    <footer className="site-footer container">
      <PayLinkLogo />
      <p>Less blockchain complexity. More confidence.</p>
      <span className="network-line">
        <span className="network-glyph" />
        Built on Monad <span className="testnet-tag">Testnet</span>
      </span>
    </footer>
  );
}
