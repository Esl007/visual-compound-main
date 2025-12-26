"use client";
import { Suspense } from "react";
import Generate from "@/pages/Generate";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Generate />
    </Suspense>
  );
}
