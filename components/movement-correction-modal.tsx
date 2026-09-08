"use client";

import React, { useEffect, useState } from "react";
import { X, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Category {
  id: string;
  name: string;
  color?: string;
}

interface MovementCorrectionModalProps {
  movementId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function MovementCorrectionModal({
  movementId,
  isOpen,
  onClose,
  onSuccess,
}: MovementCorrectionModalProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [vendorName, setVendorName] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [transactionDate, setTransactionDate] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

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
        
        const data = movementData.data || movementData;
        setVendorName(data.vendor || "");
        setAmount(data.amount || "");
        setTransactionDate(data.transactionDate ? new Date(data.transactionDate).toISOString().split('T')[0] : "");
        setSelectedCategory(data.categoryId || "");
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
    if (!vendorName.trim() || !amount || !transactionDate) {
      setError("Todos los campos son requeridos");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch(`/api/movements/${movementId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          categoryId: selectedCategory,
          vendorName: vendorName.trim(),
          amount: Number(amount),
          transactionDate
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to update movement");
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold">Editar Movimiento</h2>
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
                Movimiento actualizado correctamente
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
              <div>
                <label className="block text-sm font-medium mb-2">
                  Fecha
                </label>
                <input
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Vendedor / Concepto
                </label>
                <input
                  type="text"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Monto
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Categoría
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">-- Selecciona una categoría --</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

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
                  disabled={submitting || !selectedCategory || !vendorName || !amount || !transactionDate}
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
