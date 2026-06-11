import { useEffect, useState } from "react";
import { loadAppData, type AppData } from "./data";
import type { ColorMode } from "./types";
import MapView from "./components/MapView";
import SummaryBar from "./components/SummaryBar";
import ControlPanel from "./components/ControlPanel";
import InfoPanel from "./components/InfoPanel";
import SankeyView from "./components/SankeyView";
import { fmt, pct } from "./format";

type Tab = "map" | "sankey";

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("map");
  const [colorMode, setColorMode] = useState<ColorMode>({ kind: "winner" });
  const [selected, setSelected] = useState<string | null>(null);
  const [showMethod, setShowMethod] = useState(false);

  useEffect(() => {
    loadAppData().then(setData).catch((e) => setError(String(e)));
  }, []);

  if (error) return <div className="loading">שגיאה בטעינת הנתונים: {error}</div>;
  if (!data) return <div className="loading"><div className="spinner" />טוען נתונים…</div>;

  const k25 = data.resultsMeta.knessets["25"];
  const selectedSettlement = selected ? data.settlements[selected] : null;

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <h1>מפת הבחירות לכנסת ה-25</h1>
          <p className="subtitle">תוצאות לפי יישוב · נתונים פתוחים מוועדת הבחירות המרכזית והלשכה המרכזית לסטטיסטיקה</p>
        </div>
        <nav className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === "map"} className={tab === "map" ? "tab active" : "tab"} onClick={() => setTab("map")}>מפת תוצאות</button>
          <button role="tab" aria-selected={tab === "sankey"} className={tab === "sankey" ? "tab active" : "tab"} onClick={() => setTab("sankey")}>קולות נודדים</button>
        </nav>
      </header>

      <SummaryBar national={k25.national} totalValid={k25.totalValid} parties={data.parties} />

      {tab === "map" ? (
        <main className="stage">
          <MapView
            parties={data.parties}
            settlements={data.settlements}
            points={data.points}
            colorMode={colorMode}
            selected={selected}
            onSelect={setSelected}
          />
          <ControlPanel parties={data.parties} national={k25.national} colorMode={colorMode} onChange={setColorMode} />
          {selectedSettlement && (
            <InfoPanel settlement={selectedSettlement} parties={data.parties} onClose={() => setSelected(null)} />
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
      ) : (
        <main className="stage sankey-stage">
          <div className="sankey-head">
            <h2>מעבר קולות: מכנסת 24 (2021) לכנסת 25 (2022)</h2>
            <p className="disclaimer">
              ⚠️ <b>אומדן בלבד.</b> אי אפשר לדעת כיצד הצביע אדם יחיד. התרשים מציג <b>זרימת שינוי נטו</b> — בכל יישוב
              נמדד אילו מפלגות עלו ואילו ירדו, וההפרש יוחס ביניהן. זהו אומדן סטטיסטי מצרפי, חשוף ל<b>כשל אקולוגי</b>,
              ואינו עוקב אחר מצביעים בודדים.
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
