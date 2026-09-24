import { lazy, Suspense, type ReactNode } from "react";
import { Route, Routes } from "react-router-dom";
import AppShell from "./components/layout/AppShell";
import { LoadingState } from "./components/ui/States";
import FlagsList from "./pages/FlagsList";
import NotFound from "./pages/NotFound";
import Overview from "./pages/Overview";

// Pages with charts or heavier logic load on demand.
const Activity = lazy(() => import("./pages/Activity"));
const Chaos = lazy(() => import("./pages/Chaos"));
const CreateFlag = lazy(() => import("./pages/CreateFlag"));
const Docs = lazy(() => import("./pages/Docs"));
const FlagDetail = lazy(() => import("./pages/FlagDetail"));
const Health = lazy(() => import("./pages/Health"));
const IncidentDetail = lazy(() => import("./pages/IncidentDetail"));
const Incidents = lazy(() => import("./pages/Incidents"));
const LoadGenerator = lazy(() => import("./pages/LoadGenerator"));
const Metrics = lazy(() => import("./pages/Metrics"));
const Planned = lazy(() => import("./pages/Planned"));
const Playground = lazy(() => import("./pages/Playground"));
const Releases = lazy(() => import("./pages/Releases"));
const Rollouts = lazy(() => import("./pages/Rollouts"));
const Services = lazy(() => import("./pages/Services"));
const Settings = lazy(() => import("./pages/Settings"));

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<LoadingState label="Loading page…" />}>{children}</Suspense>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Overview />} />
        <Route path="flags" element={<FlagsList />} />
        <Route path="flags/new" element={<Lazy><CreateFlag /></Lazy>} />
        <Route path="flags/:key" element={<Lazy><FlagDetail /></Lazy>} />
        <Route path="rollouts" element={<Lazy><Rollouts /></Lazy>} />
        <Route path="releases" element={<Lazy><Releases /></Lazy>} />
        <Route path="health" element={<Lazy><Health /></Lazy>} />
        <Route path="metrics" element={<Lazy><Metrics /></Lazy>} />
        <Route path="incidents" element={<Lazy><Incidents /></Lazy>} />
        <Route path="incidents/:id" element={<Lazy><IncidentDetail /></Lazy>} />
        <Route path="activity" element={<Lazy><Activity /></Lazy>} />
        <Route path="playground" element={<Lazy><Playground /></Lazy>} />
        <Route path="load-generator" element={<Lazy><LoadGenerator /></Lazy>} />
        <Route path="chaos" element={<Lazy><Chaos /></Lazy>} />
        <Route path="services" element={<Lazy><Services /></Lazy>} />
        <Route path="settings" element={<Lazy><Settings /></Lazy>} />
        <Route path="docs" element={<Lazy><Docs /></Lazy>} />
        <Route path="environments" element={<Lazy><Planned feature="environments" /></Lazy>} />
        <Route path="experiments" element={<Lazy><Planned feature="experiments" /></Lazy>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
