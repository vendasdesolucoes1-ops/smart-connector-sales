import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import Index from "./pages/Index";
import Prospecting from "./pages/Prospecting";
import Broadcasts from "./pages/Broadcasts";
import Leads from "./pages/Leads";
import CRM from "./pages/CRM";
import SettingsPage from "./pages/SettingsPage";
import AIPage from "./pages/AIPage";
import WhatsAppConnection from "./pages/WhatsAppConnection";
import Appointments from "./pages/Appointments";
import NotFound from "./pages/NotFound";
import Landing from "./pages/Landing";
import Checkout from "./pages/Checkout";
import AdminAuth from "./pages/AdminAuth";
import AdminPanel from "./pages/AdminPanel";
import CompanyProfile from "./pages/CompanyProfile";
import CompanyForm from "./pages/CompanyForm";
import MySeller from "./pages/MySeller";
import CommCRM from "./pages/CommCRM";

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/site" element={<Landing />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/admin" element={<AdminAuth />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/forms/:token" element={<CompanyForm />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Index />} />
        <Route path="/whatsapp" element={<WhatsAppConnection />} />
        <Route path="/prospecting" element={<Prospecting />} />
        <Route path="/broadcasts" element={<Broadcasts />} />
        <Route path="/comm-crm" element={<CommCRM />} />
        <Route path="/leads" element={<Leads />} />
        <Route path="/crm" element={<CRM />} />
        <Route path="/ai" element={<AIPage />} />
        <Route path="/my-seller" element={<MySeller />} />
        <Route path="/company" element={<CompanyProfile />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/appointments" element={<Appointments />} />
      </Route>
      <Route path="/site" element={<Landing />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/admin" element={<AdminAuth />} />
      <Route path="/admin/panel" element={<AdminPanel />} />
      <Route path="/forms/:token" element={<CompanyForm />} />
      <Route path="/auth" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
