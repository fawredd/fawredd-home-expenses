"use client";

import React, { useState } from "react";
import { Moon, Sun, Menu } from "lucide-react";
import { SignOutButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

import { CategoryCreationModal } from "@/components/category-creation-modal";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isDark, setIsDark] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  const toggleTheme = () => {
    setIsDark(!isDark);
    const root = document.documentElement;
    if (isDark) {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    } else {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    }
  };

  return (
    <div className={isDark ? "dark" : ""}>
      <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50">
        {/* Header */}
        <header className="sticky top-0 z-40 w-full border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              {/* Logo */}
              <div className="flex items-center">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                  💰 FAWREDD
                </h1>
              </div>
              {/* Actions */}
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="hidden md:flex border-slate-200 dark:border-slate-700"
                >
                  + Nueva Categoría
                </Button>

                <button
                  onClick={toggleTheme}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  aria-label="Toggle theme"
                >
                  {isDark ? (
                    <Sun className="w-5 h-5" />
                  ) : (
                    <Moon className="w-5 h-5" />
                  )}
                </button>

                <SignOutButton>
                  <button className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                    Cerrar sesión
                  </button>
                </SignOutButton>

                {/* Mobile Menu Button */}
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="md:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <Menu className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        <CategoryCreationModal 
          isOpen={isCategoryModalOpen} 
          onClose={() => setIsCategoryModalOpen(false)} 
          onSuccess={() => window.location.reload()} 
        />

        {/* Footer */}
        <footer className="border-t border-slate-200 dark:border-slate-800 py-8 mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-slate-500 dark:text-slate-400">
            <p>Fawredd Home Expenses • © 2026 • Local Development MVP</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
