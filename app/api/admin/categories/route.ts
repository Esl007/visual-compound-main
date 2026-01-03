import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function GET() {
  const adminToken = process.env.ADMIN_UPLOAD_TOKEN;
  if (!adminToken) return new Response(JSON.stringify({ error: "Missing ADMIN_UPLOAD_TOKEN" }), { status: 500 });
  // No auth required for GET per spec (public list), but we can safely read with admin since it is server-side
  const supa = supabaseAdmin();
  const { data, error } = await supa.from("template_categories").select("id,name").order("name", { ascending: true });
  if (error) {
    const msg = String(error.message || "");
    if (msg.includes("Could not find the table") || msg.includes("does not exist") || msg.includes("schema cache")) {
      const { data: data2, error: err2 } = await supa.from("categories").select("id,name").order("name", { ascending: true });
      if (!err2) {
        return new Response(JSON.stringify({ items: data2 || [] }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: err2?.message || msg }), { status: 400 });
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
  return new Response(JSON.stringify({ items: data || [] }), { status: 200, headers: { "content-type": "application/json" } });
}

export async function POST(req: NextRequest) {
  const adminToken = process.env.ADMIN_UPLOAD_TOKEN;
  if (!adminToken) return new Response(JSON.stringify({ error: "Missing ADMIN_UPLOAD_TOKEN" }), { status: 500 });
  const headerToken = req.headers.get("x-admin-token");
  const cookieToken = req.cookies.get("admin-token")?.value;
  if (headerToken !== adminToken && cookieToken !== adminToken) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  let name = "";
  const ctype = req.headers.get("content-type") || "";
  if (ctype.includes("application/json")) {
    const body = await req.json();
    name = String(body?.name || "").trim();
  } else {
    const fd = await req.formData();
    name = String(fd.get("name") || "").trim();
  }
  if (!name) return new Response(JSON.stringify({ error: "Name required" }), { status: 400 });
  const supa = supabaseAdmin();
  const { data, error } = await supa
    .from("template_categories")
    .insert({ id: randomUUID(), name })
    .select("id,name")
    .single();
  const url = new URL(req.url);
  const accept = req.headers.get("accept") || "";
  if (error) {
    const msg = String(error.message || "");
    if (msg.includes("Could not find the table") || msg.includes("does not exist") || msg.includes("schema cache")) {
      // Fallback: try inserting into legacy 'categories' table
      const { data: data2, error: err2 } = await supa
        .from("categories")
        .insert({ id: randomUUID(), name })
        .select("id,name")
        .single();
      if (!err2) {
        if (accept.includes("text/html") || url.searchParams.get("redirect") === "1") {
          return NextResponse.redirect(new URL("/admin/templates1", req.url), 303);
        }
        return new Response(JSON.stringify(data2), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (accept.includes("text/html") || url.searchParams.get("redirect") === "1") {
        return NextResponse.redirect(new URL("/admin/templates1", req.url), 303);
      }
      return new Response(JSON.stringify({ error: err2?.message || msg }), { status: 400 });
    }
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
  if (accept.includes("text/html") || url.searchParams.get("redirect") === "1") {
    return NextResponse.redirect(new URL("/admin/templates1", req.url), 303);
  }
  return new Response(JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" } });
}
