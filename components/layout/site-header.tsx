import { PayLinkLogo } from "@/components/branding/logo";
import { WalletButton } from "@/components/wallet/wallet-button";
import { Suspense } from "react";
import { NavigationLinks, SiteNavigation } from "./site-navigation";
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <PayLinkLogo />
        <Suspense fallback={<NavigationLinks />}>
          <SiteNavigation />
        </Suspense>
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
