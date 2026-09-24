import { useQuery } from "@tanstack/react-query";
import { Link, Route, Routes, useParams } from "react-router-dom";
import { getFlag } from "./api/flags";
import Layout from "./components/Layout";
import FlagsList from "./pages/FlagsList";

function FlagSummary() {
  const { key = "" } = useParams();
  const flagQuery = useQuery({ queryKey: ["flags", key], queryFn: () => getFlag(key), enabled: Boolean(key) });

  if (flagQuery.isPending) return <main className="p-6 text-sm text-neutral-600">Loading flag…</main>;
  if (flagQuery.isError) {
    return (
      <main className="p-6">
        <p className="text-sm text-red-700">{flagQuery.error.message}</p>
        <Link className="mt-4 inline-block text-sm text-emerald-800 underline" to="/">Back to flags</Link>
      </main>
    );
  }

  return (
    <main className="p-6">
      <Link className="text-sm text-emerald-800 underline" to="/">Back to flags</Link>
      <h1 className="mt-5 text-2xl font-semibold text-neutral-900">{flagQuery.data.name}</h1>
      <p className="mt-1 font-mono text-sm text-neutral-600">{flagQuery.data.key}</p>
      <p className="mt-5 text-sm text-neutral-700">{flagQuery.data.description || "No description"}</p>
    </main>
  );
}

function NotFound() {
  return <main className="p-6 text-sm text-neutral-600">Page not found.</main>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<FlagsList />} />
        <Route path="flags/:key" element={<FlagSummary />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
