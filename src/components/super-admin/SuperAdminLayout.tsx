import { NavLink, Outlet } from "react-router-dom";
import { LayoutDashboard, Mail, Settings, LogOut, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";

const navItems = [
  { to: "/super-admin", label: "Visão geral", icon: LayoutDashboard, end: true },
  { to: "/super-admin/invites", label: "Convites", icon: Mail, end: false },
  { to: "/super-admin/settings", label: "Configurações", icon: Settings, end: false },
];

export function SuperAdminLayout() {
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-60 border-r border-border/30 flex flex-col p-4 gap-6">
        <div className="flex items-center gap-2 px-2">
          <Logo className="h-7 w-auto" />
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Super Admin
          </div>
        </div>

        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                  isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-secondary/40"
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={signOut}
          className="mt-auto flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary/40 transition-colors"
        >
          <LogOut className="h-4 w-4" /> Sair
        </button>
      </aside>

      <main className="flex-1 p-6 sm:p-10 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
