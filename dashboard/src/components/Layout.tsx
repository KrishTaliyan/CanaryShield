import { Link, Outlet, useLocation } from "react-router-dom";

const navigation = [
  { label: "Flags", href: "/" },
  { label: "Create flag", href: "/flags/new" },
  { label: "Incidents", href: "/incidents" },
  { label: "Playground", href: "/playground" },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 md:flex">
      <aside className="border-b border-neutral-200 bg-white md:min-h-screen md:w-56 md:shrink-0 md:border-b-0 md:border-r">
        <div className="flex h-14 items-center border-b border-neutral-200 px-5">
          <Link to="/" className="text-base font-semibold text-neutral-900">FlagGuard</Link>
        </div>
        <nav aria-label="Main navigation" className="flex gap-1 overflow-x-auto p-3 md:flex-col">
          {navigation.map((item) => {
            const active = item.href === "/"
              ? location.pathname === "/" || (location.pathname.startsWith("/flags/") && location.pathname !== "/flags/new")
              : location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                aria-current={active ? "page" : undefined}
                className={`whitespace-nowrap rounded px-3 py-2 text-sm font-medium ${
                  active ? "bg-emerald-50 text-emerald-900" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
