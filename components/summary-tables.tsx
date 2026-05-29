"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, TrendingUp, TrendingDown } from "lucide-react";

interface MonthlySummary {
  yearMonth: string;
  month: number;
  year: number;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  movementCount: number;
  changePercent?: number;
}

export function MonthlySummaryTable() {
  const [data, setData] = useState<MonthlySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/dashboard/monthly-summary");
        if (!res.ok) throw new Error("Failed to fetch monthly summary");

        const result = await res.json();
        setData(result.summary || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, []);

  const formatMonth = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-ES", {
      month: "long",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="h-12 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"
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
        Sin datos de resumen mensual
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">Mes</th>
            <th className="px-4 py-3 text-right font-semibold">Ingresos</th>
            <th className="px-4 py-3 text-right font-semibold">Egresos</th>
            <th className="px-4 py-3 text-right font-semibold">Balance</th>
            <th className="px-4 py-3 text-center font-semibold">Cambio</th>
            <th className="px-4 py-3 text-center font-semibold">Movimientos</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={row.yearMonth}
              className={`border-b border-slate-200 dark:border-slate-700 ${
                idx % 2 === 0
                  ? "bg-white dark:bg-slate-950"
                  : "bg-slate-50 dark:bg-slate-900"
              } hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors`}
            >
              <td className="px-4 py-3 font-medium">
                {formatMonth(row.yearMonth)}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-green-600 dark:text-green-400">
                ${row.totalIncome.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-red-600 dark:text-red-400">
                ${row.totalExpenses.toLocaleString()}
              </td>
              <td
                className={`px-4 py-3 text-right font-semibold ${
                  row.balance >= 0
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-orange-600 dark:text-orange-400"
                }`}
              >
                ${row.balance.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-center">
                {row.changePercent !== undefined && (
                  <span className="flex items-center justify-center gap-1 text-xs font-medium">
                    {row.changePercent >= 0 ? (
                      <>
                        <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                        <span className="text-green-600 dark:text-green-400">
                          +{row.changePercent.toFixed(1)}%
                        </span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                        <span className="text-red-600 dark:text-red-400">
                          {row.changePercent.toFixed(1)}%
                        </span>
                      </>
                    )}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400">
                {row.movementCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface AnnualSummary {
  year: string;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  movementCount: number;
}

export function AnnualSummaryTable() {
  const [data, setData] = useState<AnnualSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/dashboard/annual-summary");
        if (!res.ok) throw new Error("Failed to fetch annual summary");

        const result = await res.json();
        setData(result.summary || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-12 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"
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
        Sin datos de resumen anual
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
      <table className="w-full text-sm">
        <thead className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">Año</th>
            <th className="px-4 py-3 text-right font-semibold">Ingresos</th>
            <th className="px-4 py-3 text-right font-semibold">Egresos</th>
            <th className="px-4 py-3 text-right font-semibold">Balance</th>
            <th className="px-4 py-3 text-center font-semibold">Movimientos</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={row.year}
              className={`border-b border-slate-200 dark:border-slate-700 ${
                idx % 2 === 0
                  ? "bg-white dark:bg-slate-950"
                  : "bg-slate-50 dark:bg-slate-900"
              } hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors`}
            >
              <td className="px-4 py-3 font-semibold text-lg">{row.year}</td>
              <td className="px-4 py-3 text-right font-semibold text-green-600 dark:text-green-400">
                ${row.totalIncome.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-red-600 dark:text-red-400">
                ${row.totalExpenses.toLocaleString()}
              </td>
              <td
                className={`px-4 py-3 text-right font-semibold ${
                  row.balance >= 0
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-orange-600 dark:text-orange-400"
                }`}
              >
                ${row.balance.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-center text-slate-600 dark:text-slate-400">
                {row.movementCount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
