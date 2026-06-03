"use client";

import React, { useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { DocumentUploadComponent } from "@/components/upload-component";
import { MetricsSummary } from "@/components/metrics-summary";
import { MovementsTable } from "@/components/movements-table";
import {
  MonthlySummaryTable,
  AnnualSummaryTable,
} from "@/components/summary-tables";
import { CategoryBreakdownTable } from "@/components/category-breakdown";
import { CategoryCorrectionModal } from "@/components/category-correction-modal";

type TabType = "upload" | "movements" | "monthly" | "annual" | "categories";

export default function HomeClient() {
  const [activeTab, setActiveTab] = useState<TabType>("movements");
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(
    null,
  );

  const handleCategoryEdit = (movementId: string) => {
    setSelectedMovementId(movementId);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Title */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50 mb-2">
            Panel Financiero
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Gestiona y analiza tus movimientos financieros
          </p>
        </div>

        {/* Metrics Summary */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Resumen Financiero</h2>
          <MetricsSummary />
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
          <button
            onClick={() => setActiveTab("upload")}
            className={`px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "upload"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50"
            }`}
          >
            📤 Cargar Documentos
          </button>
          <button
            onClick={() => setActiveTab("movements")}
            className={`px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "movements"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50"
            }`}
          >
            📋 Movimientos
          </button>
          <button
            onClick={() => setActiveTab("monthly")}
            className={`px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "monthly"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50"
            }`}
          >
            📊 Mensual
          </button>
          <button
            onClick={() => setActiveTab("annual")}
            className={`px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "annual"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50"
            }`}
          >
            📈 Anual
          </button>
          <button
            onClick={() => setActiveTab("categories")}
            className={`px-4 py-3 font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === "categories"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-50"
            }`}
          >
            🏷️ Por Categoría
          </button>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === "upload" && (
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold mb-6">
                Cargar Documentos Financieros
              </h2>
              <DocumentUploadComponent />
            </div>
          )}

          {activeTab === "movements" && (
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold mb-6">Movimientos</h2>
              <MovementsTable onCategoryEdit={handleCategoryEdit} />
            </div>
          )}

          {activeTab === "monthly" && (
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold mb-6">Resumen Mensual</h2>
              <MonthlySummaryTable />
            </div>
          )}

          {activeTab === "annual" && (
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold mb-6">Resumen Anual</h2>
              <AnnualSummaryTable />
            </div>
          )}

          {activeTab === "categories" && (
            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
              <h2 className="text-lg font-semibold mb-6">
                Distribución por Categoría
              </h2>
              <CategoryBreakdownTable />
            </div>
          )}
        </div>
      </div>

      {/* Category Correction Modal */}
      <CategoryCorrectionModal
        movementId={selectedMovementId || ""}
        isOpen={selectedMovementId !== null}
        onClose={() => setSelectedMovementId(null)}
        onSuccess={() => {
          // Refresh the movements table
          window.location.reload();
        }}
      />
    </DashboardLayout>
  );
}
