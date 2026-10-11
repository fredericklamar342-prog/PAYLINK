"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";

export function SiteNavigation() {
  const pathname = usePathname();
  return <NavigationLinks pathname={pathname} />;
}

export function NavigationLinks({ pathname }: { pathname?: string }) {
  return (
    <nav className="site-navigation" aria-label="Main navigation">
      <Link href="/#how-it-works">How it works</Link>
      <Link href="/#security">Security</Link>
      <Link
        className="nav-create"
        href="/create"
        aria-current={pathname === "/create" ? "page" : undefined}
      >
        Create a link <Icon name="arrow" size={15} />
      </Link>
    </nav>
  );
}
