import Link from "next/link";
import type { ComponentProps } from "react";

/** Keep secondary routes out of startup work; navigation still works on activation. */
export function IntentLink(props: Omit<ComponentProps<typeof Link>, "prefetch">) {
  return <Link {...props} prefetch={false} />;
}
