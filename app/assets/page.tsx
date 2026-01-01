"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

interface Asset {
  id: string;
  url: string;
  type: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
  signedUrl?: string;
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabaseBrowser().auth.getUser();
      if (!mounted) return;
      if (!data?.user) {
        try {
          const next = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/assets";
          window.location.href = `/sign-in?next=${encodeURIComponent(next)}`;
        } catch {
          window.location.href = "/sign-in";
        }
        return;
      }
      try {
        const res = await fetch("/api/images?type=user", { cache: "no-store" });
        if (res.status === 401) {
          try {
            const next = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/assets";
            window.location.href = `/sign-in?next=${encodeURIComponent(next)}`;
          } catch {
            window.location.href = "/sign-in";
          }
          return;
        }
        if (!res.ok) throw new Error("Failed to load assets");
        const j = (await res.json()) as { items?: any[] };
        if (!mounted) return;
        const items = Array.isArray(j?.items) ? j.items : [];
        const mapped: Asset[] = items.map((row) => ({
          id: row.id,
          url: row.signed_url || row.storage_path,
          type: row.type,
          width: row.metadata?.width ?? null,
          height: row.metadata?.height ?? null,
          created_at: row.created_at,
          signedUrl: row.signed_url || undefined,
        }));
        setAssets(mapped);
      } catch (e) {
        console.error(e);
        if (!mounted) return;
        setAssets([]);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen p-8 lg:p-12">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl lg:text-4xl font-display font-semibold text-foreground">Assets</h1>
          <p className="text-muted-foreground">Your generated and uploaded images</p>
        </div>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : assets && assets.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {assets.map((a) => (
              <div key={a.id} className="rounded-xl overflow-hidden border border-border bg-card">
                <div className="aspect-square bg-muted">
                  <img src={a.signedUrl || a.url} alt={a.type || "asset"} className="w-full h-full object-cover" />
                </div>
                <div className="p-2 text-xs text-muted-foreground flex items-center justify-between">
                  <span>{a.type || "final"}</span>
                  <span>
                    {a.width || "?"}×{a.height || "?"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No assets yet. Generate your first image.</div>
        )}
      </div>
    </div>
  );
}
