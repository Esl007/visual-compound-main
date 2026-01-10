"use client";
import React from "react";

type Props = {
  id: string;
  kind: "background" | "product";
  label?: string;
};

export default function DirectUpload({ id, kind, label }: Props) {
  const [pending, setPending] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);

  const onChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    setFile(e.target.files?.[0] || null);
  };

  const onUpload = async () => {
    if (!file) return;
    setPending(true);
    try {
      const presignRes = await fetch("/api/admin/templates/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ templateId: id, kind, mimeType: file.type || "application/octet-stream" }),
      });
      if (!presignRes.ok) throw new Error(`presign failed: ${await presignRes.text()}`);
      const { putUrl } = await presignRes.json();

      const uploadRes = await fetch(putUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!uploadRes.ok) throw new Error(`upload failed: status ${uploadRes.status}`);

      const procRes = await fetch("/api/admin/templates/process-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
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
      <button onClick={onUpload} disabled={!file || pending} className="px-3 py-1.5 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50">
        {pending ? "Uploading..." : (label || "Upload")}
      </button>
    </div>
  );
}
