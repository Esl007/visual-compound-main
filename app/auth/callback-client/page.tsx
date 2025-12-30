"use client";
import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function AuthCallbackClient() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const run = async () => {
      const code = params?.get("code");
      const next = params?.get("next") || "/";
      if (!code) {
        router.replace("/sign-in");
        return;
      }
      try {
        const supabase = supabaseBrowser();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          router.replace(`/sign-in?error=${encodeURIComponent(error.message)}`);
          return;
        }
        router.replace(next);
      } catch (e: any) {
        router.replace(`/sign-in?error=${encodeURIComponent(e?.message || "Auth failed")}`);
      }
    };
    void run();
  }, [params?.toString(), router]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-8 text-sm text-muted-foreground">
      Completing sign-in...
    </div>
  );
}
