import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Kiosk from "./pages/Kiosk";
import Auth from "./pages/Auth";
import AdminDashboard from "./pages/admin/Dashboard";
import Employees from "./pages/admin/Employees";
import Sectors from "./pages/admin/Sectors";
import Timesheet from "./pages/admin/Timesheet";
import HourBank from "./pages/admin/HourBank";
import Settings from "./pages/admin/Settings";
import Companies from "./pages/admin/Companies";
import MonthlyClosing from "./pages/admin/MonthlyClosing";
import Documents from "./pages/admin/Documents";
import Users from "./pages/admin/Users";
import PortalLogin from "./pages/portal/PortalLogin";
import PortalDashboard from "./pages/portal/PortalDashboard";
import PortalDocuments from "./pages/portal/PortalDocuments";
import PortalTimesheet from "./pages/portal/PortalTimesheet";
import NotFound from "./pages/NotFound";
import { CompanyProvider } from "./contexts/CompanyContext";

const queryClient = new QueryClient();

const AdminRoutes = () => (
  <CompanyProvider>
    <Routes>
      <Route path="/" element={<AdminDashboard />} />
      <Route path="/employees" element={<Employees />} />
      <Route path="/sectors" element={<Sectors />} />
      <Route path="/timesheet" element={<Timesheet />} />
      <Route path="/hourbank" element={<HourBank />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/companies" element={<Companies />} />
      <Route path="/closing" element={<MonthlyClosing />} />
      <Route path="/documents" element={<Documents />} />
      <Route path="/users" element={<Users />} />
    </Routes>
  </CompanyProvider>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/kiosk" element={<Kiosk />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/admin/*" element={<AdminRoutes />} />
          <Route path="/portal/login" element={<PortalLogin />} />
          <Route path="/portal" element={<PortalDashboard />} />
          <Route path="/portal/documents" element={<PortalDocuments />} />
          <Route path="/portal/timesheet" element={<PortalTimesheet />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
