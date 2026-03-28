import { Outlet, useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { LayoutDashboard, Users, UserCheck, ListChecks, MessageSquare, Menu, X, Bike } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const navItems = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/leads", icon: Users, label: "Leads" },
  { to: "/admin/tasks", icon: ListChecks, label: "Tarefas" },
  { to: "/admin/messages", icon: MessageSquare, label: "Mensagens" },
];

const AdminLayout = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-card border-r border-border/50 z-40 transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 flex flex-col`}>
        <div className="px-5 py-5 flex items-center gap-2 border-b border-border/50">
          <Bike className="w-6 h-6 text-primary" />
          <span className="font-display font-bold text-lg">Arsenal <span className="text-primary">CRM</span></span>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/admin"}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-accent transition-colors"
              activeClassName="bg-primary/10 text-primary font-medium"
              onClick={() => setOpen(false)}
            >
              <item.icon className="w-4.5 h-4.5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-border/50 md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setOpen(!open)}>
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
          <span className="font-display font-bold">Arsenal <span className="text-primary">CRM</span></span>
        </header>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
