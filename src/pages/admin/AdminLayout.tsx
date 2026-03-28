import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { NavLink } from "@/components/NavLink";
import { LayoutDashboard, Users, ListChecks, MessageSquare, Menu, X, Bike, ChevronLeft, Kanban, LogOut, BarChart3, CalendarDays, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import BottomTabBar from "@/components/BottomTabBar";
import { useRealtimeLeads } from "@/hooks/useRealtimeLeads";
import { useAuth } from "@/hooks/useAuth";
import NotificationCenter from "@/components/admin/NotificationCenter";
import GlobalSearch from "@/components/admin/GlobalSearch";
import AddLeadDialog from "@/components/admin/AddLeadDialog";
import PhotoLeadCapture from "@/components/admin/PhotoLeadCapture";
import AdminBreadcrumb from "@/components/admin/AdminBreadcrumb";

const navItems = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/leads", icon: Users, label: "Leads" },
  { to: "/admin/pipeline", icon: Kanban, label: "Pipeline" },
  { to: "/admin/tasks", icon: ListChecks, label: "Tarefas" },
  { to: "/admin/calendar", icon: CalendarDays, label: "Agenda" },
  { to: "/admin/messages", icon: MessageSquare, label: "Mensagens" },
  { to: "/admin/metrics", icon: BarChart3, label: "Métricas" },
  { to: "/admin/goals", icon: Target, label: "Metas" },
];

const AdminLayout = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isClientDetail = location.pathname.includes("/admin/client/");
  const { signOut, user } = useAuth();
  useRealtimeLeads();

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  return (
    <div className="min-h-screen bg-background flex">
      {open && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-card/50 backdrop-blur-xl border-r border-border/50 z-40 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 flex flex-col`}>
        <div className="px-5 py-5 flex items-center gap-2.5 border-b border-border/50">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <Bike className="w-4 h-4 text-primary" />
          </div>
          <span className="font-display font-bold text-sm">Arsenal <span className="text-primary">CRM</span></span>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/admin"}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-accent transition-all duration-200"
              activeClassName="bg-primary/10 text-primary font-medium"
              onClick={() => setOpen(false)}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-border/50 space-y-1">
          {user && (
            <div className="px-3 py-1.5 mb-1">
              <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
            </div>
          )}
          <NavLink
            to="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-accent transition-all duration-200"
          >
            <ChevronLeft className="w-4 h-4" />
            Voltar ao site
          </NavLink>
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200 w-full"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center gap-2 px-4 py-3 border-b border-border/50 backdrop-blur-xl bg-background/80 sticky top-0 z-20">
          <Button variant="ghost" size="icon" onClick={() => setOpen(!open)} className="rounded-full md:hidden">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <div className="flex items-center gap-2 md:hidden">
            <Bike className="w-4 h-4 text-primary" />
            <span className="font-display font-bold text-sm">Arsenal <span className="text-primary">CRM</span></span>
          </div>
          
          <div className="flex-1" />
          
          <GlobalSearch />
          <PhotoLeadCapture />
          <AddLeadDialog />
          <NotificationCenter />
        </header>
        <main className={`flex-1 overflow-y-auto ${!isClientDetail ? "pb-20 md:pb-0" : ""}`}>
          <AdminBreadcrumb />
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {!isClientDetail && <BottomTabBar />}
    </div>
  );
};

export default AdminLayout;
