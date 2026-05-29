"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Edit2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Movement {
  id: string;
  transactionDate: string;
  vendor: string;
  amount: number;
  currency: string;
  categoryName: string;
  categoryColor?: string;
  movementType: "income" | "expense";
  confidence: number;
  isReviewed: boolean;
}

interface MovementsTableProps {
  onCategoryEdit?: (movementId: string) => void;
}

export function MovementsTable({ onCategoryEdit }: MovementsTableProps) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const limit = 50;

  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    vendorSearch: "",
  });

  type SortBy = "date" | "amount" | "vendor" | "category";
  type SortOrder = "asc" | "desc";

  const [sorting, setSorting] = useState<{
    sortBy: SortBy;
    sortOrder: SortOrder;
  }>({
    sortBy: "date",
    sortOrder: "desc",
  });

  useEffect(() => {
    const fetchMovements = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({
          offset: (page * limit).toString(),
          limit: limit.toString(),
          sortBy: sorting.sortBy,
          sortOrder: sorting.sortOrder,
        });

        if (filters.startDate) params.append("startDate", filters.startDate);
        if (filters.endDate) params.append("endDate", filters.endDate);
        if (filters.vendorSearch)
          params.append("vendorSearch", filters.vendorSearch);

        const res = await fetch(`/api/dashboard/movements?${params}`);
        if (!res.ok) throw new Error("Failed to fetch movements");

        const data = await res.json();
        setMovements(data.movements);
        setTotal(data.total);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchMovements();
  }, [page, filters, sorting]);

  const toggleSort = (field: SortBy) => {
    if (sorting.sortBy === field) {
      setSorting((prev) => ({
        ...prev,
        sortOrder: prev.sortOrder === "asc" ? "desc" : "asc",
      }));
    } else {
      setSorting({ sortBy: field, sortOrder: "desc" });
    }
    setPage(0);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const totalPages = Math.ceil(total / limit);

  if (loading && movements.length === 0) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="h-12 bg-slate-100 dark:bg-slate-900 rounded animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <input
          type="date"
          value={filters.startDate}
          onChange={(e) => {
            setFilters({ ...filters, startDate: e.target.value });
            setPage(0);
          }}
          placeholder="Desde"
          className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 text-sm"
        />
        <input
          type="date"
          value={filters.endDate}
          onChange={(e) => {
            setFilters({ ...filters, endDate: e.target.value });
            setPage(0);
          }}
          placeholder="Hasta"
          className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 text-sm"
        />
        <input
          type="text"
          value={filters.vendorSearch}
          onChange={(e) => {
            setFilters({ ...filters, vendorSearch: e.target.value });
            setPage(0);
          }}
          placeholder="Buscar vendedor..."
          className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-50 text-sm"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <span className="text-sm text-red-700 dark:text-red-300">
            {error}
          </span>
        </div>
      )}

      {/* Table */}
      {movements.length === 0 ? (
        <div className="p-8 text-center text-slate-500 dark:text-slate-400">
          <p>No hay movimientos para mostrar</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">
                    <button
                      onClick={() => toggleSort("date")}
                      className="flex items-center gap-2 hover:text-blue-600"
                    >
                      Fecha
                      {sorting.sortBy === "date" && (
                        <ArrowUpDown className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    <button
                      onClick={() => toggleSort("vendor")}
                      className="flex items-center gap-2 hover:text-blue-600"
                    >
                      Vendedor
                      {sorting.sortBy === "vendor" && (
                        <ArrowUpDown className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right font-semibold">
                    <button
                      onClick={() => toggleSort("amount")}
                      className="flex items-center justify-end gap-2 hover:text-blue-600 w-full"
                    >
                      Monto
                      {sorting.sortBy === "amount" && (
                        <ArrowUpDown className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-semibold">
                    <button
                      onClick={() => toggleSort("category")}
                      className="flex items-center gap-2 hover:text-blue-600"
                    >
                      Categoría
                      {sorting.sortBy === "category" && (
                        <ArrowUpDown className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-center font-semibold">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-center font-semibold">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody>
                {movements.map((movement, idx) => (
                  <tr
                    key={movement.id}
                    className={`border-b border-slate-200 dark:border-slate-700 ${
                      idx % 2 === 0
                        ? "bg-white dark:bg-slate-950"
                        : "bg-slate-50 dark:bg-slate-900"
                    } hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors`}
                  >
                    <td className="px-4 py-3">
                      {formatDate(movement.transactionDate)}
                    </td>
                    <td className="px-4 py-3 font-medium">{movement.vendor}</td>
                    <td
                      className={`px-4 py-3 text-right font-semibold ${
                        movement.movementType === "income"
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {movement.movementType === "income" ? "+" : "-"}
                      {movement.amount.toLocaleString()} {movement.currency}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-1 rounded text-xs font-medium text-white"
                        style={{
                          backgroundColor: movement.categoryColor || "#6B7280",
                        }}
                      >
                        {movement.categoryName}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {movement.confidence < 0.7 && (
                        <span className="text-xs px-2 py-1 bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200 rounded">
                          {(movement.confidence * 100).toFixed(0)}%
                        </span>
                      )}
                      {movement.confidence >= 0.7 && (
                        <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded">
                          ✓
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => onCategoryEdit?.(movement.id)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                        title="Editar categoría"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
            <span>
              Mostrando {page * limit + 1}-{Math.min((page + 1) * limit, total)}{" "}
              de {total}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {[...Array(Math.min(totalPages, 5))].map((_, i) => {
                const pageNum = i;
                return (
                  <Button
                    key={pageNum}
                    variant={page === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum + 1}
                  </Button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
