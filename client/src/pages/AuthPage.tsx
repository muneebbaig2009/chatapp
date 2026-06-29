import { useState } from "react";
import { api } from "../api/client";
import { useAppDispatch } from "../store/hooks";
import { setCredentials } from "../store/slices/authSlice";

export function AuthPage() {
  const dispatch = useAppDispatch();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ email: "", username: "", displayName: "", password: "" });
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setError("");
    setLoading(true);
    try {
      const endpoint = mode === "login" ? "/auth/login" : "/auth/register";
      const payload =
        mode === "login"
          ? { email: form.email, password: form.password, rememberMe }
          : { ...form, rememberMe };
      const { data } = await api.post(endpoint, payload);
      dispatch(setCredentials({ user: data.user, accessToken: data.accessToken }));
    } catch (e: any) {
      setError(e.response?.data?.error ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img src="/logo.png" alt="HAMNAVA" className="inline-flex w-14 h-14 rounded-2xl mb-3 object-contain" />
          <h1 className="text-2xl font-semibold">HAMNAVA</h1>
          <p className="text-muted text-sm mt-1">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </p>
        </div>

        <div className="space-y-3">
          {mode === "register" && (
            <>
              <Field label="Display name" value={form.displayName} onChange={(v) => update("displayName", v)} />
              <Field label="Username" value={form.username} onChange={(v) => update("username", v)} />
            </>
          )}
          <Field label="Email" type="email" value={form.email} onChange={(v) => update("email", v)} />
          <Field label="Password" type="password" value={form.password} onChange={(v) => update("password", v)} />

          <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="rounded border-surface bg-panel accent-accent"
            />
            Keep me signed in
          </label>

          {error && <p className="text-sm text-danger">{error}</p>}

          <button
            onClick={submit}
            disabled={loading}
            className="w-full bg-accent hover:bg-accent-dim disabled:opacity-50 text-accent-fg font-semibold rounded-lg py-2.5 transition"
          >
            {loading ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}
          </button>
        </div>

        <p className="text-center text-sm text-muted mt-6">
          {mode === "login" ? "No account yet?" : "Already have an account?"}{" "}
          <button
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
            className="text-accent font-medium hover:underline"
          >
            {mode === "login" ? "Sign up" : "Log in"}
          </button>
        </p>
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block">
      <span className="text-xs text-muted mb-1 block">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-panel border border-surface rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/60"
      />
    </label>
  );
}
