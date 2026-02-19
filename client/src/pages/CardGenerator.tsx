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
    const socket = io({
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    socket.on("connect", () => {
      socket.emit("join", sessionId);
    });

    socket.on("progress", (data: ProgressData) => {
      setProgress(data);
    });

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
      setError("Por favor, selecione um arquivo .xlsx válido");
      return;
    }
    setFile(selectedFile);
    setError(null);
    setZipPath(null);
    setProgress(null);
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Selecione um arquivo primeiro.");
      return;
    }

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

      if (!uploadResponse.ok) {
        throw new Error("Erro ao fazer upload");
      }

      const { filePath } = await uploadResponse.json();

      const result = await generateCardsMutation.mutateAsync({
        filePath,
        sessionId
      });

      if (result.success) {
        setZipPath(result.zipPath);
      }
    } catch (err) {
      setError("Erro ao processar planilha.");
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
    setError(null);

    try {
      const response = await fetch("/api/gerar-jornal", {
        method: "POST"
      });

      if (!response.ok) {
        throw new Error("Erro ao gerar jornal");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "jornal_final.pdf";
      document.body.appendChild(a);
      a.click();

      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError("Erro ao gerar jornal.");
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
  const textSecondary = isDark ? "text-slate-300" : "text-slate-600";

  return (
    <div className={`min-h-screen py-12 px-4 transition-colors duration-500 ${bgColor}`}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-16">
          <h1 className={`text-3xl font-bold ${textPrimary}`}>
            Gerador de Cards
          </h1>
          <button
            onClick={() => setIsDark(!isDark)}
            className="p-3 rounded-full bg-white/10"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
        </div>

        <div className={`${cardBg} rounded-2xl p-8 shadow-2xl`}>
          {!isProcessing && !zipPath && (
            <>
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
                className="mb-4"
              />
              <Button onClick={handleUpload}>
                Processar Planilha
              </Button>
            </>
          )}

          {isProcessing && progress && (
            <div className="space-y-4">
              <Progress value={progress.percentage} />
              <p>{progress.processed} de {progress.total}</p>
            </div>
          )}

          {!isProcessing && zipPath && (
            <div className="space-y-4">
              <Button onClick={handleDownload}>
                Baixar Cards (ZIP)
              </Button>

              <Button
                onClick={handleGenerateJournal}
                disabled={isGeneratingJournal}
              >
                {isGeneratingJournal
                  ? "Gerando Jornal..."
                  : "Gerar Jornal Diagramado"}
              </Button>
            </div>
          )}

          {error && (
            <p className="text-red-500 mt-4">{error}</p>
          )}
        </div>

        <div className="mt-16 text-center text-sm text-gray-400">
          Desenvolvido por Esio Lima - Versão 3.0
        </div>
      </div>
    </div>
  );
}
