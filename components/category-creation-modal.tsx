"use client";

import React, { useState } from "react";
import { X, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CategoryCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CategoryCreationModal({
  isOpen,
  onClose,
  onSuccess,
}: CategoryCreationModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6B7280"); // default gray
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("El nombre de la categoría es requerido");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), color }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Error al crear la categoría");
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
        setSuccess(false);
        setName("");
        setColor("#6B7280");
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const presetColors = [
    "#EF4444", // Red
    "#F97316", // Orange
    "#F59E0B", // Amber
    "#10B981", // Emerald
    "#06B6D4", // Cyan
    "#3B82F6", // Blue
    "#8B5CF6", // Violet
    "#D946EF", // Fuchsia
    "#6B7280", // Gray
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold">Nueva Categoría</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {success && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="text-sm text-green-700 dark:text-green-200">
                Categoría creada correctamente
              </span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <span className="text-sm text-red-700 dark:text-red-300">
                {error}
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Nombre</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Combustible"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Color</label>
              <div className="flex flex-wrap gap-2">
                {presetColors.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setColor(preset)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${
                      color === preset
                        ? "border-slate-900 dark:border-white scale-110"
                        : "border-transparent hover:scale-105"
                    }`}
                    style={{ backgroundColor: preset }}
                    title={preset}
                  />
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={submitting}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={submitting || !name.trim()}
                className="flex-1"
              >
                {submitting ? "Guardando..." : "Crear"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
