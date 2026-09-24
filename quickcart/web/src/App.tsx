import { Link, Route, Routes } from "react-router-dom";

function StoreHome() {
  return <main className="min-h-screen p-6">QuickCart</main>;
}

function NotFound() {
  return (
    <main className="min-h-screen p-6">
      <p>Page not found.</p>
      <Link className="underline" to="/">Return to store</Link>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<StoreHome />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
