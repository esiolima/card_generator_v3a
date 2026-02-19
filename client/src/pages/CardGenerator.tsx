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
      setError("Erro ao processar arquivo.");
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
    } catch {
      setError("Erro ao gerar jornal.");
    } finally {
      setIsGeneratingJournal(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-8">
      <div className="w-full max-w-xl bg-gray-800 p-8 rounded-2xl shadow-xl">
        <h1 className="text-2xl font-bold mb-6">Gerador de Cards</h1>

        {!isProcessing && !zipPath && (
          <>
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mb-4"
            />
            <Button onClick={handleUpload}>
              Processar Planilha
            </Button>
          </>
        )}

        {isProcessing && (
          <div className="mt-4">
            <Progress value={progress?.percentage || 0} />
          </div>
        )}

        {!isProcessing && zipPath && (
          <div className="mt-6 space-y-4">
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
          <p className="text-red-400 mt-4">{error}</p>
        )}
      </div>
    </div>
  );
}
