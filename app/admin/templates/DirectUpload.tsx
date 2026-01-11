"use client";
import React from "react";

type Props = {
  id: string;
  kind: "background" | "product";
  label?: string;
  token?: string;
};

export default function DirectUpload({ id, kind, label, token }: Props) {
  const [pending, setPending] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const LARGE_THRESHOLD = 4_400_000; // ~4.2MB, avoid Vercel function payload limits on fallback

  const onChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    setFile(e.target.files?.[0] || null);
  };

  const onUpload = async () => {
    if (!file) return;
    setPending(true);
    try {
      // Try presigned PUT path first
      const presignRes = await fetch("/api/admin/templates/presign", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
        body: JSON.stringify({ templateId: id, kind, mimeType: file.type || "application/octet-stream" }),
      });
      if (!presignRes.ok) throw new Error(`presign failed: ${await presignRes.text()}`);
      const { putUrl } = await presignRes.json();

      try {
        const uploadRes = await fetch(putUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!uploadRes.ok) throw new Error(`upload failed: status ${uploadRes.status}`);
      } catch (err) {
        // CORS/network or provider error — fallback to server-side direct upload (multipart)
        console.warn("Presigned PUT failed", err);
        // Try presigned POST which typically avoids preflight and can work with no-cors
        try {
          const postPresign = await fetch("/api/admin/templates/presign-post", {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
            body: JSON.stringify({ templateId: id, kind, mimeType: file.type || "application/octet-stream" }),
          });
          if (!postPresign.ok) throw new Error(`presign-post failed: ${await postPresign.text()}`);
          const { url: postUrl, fields } = await postPresign.json();
          const fdDirect = new FormData();
          Object.entries(fields || {}).forEach(([k, v]) => fdDirect.append(k, String(v)));
          fdDirect.append("file", file);
          // Use no-cors to avoid blocking on missing ACAO header; success will be inferred by processing step
          await fetch(postUrl, { method: "POST", body: fdDirect, mode: "no-cors" as any });
        } catch (postErr) {
          // As a last resort for small files only, try server multipart (subject to Vercel ~4.5MB limit)
          if (file.size > LARGE_THRESHOLD) {
            throw new Error("Direct PUT/POST failed and file is too large for server fallback (>4MB). Please update Backblaze CORS to allow this origin or try from the main domain.");
          }
          const fd = new FormData();
          fd.set("id", id);
          fd.set("kind", kind);
          fd.set("file", file);
          const fb = await fetch("/api/admin/templates/direct-upload", { method: "POST", credentials: "include", headers: { ...(token ? { "x-admin-token": token } : {}) }, body: fd });
          if (!fb.ok) throw new Error(`fallback upload failed: ${await fb.text()}`);
        }
      }

      // Always process after upload (either presigned PUT or fallback multipart)
      const procRes = await fetch("/api/admin/templates/process-upload", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
        body: JSON.stringify({ templateId: id, kind }),
      });
      if (!procRes.ok) throw new Error(`process failed: ${await procRes.text()}`);

      // Refresh page to reflect new preview/thumbs
      window.location.reload();
    } catch (e) {
      console.error(e);
      alert((e as any)?.message || String(e));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input onChange={onChange} type="file" accept="image/*" className="block text-sm bg-white text-black border rounded px-2 py-1" />
      <button type="button" onClick={onUpload} disabled={!file || pending} className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">
        {pending ? "Uploading..." : (label || "Upload")}
      </button>
    </div>
  );
}
