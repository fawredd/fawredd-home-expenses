"use client";

import React, { useEffect, useState } from "react";
import { X, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Category {
  id: string;
  name: string;
  color?: string;
}

interface CategoryCorrectionModalProps {
  movementId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CategoryCorrectionModal({
  movementId,
  isOpen,
  onClose,
  onSuccess,
}: CategoryCorrectionModalProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<string>("");

  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const [categoriesRes, movementRes] = await Promise.all([
          fetch("/api/categories"),
          fetch(`/api/movements/${movementId}/category`),
        ]);

        if (!categoriesRes.ok || !movementRes.ok) {
          throw new Error("Failed to fetch data");
        }

        const catsData = await categoriesRes.json();
        const movementData = await movementRes.json();

        setCategories(catsData.categories || []);
        setCurrentCategory(movementData.categoryId || "");
        setSelectedCategory(movementData.categoryId || "");
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, movementId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory) {
      setError("Por favor selecciona una categoría");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch(`/api/movements/${movementId}/category`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categoryId: selectedCategory }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to update category");
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
        setSuccess(false);
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const currentCategoryName = categories.find(
    (c) => c.id === currentCategory,
  )?.name;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold">Actualizar Categoría</h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {success && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              <span className="text-sm text-green-700 dark:text-green-200">
                Categoría actualizada correctamente
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

          {loading ? (
            <div className="py-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {currentCategoryName && (
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-1">
                    Categoría actual
                  </p>
                  <p className="font-medium">{currentCategoryName}</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">
                  Nueva Categoría
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- Selecciona una categoría --</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Preview */}
              {selectedCategory && selectedCategory !== currentCategory && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">
                    Nueva categoría seleccionada
                  </p>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor:
                          categories.find((c) => c.id === selectedCategory)
                            ?.color || "#6B7280",
                      }}
                    />
                    <p className="font-medium">
                      {categories.find((c) => c.id === selectedCategory)?.name}
                    </p>
                  </div>
                </div>
              )}

              {/* Actions */}
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
                  disabled={
                    submitting ||
                    !selectedCategory ||
                    selectedCategory === currentCategory
                  }
                  className="flex-1"
                >
                  {submitting ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
