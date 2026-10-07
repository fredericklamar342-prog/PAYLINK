import Link from "next/link";
export function PayLinkLogo() {
  return (
    <Link href="/" className="logo" aria-label="PayLink home">
      <span className="logo-mark" aria-hidden="true">
        <i />
        <i />
      </span>
      paylink<span className="logo-period">.</span>
    </Link>
  );
}
