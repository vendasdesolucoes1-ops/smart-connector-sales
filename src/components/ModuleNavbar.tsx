import { NavLink } from "@/components/NavLink";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { ModuleGroup } from "@/lib/navigation";

interface Props {
  module: ModuleGroup;
  currentPath: string;
}

export function ModuleNavbar({ module, currentPath }: Props) {
  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="flex items-center h-12 px-3">
        <SidebarTrigger className="mr-2" />
        {/* Module label */}
        <div className="flex items-center gap-2 shrink-0 mr-5">
          <module.icon className="h-4.5 w-4.5 text-primary" />
          <span className="text-sm font-semibold text-foreground">{module.label}</span>
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-border mr-4" />

        {/* Tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {module.items.map((item) => {
            const isActive = currentPath === item.url;
            return (
              <NavLink
                key={item.url}
                to={item.url}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
                activeClassName=""
              >
                <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                <span>{item.title}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="flex-1" />

        <ThemeToggle />
      </div>
    </header>
  );
}
