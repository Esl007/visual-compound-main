"use client";

import Link from "next/link";
import { forwardRef } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type AnchorProps = React.AnchorHTMLAttributes<HTMLAnchorElement>;

interface NavLinkCompatProps extends Omit<AnchorProps, "href" | "className"> {
  to: string;
  className?: string;
  activeClassName?: string;
  pendingClassName?: string;
}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, activeClassName, pendingClassName, to, ...props }, _ref) => {
    const pathname = usePathname();
    const isActive = pathname === to;
    const isPending = false;

    return (
      <Link
        href={to}
        className={cn(className, isActive && activeClassName, isPending && pendingClassName)}
        {...props}
      />
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
