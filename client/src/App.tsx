import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { FilterProvider } from "./contexts/FilterContext";
import DashboardLayout from "./components/DashboardLayout";
import OverallKPI from "./pages/OverallKPI";
import VLRAnalysis from "./pages/VLRAnalysis";
import ANOVAAnalysis from "./pages/ANOVAAnalysis";
import SalesAreaFigures from "./pages/SalesAreaFigures";
import DataUpload from "./pages/DataUpload";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={OverallKPI} />
        <Route path="/overall" component={OverallKPI} />
        <Route path="/vlr-analysis" component={VLRAnalysis} />
        <Route path="/anova" component={ANOVAAnalysis} />
        <Route path="/sales-area" component={SalesAreaFigures} />
        <Route path="/upload" component={DataUpload} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <FilterProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </FilterProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
