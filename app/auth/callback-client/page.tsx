"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { toast } from "sonner";

export const dynamic = "force-dynamic";

function CallbackInner() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const run = async () => {
      const code = params?.get("code");
      const ok = params?.get("ok");
      const next = params?.get("next") || "/";
      if (code) {
        try {
          const supabase = supabaseBrowser();
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            router.replace(`/sign-in?error=${encodeURIComponent(error.message)}`);
            return;
          }
          try {
            const { data } = await supabase.auth.getSession();
            const at = data.session?.access_token;
            const rt = data.session?.refresh_token;
            if (at && rt) {
              await fetch("/auth/set-session", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ access_token: at, refresh_token: rt }),
              });
            }
          } catch {}
          try { toast.success("Signed in successfully"); } catch {}
          setTimeout(() => router.replace(next), 800);
        } catch (e: any) {
          router.replace(`/sign-in?error=${encodeURIComponent(e?.message || "Auth failed")}`);
        }
        return;
      }
      if (ok) {
        try { toast.success("Signed in successfully"); } catch {}
        setTimeout(() => router.replace(next), 600);
        return;
      }
      router.replace("/sign-in");
    };
    void run();
  }, [params?.toString(), router]);

  return (
    <div className="min-h-[50vh] flex items-center justify-center p-8 text-sm text-muted-foreground">
      Completing sign-in...
    </div>
  );
}

export default function AuthCallbackClient() {
  return (
    <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center p-8 text-sm text-muted-foreground">Completing sign-in...</div>}>
      <CallbackInner />
    </Suspense>
  );
}
