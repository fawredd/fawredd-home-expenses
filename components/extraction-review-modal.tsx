"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  AlertCircle,
  CheckCircle,
  Brain,
  FileText,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface Category {
  id: string;
  name: string;
  color?: string;
}

interface ExtractionReviewData {
  document: {
    id: string;
    filename: string;
    mimeType: string;
    processingStatus: string;
  };
  extraction: {
    id: string;
    extractedVendor?: string;
    extractedCuit?: string;
    extractedDate?: string;
    extractedAmount?: string;
    extractedCurrency?: string;
    extractedDocumentType?: string;
    rawOcrText?: string;
    overallConfidence?: string;
  } | null;
}

interface ExtractionReviewModalProps {
  documentId: string;
  documentName?: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const DOCUMENT_TYPES = [
  { value: "invoice", label: "Factura" },
  { value: "receipt", label: "Recibo / Ticket" },
  { value: "statement", label: "Extracto Bancario" },
  { value: "ticket", label: "Ticket" },
  { value: "other", label: "Otro" },
] as const;

const CURRENCIES = ["ARS", "USD", "EUR", "UYU"] as const;

export function ExtractionReviewModal({
  documentId,
  documentName,
  isOpen,
  onClose,
  onSuccess,
}: ExtractionReviewModalProps) {
  const [reviewData, setReviewData] = useState<ExtractionReviewData | null>(
    null,
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showRawText, setShowRawText] = useState(false);

  // Form state — pre-filled from partial extraction
  const [vendor, setVendor] = useState("");
  const [cuit, setCuit] = useState("");
  const [date, setDate] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>("ARS");
  const [documentType, setDocumentType] =
    useState<(typeof DOCUMENT_TYPES)[number]["value"]>("other");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setSuccess(false);

    const fetchData = async () => {
      try {
        setLoading(true);
        const [reviewRes, categoriesRes] = await Promise.all([
          fetch(`/api/documents/${documentId}/review`),
          fetch("/api/categories"),
        ]);

        if (!reviewRes.ok || !categoriesRes.ok) {
          throw new Error("Error al cargar datos del documento");
        }

        const reviewJson = await reviewRes.json();
        const catsJson = await categoriesRes.json();

        const data: ExtractionReviewData =
          reviewJson.data ?? reviewJson;
        setReviewData(data);
        setCategories(catsJson.categories || catsJson.data?.categories || []);

        // Pre-fill form from partial extraction
        const ext = data.extraction;
        if (ext) {
          setVendor(ext.extractedVendor ?? "");
          setCuit(ext.extractedCuit ?? "");
          setDate(ext.extractedDate ?? "");
          setAmount(
            ext.extractedAmount ? Number(ext.extractedAmount) : "",
          );
          setCurrency(
            (ext.extractedCurrency as (typeof CURRENCIES)[number]) ?? "ARS",
          );
          setDocumentType(
            (ext.extractedDocumentType as (typeof DOCUMENT_TYPES)[number]["value"]) ??
              "other",
          );
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, documentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!vendor.trim()) {
      setError("El proveedor es requerido");
      return;
    }
    if (!date) {
      setError("La fecha es requerida");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError("El monto debe ser mayor a cero");
      return;
    }
    if (!categoryId) {
      setError("Debes seleccionar una categoría");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch(`/api/documents/${documentId}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor: vendor.trim(),
          cuit: cuit.trim() || undefined,
          date,
          amount: Number(amount),
          currency,
          documentType,
          categoryId,
          description: description.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.message ?? "Error al guardar la revisión");
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
        setSuccess(false);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const confidence = reviewData?.extraction?.overallConfidence
    ? Math.round(Number(reviewData.extraction.overallConfidence) * 100)
    : null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto border border-slate-200 dark:border-slate-700">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 z-10 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Brain className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                Revisión requerida
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
                {documentName ?? reviewData?.document.filename ?? documentId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Learning banner */}
          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <Brain className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-800 dark:text-amber-200">
              Este proveedor no fue reconocido. Tus correcciones entrenarán al sistema para extraer datos automáticamente en documentos futuros del mismo proveedor.
            </p>
          </div>

          {/* Confidence badge */}
          {confidence !== null && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Confianza de extracción automática:
              </span>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  confidence >= 70
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                    : confidence >= 40
                      ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                      : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                }`}
              >
                {confidence}%
              </span>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" />
              <span className="text-sm text-green-700 dark:text-green-200">
                ✅ Revisión guardada. El sistema ha aprendido de este documento.
              </span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
              <span className="text-sm text-red-700 dark:text-red-300">
                {error}
              </span>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-slate-400 mx-auto" />
              <p className="mt-2 text-sm text-slate-500">Cargando datos…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" id="extraction-review-form">

              {/* Vendor */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Proveedor <span className="text-red-500">*</span>
                </label>
                <input
                  id="review-vendor"
                  type="text"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  placeholder="Nombre del proveedor o empresa"
                  className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  required
                />
              </div>

              {/* CUIT */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  CUIT{" "}
                  <span className="text-xs text-slate-400">(formato: 20-12345678-9)</span>
                </label>
                <input
                  id="review-cuit"
                  type="text"
                  value={cuit}
                  onChange={(e) => setCuit(e.target.value)}
                  placeholder="XX-XXXXXXXX-X"
                  pattern="\d{2}-\d{8}-\d{1}"
                  className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono"
                />
              </div>

              {/* Date + Document type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Fecha <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="review-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Tipo de documento
                  </label>
                  <select
                    id="review-document-type"
                    value={documentType}
                    onChange={(e) =>
                      setDocumentType(
                        e.target.value as typeof documentType,
                      )
                    }
                    className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    {DOCUMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Amount + Currency */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Monto total <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="review-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) =>
                      setAmount(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Moneda
                  </label>
                  <select
                    id="review-currency"
                    value={currency}
                    onChange={(e) =>
                      setCurrency(e.target.value as typeof currency)
                    }
                    className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Categoría <span className="text-red-500">*</span>
                </label>
                <select
                  id="review-category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  required
                >
                  <option value="">-- Selecciona una categoría --</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Description (optional) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Descripción{" "}
                  <span className="text-xs text-slate-400">(opcional)</span>
                </label>
                <input
                  id="review-description"
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descripción adicional"
                  className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Raw text toggle */}
              {reviewData?.extraction?.rawOcrText && (
                <div>
                  <button
                    type="button"
                    onClick={() => setShowRawText((p) => !p)}
                    className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {showRawText ? "Ocultar" : "Ver"} texto extraído del documento
                  </button>
                  {showRawText && (
                    <pre className="mt-2 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-600 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-40">
                      {reviewData.extraction.rawOcrText}
                    </pre>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
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
                    !vendor.trim() ||
                    !date ||
                    !amount ||
                    !categoryId
                  }
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Guardando…
                    </>
                  ) : (
                    "Confirmar y aprender"
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
