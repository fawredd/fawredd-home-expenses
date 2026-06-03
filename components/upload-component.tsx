"use client";

import React, { useState, useCallback, useRef } from "react";
import { Upload, X, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileUploadItem {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
}

  const ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const MAX_FILES = 5;

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: "Solo se aceptan archivos PDF, JPG y PNG",
      };
    }
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: "El archivo es demasiado grande (máximo 5MB)",
      };
    }
    return { valid: true };
  };
  
export function DocumentUploadComponent() {
  const [uploads, setUploads] = useState<FileUploadItem[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const handleFiles = async (files: File[]) => {
    if (uploads.length + files.length > MAX_FILES) {
      alert(`Máximo ${MAX_FILES} archivos por carga`);
      return;
    }

    const newUploads: FileUploadItem[] = files
      .filter((file) => {
        const validation = validateFile(file);
        if (!validation.valid) {
          alert(`${file.name}: ${validation.error}`);
          return false;
        }
        return true;
      })
      .map((file) => ({
        id: Math.random().toString(36).substr(2, 9),
        file,
        progress: 0,
        status: "pending" as const,
      }));

    setUploads((prev) => [...prev, ...newUploads]);

    // Upload each file
    for (const upload of newUploads) {
      await uploadFile(upload.id, upload.file);
    }
  };

  const uploadFile = async (uploadId: string, file: File) => {
    try {
      setUploads((prev) =>
        prev.map((u) =>
          u.id === uploadId ? { ...u, status: "uploading" as const } : u,
        ),
      );

      const formData = new FormData();
      formData.append("files", file);

      const xhr = new XMLHttpRequest();

      // Track progress
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploads((prev) =>
            prev.map((u) =>
              u.id === uploadId ? { ...u, progress: percentComplete } : u,
            ),
          );
        }
      });

      // Handle completion
      xhr.addEventListener("load", () => {
        if (xhr.status === 201) {
          setUploads((prev) =>
            prev.map((u) =>
              u.id === uploadId
                ? { ...u, status: "success", progress: 100 }
                : u,
            ),
          );
        } else {
          const response = JSON.parse(xhr.responseText);
          setUploads((prev) =>
            prev.map((u) =>
              u.id === uploadId
                ? {
                    ...u,
                    status: "error" as const,
                    error: response.message || "Error al subir archivo",
                  }
                : u,
            ),
          );
        }
      });

      xhr.addEventListener("error", () => {
        setUploads((prev) =>
          prev.map((u) =>
            u.id === uploadId
              ? { ...u, status: "error" as const, error: "Error de red" }
              : u,
          ),
        );
      });

      xhr.open("POST", "/api/documents/upload");
      xhr.send(formData);
    } catch (error) {
      setUploads((prev) =>
        prev.map((u) =>
          u.id === uploadId
            ? {
                ...u,
                status: "error" as const,
                error:
                  error instanceof Error ? error.message : "Error desconocido",
              }
            : u,
        ),
      );
    }
  };

  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      dragCounter.current++;
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      dragCounter.current--;
      if (dragCounter.current === 0) setIsDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const removeUpload = (id: string) => {
    setUploads((prev) => prev.filter((u) => u.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Upload Zone */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragActive
            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
            : "border-slate-300 dark:border-slate-700 hover:border-blue-400"
        }`}
      >
        <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
        <h3 className="text-lg font-semibold mb-2">Arrastra documentos aquí</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          o haz clic para seleccionar archivos
        </p>
        <p className="text-xs text-slate-400 mb-4">
          PDF, JPG, PNG (máximo 5MB, máximo {MAX_FILES} archivos)
        </p>
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          Seleccionar archivos
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => {
            if (e.target.files) {
              handleFiles(Array.from(e.target.files));
            }
          }}
          className="hidden"
        />
      </div>

      {/* Upload Queue */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Archivos en cola:
          </h4>
          {uploads.map((upload) => (
            <div
              key={upload.id}
              className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg"
            >
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="text-sm font-medium truncate">
                    {upload.file.name}
                  </span>
                  <span className="text-xs text-slate-500">
                    {upload.progress.toFixed(0)}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      upload.status === "error"
                        ? "bg-red-500"
                        : upload.status === "success"
                          ? "bg-green-500"
                          : "bg-blue-500"
                    }`}
                    style={{ width: `${upload.progress}%` }}
                  />
                </div>
                {upload.error && (
                  <p className="text-xs text-red-500 mt-1">{upload.error}</p>
                )}
              </div>
              {upload.status === "success" && (
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              )}
              {upload.status === "error" && (
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              )}
              {(upload.status === "pending" ||
                upload.status === "uploading") && (
                <button
                  onClick={() => removeUpload(upload.id)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Success Message */}
      {uploads.some((u) => u.status === "success") && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm text-green-800 dark:text-green-200">
            ✓ Documentos subidos correctamente. Se están procesando...
          </p>
        </div>
      )}
    </div>
  );
}
