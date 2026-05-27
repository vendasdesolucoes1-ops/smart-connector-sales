import { useState } from "react";
import { LogOut, Menu, X, ChevronDown, PanelLeft } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { OnboardingDialog } from "@/components/OnboardingDialog";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/Logo";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { allNavItems } from "@/lib/navigation";

export function AppNavbar() {
  const { signOut, profile } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const initials = profile?.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "U";

  return (
    <>
      <header className="sticky top-0 z-50 w-full h-12 border-b border-border/50 bg-background/95 backdrop-blur-sm flex items-center px-3 sm:px-5 gap-2">
        {/* Sidebar trigger - always visible on dashboard */}
        <SidebarTrigger className="h-7 w-7 text-muted-foreground hover:text-foreground" />

        {/* Mobile menu */}
        <div className="lg:hidden flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setMobileOpen(!mobileOpen)} className="h-7 w-7">
            {mobileOpen ? <X className="h-3.5 w-3.5" /> : <Menu className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {/* Logo */}
        <NavLink to="/" className="flex items-center gap-2">
          <Logo className="h-6 w-auto" />
          <span className="text-[13px] font-semibold text-foreground hidden sm:inline tracking-tight">
            Sales
          </span>
        </NavLink>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 px-1.5 py-1 rounded-md hover:bg-accent transition-colors outline-none">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-[9px] font-bold text-primary">
                  {initials}
                </div>
                <span className="hidden md:inline text-[12px] font-medium max-w-[100px] truncate">
                  {profile?.full_name?.split(" ")[0] || "Usuário"}
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground hidden md:block" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 rounded-lg">
              <div className="px-2.5 py-1.5">
                <p className="text-[12px] font-medium">{profile?.full_name || "Usuário"}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <div className="flex items-center justify-between px-2">
                  <span className="text-[12px]">Onboarding</span>
                  <OnboardingDialog />
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive cursor-pointer text-[12px]">
                <LogOut className="h-3.5 w-3.5 mr-1.5" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 pt-12" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          <nav className="relative w-64 h-full bg-background border-r border-border overflow-y-auto animate-slide-in" onClick={(e) => e.stopPropagation()}>
            <div className="p-2 space-y-0.5">
              {allNavItems.map((item) => (
                <NavLink
                  key={item.url}
                  to={item.url}
                  end={item.url === "/"}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  activeClassName="!text-foreground !bg-accent font-medium"
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </NavLink>
              ))}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
