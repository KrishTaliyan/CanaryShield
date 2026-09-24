import { lazy, Suspense } from "react";
import { Link, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import CreateFlag from "./pages/CreateFlag";
import FlagsList from "./pages/FlagsList";
import Incidents from "./pages/Incidents";
import Playground from "./pages/Playground";

// The flag page carries the charts library, so it loads on demand.
const FlagDetail = lazy(() => import("./pages/FlagDetail"));

function PageLoading() {
  return <main className="mx-auto max-w-6xl p-5 text-sm text-neutral-600 md:p-8" aria-busy="true">Loading…</main>;
}

function NotFound() {
  return (
    <main className="mx-auto max-w-6xl p-5 md:p-8">
      <h1 className="text-2xl font-semibold text-neutral-950">Page not found</h1>
      <Link className="mt-3 inline-flex text-sm font-medium text-emerald-800 hover:underline" to="/">Back to flags</Link>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<FlagsList />} />
        <Route path="flags/new" element={<CreateFlag />} />
        <Route path="flags/:key" element={<Suspense fallback={<PageLoading />}><FlagDetail /></Suspense>} />
        <Route path="incidents" element={<Incidents />} />
        <Route path="playground" element={<Playground />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
