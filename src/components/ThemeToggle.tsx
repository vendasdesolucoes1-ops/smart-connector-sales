import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center gap-1.5">
      <Sun className="h-3.5 w-3.5 text-muted-foreground" />
      <Switch
        checked={theme === "dark"}
        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
        className="h-5 w-9 data-[state=checked]:bg-primary data-[state=unchecked]:bg-muted"
      />
      <Moon className="h-3.5 w-3.5 text-muted-foreground" />
    </div>
  );
}
