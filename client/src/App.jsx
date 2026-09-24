import { useEffect, useMemo, useState } from "react";
import Dashboard from "./components/Dashboard";
import DemoApp from "./components/DemoApp";
import {
  demoUsers,
  evaluateFeature,
  getProjectedImpact,
} from "./lib/featureEvaluation";

function App() {
  const [enabled, setEnabled] = useState(true);
  const [rolloutPercentage, setRolloutPercentage] = useState(45);
  const [cohortTarget, setCohortTarget] = useState("Delhi");
  const [activeRing, setActiveRing] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState(demoUsers[1].id);
  const [liveTraffic, setLiveTraffic] = useState(860);
  const [errorSpike, setErrorSpike] = useState(false);

  const selectedUser =
    demoUsers.find((user) => user.id === selectedUserId) ?? demoUsers[0];

  const config = useMemo(
    () => ({
      enabled,
      rolloutPercentage,
      cohortTarget,
      activeRing,
    }),
    [activeRing, cohortTarget, enabled, rolloutPercentage],
  );

  const evaluation = useMemo(
    () => evaluateFeature(selectedUser, config),
    [config, selectedUser],
  );

  const impact = useMemo(
    () => getProjectedImpact(demoUsers, config, liveTraffic),
    [config, liveTraffic],
  );

  useEffect(() => {
    const interval = window.setInterval(() => {
      setLiveTraffic((current) => {
        const next = current + Math.round(Math.random() * 80 - 34);
        return Math.min(1200, Math.max(520, next));
      });
    }, 1400);

    return () => window.clearInterval(interval);
  }, []);

  const simulateErrorSpike = () => {
    setErrorSpike(true);
    setEnabled(false);
  };

  const autoRollback = () => {
    setErrorSpike(false);
    setEnabled(false);
    setRolloutPercentage(0);
  };

  const updateEnabled = (nextEnabled) => {
    setEnabled(nextEnabled);
    if (nextEnabled) {
      setErrorSpike(false);
      setRolloutPercentage((current) => Math.max(current, 10));
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(135deg,rgba(17,24,39,0.95),rgba(3,7,18,1)),radial-gradient(circle_at_18%_12%,rgba(34,211,238,0.18),transparent_32%),radial-gradient(circle_at_82%_18%,rgba(16,185,129,0.14),transparent_28%),radial-gradient(circle_at_50%_100%,rgba(244,63,94,0.10),transparent_34%)]" />
      <div className="mx-auto grid min-h-screen max-w-[1800px] gap-5 p-4 lg:grid-cols-[440px_minmax(0,1fr)] lg:p-6">
        <Dashboard
          enabled={enabled}
          setEnabled={updateEnabled}
          rolloutPercentage={rolloutPercentage}
          setRolloutPercentage={setRolloutPercentage}
          cohortTarget={cohortTarget}
          setCohortTarget={setCohortTarget}
          activeRing={activeRing}
          setActiveRing={setActiveRing}
          impact={impact}
          liveTraffic={liveTraffic}
          errorSpike={errorSpike}
          onSimulateErrorSpike={simulateErrorSpike}
          onAutoRollback={autoRollback}
        />
        <DemoApp
          users={demoUsers}
          selectedUser={selectedUser}
          setSelectedUserId={setSelectedUserId}
          evaluation={evaluation}
          config={config}
          impact={impact}
        />
      </div>
    </div>
  );
}

export default App;
