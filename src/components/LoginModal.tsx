import { useState } from "react";

/** Full-screen access-code gate. On a correct code the Worker sets a 30-day cookie. */
export default function LoginModal({ onSuccess }: { onSuccess: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(false);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (res.ok) onSuccess();
      else setErr(true);
    } catch {
      setErr(true);
    }
    setBusy(false);
  }

  return (
    <div className="login-overlay">
      <form className="login-card" onSubmit={submit}>
        <div className="login-mark">🗳️</div>
        <h1 className="login-title">מפות הבחירות לכנסת</h1>
        <p className="login-sub">הדגמה מוגנת · הזינו קוד גישה כדי להמשיך</p>
        <input
          className="login-input"
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="קוד גישה"
          autoFocus
          autoComplete="off"
        />
        {err && <p className="login-err">קוד שגוי. נסו שוב.</p>}
        <button className="login-btn" type="submit" disabled={busy || !code}>
          {busy ? "בודק…" : "כניסה"}
        </button>
        <p className="login-note">הגישה תישמר ל-30 יום במכשיר זה.</p>
      </form>
    </div>
  );
}
