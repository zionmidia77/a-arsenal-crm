import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index";
import ChatFunnel from "./pages/ChatFunnel";
import ClientDashboard from "./pages/ClientDashboard";
import Simulator from "./pages/Simulator";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminLeads from "./pages/admin/AdminLeads";
import AdminTasks from "./pages/admin/AdminTasks";
import AdminMessages from "./pages/admin/AdminMessages";
import AdminClientDetail from "./pages/admin/AdminClientDetail";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/chat" element={<ChatFunnel />} />
          <Route path="/dashboard" element={<ClientDashboard />} />
          <Route path="/simulator" element={<Simulator />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="leads" element={<AdminLeads />} />
            <Route path="tasks" element={<AdminTasks />} />
            <Route path="messages" element={<AdminMessages />} />
            <Route path="client/:id" element={<AdminClientDetail />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
