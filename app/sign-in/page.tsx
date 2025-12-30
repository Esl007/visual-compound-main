"use client";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useMemo } from "react";

export const dynamic = "force-dynamic";

export default function SignInPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  const googleEnabled = process.env.NEXT_PUBLIC_SUPABASE_GOOGLE_ENABLED === "true";
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/` : "/";

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
          providers={googleEnabled ? ["google"] : []}
          appearance={{ theme: ThemeSupa }}
          view="magic_link"
          redirectTo={redirectTo}
          showLinks={true}
        />
      </div>
    </div>
  );
}
