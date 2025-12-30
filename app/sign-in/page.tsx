"use client";
import { Auth } from "@supabase/auth-ui-react";
import { ThemeSupa } from "@supabase/auth-ui-shared";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function SignInPage() {
  const supabase = supabaseBrowser();
  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/` : "/";
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6 lg:p-10">
      <div className="w-full max-w-md card-elevated p-6">
        <h1 className="text-2xl font-display mb-4">Sign in</h1>
        <Auth
          supabaseClient={supabase}
          providers={["google"]}
          appearance={{ theme: ThemeSupa }}
          view="magic_link"
          redirectTo={redirectTo}
          showLinks={true}
        />
      </div>
    </div>
  );
}
