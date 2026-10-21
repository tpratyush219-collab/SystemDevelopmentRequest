import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  getSimulationHistory,
  saveSimulationRun,
  type SimulationOutcome,
} from "./lib/simulation-api";

type IconName =
  | "activity"
  | "alert"
  | "arrow"
  | "check"
  | "database"
  | "gateway"
  | "lock"
  | "play"
  | "refresh"
  | "shield"
  | "stop"
  | "user";

type ServiceStatus = "healthy" | "warning" | "danger" | "protected";

type Service = {
  id: string;
  short: string;
  name: string;
  detail: string;
  icon: IconName;
  status: ServiceStatus;
};

const timeline = [
  { time: "T+0s", title: "Database down", detail: "Primary database stops responding" },
  { time: "T+2s", title: "Auth fails", detail: "Identity checks begin to time out" },
  { time: "T+5s", title: "Gateway overload", detail: "Pending requests exhaust the pool" },
  { time: "T+8s", title: "Backup swamped", detail: "Redirected traffic overloads replica" },
  { time: "T+12s", title: "Users impacted", detail: "Errors reach every active session" },
];

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  const paths: Record<IconName, ReactNode> = {
    activity: <path d="M3 12h4l2.2-6 4.2 12 2.2-6H21" />,
    alert: (
      <>
        <path d="M10.3 3.8 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z" />
        <path d="M12 9v4M12 17h.01" />
      </>
    ),
    arrow: <path d="m9 18 6-6-6-6" />,
    check: <path d="m5 12 4 4L19 6" />,
    database: (
      <>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
      </>
    ),
    gateway: (
      <>
        <path d="M4 5h16v14H4zM4 9h16" />
        <path d="M8 14h3M15 14h1" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    play: <path d="m8 5 11 7-11 7Z" />,
    refresh: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M6.1 9a7 7 0 0 1 11.5-2.6L20 12M4 12l2.4 5.6A7 7 0 0 0 17.9 15" />
      </>
    ),
    shield: <path d="M12 3 4.5 6v5.5c0 4.7 3.2 7.8 7.5 9.5 4.3-1.7 7.5-4.8 7.5-9.5V6L12 3Zm-3 9 2 2 4-4" />,
    stop: <rect x="6" y="6" width="12" height="12" rx="1" />,
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
      </>
    ),
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function Button({
  children,
  icon,
  variant = "secondary",
  onClick,
  disabled,
}: {
  children: ReactNode;
  icon: IconName;
  variant?: "primary" | "secondary" | "danger";
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button className={`control control--${variant}`} onClick={onClick} disabled={disabled}>
      <Icon name={icon} size={16} />
      <span>{children}</span>
    </button>
  );
}

function StatusPill({ status }: { status: ServiceStatus }) {
  const labels: Record<ServiceStatus, string> = {
    healthy: "Healthy",
    warning: "Slow",
    danger: "Down",
    protected: "Protected",
  };
  return (
    <span className={`status status--${status}`}>
      <i />
      {labels[status]}
    </span>
  );
}

function ServiceCard({ service, isLast }: { service: Service; isLast: boolean }) {
  return (
    <div className="service-wrap">
      <article className={`service service--${service.status}`}>
        <div className="service__icon">
          <Icon name={service.icon} size={21} />
        </div>
        <div className="service__copy">
          <span className="service__short">{service.short}</span>
          <strong>{service.name}</strong>
          <small>{service.detail}</small>
        </div>
        <StatusPill status={service.status} />
      </article>
      {!isLast && (
        <div className={`connector connector--${service.status}`}>
          <span />
          <Icon name="arrow" size={15} />
        </div>
      )}
    </div>
  );
}

