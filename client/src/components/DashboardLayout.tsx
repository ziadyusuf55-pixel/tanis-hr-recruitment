import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { trpc } from "@/lib/trpc";
import {
  LayoutDashboard, Users, LogOut, PanelLeft, GraduationCap, Inbox, Settings,
  Briefcase, Banknote, CreditCard, BarChart2, AlertCircle, Star, Wallet,
  FileText, Activity, ChevronDown, ChevronRight, TrendingUp, BookOpen, PhoneOff, DollarSign,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

type NavLeaf = { icon: React.ElementType; label: string; path: string };
type NavGroup = { icon: React.ElementType; label: string; key: string; children: NavLeaf[] };
type NavItem = NavLeaf | NavGroup;
const isGroup = (item: NavItem): item is NavGroup => "children" in item;

const NAV: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard",     path: "/" },
  { icon: Users,           label: "Candidates",    path: "/candidates" },
  { icon: GraduationCap,  label: "Training",      path: "/training" },
  {
    icon: Briefcase, label: "Operations", key: "operations",
    children: [
      { icon: Briefcase,   label: "Agents",        path: "/operations" },
      { icon: BarChart2,   label: "Performance",   path: "/performance" },
      { icon: AlertCircle, label: "Adherence Log", path: "/adherence" },
      { icon: Star,        label: "Quality Log",   path: "/quality" },
      { icon: BookOpen,    label: "Coaching",      path: "/coaching-admin" },
      { icon: PhoneOff,    label: "Client Logouts", path: "/client-logouts" },
    ],
  },
  {
    icon: Banknote, label: "Payroll", key: "payroll",
    children: [
      { icon: Banknote,    label: "Payroll",              path: "/payroll" },
      { icon: DollarSign,  label: "Commission",            path: "/commission" },
      { icon: Wallet,      label: "Payment Preferences",  path: "/payment-preferences" },
      { icon: FileText,    label: "All Documents",        path: "/all-documents" },
    ],
  },
  { icon: Activity, label: "Cycle Tracker", path: "/cycle-tracker" },
  { icon: TrendingUp, label: "Performance Reports", path: "/performance-reports" },
  { icon: Inbox,    label: "Requests",      path: "/requests" },
  { icon: Settings, label: "Settings",      path: "/settings" },
];

const allLeaves = (items: NavItem[]): NavLeaf[] =>
  items.flatMap(i => isGroup(i) ? i.children : [i]);

