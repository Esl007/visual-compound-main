import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../src/index.css";
import { MainLayout } from "@/components/layout/MainLayout";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "VisualAI",
  description: "AI-powered visual generation",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background">
        <Providers>
          <MainLayout>{children}</MainLayout>
        </Providers>
      </body>
    </html>
  );
}
