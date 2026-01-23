"use client";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  const siteEnv = process.env.NEXT_PUBLIC_SITE_URL as string | undefined;
  const nextParam = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") : null;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const base = (origin || siteEnv || "/").replace(/\/$/, "");
  const redirectTo = `${base}/auth/callback${nextParam ? `?next=${encodeURIComponent(nextParam)}` : ""}`;

  const supabase = useMemo(() => {
    if (!url || !anon) return null as any;
    try {
      return supabaseBrowser();
    } catch {
      return null as any;
    }
  }, [url, anon]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [signedEmail, setSignedEmail] = useState<string | null>(null);
  const [signedName, setSignedName] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    try {
      const existing = typeof window !== "undefined" ? window.localStorage.getItem("sb_remember") : null;
      if (existing === "0") setRemember(false);
      else setRemember(true);
    } catch {}
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!mounted) return;
        const u = data.user;
        setSignedEmail(u?.email || null);
        const name = (u?.user_metadata as any)?.name || (u?.user_metadata as any)?.full_name || null;
        setSignedName(name);
      } catch {}
    })();
    const { data: sub } = supabase.auth.onAuthStateChange(async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const u = data.user;
        setSignedEmail(u?.email || null);
        const name = (u?.user_metadata as any)?.name || (u?.user_metadata as any)?.full_name || null;
        setSignedName(name);
      } catch {
        setSignedEmail(null);
        setSignedName(null);
      }
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, [supabase]);

  const onPasswordSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password, options: { redirectTo } });
      if (error) throw error;
      const next = nextParam || "/";
      window.location.href = next;
    } catch (err: any) {
      alert(err?.message || "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  if (!url || !anon || !supabase) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-md card-elevated p-6">
          <h1 className="text-2xl font-display mb-2">Sign in</h1>
          <p className="text-sm text-muted-foreground">Supabase environment is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 lg:p-10">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card-elevated p-6 md:p-8">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <img src="/logo.png" alt="Vizualy AI" className="h-8 w-8 object-contain" />
              <h1 className="text-2xl font-display">Sign in</h1>
            </div>
            {signedEmail ? (
              <div className="text-sm text-muted-foreground">You're signed in as <span className="font-medium text-foreground">{signedName || signedEmail}</span>.</div>
            ) : (
              <p className="text-sm text-muted-foreground">Welcome back! Continue with Google or use your email.</p>
            )}
          </div>

          <button
            type="button"
            className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg h-11 transition-colors"
            onClick={async () => {
              try { if (typeof window !== "undefined") window.localStorage.setItem("sb_remember", remember ? "1" : "0"); } catch {}
              await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="h-5 w-5"><path fill="#FFC107" d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12  s5.373-12,12-12c3.059,0,5.842,1.155,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24  s8.955,20,20,20s20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"/><path fill="#FF3D00" d="M6.306,14.691l6.571,4.819C14.655,16.108,18.961,14,24,14c3.059,0,5.842,1.155,7.961,3.039l5.657-5.657  C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.248,6.306,14.691z"/><path fill="#4CAF50" d="M24,44c5.176,0,9.86-1.977,13.409-5.196l-6.191-5.238C29.211,35.091,26.715,36,24,36  c-5.202,0-9.619-3.317-11.283-7.946l-6.49,5.001C9.63,39.556,16.295,44,24,44z"/><path fill="#1976D2" d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.104,4.215-3.852,5.717l6.191,5.238  C36.285,35.091,44,30,44,20C44,22.659,43.862,21.35,43.611,20.083z"/></svg>
            Continue with Google
          </button>

          {!signedEmail && (
            <>
              <div className="flex items-center gap-3 my-6">
                <div className="h-px bg-border flex-1" />
                <span className="text-xs text-muted-foreground">or</span>
                <div className="h-px bg-border flex-1" />
              </div>

              <form onSubmit={onPasswordSignIn} className="space-y-3">
                <div>
                  <label className="text-sm">Email address</label>
                  <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="input input-bordered w-full mt-1" placeholder="you@example.com" />
                </div>
                <div>
                  <label className="text-sm">Password</label>
                  <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="input input-bordered w-full mt-1" placeholder="Your password" />
                </div>
                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => {
                        const v = e.target.checked;
                        setRemember(v);
                        try { if (typeof window !== "undefined") window.localStorage.setItem("sb_remember", v ? "1" : "0"); } catch {}
                      }}
                      className="checkbox checkbox-sm"
                    />
                    Remember me
                  </label>
                  <Link href="#" className="text-sm text-primary hover:underline">Forgot password?</Link>
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full h-11">{loading ? "Signing in..." : "Sign in"}</button>
              </form>

              <EmailMagicLink supabaseClient={supabase} baseUrl={redirectTo} />
            </>
          )}
        </div>

        <div className="hidden md:flex card-elevated p-8 bg-surface-elevated flex-col justify-center">
          <h3 className="text-xl font-display mb-2">Your brand, faster</h3>
          <p className="text-sm text-muted-foreground mb-4">Create stunning visuals in seconds. Sign in to access your templates, assets, and publish-ready creatives.</p>
          {signedEmail ? (
            <Link href={nextParam || "/"} className="btn-primary w-full h-11">Continue</Link>
          ) : (
            <div className="text-xs text-muted-foreground">By continuing, you agree to our Terms and Privacy Policy.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function EmailMagicLink({ supabaseClient, baseUrl }: { supabaseClient: any; baseUrl: string }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabaseClient.auth.signInWithOtp({ email, options: { emailRedirectTo: baseUrl } });
      if (error) throw error;
      alert("Magic link sent. Check your email.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-3">
      <label className="text-sm text-foreground">Email (Magic Link)</label>
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="input input-bordered w-full" />
      <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? "Sending..." : "Send Magic Link"}</button>
    </form>
  );
}
