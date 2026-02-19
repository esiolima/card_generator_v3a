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
    setZipPath(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const { filePath } = await uploadResponse.json();

      const result = await generateCardsMutation.mutateAsync({
        filePath,
        sessionId,
      });

      if (result.success) {
        setZipPath(result.zipPath);
      }
    } catch {
      setError("Erro ao processar planilha");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!zipPath) return;

    try {
      const response = await fetch(
        `/api/download?zipPath=${encodeURIComponent(zipPath)}`
      );

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);

      const contentDisposition =
        response.headers.get("content-disposition");

      let fileName = "download.zip";

      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) fileName = match[1];
      }

      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();

      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      setError("Erro ao baixar arquivo");
    }
  };

  const handleGenerateJournal = async () => {
    try {
      const response = await fetch("/api/gerar-jornal", {
        method: "POST",
      });

      if (!response.ok) throw new Error();

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
    <div className={`min-h-screen py-12 px-6 ${bgColor}`}>
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className={`text-3xl font-bold ${textPrimary}`}>
              Gerador de Cards
            </h1>
            <p className={`text-sm ${textSecondary}`}>
              Núcleo de Comunicação e Marketing / Trade Martins
            </p>
          </div>
          <button onClick={() => setIsDark(!isDark)}>
            {isDark ? <Sun /> : <Moon />}
          </button>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className={`${cardBg} rounded-2xl p-8 shadow-2xl`}>
              
              {!zipPath && (
                <>
                  <h2 className={`text-2xl font-bold mb-2 ${textPrimary}`}>
                    Transforme suas Planilhas
                  </h2>
                  <p className={textSecondary}>
                    Converta dados Excel em cards PDF profissionais em segundos
                  </p>

                  <div className="mt-6">
                    <input
                      type="file"
                      accept=".xlsx"
                      onChange={(e) =>
                        handleFileSelect(e.target.files?.[0])
                      }
                    />
                  </div>

                  <Button
                    onClick={handleUpload}
                    className="mt-6 w-full"
                  >
                    Processar Planilha
                  </Button>
                </>
              )}

              {isProcessing && progress && (
                <div className="mt-6">
                  <Progress value={progress.percentage} />
                </div>
              )}

              {zipPath && (
                <div className="mt-8 space-y-4">
                  <Button
                    onClick={handleDownload}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <Download size={18} />
                    Baixar Cards (ZIP)
                  </Button>

                  <Button
                    onClick={handleGenerateJournal}
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <FileText size={18} />
                    Gerar Jornal Diagramado
                  </Button>
                </div>
              )}

              {error && (
                <p className="text-red-400 mt-4">
                  {error}
                </p>
              )}
            </div>
          </div>

          <div>
            <Button
              onClick={() => setLocation("/logos")}
              className="w-full bg-purple-600 text-white"
            >
              <Image className="mr-2" size={18} />
              Gerenciar Logos
            </Button>
          </div>
        </div>

        <div className="mt-16 text-center text-sm text-gray-400">
          Desenvolvido por Esio Lima - Versão 3.0
        </div>
      </div>
    </div>
  );
}
