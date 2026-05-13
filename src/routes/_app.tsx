import { createFileRoute, Outlet, Link, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, LogOut, Home, PlusCircle, History, BarChart3, Package, Users, ListOrdered, Cigarette, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { loading, session, role, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/login" });
  }, [loading, session, navigate]);

  useEffect(() => {
    if (loading || !session || !role) return;

    if (role === "admin" && location.pathname.startsWith("/sales")) {
      navigate({ to: "/admin", replace: true });
    }

    if (role === "sales" && location.pathname.startsWith("/admin")) {
      navigate({ to: "/sales", replace: true });
    }
  }, [loading, session, role, location.pathname, navigate]);

  if (loading || !session || !role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isAdmin = role === "admin";
  const path = location.pathname;

  if ((isAdmin && path.startsWith("/sales")) || (!isAdmin && path.startsWith("/admin"))) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-subtle">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const salesNav = [
    { to: "/sales", icon: Home, label: "Beranda" },
    { to: "/sales/input", icon: PlusCircle, label: "Input" },
    { to: "/sales/history", icon: History, label: "Riwayat" },
  ];
  const adminNav = [
    { to: "/admin", icon: Home, label: "Beranda" },
    { to: "/admin/transactions", icon: ListOrdered, label: "Transaksi" },
    { to: "/admin/analytics", icon: BarChart3, label: "Analitik" },
    { to: "/admin/products", icon: Package, label: "Produk" },
    { to: "/admin/sales", icon: Users, label: "Sales" },
    { to: "/admin/settings", icon: Settings, label: "Setelan" },
  ];
  const nav = isAdmin ? adminNav : salesNav;

  return (
    <div className="min-h-screen bg-gradient-subtle pb-20 md:pb-0 md:pl-64">
      {/* Sidebar (md+) */}
      <aside className="hidden md:flex fixed top-0 left-0 h-screen w-64 flex-col border-r bg-sidebar">
        <div className="px-5 py-5 flex items-center gap-3 border-b">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
            <Cigarette className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <p className="font-semibold leading-tight">Binowo Perkasa</p>
            <p className="text-xs text-muted-foreground">{isAdmin ? "Panel Admin" : "Panel Sales"}</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => {
            const active = path === item.to || (item.to !== "/sales" && item.to !== "/admin" && path.startsWith(item.to));
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active ? "bg-primary text-primary-foreground shadow-soft" : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <Icon className="h-4 w-4" /> {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t">
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium truncate">{profile?.full_name || profile?.email}</p>
            <p className="text-xs text-muted-foreground">
              {isAdmin ? "Admin" : `Sales · ${profile?.sales_code ?? "—"}`}
            </p>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={() => { signOut().then(() => navigate({ to: "/login" })); }}>
            <LogOut className="h-4 w-4 mr-2" /> Keluar
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 bg-card/80 backdrop-blur border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-primary flex items-center justify-center">
            <Cigarette className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold leading-none">Binowo Perkasa</p>
            <p className="text-[11px] text-muted-foreground">{isAdmin ? "Admin" : profile?.sales_code ?? "Sales"}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => { signOut().then(() => navigate({ to: "/login" })); }}>
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      <main className="p-4 md:p-8 max-w-6xl mx-auto">
        <Outlet />
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-card border-t shadow-card">
        <div className={`grid ${isAdmin ? "grid-cols-6" : "grid-cols-3"}`}>
          {nav.map((item) => {
            const active = path === item.to || (item.to !== "/sales" && item.to !== "/admin" && path.startsWith(item.to));
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to}
                className={`flex flex-col items-center justify-center py-2.5 text-[11px] gap-0.5 transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate max-w-full px-1">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
