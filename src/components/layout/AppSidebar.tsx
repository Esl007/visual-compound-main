"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Sparkles,
  Package,
  LayoutTemplate,
  PenTool,
  Palette,
  Download,
  Settings,
  CreditCard,
  HelpCircle,
  LogIn,
  ChevronLeft,
  Menu,
  Home,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

interface NavItem {
  label: string;
  icon: ReactNode;
  path: string;
}

const primaryNav: NavItem[] = [
  { label: "Dashboard", icon: <Home className="w-5 h-5" />, path: "/" },
  { label: "Generate", icon: <Sparkles className="w-5 h-5" />, path: "/generate" },
  { label: "Assets", icon: <Package className="w-5 h-5" />, path: "/assets" },
  { label: "Products", icon: <Package className="w-5 h-5" />, path: "/products" },
  { label: "Templates", icon: <LayoutTemplate className="w-5 h-5" />, path: "/templates" },
  { label: "Ad Builder", icon: <PenTool className="w-5 h-5" />, path: "/ad-builder" },
];

const secondaryNav: NavItem[] = [
  { label: "Brand Settings", icon: <Palette className="w-5 h-5" />, path: "/brand-settings" },
  { label: "Export & Publish", icon: <Download className="w-5 h-5" />, path: "/export" },
];

const footerNav: NavItem[] = [
  { label: "Account", icon: <Settings className="w-5 h-5" />, path: "/account" },
  { label: "Billing", icon: <CreditCard className="w-5 h-5" />, path: "/billing" },
  { label: "Help", icon: <HelpCircle className="w-5 h-5" />, path: "/help" },
  { label: "Sign In", icon: <LogIn className="w-5 h-5" />, path: "/sign-in" },
];

export const AppSidebar = () => {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const supa = supabaseBrowser();
    (async () => {
      try {
        const { data } = await supa.auth.getUser();
        if (!mounted) return;
        setUserEmail(data.user?.email || null);
        const name = (data.user?.user_metadata as any)?.name || (data.user?.user_metadata as any)?.full_name || null;
        setUserName(name);
      } catch {}
    })();
    const { data: sub } = supa.auth.onAuthStateChange(async () => {
      try {
        const { data } = await supa.auth.getUser();
        setUserEmail(data.user?.email || null);
        const name = (data.user?.user_metadata as any)?.name || (data.user?.user_metadata as any)?.full_name || null;
        setUserName(name);
      } catch {
        setUserEmail(null);
        setUserName(null);
      }
    });
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = pathname === item.path || (item.path === "/" && pathname === "/");

    return (
      <Link
        href={item.path}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative ${
          isActive
            ? "bg-primary/10 text-primary font-medium"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        }`}
      >
        {isActive && (
          <motion.div
            layoutId="activeIndicator"
            className="absolute left-0 inset-y-1 w-1 bg-primary rounded-r-full rounded-l-none pointer-events-none z-10"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        )}
        <span className={`transition-colors ${isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"}`}>
          {item.icon}
        </span>
        {!collapsed && (
          <span className="text-sm">{item.label}</span>
        )}
      </Link>
    );
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="h-screen bg-sidebar border-r border-sidebar-border flex flex-col sticky top-0"
    >
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-sidebar-border">
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 flex-1"
          >
            <div className="overflow-hidden bg-transparent flex items-center">
              <img src="/logo.png" alt="Vizualy AI" className="h-8 w-full object-contain" />
            </div>
          </motion.div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-2 rounded-lg hover:bg-sidebar-accent transition-colors text-muted-foreground hover:text-foreground"
        >
          {collapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {primaryNav.map((item) => (
          <div key={item.path}>
            <NavLink item={item} />
          </div>
        ))}

        {/* Divider */}
        <div className="my-4 border-t border-sidebar-border" />

        {secondaryNav.map((item) => (
          <div key={item.path}>
            <NavLink item={item} />
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-2">
        {userEmail ? (
          <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-sidebar-accent text-sidebar-accent-foreground">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
                {(userName || userEmail).slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium truncate">{userName || "Signed in"}</div>
                <div className="text-[11px] text-muted-foreground truncate">{userEmail}</div>
              </div>
            </div>
            <button
              onClick={async () => {
                try {
                  await supabaseBrowser().auth.signOut();
                } finally {
                  const next = encodeURIComponent(pathname || "/");
                  window.location.href = `/sign-in?next=${next}`;
                }
              }}
              className="text-xs px-2 py-1 rounded-md bg-muted hover:bg-muted/70"
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {footerNav.map((item) => {
              if (item.path === "/sign-in") {
                const safePath = pathname || "/";
                const nextAware: NavItem = { ...item, path: `/sign-in?next=${encodeURIComponent(safePath)}` };
                return (
                  <div key={item.path}>
                    <NavLink item={nextAware} />
                  </div>
                );
              }
              return (
                <div key={item.path}>
                  <NavLink item={item} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.aside>
  );
};
