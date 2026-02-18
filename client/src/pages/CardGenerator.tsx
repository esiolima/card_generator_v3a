// 🔥 CÓDIGO COMPLETO RESTAURADO + BOTÃO NOVO

import { useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  Download,
  Hourglass,
  Moon,
  Sun,
  Image,
  FileText
} from "lucide-react";

interface ProgressData {
  total: number;
  processed: number;
  percentage: number;
  currentCard: string;
}

export default function CardGenerator() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingJournal, setIsGeneratingJournal] = useState(false);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [zipPath, setZipPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(() =>
    `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );
  const [isDark, setIsDark] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const [, setLocation] = useLocation();

  const generateCardsMutation = trpc.card.generateCards.useMutation();

  useEffect(() => {
    const socket = io();
    socket.on("connect", () => socket.emit("join", sessionId));
    socket.on("progress", (data: ProgressData) => setProgress(data));
    socket.on("error", (message: string) => {
      setError(message);
      setIsProcessing(false);
    });
    socketRef.current = socket;
    return () => socket.disconnect();
  }, [sessionId]);

  const handleFileSelect = (selectedFile: File | null | undefined) => {
    if (!selectedFile) return;
    if (!selectedFile.name.endsWith(".xlsx")) {
      setError("Selecione um arquivo .xlsx válido");
      return;
    }
    setFile(selectedFile);
    setError(null);
    setZipPath(null);
    setProgress(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsProcessing(true);
    setError(null);
    setProgress(null);
    setZipPath(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData
      });

      if (!uploadResponse.ok)
        throw new Error("Erro no upload");

      const { filePath } = await uploadResponse.json();

      const result = await generateCardsMutation.mutateAsync({
        filePath,
        sessionId
      });

      if (result.success) setZipPath(result.zipPath);
    } catch (err) {
      setError("Erro ao processar planilha");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!zipPath) return;

    const response = await fetch(
      `/api/download?zipPath=${encodeURIComponent(zipPath)}`
    );

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "cards.zip";
    document.body.appendChild(a);
    a.click();

    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleGenerateJournal = async () => {
    setIsGeneratingJournal(true);
    try {
      const response = await fetch("/api/gerar-jornal", {
        method: "POST"
      });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "jornal_final.pdf";
      document.body.appendChild(a);
      a.click();

      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      setError("Erro ao gerar jornal");
    } finally {
      setIsGeneratingJournal(false);
    }
  };

  const bgColor = isDark
    ? "bg-gradient-to-br from-gray-900 via-blue-950 to-purple-950"
    : "bg-gradient-to-br from-slate-100 via-blue-100 to-purple-100";

  const cardBg = isDark
    ? "bg-white/10 backdrop-blur-lg border border-white/20"
    : "bg-white/50 backdrop-blur-lg border border-white/80";

  const textPrimary = isDark ? "text-white" : "text-slate-900";

  return (
    <div className={`min-h-screen py-12 px-4 ${bgColor}`}>
      <div className="max-w-4xl mx-auto">
        <div className={`${cardBg} rounded-2xl p-8 shadow-2xl`}>
          <h1 className={`text-3xl font-bold mb-6 ${textPrimary}`}>
            Gerador de Cards
          </h1>

          {!isProcessing && !zipPath && (
            <>
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) =>
                  handleFileSelect(e.target.files?.[0])
                }
                className="mb-4"
              />
              <Button onClick={handleUpload}>
                Processar Planilha
              </Button>
            </>
          )}

          {isProcessing && (
            <div className="mt-6">
              <Progress value={progress?.percentage || 0} />
            </div>
          )}

          {!isProcessing && zipPath && (
            <div className="mt-6 space-y-4">
              <Button onClick={handleDownload}>
                <Download className="mr-2 w-4 h-4" />
                Baixar Cards (ZIP)
              </Button>

              <Button
                onClick={handleGenerateJournal}
                disabled={isGeneratingJournal}
              >
                {isGeneratingJournal ? (
                  <>
                    <Hourglass className="mr-2 w-4 h-4 animate-spin" />
                    Gerando Jornal...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 w-4 h-4" />
                    Gerar Jornal Diagramado
                  </>
                )}
              </Button>
            </div>
          )}

          {error && (
            <p className="text-red-500 mt-4">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
