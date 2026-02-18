import { useState, useRef, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle2, AlertCircle, Download, Hourglass, Moon, Sun, Image, FileText } from "lucide-react";

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
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [isDark, setIsDark] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const [, setLocation] = useLocation();

  const generateCardsMutation = trpc.card.generateCards.useMutation();

  useEffect(() => {
    const socket = io({ reconnection: true, reconnectionDelay: 1000, reconnectionDelayMax: 5000, reconnectionAttempts: 5 });
    socket.on("connect", () => { socket.emit("join", sessionId); });
    socket.on("progress", (data: ProgressData) => setProgress(data));
    socket.on("error", (message: string) => { setError(message); setIsProcessing(false); });
    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [sessionId]);

  const handleFileSelect = (selectedFile: File | null | undefined) => {
    if (!selectedFile) return;
    if (!selectedFile.name.endsWith(".xlsx")) { setError("Por favor, selecione um arquivo .xlsx válido"); return; }
    if (selectedFile.size > 10 * 1024 * 1024) { setError("O arquivo não pode exceder 10MB"); return; }
    setFile(selectedFile);
    setError(null);
    setZipPath(null);
    setProgress(null);
  };

  const handleUpload = async () => {
    if (!file) { setError("Por favor, selecione um arquivo"); return; }
    setIsProcessing(true);
    setError(null);
    setProgress(null);
    setZipPath(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const uploadResponse = await fetch("/api/upload", { method: "POST", body: formData });
      if (!uploadResponse.ok) throw new Error("Erro ao fazer upload do arquivo");

      const { filePath } = await uploadResponse.json();
      const result = await generateCardsMutation.mutateAsync({ filePath, sessionId });

      if (result.success) setZipPath(result.zipPath);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao processar arquivo");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = async () => {
    if (!zipPath) return;

    try {
      const response = await fetch(`/api/download?zipPath=${encodeURIComponent(zipPath)}`);
      if (!response.ok) throw new Error("Erro ao baixar arquivo");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cards.zip";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao baixar arquivo");
    }
  };

  const handleGenerateJournal = async () => {
    try {
      setIsGeneratingJournal(true);

      const response = await fetch("/api/gerar-jornal", { method: "POST" });
      if (!response.ok) throw new Error("Erro ao gerar jornal");

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
      setError(err instanceof Error ? err.message : "Erro ao gerar jornal");
    } finally {
      setIsGeneratingJournal(false);
    }
  };

  const bgColor = isDark ? "bg-gradient-to-br from-gray-900 via-blue-950 to-purple-950" : "bg-gradient-to-br from-slate-100 via-blue-100 to-purple-100";
  const cardBg = isDark ? "bg-white/10 backdrop-blur-lg border border-white/20" : "bg-white/50 backdrop-blur-lg border border-white/80";
  const textPrimary = isDark ? "text-white" : "text-slate-900";
  const textSecondary = isDark ? "text-slate-300" : "text-slate-600";

  return (
    <div className={`min-h-screen py-12 px-4 ${bgColor}`}>
      <div className="max-w-4xl mx-auto">
        <div className={`${cardBg} rounded-2xl p-8 shadow-2xl`}>

          {!isProcessing && !zipPath && (
            <div className="space-y-6">
              <h2 className={`text-2xl font-bold ${textPrimary}`}>Gerador de Cards</h2>

              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
                className="w-full"
              />

              {error && <p className="text-red-500">{error}</p>}

              <Button onClick={handleUpload} disabled={!file || isProcessing}>
                Processar Planilha
              </Button>
            </div>
          )}

          {isProcessing && (
            <div className="text-center space-y-4">
              <Hourglass className="animate-spin mx-auto" />
              <p>{progress?.percentage}%</p>
            </div>
          )}

          {!isProcessing && zipPath && (
            <div className="space-y-4">
              <h2 className={`text-xl font-bold ${textPrimary}`}>Cards Gerados</h2>

              <Button onClick={handleDownload} className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Baixar Cards (ZIP)
              </Button>

              <Button
                onClick={handleGenerateJournal}
                disabled={isGeneratingJournal}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isGeneratingJournal ? (
                  <>
                    <Hourglass className="w-4 h-4 mr-2 animate-spin" />
                    Gerando Jornal...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4 mr-2" />
                    Gerar Jornal Diagramado
                  </>
                )}
              </Button>

              <Button onClick={() => {
                setFile(null);
                setZipPath(null);
                setProgress(null);
                setError(null);
              }}>
                Processar Outro Arquivo
              </Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
