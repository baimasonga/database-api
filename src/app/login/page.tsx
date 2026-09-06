"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initial: LoginState = {};

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <div className="grid min-h-screen place-items-center bg-[color:var(--color-avdp-900)] px-6">
      <form action={action} className="w-full max-w-sm rounded-lg bg-white p-7 shadow-lg">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded bg-[color:var(--color-gold-500)] text-sm font-bold text-[color:var(--color-avdp-900)]">
            A
          </span>
          <div>
            <p className="text-sm font-semibold">AVDP Data Manager</p>
            <p className="text-xs text-[color:var(--color-ink-400)]">Authorised staff only</p>
          </div>
        </div>

        <label className="mb-3 block">
          <span className="label">Email address</span>
          <input name="email" type="email" autoComplete="username" required className="input mt-1" />
        </label>
        <label className="mb-4 block">
          <span className="label">Password</span>
          <input name="password" type="password" autoComplete="current-password" required className="input mt-1" />
        </label>

        {state.error ? <p className="mb-3 text-sm text-red-700">{state.error}</p> : null}

        <button type="submit" disabled={pending} className="btn-primary w-full">
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
