import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import ChatFunnel from "./pages/ChatFunnel";
import ClientDashboard from "./pages/ClientDashboard";
import Simulator from "./pages/Simulator";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminLeads from "./pages/admin/AdminLeads";
import AdminTasks from "./pages/admin/AdminTasks";
import AdminMessages from "./pages/admin/AdminMessages";
import AdminPipeline from "./pages/admin/AdminPipeline";
import AdminMetrics from "./pages/admin/AdminMetrics";
import AdminClientDetail from "./pages/admin/AdminClientDetail";
import AdminGoals from "./pages/admin/AdminGoals";
import AdminCalendar from "./pages/admin/AdminCalendar";
import AdminChatHistory from "./pages/admin/AdminChatHistory";
import MemberArea from "./pages/MemberArea";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/chat" element={<ChatFunnel />} />
            <Route path="/dashboard" element={<ClientDashboard />} />
            <Route path="/simulator" element={<Simulator />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="leads" element={<AdminLeads />} />
              <Route path="pipeline" element={<AdminPipeline />} />
              <Route path="tasks" element={<AdminTasks />} />
              <Route path="messages" element={<AdminMessages />} />
              <Route path="metrics" element={<AdminMetrics />} />
              <Route path="calendar" element={<AdminCalendar />} />
              <Route path="goals" element={<AdminGoals />} />
              <Route path="chat-history" element={<AdminChatHistory />} />
              <Route path="client/:id" element={<AdminClientDetail />} />
            </Route>
            <Route
              path="/member"
              element={
                <ProtectedRoute>
                  <MemberArea />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
