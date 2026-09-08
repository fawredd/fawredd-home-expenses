"use client";

import React, { useEffect, useState } from "react";
import { X, ExternalLink, AlertCircle } from "lucide-react";

interface DocumentViewerModalProps {
  documentId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function DocumentViewerModal({
  documentId,
  isOpen,
  onClose,
}: DocumentViewerModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fileUrl = isOpen ? `/api/documents/${documentId}/file` : null;

  useEffect(() => {
    if (!isOpen) return;

    // Reset state via a small timeout to avoid synchronous update warning
    const t = setTimeout(() => {
      setLoading(true);
      setError(null);
    }, 0);

    return () => clearTimeout(t);
  }, [isOpen, documentId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-5xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            Visor de Documento
            {fileUrl && (
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-700"
                title="Abrir en pestaña nueva"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors bg-slate-100 dark:bg-slate-800 rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-4 relative overflow-hidden">
          {error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <span className="text-sm text-red-700 dark:text-red-300">
                  {error}
                </span>
              </div>
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          )}

          {fileUrl && !error && (
            <iframe
              src={fileUrl}
              className="w-full h-full rounded border border-slate-300 dark:border-slate-700 bg-white"
              onLoad={() => setLoading(false)}
              onError={() =>
                setError(
                  "Error al cargar el documento. Puede que no esté disponible o el formato no sea soportado por el navegador.",
                )
              }
              title="Document Viewer"
            />
          )}
        </div>
      </div>
    </div>
  );
}
