import { useCallback, useEffect, useState } from "react";
import { loadAppData, loadCityDrill, AuthRequiredError, type AppData, type FeatureCollection } from "./data";
import type { ColorMode } from "./types";
import MapView, { type Theme, type MapViewMode } from "./components/MapView";
import SummaryBar from "./components/SummaryBar";
import ControlPanel from "./components/ControlPanel";
import InfoPanel from "./components/InfoPanel";
import SankeyView from "./components/SankeyView";
import CoalitionBuilder from "./components/CoalitionBuilder";
import DemographicsView from "./components/DemographicsView";
import LoginModal from "./components/LoginModal";
import { fmt, pct } from "./format";

type Tab = "map" | "sankey" | "coalition" | "demo";

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("map");
  const [colorMode, setColorMode] = useState<ColorMode>({ kind: "winner" });
  const [year, setYear] = useState<24 | 25>(25);
  const [mapViewMode, setMapViewMode] = useState<MapViewMode>("choropleth");
  const [selected, setSelected] = useState<string | null>(null);
  const [showMethod, setShowMethod] = useState(false);
  const [drillCity, setDrillCity] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || saved === "light") return saved;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [needAuth, setNeedAuth] = useState(false);
  const [authedFlag, setAuthedFlag] = useState(() => !!localStorage.getItem("app_authed"));
  const [drillData, setDrillData] = useState<FeatureCollection | null>(null);

  const load = useCallback(() => {
    loadAppData()
      .then((d) => { setData(d); setNeedAuth(false); setError(null); })
      .catch((e) => { if (e instanceof AuthRequiredError) setNeedAuth(true); else setError(String(e)); });
  }, []);

  useEffect(() => {
    load();
    // Shareable deep-link to the city drill-down, e.g. ?drill=5000
    const drill = new URLSearchParams(window.location.search).get("drill");
    if (drill) setDrillCity(drill);
  }, [load]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Lazy-load the city drill-down GeoJSON (through the auth cookie) on first use.
  useEffect(() => {
    if (drillCity && !drillData) loadCityDrill().then(setDrillData).catch(() => {});
  }, [drillCity, drillData]);

  const onAuthSuccess = () => { localStorage.setItem("app_authed", "1"); setAuthedFlag(true); load(); };
  const logout = async () => {
    await fetch("/api/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem("app_authed");
    setAuthedFlag(false);
    setData(null);
    setNeedAuth(true);
  };

  if (error) return <div className="loading">שגיאה בטעינת הנתונים: {error}</div>;
  if (needAuth) return <LoginModal onSuccess={onAuthSuccess} />;
  if (!data) return <div className="loading"><div className="spinner" />טוען נתונים…</div>;

  const k25 = data.resultsMeta.knessets["25"];
  const activeSettlements = year === 25 ? data.settlements : data.settlements24;
  const selectedSettlement = selected ? activeSettlements[selected] : null;
  const drillSemel = data.cityDrill ? String(data.cityDrill.semel) : null;

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <h1>מפת הבחירות לכנסת ה-25</h1>
          <p className="subtitle">תוצאות לפי יישוב · נתונים פתוחים מוועדת הבחירות המרכזית והלשכה המרכזית לסטטיסטיקה</p>
        </div>
        <div className="header-right">
          <nav className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === "map"} className={tab === "map" ? "tab active" : "tab"} onClick={() => setTab("map")}>מפת תוצאות</button>
            <button role="tab" aria-selected={tab === "coalition"} className={tab === "coalition" ? "tab active" : "tab"} onClick={() => { setDrillCity(null); setTab("coalition"); }}>בנה ממשלה</button>
            <button role="tab" aria-selected={tab === "demo"} className={tab === "demo" ? "tab active" : "tab"} onClick={() => { setDrillCity(null); setTab("demo"); }}>דמוגרפיה</button>
            <button role="tab" aria-selected={tab === "sankey"} className={tab === "sankey" ? "tab active" : "tab"} onClick={() => { setDrillCity(null); setTab("sankey"); }}>קולות נודדים</button>
          </nav>
          <button
            className="theme-toggle"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={theme === "dark" ? "עבור למצב בהיר" : "עבור למצב כהה"}
            title={theme === "dark" ? "מצב בהיר" : "מצב כהה"}
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          {authedFlag && (
            <button className="logout-btn" onClick={logout} title="התנתקות">יציאה</button>
          )}
        </div>
      </header>

      <SummaryBar national={k25.national} totalValid={k25.totalValid} parties={data.parties} />

      {tab === "map" ? (
        <main className="stage">
          <MapView
            parties={data.parties}
            settlements={activeSettlements}
            points={data.points}
            colorMode={colorMode}
            selected={selected}
            onSelect={setSelected}
            settlementsGeo={data.settlementsGeo}
            pointsGeo={data.pointsGeo}
            allPointsGeo={data.allPointsGeo}
            drillData={drillCity ? drillData : null}
            theme={theme}
            year={year}
            mapView={mapViewMode}
          />
          <ControlPanel parties={data.parties} national={k25.national} colorMode={colorMode} onChange={setColorMode} year={year} onYear={setYear} mapView={mapViewMode} onMapView={setMapViewMode} />
          {drillCity && data.cityDrill && (
            <div className="drill-banner">
              <div>
                <b>{data.cityDrill.city} · רזולוציית שכונה</b>
                <span className="drill-banner-sub">אזורים סטטיסטיים (הלמ"ס) · אומדן מבוסס כתובות קלפי · שכבת פרימיום בהמתנה לאישור רישוי</span>
              </div>
              <button className="drill-back" onClick={() => setDrillCity(null)}>→ חזרה למפה הארצית</button>
            </div>
          )}
          {!drillCity && selectedSettlement && (
            <InfoPanel
              settlement={selectedSettlement}
              parties={data.parties}
              year={year}
              onClose={() => setSelected(null)}
              drillAvailable={selected === drillSemel && year === 25}
              onDrill={() => { setDrillCity(selected); setSelected(null); }}
            />
          )}
          <button className="method-toggle" onClick={() => setShowMethod((v) => !v)}>
            {showMethod ? "סגור" : "איך זה עובד?"}
          </button>
          {showMethod && (
            <div className="panel method-panel">
              <h3>איך נבנתה המפה</h3>
              <p>
                לכל יישוב מחושבת המפלגה המנצחת ואחוז ההצבעה מתוך תוצאות האמת של ועדת הבחירות (לפי קלפי, מצרף ליישוב).
                גבולות היישובים מגיעים משכבת הגבולות הרשמית של הלמ"ס. יישובים ללא פוליגון (בעיקר ביו"ש) מוצגים כעיגול
                בגודל יחסי למספר הקולות.
              </p>
              <p className="muted">
                כיסוי: {pct(data.geoMeta.coverageByValidVotes_rendered, 1)} מהקולות הכשרים מוצגים על המפה.
                היתר — בעיקר {fmt(data.geoMeta.unmappableValidVotes)} קולות ב"מעטפות חיצוניות" (חיילים, אסירים, נציגויות) —
                חסרי מיקום גאוגרפי מעצם טבעם.
              </p>
              <p className="muted">שימו לב: צביעה לפי שטח מדגישה יישובים גדולים בשטח; לחיצה על יישוב מציגה תמיד את מספרי הקולות המלאים.</p>
            </div>
          )}
        </main>
      ) : tab === "coalition" ? (
        <main className="stage coalition-stage">
          <CoalitionBuilder seats={data.seats} />
        </main>
      ) : tab === "demo" ? (
        <main className="stage coalition-stage">
          <DemographicsView socio={data.socio} />
        </main>
      ) : (
        <main className="stage sankey-stage">
          <div className="sankey-head">
            <h2>מעבר קולות: מכנסת 24 (2021) לכנסת 25 (2022)</h2>
            <p className="disclaimer">
              ⚠️ <b>אומדן בלבד.</b> אי אפשר לדעת כיצד הצביע אדם יחיד. התרשים מציג <b>אך ורק את השינוי נטו</b> בין המערכות —
              בכל יישוב נמדד אילו מפלגות עלו ואילו ירדו, וההפרש יוחס ביניהן. מפלגה ש<b>שמרה</b> על מצביעיה אינה מופיעה כזרם
              (אין כאן זרמי "נאמנות"). זהו אומדן סטטיסטי מצרפי, חשוף ל<b>כשל אקולוגי</b>, ואינו עוקב אחר מצביעים בודדים.
            </p>
          </div>
          <SankeyView data={data.sankey} />
          <p className="muted sankey-foot">מוצגות זרימות של {fmt(data.sankey.minLinkShown)}+ קולות. סך הזרימה (השינוי) המוערך: {fmt(data.sankey.totalFlow)} קולות.</p>
        </main>
      )}

      <footer className="app-footer">
        <span>מקורות: הלשכה המרכזית לסטטיסטיקה · ועדת הבחירות המרכזית לכנסת · נתונים פתוחים מ-data.gov.il</span>
        <span className="footer-note">דמו · נבנה מנתונים פתוחים ומורשים בלבד</span>
      </footer>
    </div>
  );
}
