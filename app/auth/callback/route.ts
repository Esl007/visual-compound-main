import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const supabase = supabaseServer();
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") || "/";
  try {
    if (code) {
      // Exchange the auth code for a session and set cookies via SSR helper
      const { error } = await supabase.auth.exchangeCodeForSession(code as string);
      if (error) {
        return NextResponse.redirect(new URL(`/sign-in?error=${encodeURIComponent(error.message)}`, url.origin));
      }
      // After setting cookies, hop to the client callback to show a success toast,
      // then continue to the intended destination.
      const cb = new URL(`/auth/callback-client?ok=1&next=${encodeURIComponent(next)}`, url.origin);
      return NextResponse.redirect(cb);
    }
  } catch (_) {
    // ignore; redirect to sign-in for safety
    return NextResponse.redirect(new URL("/sign-in", url.origin));
  }
  // Redirect to next path (defaults to home)
  const target = new URL(`/auth/callback-client?ok=1&next=${encodeURIComponent(next)}`, url.origin);
  return NextResponse.redirect(target);
}
