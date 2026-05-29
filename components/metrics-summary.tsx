"use client";

import React, { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, AlertCircle } from "lucide-react";

interface DashboardMetrics {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  movementCount: number;
  documentCount: number;
  categorizedPercent: number;
  averageConfidence: number;
  dateRange?: {
    startDate: string | null;
    endDate: string | null;
  };
}

interface MetricsSummaryProps {
  dateRange?: { startDate?: string; endDate?: string };
}

export function MetricsSummary({ dateRange }: MetricsSummaryProps) {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (dateRange?.startDate)
          params.append("startDate", dateRange.startDate);
        if (dateRange?.endDate) params.append("endDate", dateRange.endDate);

        const [metricsRes, uncatRes] = await Promise.all([
          fetch(`/api/dashboard/metrics?${params}`),
          fetch("/api/dashboard/uncategorized-count"),
        ]);

        if (!metricsRes.ok || !uncatRes.ok) {
          throw new Error("Failed to fetch metrics");
        }

        const metricsData = await metricsRes.json();
        const uncatData = await uncatRes.json();

        setMetrics(metricsData);
        setUncategorizedCount(uncatData.uncategorizedCount || 0);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [dateRange]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-24 bg-slate-200 dark:bg-slate-800 rounded-lg"
          />
        ))}
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
        <span className="text-sm text-red-700 dark:text-red-300">
          Error al cargar métricas: {error}
        </span>
      </div>
    );
  }

  const metricCards = [
    {
      label: "Ingresos Totales",
      value: `$${metrics.totalIncome.toLocaleString()}`,
      icon: TrendingUp,
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-50 dark:bg-green-900/20",
    },
    {
      label: "Gastos Totales",
      value: `$${metrics.totalExpenses.toLocaleString()}`,
      icon: TrendingDown,
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-50 dark:bg-red-900/20",
    },
    {
      label: "Balance",
      value: `$${metrics.balance.toLocaleString()}`,
      icon: metrics.balance >= 0 ? TrendingUp : TrendingDown,
      color:
        metrics.balance >= 0
          ? "text-blue-600 dark:text-blue-400"
          : "text-orange-600 dark:text-orange-400",
      bgColor:
        metrics.balance >= 0
          ? "bg-blue-50 dark:bg-blue-900/20"
          : "bg-orange-50 dark:bg-orange-900/20",
    },
    {
      label: "Movimientos",
      value: metrics.movementCount.toString(),
      icon: TrendingUp,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-50 dark:bg-purple-900/20",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Uncategorized Alert */}
      {uncategorizedCount > 0 && (
        <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <span className="text-sm text-amber-800 dark:text-amber-200">
              {uncategorizedCount} movimiento{uncategorizedCount > 1 ? "s" : ""}{" "}
              sin categorizar
            </span>
          </div>
          <a
            href="#uncategorized"
            className="text-sm font-medium text-amber-700 dark:text-amber-300 hover:underline"
          >
            Revisar
          </a>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`p-4 rounded-lg border border-slate-200 dark:border-slate-700 ${card.bgColor}`}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                  {card.label}
                </span>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
            Categorización
          </span>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-50 mt-2">
            {metrics.categorizedPercent.toFixed(1)}%
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {metrics.categorizedPercent === 100
              ? "Todos los movimientos categorizados"
              : "de movimientos categorizados"}
          </p>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase">
            Confianza Promedio
          </span>
          <p className="text-2xl font-bold text-slate-900 dark:text-slate-50 mt-2">
            {(metrics.averageConfidence * 100).toFixed(0)}%
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            en categorizaciones automáticas
          </p>
        </div>
      </div>
    </div>
  );
}
