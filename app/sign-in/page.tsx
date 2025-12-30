"use client";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useMemo, useState } from "react";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  const siteEnv = process.env.NEXT_PUBLIC_SITE_URL as string | undefined;
  const nextParam = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("next") : null;
  const redirectTo = typeof window !== "undefined"
    ? `${siteEnv || window.location.origin}/auth/callback${nextParam ? `?next=${encodeURIComponent(nextParam)}` : ""}`
    : `${(siteEnv || "/").replace(/\/$/, "")}/auth/callback${nextParam ? `?next=${encodeURIComponent(nextParam)}` : ""}`;

  const supabase = useMemo(() => {
    if (!url || !anon) return null as any;
    try {
      return supabaseBrowser();
    } catch {
      return null as any;
    }
  }, [url, anon]);

  if (!url || !anon || !supabase) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-md card-elevated p-6">
          <h1 className="text-2xl font-display mb-2">Sign in</h1>
          <p className="text-sm text-muted-foreground">
            Supabase environment is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and
            NEXT_PUBLIC_SUPABASE_ANON_KEY.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 lg:p-10">
      <div className="w-full max-w-md card-elevated p-6">
        <h1 className="text-2xl font-display mb-4">Sign in</h1>
        <Auth
          supabaseClient={supabase}
          providers={["google"]}
          appearance={{ theme: ThemeSupa }}
          view="sign_in"
          redirectTo={redirectTo}
          showLinks={true}
        />
        <EmailMagicLink supabaseClient={supabase} baseUrl={redirectTo} />
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
      const { error } = await supabaseClient.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: baseUrl },
      });
      if (error) throw error;
      alert("Magic link sent. Check your email.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-3">
      <label className="text-sm text-foreground">Email (Magic Link)</label>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="input input-bordered w-full"
      />
      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Sending..." : "Send Magic Link"}
      </button>
    </form>
  );
}
