"use client";

/**
 * PendingReviewList — shows documents in "awaiting_review" state.
 * Polls the API on mount + after successful review submissions.
 */

import React, { useEffect, useState } from "react";
import { Brain, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExtractionReviewModal } from "@/components/extraction-review-modal";

interface PendingDocument {
  id: string;
  filename: string;
  mimeType: string;
  processingStatus: string;
  uploadedAt: string;
}

interface PendingReviewListProps {
  /** Called when a review is submitted so parent can refresh the dashboard */
  onReviewCompleted?: () => void;
}

export function PendingReviewList({
  onReviewCompleted,
}: PendingReviewListProps) {
  const [documents, setDocuments] = useState<PendingDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewingDocumentId, setReviewingDocumentId] = useState<string | null>(
    null,
  );
  const [reviewingDocumentName, setReviewingDocumentName] = useState<
    string | undefined
  >();

  const fetchPending = async () => {
    try {
      setLoading(true);
      // Re-use the existing documents list endpoint, filter client-side
      const res = await fetch("/api/documents?status=awaiting_review&limit=20");
      if (!res.ok) throw new Error("Error al cargar documentos pendientes");

      const json = await res.json();
      const data = json.data ?? json;
      // Filter for awaiting_review in case the endpoint doesn't support status filter
      const all: PendingDocument[] = data.documents ?? data ?? [];
      setDocuments(
        all.filter(
          (d: PendingDocument) => d.processingStatus === "awaiting_review",
        ),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const task = setTimeout(() => {
      void fetchPending();
    }, 0);

    return () => clearTimeout(task);
  }, []);

  const handleReviewSuccess = () => {
    setReviewingDocumentId(null);
    setReviewingDocumentName(undefined);
    fetchPending();
    onReviewCompleted?.();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-slate-400 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        Verificando documentos pendientes…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">
        <AlertCircle className="w-4 h-4 shrink-0" />
        {error}
      </div>
    );
  }

  if (documents.length === 0) return null;

  return (
    <>
      <div className="space-y-3">
        {/* Section header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Brain className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Documentos pendientes de revisión
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold">
                {documents.length}
              </span>
            </h3>
          </div>
          <button
            onClick={fetchPending}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-1 rounded"
            title="Actualizar"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Info banner */}
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200">
          El sistema no reconoció estos documentos. Revisá y confirmá los datos
          para que el sistema aprenda a extraerlos automáticamente en el futuro.
        </div>

        {/* Document cards */}
        <div className="space-y-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/50 rounded-xl gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">
                    {doc.mimeType === "application/pdf"
                      ? "PDF"
                      : (doc.mimeType.split("/")[1]?.toUpperCase() ?? "DOC")}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                    {doc.filename}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Subido:{" "}
                    {new Date(doc.uploadedAt).toLocaleDateString("es-AR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                id={`review-btn-${doc.id}`}
                onClick={() => {
                  setReviewingDocumentId(doc.id);
                  setReviewingDocumentName(doc.filename);
                }}
                className="shrink-0 bg-amber-500 hover:bg-amber-600 text-white text-xs px-3"
              >
                <Brain className="w-3.5 h-3.5 mr-1.5" />
                Revisar
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Review modal */}
      {reviewingDocumentId && (
        <ExtractionReviewModal
          documentId={reviewingDocumentId}
          documentName={reviewingDocumentName}
          isOpen={reviewingDocumentId !== null}
          onClose={() => {
            setReviewingDocumentId(null);
            setReviewingDocumentName(undefined);
          }}
          onSuccess={handleReviewSuccess}
        />
      )}
    </>
  );
}
