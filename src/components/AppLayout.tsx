import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { ModuleNavbar } from "@/components/ModuleNavbar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { findCurrentModule } from "@/lib/navigation";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AppLayout() {
  const { pathname } = useLocation();
  const currentModule = findCurrentModule(pathname);

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          {currentModule ? (
            <ModuleNavbar module={currentModule} currentPath={pathname} />
          ) : (
            <header className="sticky top-0 z-40 h-12 border-b border-border bg-background/95 backdrop-blur-sm flex items-center px-3 gap-2">
              <SidebarTrigger />
              <div className="flex-1" />
              <ThemeToggle />
            </header>
          )}

          <main className="flex-1 w-full overflow-x-hidden">
            <div className="px-5 py-6 sm:px-6 lg:px-8 animate-fade-in">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
