"use client";

import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mb-4">
          Iniciar sesión
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8">
          Usar correo electrónico o Google para acceder a tu panel financiero.
        </p>
        <SignIn path="/sign-in" routing="path" />
      </div>
    </div>
  );
}
