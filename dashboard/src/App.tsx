import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import CreateFlag from "./pages/CreateFlag";
import FlagDetail from "./pages/FlagDetail";
import FlagsList from "./pages/FlagsList";
import Playground from "./pages/Playground";

function NotFound() {
  return <main className="p-6 text-sm text-neutral-600">Page not found.</main>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<FlagsList />} />
        <Route path="flags/new" element={<CreateFlag />} />
        <Route path="flags/:key" element={<FlagDetail />} />
        <Route path="playground" element={<Playground />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
