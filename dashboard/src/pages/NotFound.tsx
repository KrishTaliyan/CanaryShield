import { Compass, LayoutDashboard, Search } from "lucide-react";
import { useLocation } from "react-router-dom";
import { ButtonLink } from "../components/ui/Button";
import { EmptyState } from "../components/ui/States";

export default function NotFound() {
  const { pathname } = useLocation();
  return (
    <EmptyState
      className="mt-16"
      icon={<Compass size={24} />}
      title="This page does not exist"
      description={<>Nothing lives at <code className="font-mono text-ink">{pathname}</code>. Press Ctrl K to search, or go back to the overview.</>}
      action={
        <div className="flex flex-wrap justify-center gap-2">
          <ButtonLink to="/" variant="primary" icon={<LayoutDashboard size={16} />}>Overview</ButtonLink>
          <ButtonLink to="/flags" icon={<Search size={16} />}>Feature flags</ButtonLink>
        </div>
      }
    />
  );
}
