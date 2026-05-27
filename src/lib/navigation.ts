import {
  LayoutDashboard, Smartphone, Users, Search, Send,
  Kanban, Calendar, Brain, Building2, UserCheck, Settings, Radio,
} from "lucide-react";

export interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface ModuleGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

export const dashboardItem: NavItem = {
  title: "Dashboard",
  url: "/",
  icon: LayoutDashboard,
};

export const moduleGroups: ModuleGroup[] = [
  {
    label: "Comunicação",
    icon: Smartphone,
    items: [
      { title: "WhatsApp", url: "/whatsapp", icon: Smartphone },
      { title: "Disparos", url: "/broadcasts", icon: Send },
      { title: "CRM Comunicação", url: "/comm-crm", icon: Radio },
    ],
  },
  {
    label: "Vendas",
    icon: Users,
    items: [
      { title: "Leads", url: "/leads", icon: Users },
      { title: "Prospecção", url: "/prospecting", icon: Search },
      { title: "CRM Pipeline", url: "/crm", icon: Kanban },
      { title: "Agendamentos", url: "/appointments", icon: Calendar },
    ],
  },
  {
    label: "Inteligência",
    icon: Brain,
    items: [
      { title: "Agente IA", url: "/ai", icon: Brain },
      { title: "Meu Vendedor", url: "/my-seller", icon: UserCheck },
    ],
  },
  {
    label: "Configuração",
    icon: Settings,
    items: [
      { title: "Empresa", url: "/company", icon: Building2 },
      { title: "Configurações", url: "/settings", icon: Settings },
    ],
  },
];

export function findCurrentModule(pathname: string): ModuleGroup | null {
  for (const group of moduleGroups) {
    if (group.items.some((item) => item.url === pathname)) {
      return group;
    }
  }
  return null;
}

export const allNavItems: NavItem[] = [
  dashboardItem,
  ...moduleGroups.flatMap((g) => g.items),
];
