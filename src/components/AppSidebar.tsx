import { useNavigate, useLocation } from "react-router-dom";
import { LogOut, ChevronLeft, ChevronRight, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { moduleGroups, dashboardItem } from "@/lib/navigation";
import { NavLink } from "@/components/NavLink";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function AppSidebar() {
  const { signOut, profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";

  const firstName = profile?.full_name?.split(" ")[0] || "Usuário";
  const initials = profile?.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "U";

  const isActive = (url: string) => location.pathname === url;
  const isGroupActive = (items: { url: string }[]) => items.some(i => location.pathname === i.url);

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-border bg-sidebar-background">
      {/* Header with full logo */}
      <SidebarHeader className="px-4 pt-4 pb-3">
        <div className="flex items-center gap-3">
          <Logo className="h-9 w-auto shrink-0" />
          <div>
            <p className="text-base font-bold text-foreground tracking-tight leading-none">VS Sales</p>
            <p className="text-xs text-muted-foreground mt-0.5">Plataforma de vendas</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 flex-1 overflow-y-auto pt-2">
        {/* Dashboard */}
        <NavLink
          to={dashboardItem.url}
          end
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-all font-medium mb-2"
          activeClassName="!bg-primary/10 !text-primary"
        >
          <LayoutDashboard className="h-[18px] w-[18px] shrink-0" />
          <span>Dashboard</span>
        </NavLink>

        <div className="mx-2 my-2 h-px bg-border" />

        {/* Module groups */}
        <div className="space-y-1">
          {moduleGroups.map((group) => {
            const groupActive = isGroupActive(group.items);
            return (
              <div key={group.label}>
                <p className={`px-3 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-wider ${groupActive ? "text-primary" : "text-muted-foreground/60"}`}>
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = isActive(item.url);
                    return (
                      <NavLink
                        key={item.url}
                        to={item.url}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all font-medium ${
                          active
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "text-foreground/70 hover:text-foreground hover:bg-accent border border-transparent"
                        }`}
                        activeClassName=""
                      >
                        <item.icon className={`h-[18px] w-[18px] shrink-0 ${active ? "text-primary" : ""}`} />
                        <span>{item.title}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="p-3">
        <div className="rounded-lg border border-border bg-accent/40 p-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-xs font-bold text-primary">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{firstName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="h-1.5 w-1.5 rounded-full bg-success" />
                <span className="text-xs text-muted-foreground">online</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
