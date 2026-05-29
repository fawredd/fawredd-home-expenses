"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";

interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  parentCategory?: string;
  totalAmount: number;
  percentageOfTotal: string;
  movementCount: number;
  color?: string;
}

export function CategoryBreakdownTable() {
  const [data, setData] = useState<CategoryBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBreakdown = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/dashboard/category-breakdown");
        if (!res.ok) throw new Error("Failed to fetch category breakdown");

        const result = await res.json();
        setData(result.breakdown || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchBreakdown();
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="h-16 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
        <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400">
        Sin datos de categorías
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.map((category) => {
        const percentage = parseFloat(category.percentageOfTotal);
        return (
          <div key={category.categoryId} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: category.color || "#6B7280" }}
                />
                <span className="font-medium">{category.categoryName}</span>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  ${category.totalAmount.toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {category.movementCount} movimiento
                  {category.movementCount !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min(percentage, 100)}%`,
                    backgroundColor: category.color || "#6B7280",
                  }}
                />
              </div>
              <span className="text-sm font-medium w-16 text-right">
                {percentage.toFixed(1)}%
              </span>
            </div>
          </div>
        );
      })}

      {/* Total */}
      <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
        <div className="flex justify-between items-center font-semibold">
          <span>Total Egresos</span>
          <span>
            $
            {data
              .reduce((sum, cat) => sum + cat.totalAmount, 0)
              .toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
