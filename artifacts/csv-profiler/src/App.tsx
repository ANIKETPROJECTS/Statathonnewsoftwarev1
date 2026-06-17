import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BarChart2, ArrowLeftRight } from "lucide-react";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import FWFConverter from "@/pages/FWFConverter";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

function AppLayout() {
  const [location] = useLocation();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  const tabs = [
    { path: "/",    label: "CSV Profiler",       icon: <BarChart2 className="w-3.5 h-3.5" /> },
    { path: "/fwf", label: "Fixed-Width → CSV",  icon: <ArrowLeftRight className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Shared header */}
      <header className="border-b border-border bg-card px-6 py-3">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <BarChart2 className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold text-foreground">CSV Data Profiler</span>
          </div>

          {/* Tool tabs */}
          <nav className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {tabs.map((t) => {
              const active = t.path === "/" ? location === "/" : location.startsWith(t.path);
              return (
                <Link
                  key={t.path}
                  href={base + t.path}
                  className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
                    active
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.icon}
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/fwf" component={FWFConverter} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppLayout />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
