import { useEffect, useMemo, useState } from "react";
import ControlPanel from "./ControlPanel";
import DemoApp from "./DemoApp";
import {
  defaultFlagConfig,
  evaluateFeature,
  previewUsers,
  projectBlastRadius,
} from "../services/featureService";

function Dashboard() {
  const [config, setConfig] = useState(defaultFlagConfig);
  const [selectedUserId, setSelectedUserId] = useState(previewUsers[0].id);
  const [liveTraffic, setLiveTraffic] = useState(3000);
  const [errorSpike, setErrorSpike] = useState(false);
  const [theme, setTheme] = useState(() => {
    const stored = window.localStorage.getItem("canary-theme");
    return stored === "light" ? "light" : "dark";
  });

  const selectedUser =
    previewUsers.find((user) => user.id === selectedUserId) ?? previewUsers[0];

  const decision = useMemo(
    () => evaluateFeature(selectedUser, config),
    [config, selectedUser],
  );

  const blastRadius = useMemo(
    () => projectBlastRadius(previewUsers, config, liveTraffic),
    [config, liveTraffic],
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLiveTraffic((current) => {
        const next = current + Math.round(Math.random() * 70 - 30);
        return Math.min(10000, Math.max(1000, next));
      });
    }, 1600);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("canary-theme", theme);
  }, [theme]);

  const updateConfig = (patch) => {
    setConfig((current) => ({ ...current, ...patch }));
  };

  const handleToggleFeature = (enabled) => {
    setErrorSpike(false);
    updateConfig({ enabled });
  };

  const handleSimulateErrorSpike = () => {
    setErrorSpike(true);
    updateConfig({ enabled: false });
  };

  const handleAutoRollback = () => {
    setErrorSpike(false);
    updateConfig({ enabled: false, rollout: 0 });
  };

  return (
    <div className={`min-h-screen bg-[rgb(var(--page))] text-[rgb(var(--text))] theme-${theme}`}>
      <div className="mx-auto grid min-h-screen max-w-[1800px] gap-4 p-4 lg:grid-cols-[420px_minmax(0,1fr)] lg:p-5">
        <ControlPanel
          config={config}
          theme={theme}
          onThemeChange={setTheme}
          onToggleFeature={handleToggleFeature}
          onRolloutChange={(rollout) => updateConfig({ rollout })}
          onCityChange={(city) => updateConfig({ city })}
          onUserTypeChange={(type) => updateConfig({ type })}
          onRingChange={(ring) => updateConfig({ ring })}
          onTrafficChange={setLiveTraffic}
          onSimulateErrorSpike={handleSimulateErrorSpike}
          onAutoRollback={handleAutoRollback}
          errorSpike={errorSpike}
          liveTraffic={liveTraffic}
          blastRadius={blastRadius}
        />
        <DemoApp
          users={previewUsers}
          selectedUser={selectedUser}
          onUserChange={setSelectedUserId}
          decision={decision}
          config={config}
          blastRadius={blastRadius}
        />
      </div>
    </div>
  );
}

export default Dashboard;
