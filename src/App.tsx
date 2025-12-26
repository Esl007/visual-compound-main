import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import Generate from "./pages/Generate";
import Products from "./pages/Products";
import Templates from "./pages/Templates";
import AdBuilder from "./pages/AdBuilder";
import BrandSettings from "./pages/BrandSettings";
import Export from "./pages/Export";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <MainLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/generate" element={<Generate />} />
            <Route path="/products" element={<Products />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/ad-builder" element={<AdBuilder />} />
            <Route path="/brand-settings" element={<BrandSettings />} />
            <Route path="/export" element={<Export />} />
            <Route path="/account" element={<Navigate to="/" replace />} />
            <Route path="/billing" element={<Navigate to="/" replace />} />
            <Route path="/help" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </MainLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