const TANIS_LOGO_WHITE = "https://d2xsxph8kpxj0f.cloudfront.net/310419663028909162/GKQCuajYkpcdyw75NP8gmu/tanis-logo-white_d38279a7.png";
const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 200;
const MAX_WIDTH = 320;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-6 p-8 max-w-sm w-full text-center">
          <img src={TANIS_LOGO_WHITE} alt="Tanis" className="w-14 h-14 object-contain" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Sign in to continue</h1>
            <p className="text-sm text-muted-foreground mt-1.5">Access requires authentication.</p>
          </div>
          <Button onClick={() => { window.location.href = getLoginUrl(); }} size="lg" className="w-full">
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: {
  children: React.ReactNode;
  setSidebarWidth: (w: number) => void;
}) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const item of NAV) {
      if (isGroup(item)) {
        initial[item.key] = item.children.some(
          c => location === c.path || (c.path !== "/" && location.startsWith(c.path))
        );
      }
    }
    return initial;
  });

  useEffect(() => {
    for (const item of NAV) {
      if (isGroup(item)) {
        const active = item.children.some(
          c => location === c.path || (c.path !== "/" && location.startsWith(c.path))
        );
        if (active) setOpenGroups(prev => ({ ...prev, [item.key]: true }));
      }
    }
  }, [location]);

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - left;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, setSidebarWidth]);

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "R";

  const { data: unreadCount = 0 } = trpc.requests.countUnread.useQuery(undefined, {
    refetchInterval: 30000,
    enabled: !!user,
  });

  const renderLeaf = (item: NavLeaf, indent = false) => {
    const isActive = location === item.path || (item.path !== "/" && location.startsWith(item.path));
    const isRequests = item.path === "/requests";
    const showBadge = isRequests && Number(unreadCount) > 0;
    return (
      <SidebarMenuItem key={item.path}>
        <SidebarMenuButton
          isActive={isActive}
          onClick={() => setLocation(item.path)}
          tooltip={item.label}
          className={`h-9 rounded-lg font-normal text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent data-[active=true]:bg-white/10 data-[active=true]:text-sidebar-foreground${indent && !isCollapsed ? " pl-7" : ""}`}
        >
          <div className="relative shrink-0">
            <item.icon className="h-4 w-4" />
            {showBadge && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center font-bold leading-none">
                {Number(unreadCount) > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          <span className="text-sm flex-1">{item.label}</span>
          {showBadge && !isCollapsed && (
            <span className="ml-auto text-[10px] font-bold text-red-400">{Number(unreadCount) > 9 ? "9+" : unreadCount} new</span>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const renderGroup = (group: NavGroup) => {
    const isOpen = openGroups[group.key] ?? false;
    const isAnyChildActive = group.children.some(
      c => location === c.path || (c.path !== "/" && location.startsWith(c.path))
    );
    const toggle = () => setOpenGroups(prev => ({ ...prev, [group.key]: !prev[group.key] }));

    if (isCollapsed) {
      return (
        <div key={group.key}>
          {group.children.map(child => renderLeaf(child, false))}
        </div>
      );
    }

    return (
      <div key={group.key}>
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive={isAnyChildActive && !isOpen}
            onClick={toggle}
            tooltip={group.label}
            className={`h-9 rounded-lg font-normal text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent${isAnyChildActive ? " text-sidebar-foreground" : ""}`}
          >
            <group.icon className="h-4 w-4 shrink-0" />
            <span className="text-sm flex-1">{group.label}</span>
            {isOpen
              ? <ChevronDown className="h-3.5 w-3.5 text-sidebar-foreground/40 shrink-0" />
              : <ChevronRight className="h-3.5 w-3.5 text-sidebar-foreground/40 shrink-0" />
            }
          </SidebarMenuButton>
        </SidebarMenuItem>
        {isOpen && (
          <SidebarMenu className="gap-0.5 mt-0.5">
            {group.children.map(child => renderLeaf(child, true))}
          </SidebarMenu>
        )}
      </div>
    );
  };

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r border-sidebar-border"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 border-b border-sidebar-border">
            <div className="flex items-center gap-3 px-3 h-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-sidebar-accent transition-colors shrink-0"
                aria-label="Toggle sidebar"
              >
                <PanelLeft className="h-4 w-4 text-sidebar-foreground/60" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-2.5 min-w-0">
                  <img src={TANIS_LOGO_WHITE} alt="Tanis" className="w-10 h-10 object-contain shrink-0 drop-shadow-sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-sidebar-foreground truncate leading-none tracking-wide">Tanis Hub</p>
                    <p className="text-[10px] text-sidebar-foreground/50 truncate mt-0.5 uppercase tracking-widest">Operations</p>
                  </div>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="py-3 overflow-y-auto">
            <SidebarMenu className="px-2 gap-0.5">
              {NAV.map(item => isGroup(item) ? renderGroup(item) : renderLeaf(item))}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-sidebar-border">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-sidebar-accent transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none">
                  <Avatar className="h-8 w-8 shrink-0 border border-white/10">
                    <AvatarFallback className="text-xs font-semibold bg-white/10 text-sidebar-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  {!isCollapsed && (
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-sidebar-foreground truncate">{user?.name || "Recruiter"}</p>
                      <p className="text-[10px] text-sidebar-foreground/50 truncate">{user?.email || ""}</p>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top" className="w-48 mb-1">
                <div className="px-2 py-1.5">
                  <p className="text-xs font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="mr-2 h-3.5 w-3.5" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>

        {!isCollapsed && (
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/30 transition-colors z-50"
            onMouseDown={() => !isCollapsed && setIsResizing(true)}
          />
        )}
      </div>

      <SidebarInset className="bg-background">
        {isMobile && (
          <div className="flex border-b h-14 items-center gap-3 bg-background/95 px-4 backdrop-blur sticky top-0 z-40">
            <SidebarTrigger className="h-8 w-8 rounded-lg" />
            <span className="text-sm font-medium">
              {allLeaves(NAV).find((m) => location === m.path || (m.path !== "/" && location.startsWith(m.path)))?.label ?? "Menu"}
            </span>
          </div>
        )}
        <main className="flex-1 min-h-screen p-6">{children}</main>
      </SidebarInset>
    </>
  );
}
