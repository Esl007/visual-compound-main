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

  async function waitUntilExists(key: string, timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    let lastErr: any = null;
    while (Date.now() < deadline) {
      try {
        const r = await fetch("/api/admin/templates/exists", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
          body: JSON.stringify({ templateId: id, kind }),
        });
        if (r.ok) {
          const j = await r.json();
          if (j?.exists) return true;
        }
      } catch (e) {
        lastErr = e;
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    if (lastErr) console.warn("waitUntilExists last error:", lastErr);
    return false;
  }

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
      const { putUrl, key, corsInfo } = await presignRes.json();
      if (corsInfo) console.log("presign.corsInfo", corsInfo);

      try {
        const uploadRes = await fetch(putUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        });
        if (!uploadRes.ok) throw new Error(`upload failed: status ${uploadRes.status}`);
        // Verify object exists before processing (handles eventual consistency and silent CORS drops)
        const ok = await waitUntilExists(key);
        if (!ok) throw new Error("Upload PUT finished but object is not visible yet. CORS or propagation delay.");
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
          const { url: postUrl, fields, key: postKey, corsInfo: postCorsInfo } = await postPresign.json();
          if (postCorsInfo) console.log("presignPost.corsInfo", postCorsInfo);
          const fdDirect = new FormData();
          Object.entries(fields || {}).forEach(([k, v]) => fdDirect.append(k, String(v)));
          fdDirect.append("file", file);
          // Use no-cors to avoid blocking on missing ACAO header; success will be inferred by processing step
          await fetch(postUrl, { method: "POST", body: fdDirect, mode: "no-cors" as any });
          const ok = await waitUntilExists(postKey);
          if (!ok) throw new Error("Upload POST attempted but object not visible. Likely bucket CORS or signature mismatch.");
        } catch (postErr) {
          console.warn("Presigned POST failed", postErr);
          // Try B2 Native direct upload (b2_upload_file), which can avoid S3 CORS quirks
          try {
            const b2 = await fetch("/api/admin/templates/presign-b2", {
              method: "POST",
              credentials: "include",
              headers: { "content-type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
              body: JSON.stringify({ templateId: id, kind }),
            });
            if (!b2.ok) throw new Error(`presign-b2 failed: ${await b2.text()}`);
            const { uploadUrl, authToken, key: b2Key, corsInfo: b2Cors } = await b2.json();
            if (b2Cors) console.log("presignB2.corsInfo", b2Cors);
            const headers: Record<string, string> = {
              Authorization: authToken,
              "X-Bz-File-Name": encodeURI(b2Key),
              "X-Bz-Content-Sha1": "do_not_verify",
              "Content-Type": file.type || "b2/x-auto",
            };
            const up = await fetch(uploadUrl, { method: "POST", headers: headers as any, body: file as any });
            if (!up.ok) throw new Error(`b2 upload failed: ${up.status}`);
            const ok = await waitUntilExists(b2Key);
            if (!ok) throw new Error("B2 native upload finished but object not visible.");
          } catch (b2Err) {
            console.warn("B2 native upload failed", b2Err);
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
            const ok = await waitUntilExists(key);
            if (!ok) throw new Error("Server fallback finished but object not visible.");
          }
        }
      }

      // Always process after upload (either presigned PUT or fallback multipart)
      const processOnce = async () => {
        const res = await fetch("/api/admin/templates/process-upload", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json", ...(token ? { "x-admin-token": token } : {}) },
          body: JSON.stringify({ templateId: id, kind }),
        });
        return res;
      };
      let res = await processOnce();
      if (res.status === 202) {
        // Pending: poll a few times until object is visible and processing can proceed
        const started = Date.now();
        const timeoutMs = 15000;
        while (Date.now() - started < timeoutMs) {
          await new Promise((r) => setTimeout(r, 700));
          res = await processOnce();
          if (res.ok) break;
          if (res.status !== 202) break;
        }
      }
      if (!res.ok) throw new Error(`process failed: ${await res.text()}`);

      // Refresh page to reflect new preview/thumbs
      window.location.reload();
    } catch (e) {
      console.error("Upload error:", e);
      const origin = window.location.origin;
      alert(`${(e as any)?.message || String(e)}\nOrigin: ${origin}\nKind: ${kind}\nFile: ${file?.name} (${file?.type}; ${file ? file.size + " bytes" : "no file"})`);
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
