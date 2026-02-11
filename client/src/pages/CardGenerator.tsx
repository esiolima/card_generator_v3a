import { useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

interface ProgressData {
  total: number;
  processed: number;
  percentage: number;
  currentCard: string;
}

export default function CardGenerator() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [zipPath, setZipPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const validateFile = (selectedFile: File) => {
    if (!selectedFile.name.endsWith(".xlsx")) {
      setError("Por favor, selecione um arquivo .xlsx válido");
      return false;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      setError("O arquivo não pode exceder 10MB");
      return false;
    }

    return true;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    if (!validateFile(selectedFile)) return;

    setFile(selectedFile);
    setError(null);
  };

  // 🔥 DRAG & DROP AVANÇADO
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;
    if (!validateFile(droppedFile)) return;

    setFile(droppedFile);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Por favor, selecione um arquivo");
      return;
    }

    setIsProcessing(true);
    setError(null);

    // Sua lógica de upload continua aqui
  };

  const bgColor = isDark ? "bg-slate-950" : "bg-gradient-to-br from-slate-50 to-blue-50";
  const cardBg = isDark ? "bg-slate-900" : "bg-white";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-300" : "text-slate-600";
  const uploadBg = isDark ? "bg-slate-800" : "bg-blue-50";

  return (
    <div className={`min-h-screen py-12 px-4 transition-colors duration-300 ${bgColor}`}>
      <div className="max-w-5xl mx-auto">

        <div className={`${cardBg} rounded-2xl p-8 shadow-xl border transition-all duration-300`}>

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
              transition-all duration-300 ease-in-out
              ${uploadBg}
              ${isDragging 
                ? "border-blue-500 bg-blue-500/10 scale-[1.02] shadow-lg" 
                : "border-slate-400 hover:border-blue-400"}
            `}
          >
            <div className="flex flex-col items-center space-y-3">
              <Upload className={`w-10 h-10 ${isDragging ? "text-blue-500 animate-bounce" : "text-blue-400"}`} />

              <div>
                <p className={`font-semibold ${textPrimary}`}>
                  {isDragging ? "Solte o arquivo aqui" : "Clique ou arraste seu arquivo"}
                </p>

                <p className={`text-sm mt-1 ${textSecondary}`}>
                  Apenas arquivos .xlsx (máximo 10MB)
                </p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {file && (
            <div className="mt-6 text-center">
              <p className={textPrimary}>{file.name}</p>
            </div>
          )}

          {error && (
            <div className="mt-6 text-red-500 text-center">
              {error}
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!file}
            className="mt-6 w-full"
          >
            Processar Planilha
          </Button>

        </div>

      </div>
    </div>
  );
}