function App() {
  const [stage, setStage] = useState(0);
  const [running, setRunning] = useState(false);
  const [protectedMode, setProtectedMode] = useState(false);
  const [syncState, setSyncState] = useState<"checking" | "ready" | "saving" | "offline">("checking");
  const [savedRunCount, setSavedRunCount] = useState(0);
  const currentRun = useRef<{ id: string; startedAt: string; saved: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    getSimulationHistory()
      .then(({ total }) => {
        if (!active) return;
        setSavedRunCount(total);
        setSyncState("ready");
      })
      .catch(() => {
        if (active) setSyncState("offline");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    if (stage >= 5) {
      setRunning(false);
      return;
    }
    const timer = window.setTimeout(() => setStage((current) => current + 1), 1400);
    return () => window.clearTimeout(timer);
  }, [running, stage]);

  const services = useMemo<Service[]>(() => {
    if (protectedMode) {
      return [
        { id: "user", short: "01", name: "User", detail: "Requests served", icon: "user", status: "healthy" },
        { id: "gateway", short: "02", name: "API Gateway", detail: "Traffic balanced", icon: "gateway", status: "protected" },
        { id: "auth", short: "03", name: "Authentication", detail: "Identity verified", icon: "lock", status: "healthy" },
        { id: "database", short: "04", name: "Database", detail: "Primary isolated", icon: "database", status: "danger" },
        { id: "backup", short: "05", name: "Backup", detail: "Replica active", icon: "shield", status: "protected" },
      ];
    }
    return [
      { id: "user", short: "01", name: "User", detail: stage >= 5 ? "Requests failing" : "Sending requests", icon: "user", status: stage >= 5 ? "danger" : "healthy" },
      { id: "gateway", short: "02", name: "API Gateway", detail: stage >= 3 ? "Pool exhausted" : "Routing traffic", icon: "gateway", status: stage >= 3 ? (stage >= 5 ? "danger" : "warning") : "healthy" },
      { id: "auth", short: "03", name: "Authentication", detail: stage >= 2 ? "Verification blocked" : "Verifying identity", icon: "lock", status: stage >= 2 ? "danger" : "healthy" },
      { id: "database", short: "04", name: "Database", detail: stage >= 1 ? "Not responding" : "Storing data", icon: "database", status: stage >= 1 ? "danger" : "healthy" },
      { id: "backup", short: "05", name: "Backup", detail: stage >= 4 ? "Replica overloaded" : stage >= 1 ? "Replication stalled" : "Keeping copies", icon: "shield", status: stage >= 4 ? "danger" : stage >= 1 ? "warning" : "healthy" },
    ];
  }, [stage, protectedMode]);

  const metrics = protectedMode
    ? [
        { label: "Failed req.", value: "6", delta: "Contained", tone: "good" },
        { label: "Response", value: "180", unit: "ms", delta: "Stable", tone: "good" },
        { label: "Success rate", value: "99.5", unit: "%", delta: "Failover", tone: "good" },
        { label: "Active faults", value: "1", delta: "Isolated", tone: "warn" },
      ]
    : [
        { label: "Failed req.", value: Math.round(stage ** 2 * 73.68).toLocaleString(), delta: stage ? `+${Math.max(14, stage * 18)}%` : "—", tone: stage ? "bad" : "muted" },
        { label: "Response", value: stage ? (0.4 + stage * 0.9).toFixed(1) : "0.1", unit: "s", delta: stage > 2 ? "Critical" : "Normal", tone: stage > 2 ? "bad" : "muted" },
        { label: "Success rate", value: stage ? Math.max(0, 100 - stage * 13.8).toFixed(0) : "99.9", unit: "%", delta: stage ? `-${stage * 13}%` : "Stable", tone: stage ? "bad" : "good" },
        { label: "Active faults", value: String(stage > 0 ? Math.min(stage, 4) : 0), delta: stage ? "Detected" : "None", tone: stage ? "warn" : "good" },
      ];

  const beginRun = () => {
    currentRun.current = {
      id: crypto.randomUUID(),
      startedAt: new Date().toISOString(),
      saved: false,
    };
  };

  const completeRun = async (outcome: SimulationOutcome) => {
    const run = currentRun.current;
    if (!run || run.saved) return;
    run.saved = true;
    setSyncState("saving");

    const recovered = outcome === "recovered";
    try {
      await saveSimulationRun({
        id: run.id,
        startedAt: run.startedAt,
        completedAt: new Date().toISOString(),
        outcome,
        stagesReached: recovered ? Math.max(stage, 1) : 5,
        elapsedSeconds: recovered ? 20 : 12,
        finalMetrics: recovered
          ? {
              failedRequests: 6,
              responseTimeMs: 180,
              successRate: 99.5,
              activeFaults: 1,
            }
          : {
              failedRequests: 1842,
              responseTimeMs: 4600,
              successRate: 31,
              activeFaults: 4,
            },
      });
      setSavedRunCount((count) => count + 1);
      setSyncState("ready");
    } catch {
      run.saved = false;
      setSyncState("offline");
    }
  };

  useEffect(() => {
    if (stage === 5 && !protectedMode) void completeRun("outage");
  }, [stage, protectedMode]);

  const start = () => {
    beginRun();
    setProtectedMode(false);
    setStage(0);
    setRunning(true);
  };
  const inject = () => {
    beginRun();
    setProtectedMode(false);
    setStage(1);
    setRunning(true);
  };
  const reset = () => {
    setRunning(false);
    setProtectedMode(false);
    setStage(0);
  };
  const recover = () => {
    setRunning(false);
    setStage(5);
    setProtectedMode(true);
    void completeRun("recovered");
  };

  const systemLabel = protectedMode
    ? "Failure contained"
    : stage === 0
      ? "All systems operational"
      : stage < 5
        ? "Incident in progress"
        : "System-wide outage";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark"><Icon name="activity" size={18} /></span>
          <span className="brand__name">ORIGIN</span>
          <span className="brand__divider" />
          <span className="brand__product">System Resilience Lab</span>
        </div>
        <div className="topbar__meta">
          <span className={`live-dot live-dot--${syncState}`} />
          {syncState === "checking"
            ? "Connecting history"
            : syncState === "saving"
              ? "Saving run"
              : syncState === "offline"
                ? "Local mode"
                : `${savedRunCount} cloud ${savedRunCount === 1 ? "run" : "runs"}`}
          <span className="avatar">PE</span>
        </div>
      </header>

      <div className="dashboard">
        <section className="hero">
          <div>
            <span className="eyebrow">Interactive simulation / 01</span>
            <h1>What if the system breaks?</h1>
            <p>Inject a controlled failure. Watch it propagate through every dependency. Then stop the collapse.</p>
          </div>
          <div className="system-state">
            <span className={`system-state__icon system-state__icon--${protectedMode ? "good" : stage ? "bad" : "good"}`}>
              <Icon name={protectedMode ? "shield" : stage ? "alert" : "check"} size={20} />
            </span>
            <div>
              <small>System state</small>
              <strong>{systemLabel}</strong>
            </div>
          </div>
        </section>

        <section className="control-panel" aria-label="Simulation controls">
          <div className="controls">
            <Button icon={running ? "stop" : "play"} variant="primary" onClick={() => running ? setRunning(false) : start()}>
              {running ? "Pause simulation" : "Start simulation"}
            </Button>
            <Button icon="alert" variant="danger" onClick={inject}>Inject failure</Button>
            <Button icon="shield" onClick={recover} disabled={stage === 0}>Recover system</Button>
            <Button icon="refresh" onClick={reset}>Reset</Button>
          </div>
          <div className="clock">
            <span>Elapsed</span>
            <strong>{protectedMode ? "T+20s" : stage === 0 ? "—" : timeline[Math.min(stage - 1, 4)].time}</strong>
          </div>
        </section>

        <section className="network panel">
          <div className="panel__heading">
            <div>
              <span className="eyebrow">Live topology</span>
              <h2>Service network</h2>
            </div>
            <div className="legend">
              <span><i className="dot dot--healthy" />Healthy</span>
              <span><i className="dot dot--warning" />Degraded</span>
              <span><i className="dot dot--danger" />Failure</span>
            </div>
          </div>
          <div className="network__flow">
            {services.map((service, index) => (
              <ServiceCard key={service.id} service={service} isLast={index === services.length - 1} />
            ))}
          </div>
          {stage > 0 && (
            <div className={`incident-strip ${protectedMode ? "incident-strip--safe" : ""}`}>
              <Icon name={protectedMode ? "shield" : "alert"} size={17} />
              <strong>{protectedMode ? "Circuit breaker open" : timeline[Math.min(stage - 1, 4)].title}</strong>
              <span>{protectedMode ? "Primary database isolated · Requests rerouted to healthy replica" : timeline[Math.min(stage - 1, 4)].detail}</span>
            </div>
          )}
        </section>

        <section className="metrics">
          {metrics.map((metric) => (
            <article className="metric panel" key={metric.label}>
              <span className="metric__label">{metric.label}</span>
              <div className="metric__value">{metric.value}<small>{metric.unit}</small></div>
              <span className={`metric__delta metric__delta--${metric.tone}`}>{metric.delta}</span>
              <div className={`spark spark--${metric.tone}`}>
                {[3, 4, 3, 5, 4, 7, 5, 8, 11, 9, 14, 17].map((height, index) => (
                  <i key={index} style={{ height: `${Math.min(100, height * (stage || 1) * 1.1)}%` }} />
                ))}
              </div>
            </article>
          ))}
        </section>

        <section className="timeline-panel panel">
          <div className="panel__heading">
            <div>
              <span className="eyebrow">Incident trace</span>
              <h2>Failure propagation timeline</h2>
            </div>
            <span className="event-count">{stage ? `${Math.min(stage, 5)} / 5 events` : "Waiting for simulation"}</span>
          </div>
          <div className="timeline">
            {timeline.map((item, index) => {
              const active = stage > index;
              const current = stage === index + 1 && running;
              return (
                <article className={`timeline__event ${active ? "timeline__event--active" : ""} ${current ? "timeline__event--current" : ""}`} key={item.time}>
                  <div className="timeline__rail">
                    <span>{active ? <Icon name="check" size={13} /> : index + 1}</span>
                  </div>
                  <time>{item.time}</time>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </article>
              );
            })}
          </div>
        </section>

        <footer>
          <span>THE PROMPT ENGINEERS</span>
          <span>Controlled fault simulation · Illustrative data</span>
        </footer>
      </div>
    </main>
  );
}

export default App;
