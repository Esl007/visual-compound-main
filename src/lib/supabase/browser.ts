import { createBrowserClient } from "@supabase/ssr";

export function supabaseBrowser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  // Determine storage based on a user preference flag set by the sign-in UI.
  // Default to persistent (localStorage); if the flag is explicitly "0", use sessionStorage.
  const storage = typeof window !== "undefined" && window?.localStorage?.getItem("sb_remember") === "0"
    ? window.sessionStorage
    : typeof window !== "undefined"
    ? window.localStorage
    : undefined as any;

  return createBrowserClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      flowType: "pkce",
      storage,
    },
  });
}
