"use client";

import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mb-4">
          Crear cuenta
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8">
          Regístrate con correo electrónico o Google y comienza a gestionar tus gastos.
        </p>
        <SignUp path="/sign-up" routing="path" />
      </div>
    </div>
  );
}
