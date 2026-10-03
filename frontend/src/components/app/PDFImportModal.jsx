import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  UploadCloud,
  Sparkles,
  BookOpen,
  Check,
  AlertCircle,
  Loader2,
  X,
  FileCheck,
  ArrowRight,
  Layers,
  HelpCircle,
  Flame,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { extractTextFromPDF } from "@/lib/pdfExtractor";
import { getAIPayloadExtra } from "@/lib/aiSettings";

export default function PDFImportModal({ open, onClose, onNoteCreated }) {
  const [file, setFile] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [processingAction, setProcessingAction] = useState(null); // 'note' | 'study' | 'reformat'
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  if (!open) return null;

  const handleFileSelect = async (selectedFile) => {
    if (!selectedFile) return;
    if (selectedFile.type !== "application/pdf" && !selectedFile.name.endsWith(".pdf")) {
      toast.error("Please upload a valid .pdf document.");
      return;
    }

    setFile(selectedFile);
    setExtracting(true);
    setExtractedData(null);

    try {
      const data = await extractTextFromPDF(selectedFile);
      setExtractedData(data);
      toast.success(`Extracted text from "${data.filename}" (${data.pageCount} pages)`);
    } catch (err) {
      console.error(err);
      toast.error("Could not extract text from this PDF.");
    } finally {
      setExtracting(false);
    }
  };

  const handleProcessAndCreate = async (actionType) => {
    if (!extractedData || !extractedData.text) return;
    setProcessingAction(actionType);

    try {
      const extra = getAIPayloadExtra();
      const res = await api.post("/ai/pdf-process", {
        text: extractedData.text,
        filename: extractedData.filename,
        action: actionType,
        ...extra,
      });

      const processed = res.data;
      const noteTitle = processed.title || extractedData.title || "Imported PDF";
      const noteContent = processed.structured_content || extractedData.text;

      // 1. Create Note in Database
      const createRes = await api.post("/notes", {
        title: noteTitle,
        content: noteContent,
        tags: ["pdf", "imported"],
      });

      const createdNote = createRes.data;

      // 2. If study cards/quiz generated, save to study set
      if ((processed.cards && processed.cards.length > 0) || (processed.quiz && processed.quiz.length > 0)) {
        await api.post(`/notes/${createdNote.id}/study`, {
          cards: processed.cards || [],
          quiz: processed.quiz || [],
        }).catch(() => {});
      }

      toast.success(`Successfully imported "${noteTitle}"`);
      onClose();
      if (onNoteCreated) {
        onNoteCreated(createdNote, actionType === "study");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to process document. Please try again.");
    } finally {
      setProcessingAction(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const reset = () => {
    setFile(null);
    setExtractedData(null);
    setExtracting(false);
    setProcessingAction(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <FileText size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-1.5">
                Import PDF into Ember
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Document intelligence, structured note generation & active-recall decks
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted/50 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {!extractedData && !extracting && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-foreground/30 hover:bg-muted/30"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files?.[0])}
              />
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3 text-muted-foreground">
                <UploadCloud size={24} />
              </div>
              <h3 className="text-sm font-medium text-foreground">
                Drop your PDF here or click to browse
              </h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Ember extracts raw text, synthesizes an executive synopsis, cleans formatting, and generates study cards.
              </p>
            </div>
          )}

          {extracting && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 size={28} className="animate-spin text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Reading and parsing PDF...</p>
                <p className="text-xs text-muted-foreground mt-0.5">Extracting semantic text streams and metadata</p>
              </div>
            </div>
          )}

          {extractedData && (
            <div className="space-y-4">
              {/* File Info Pill */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-border/80 bg-muted/30 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <FileCheck size={15} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{extractedData.filename}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {extractedData.pageCount} {extractedData.pageCount === 1 ? "page" : "pages"} ·{" "}
                      {Math.round(extractedData.sizeBytes / 1024)} KB · {extractedData.text.split(/\s+/).length} words extracted
                    </p>
                  </div>
                </div>
                <button
                  onClick={reset}
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline ml-2"
                >
                  Change file
                </button>
              </div>

              {/* Text Preview Snippet */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Extracted Text Preview</label>
                <div className="max-h-36 overflow-y-auto p-3 rounded-lg border border-border bg-background/60 text-xs font-mono leading-relaxed text-foreground/80 select-text">
                  {extractedData.text.slice(0, 500)}
                  {extractedData.text.length > 500 ? "..." : ""}
                </div>
              </div>

              {/* Action Choices */}
              <div className="space-y-2 pt-2">
                <label className="text-xs font-medium text-muted-foreground">Choose Intelligence Action</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    disabled={Boolean(processingAction)}
                    onClick={() => handleProcessAndCreate("full_note")}
                    className="flex flex-col items-start p-3.5 rounded-xl border border-border/70 hover:border-primary/50 hover:bg-primary/5 text-left transition-all group relative overflow-hidden"
                  >
                    <div className="flex items-center gap-2 text-foreground font-medium text-xs mb-1">
                      <Sparkles size={14} className="text-amber-500" />
                      <span>Synthesize & Structure Note</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Executive synopsis, cleaned Markdown headers, and organized key takeaways.
                    </p>
                    {processingAction === "full_note" && (
                      <div className="absolute inset-0 bg-background/80 backdrop-blur-xs flex items-center justify-center gap-1.5 text-xs font-medium text-primary">
                        <Loader2 size={13} className="animate-spin" /> Synthesizing...
                      </div>
                    )}
                  </button>

                  <button
                    disabled={Boolean(processingAction)}
                    onClick={() => handleProcessAndCreate("study")}
                    className="flex flex-col items-start p-3.5 rounded-xl border border-border/70 hover:border-emerald-500/50 hover:bg-emerald-500/5 text-left transition-all group relative overflow-hidden"
                  >
                    <div className="flex items-center gap-2 text-foreground font-medium text-xs mb-1">
                      <BookOpen size={14} className="text-emerald-500" />
                      <span>Create Note + Study Deck</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      Creates note & generates interactive flashcards and quiz questions directly.
                    </p>
                    {processingAction === "study" && (
                      <div className="absolute inset-0 bg-background/80 backdrop-blur-xs flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-600">
                        <Loader2 size={13} className="animate-spin" /> Generating Decks...
                      </div>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-border/60 bg-muted/10 flex items-center justify-between text-xs text-muted-foreground">
          <span>Principle Zero: Documents processed locally and isolated to your account.</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-foreground hover:bg-muted font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}
