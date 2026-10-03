import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Check,
  X as XIcon,
  Award,
  Sparkles,
  Layers,
  HelpCircle,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  GraduationCap,
  MessageCircleQuestion,
  Send,
  Flame,
  FileEdit,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { getAIPayloadExtra } from "@/lib/aiSettings";
import { FormattedContent, formatInlineText } from "@/lib/formatContent";

export default function StudyView({
  noteId,
  embedded = false,
  noteTitle = "",
  noteContent = "",
  onNoteChange,
}) {
  const [note, setNote] = useState(null);
  const [cards, setCards] = useState([]);
  const [quiz, setQuiz] = useState([]);
  const [summary, setSummary] = useState("");
  const [keypoints, setKeypoints] = useState("");
  const [loadingCards, setLoadingCards] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // Active Tab: cards | quiz | takeaways | tutor
  const [activeTab, setActiveTab] = useState("cards");

  // Flashcard Deck State
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [cardStats, setCardStats] = useState({ mastered: 0, learning: 0, again: 0 });
  const [deckMode, setDeckMode] = useState("deck"); // "deck" | "grid"

  // Quiz State
  const [score, setScore] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  // Ember Tutor State
  const [tutorMessages, setTutorMessages] = useState([
    {
      role: "assistant",
      content:
        "Welcome to your Ember study session! Ember is a spark that helps ideas grow. Ask me to test you, explain difficult mechanics, provide analogies, or drill into any concept.",
    },
  ]);
  const [tutorInput, setTutorInput] = useState("");
  const [tutorBusy, setTutorBusy] = useState(false);
  const [tutorLevel, setTutorLevel] = useState("intermediate"); // eli5 | beginner | intermediate | advanced
  const [tutorStyle, setTutorStyle] = useState("socratic"); // socratic | analogies | practice | knowledge_check

  // Live Note Pad Side Pane State
  const [splitNoteOpen, setSplitNoteOpen] = useState(true);
  const [localTitle, setLocalTitle] = useState(noteTitle || "Untitled");
  const [localContent, setLocalContent] = useState(noteContent || "");
  const [savingNote, setSavingNote] = useState(false);
  const saveTimerRef = useRef(null);

  const nav = useNavigate();

  // Load Note and Persisted Study Set
  useEffect(() => {
    if (!noteId) return;
    api
      .get(`/notes/${noteId}`)
      .then(({ data }) => {
        setNote(data);
        setLocalTitle((prev) => noteTitle || data.title || prev);
        setLocalContent((prev) => noteContent || data.content || prev);
      })
      .catch(() => {});

    api
      .get(`/notes/${noteId}/study`)
      .then(({ data }) => {
        if (data.cards && data.cards.length > 0) setCards(data.cards);
        if (data.quiz && data.quiz.length > 0) setQuiz(data.quiz);
      })
      .catch(() => {});
  }, [noteId]); // eslint-disable-line

  useEffect(() => {
    if (noteTitle) setLocalTitle(noteTitle);
    if (noteContent !== undefined) setLocalContent(noteContent);
  }, [noteTitle, noteContent]);

  // Debounced Live Note Autosave
  const triggerSave = useCallback(
    (newTitle, newContent) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      setSavingNote(true);

      saveTimerRef.current = setTimeout(async () => {
        try {
          await api.patch(`/notes/${noteId}`, {
            title: newTitle,
            content: newContent,
          });
          onNoteChange?.(newTitle, newContent);
          setSavingNote(false);
        } catch {
          setSavingNote(false);
        }
      }, 750);
    },
    [noteId, onNoteChange]
  );

  const handleTitleChange = (val) => {
    setLocalTitle(val);
    triggerSave(val, localContent);
  };

  const handleContentChange = (val) => {
    setLocalContent(val);
    triggerSave(localTitle, val);
  };

  const appendToNote = (textToAppend, label = "Insight") => {
    const updated = localContent ? `${localContent}\n\n${textToAppend}` : textToAppend;
    setLocalContent(updated);
    triggerSave(localTitle, updated);
    toast.success(`Appended ${label} to note pad`);
  };

  const genCards = async () => {
    const effectiveTitle = localTitle || note?.title || "";
    const effectiveContent = localContent || note?.content || "";
    setLoadingCards(true);
    setFlipped(false);
    setCurrentIdx(0);
    try {
      const extra = getAIPayloadExtra();
      const { data } = await api.post("/ai/flashcards", {
        text: `${effectiveTitle}\n\n${effectiveContent}`,
        note_title: effectiveTitle,
        note_context: effectiveContent,
        ...extra,
      });
      const newCards = data.cards || [];
      setCards(newCards);
      await api.post(`/notes/${noteId}/study`, { cards: newCards, quiz });
      toast.success(`Generated ${newCards.length} active-recall flashcards`);
    } catch {
      toast.error("Could not generate flashcards");
    } finally {
      setLoadingCards(false);
    }
  };

  const genQuiz = async () => {
    const effectiveTitle = localTitle || note?.title || "";
    const effectiveContent = localContent || note?.content || "";
    setLoadingQuiz(true);
    setScore(0);
    setAnsweredCount(0);
    setQuizFinished(false);
    try {
      const extra = getAIPayloadExtra();
      const { data } = await api.post("/ai/quiz", {
        text: `${effectiveTitle}\n\n${effectiveContent}`,
        note_title: effectiveTitle,
        note_context: effectiveContent,
        ...extra,
      });
      const newQuiz = data.questions || [];
      setQuiz(newQuiz);
      await api.post(`/notes/${noteId}/study`, { cards, quiz: newQuiz });
      toast.success(`Generated ${newQuiz.length} interactive quiz questions`);
    } catch {
      toast.error("Could not generate quiz");
    } finally {
      setLoadingQuiz(false);
    }
  };

  const genTakeaways = async () => {
    const effectiveTitle = localTitle || note?.title || "";
    const effectiveContent = localContent || note?.content || "";
    setLoadingSummary(true);
    try {
      const extra = getAIPayloadExtra();
      const [sRes, kRes] = await Promise.all([
        api.post("/ai/summarize", {
          text: `${effectiveTitle}\n\n${effectiveContent}`,
          note_title: effectiveTitle,
          ...extra,
        }),
        api.post("/ai/keypoints", {
          text: `${effectiveTitle}\n\n${effectiveContent}`,
          note_title: effectiveTitle,
          ...extra,
        }),
      ]);
      setSummary(sRes.data.result || "");
      setKeypoints(kRes.data.result || "");
      toast.success("Key takeaways distilled");
    } catch {
      toast.error("Could not distill takeaways");
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleTutorSubmit = async (e) => {
    e?.preventDefault();
    if (!tutorInput.trim() || tutorBusy) return;

    const userMsg = tutorInput.trim();
    setTutorInput("");
    setTutorMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setTutorBusy(true);

    try {
      const extra = getAIPayloadExtra();
      const { data } = await api.post("/ai/tutor", {
        message: userMsg,
        level: tutorLevel,
        style: tutorStyle,
        note_title: localTitle || note?.title || "",
        note_context: localContent || note?.content || "",
        history: tutorMessages.slice(-6),
        ...extra,
      });
      setTutorMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply || "I encountered an issue generating the tutor response.",
          mode: data.mode,
          level: data.level || tutorLevel,
          style: data.style || tutorStyle,
        },
      ]);
    } catch {
      setTutorMessages((prev) => [
        ...prev,
        { role: "assistant", content: "I encountered an issue connecting to Ember Tutor. Please try again." },
      ]);
    } finally {
      setTutorBusy(false);
    }
  };

  // Keyboard navigation for active recall
  useEffect(() => {
    const onKey = (e) => {
      if (activeTab !== "cards" || deckMode !== "deck" || cards.length === 0) return;
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      if (e.code === "Space") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.code === "ArrowRight") {
        nextCard();
      } else if (e.code === "ArrowLeft") {
        prevCard();
      } else if (["Digit1", "Digit2", "Digit3", "Digit4"].includes(e.code)) {
        const rating = e.code.replace("Digit", "");
        gradeCard(rating);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeTab, deckMode, cards.length, flipped, currentIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  const nextCard = () => {
    setFlipped(false);
    setCurrentIdx((i) => (i + 1) % cards.length);
  };

  const prevCard = () => {
    setFlipped(false);
    setCurrentIdx((i) => (i - 1 + cards.length) % cards.length);
  };

  const gradeCard = (rating) => {
    if (rating === "1") setCardStats((s) => ({ ...s, again: s.again + 1 }));
    else if (rating === "2" || rating === "3") setCardStats((s) => ({ ...s, learning: s.learning + 1 }));
    else if (rating === "4") setCardStats((s) => ({ ...s, mastered: s.mastered + 1 }));
    nextCard();
  };

  const handleQuizAnswer = (isCorrect) => {
    if (isCorrect) setScore((s) => s + 1);
    const nextCount = answeredCount + 1;
    setAnsweredCount(nextCount);
    if (nextCount >= quiz.length) {
      setQuizFinished(true);
      toast.success(`Quiz completed! Score: ${score + (isCorrect ? 1 : 0)}/${quiz.length}`);
    }
  };

  const currentCard = cards[currentIdx];
  const progressPercent = cards.length > 0 ? Math.round(((currentIdx + 1) / cards.length) * 100) : 0;
  const wordCount = localContent ? localContent.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className={`w-full ${splitNoteOpen ? "max-w-7xl" : "max-w-4xl"} mx-auto ${embedded ? "py-4 px-3" : "py-8 px-6 sm:px-8"} transition-all`}>
      {/* Header with Title and Mode Breadcrumb */}
      {!embedded && (
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => nav(`/app/n/${noteId}`)}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
          >
            <ArrowLeft size={13} /> Back to note
          </button>

          <button
            onClick={() => setSplitNoteOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/70 bg-card text-xs text-muted-foreground hover:text-foreground transition-all"
          >
            {splitNoteOpen ? <PanelRightClose size={13} /> : <PanelRightOpen size={13} />}
            <span>{splitNoteOpen ? "Hide Note Pad" : "Show Reference Note"}</span>
          </button>
        </div>
      )}

      {/* Main Split Grid */}
      <div className={`grid grid-cols-1 ${splitNoteOpen ? "lg:grid-cols-12 gap-6" : "gap-0"}`}>
        {/* Left / Primary Study Column */}
        <div className={`${splitNoteOpen ? "lg:col-span-7 xl:col-span-8" : "w-full"} space-y-5`}>
          {/* Retention & Progress Analytics Strip */}
          <div className="p-3.5 rounded-xl border border-border/70 bg-secondary/30 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <GraduationCap size={16} className="text-foreground opacity-80" />
              <span className="font-medium text-foreground">Study Studio</span>
              <span className="text-muted-foreground">· {localTitle ? `"${localTitle}"` : "Active recall"}</span>
            </div>

            {/* Analytics Badges & Toggle */}
            <div className="flex items-center gap-2">
              <div className="px-2.5 py-1 rounded-md border border-border/60 bg-background flex items-center gap-1.5">
                <Award size={12} className="text-emerald-500" />
                <span className="font-semibold text-foreground">{cardStats.mastered}</span>
                <span className="text-muted-foreground text-[11px]">Mastered</span>
              </div>
              <div className="px-2.5 py-1 rounded-md border border-border/60 bg-background flex items-center gap-1.5">
                <span className="font-semibold text-foreground">{cards.length}</span>
                <span className="text-muted-foreground text-[11px]">Cards</span>
              </div>
              <div className="px-2.5 py-1 rounded-md border border-border/60 bg-background flex items-center gap-1.5">
                <span className="font-semibold text-foreground">
                  {quiz.length > 0 ? `${Math.round((score / quiz.length) * 100)}%` : "0%"}
                </span>
                <span className="text-muted-foreground text-[11px]">Quiz</span>
              </div>

              {embedded && (
                <button
                  onClick={() => setSplitNoteOpen((v) => !v)}
                  title={splitNoteOpen ? "Hide Note Reference" : "Show Note Reference & Pad"}
                  className="p-1 rounded-md border border-border/60 bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ml-1"
                >
                  {splitNoteOpen ? <PanelRightClose size={13} /> : <PanelRightOpen size={13} />}
                </button>
              )}
            </div>
          </div>

          {/* Segmented Sub-Tab Switcher */}
          <div className="flex items-center p-0.5 rounded-lg bg-secondary/80 border border-border/60 w-fit">
            <button
              onClick={() => setActiveTab("cards")}
              className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === "cards"
                  ? "bg-background text-foreground shadow-xs font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers size={12} /> Cards ({cards.length})
            </button>
            <button
              onClick={() => setActiveTab("quiz")}
              className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === "quiz"
                  ? "bg-background text-foreground shadow-xs font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <HelpCircle size={12} /> Quiz ({quiz.length})
            </button>
            <button
              onClick={() => {
                setActiveTab("takeaways");
                if (!summary) genTakeaways();
              }}
              className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === "takeaways"
                  ? "bg-background text-foreground shadow-xs font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Lightbulb size={12} /> Key Insights
            </button>
            <button
              onClick={() => setActiveTab("tutor")}
              className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                activeTab === "tutor"
                  ? "bg-background text-foreground shadow-xs font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="study-tab-tutor"
            >
              <Sparkles size={12} className="text-accent" /> Socratic Tutor
            </button>
          </div>

          {/* Tab 1: 3D Flashcards Deck */}
          {activeTab === "cards" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono">
                    {cards.length > 0 ? `${currentIdx + 1} / ${cards.length}` : "0 cards"}
                  </span>
                  {cards.length > 0 && (
                    <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {cards.length > 0 && (
                    <button
                      onClick={() => setDeckMode((m) => (m === "deck" ? "grid" : "deck"))}
                      className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-md border border-border/50 hover:bg-muted transition-colors"
                    >
                      {deckMode === "deck" ? "Grid view" : "Deck view"}
                    </button>
                  )}
                  <button
                    onClick={genCards}
                    disabled={loadingCards}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-secondary hover:bg-muted text-foreground transition-all disabled:opacity-50"
                  >
                    {loadingCards ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    <span>{cards.length === 0 ? "Generate Flashcards" : "Regenerate"}</span>
                  </button>
                </div>
              </div>

              {cards.length === 0 ? (
                <div className="p-12 text-center border rounded-2xl bg-card/50 space-y-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                    <Layers size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-foreground">No flashcards yet</h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                      Generate high-yield active-recall cards directly from your note's concepts, definitions, and mechanics.
                    </p>
                  </div>
                  <button
                    onClick={genCards}
                    disabled={loadingCards}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                  >
                    {loadingCards ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    <span>Generate Flashcard Deck</span>
                  </button>
                </div>
              ) : deckMode === "grid" ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {cards.map((c, i) => (
                    <FlashcardItem
                      key={i}
                      q={c.q}
                      a={c.a}
                      idx={i}
                      category={c.category}
                      onAppend={() => appendToNote(`- **${c.q}**: ${c.a}`, `Card #${i + 1}`)}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Active 3D Card Flipper */}
                  <div
                    onClick={() => setFlipped((f) => !f)}
                    className="cursor-pointer min-h-[260px] sm:min-h-[300px] p-8 rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative group select-none"
                  >
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${flipped ? "bg-emerald-500" : "bg-primary"}`} />
                        {flipped ? "Answer" : "Question"}
                      </span>
                      {currentCard?.category && (
                        <span className="text-primary font-normal">{currentCard.category}</span>
                      )}
                    </div>

                    <div className="py-6 flex items-center justify-center text-center">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={flipped ? `a-${currentIdx}` : `q-${currentIdx}`}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.15 }}
                          className="text-base sm:text-lg font-medium leading-relaxed text-foreground max-w-xl"
                        >
                          {formatInlineText(flipped ? currentCard?.a : currentCard?.q)}
                        </motion.div>
                      </AnimatePresence>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-3">
                      <span className="text-[11px]">Click or press Space to flip</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (currentCard) {
                            appendToNote(
                              `- **Q**: ${currentCard.q}\n  - **A**: ${currentCard.a}`,
                              `Card #${currentIdx + 1}`
                            );
                          }
                        }}
                        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
                        title="Append this Q&A to the reference note pad"
                      >
                        <Plus size={12} /> Add to note pad
                      </button>
                    </div>
                  </div>

                  {/* Rating & Navigation Bar */}
                  <div className="flex items-center justify-between gap-3">
                    <button
                      onClick={prevCard}
                      className="p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Previous (Left arrow)"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    {flipped ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => gradeCard("1")}
                          className="px-3 py-1.5 rounded-lg border border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400 text-xs font-medium hover:bg-rose-500/20 transition-colors"
                        >
                          Again <span className="opacity-60 text-[10px]">(1)</span>
                        </button>
                        <button
                          onClick={() => gradeCard("2")}
                          className="px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors"
                        >
                          Hard <span className="opacity-60 text-[10px]">(2)</span>
                        </button>
                        <button
                          onClick={() => gradeCard("3")}
                          className="px-3 py-1.5 rounded-lg border border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400 text-xs font-medium hover:bg-sky-500/20 transition-colors"
                        >
                          Good <span className="opacity-60 text-[10px]">(3)</span>
                        </button>
                        <button
                          onClick={() => gradeCard("4")}
                          className="px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                        >
                          Easy <span className="opacity-60 text-[10px]">(4)</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setFlipped(true)}
                        className="px-4 py-1.5 rounded-lg text-xs font-medium bg-secondary hover:bg-muted text-foreground transition-colors"
                      >
                        Show Answer <span className="opacity-60 text-[10px]">(Space)</span>
                      </button>
                    )}

                    <button
                      onClick={nextCard}
                      className="p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Next (Right arrow)"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Interactive Quiz */}
          {activeTab === "quiz" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-mono">
                  {quiz.length > 0 ? `${answeredCount} / ${quiz.length} answered` : "0 questions"}
                </span>

                <button
                  onClick={genQuiz}
                  disabled={loadingQuiz}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-secondary hover:bg-muted text-foreground transition-all disabled:opacity-50"
                >
                  {loadingQuiz ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  <span>{quiz.length === 0 ? "Generate Quiz" : "Regenerate"}</span>
                </button>
              </div>

              {quiz.length === 0 ? (
                <div className="p-12 text-center border rounded-2xl bg-card/50 space-y-3">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                    <HelpCircle size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-foreground">No quiz generated yet</h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                      Test your comprehension with 5 multiple-choice questions testing core concepts and edge cases.
                    </p>
                  </div>
                  <button
                    onClick={genQuiz}
                    disabled={loadingQuiz}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                  >
                    {loadingQuiz ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    <span>Generate Quiz</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {quiz.map((q, idx) => (
                    <QuizItem
                      key={idx}
                      item={q}
                      idx={idx}
                      onAnswer={handleQuizAnswer}
                      onAppend={(text) => appendToNote(text, `Quiz #${idx + 1} Takeaway`)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Key Takeaways & Executive Summary */}
          {activeTab === "takeaways" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Distilled Document Intelligence</span>
                <button
                  onClick={genTakeaways}
                  disabled={loadingSummary}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-secondary hover:bg-muted text-foreground transition-all disabled:opacity-50"
                >
                  {loadingSummary ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  <span>Regenerate Takeaways</span>
                </button>
              </div>

              {loadingSummary ? (
                <div className="p-12 flex flex-col items-center justify-center text-center space-y-2">
                  <Loader2 size={24} className="animate-spin text-primary" />
                  <p className="text-xs text-muted-foreground">Distilling executive takeaways and realization points...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {summary && (
                    <div className="p-5 rounded-2xl border border-border bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                          Executive Synthesis
                        </h4>
                        <button
                          onClick={() => appendToNote(`### Executive Summary\n${summary}`, "Executive Summary")}
                          className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                        >
                          <Plus size={11} /> Add to note pad
                        </button>
                      </div>
                      <FormattedContent content={summary} className="text-sm leading-relaxed text-foreground/90" />
                    </div>
                  )}

                  {keypoints && (
                    <div className="p-5 rounded-2xl border border-border bg-card space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                          Essential Insights
                        </h4>
                        <button
                          onClick={() => appendToNote(`### Essential Insights\n${keypoints}`, "Key Insights")}
                          className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                        >
                          <Plus size={11} /> Add to note pad
                        </button>
                      </div>
                      <FormattedContent content={keypoints} className="text-sm leading-relaxed text-foreground/90 font-sans" />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Socratic Tutor */}
          {activeTab === "tutor" && (
            <div className="space-y-4">
              {/* Tutor Depth & Style Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border border-border/60 bg-muted/20 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Depth:</span>
                  <select
                    value={tutorLevel}
                    onChange={(e) => setTutorLevel(e.target.value)}
                    className="bg-background border border-border rounded-md px-2 py-1 text-xs outline-none text-foreground"
                  >
                    <option value="eli5">ELI5 (Simple Analogies)</option>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate (Standard)</option>
                    <option value="advanced">Advanced (Rigorous)</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Style:</span>
                  <select
                    value={tutorStyle}
                    onChange={(e) => setTutorStyle(e.target.value)}
                    className="bg-background border border-border rounded-md px-2 py-1 text-xs outline-none text-foreground"
                  >
                    <option value="socratic">Socratic Questioning</option>
                    <option value="analogies">Vivid Real-World Analogies</option>
                    <option value="practice">Active Practice Drill</option>
                    <option value="knowledge_check">Direct Knowledge Check</option>
                  </select>
                </div>
              </div>

              {/* Chat Thread */}
              <div className="space-y-3 min-h-[280px] max-h-[420px] overflow-y-auto p-4 rounded-2xl border border-border bg-card/60">
                {tutorMessages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[88%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground font-medium rounded-br-xs"
                          : "bg-muted/70 text-foreground border border-border/60 rounded-bl-xs"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      ) : (
                        <FormattedContent content={msg.content} />
                      )}
                      {msg.role === "assistant" && i > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/40 flex justify-end">
                          <button
                            onClick={() => appendToNote(`> **Tutor Insight**: ${msg.content}`, "Tutor Insight")}
                            className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1"
                          >
                            <Plus size={10} /> Add to note pad
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {tutorBusy && (
                  <div className="flex justify-start">
                    <div className="p-3 rounded-2xl bg-muted/70 text-xs text-muted-foreground flex items-center gap-2">
                      <Loader2 size={12} className="animate-spin text-primary" />
                      <span>Ember Tutor is thinking...</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Tutor Input Form */}
              <form onSubmit={handleTutorSubmit} className="flex items-center gap-2">
                <input
                  value={tutorInput}
                  onChange={(e) => setTutorInput(e.target.value)}
                  placeholder="Ask Ember Tutor to test your assumptions or explain a mechanism..."
                  className="flex-1 px-4 py-2 rounded-xl border border-border bg-card text-xs sm:text-sm outline-none placeholder:text-muted-foreground/40 focus:border-primary/60 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!tutorInput.trim() || tutorBusy}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-all text-xs font-medium flex items-center gap-1.5"
                >
                  <Send size={13} />
                  <span>Send</span>
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Right Column: Live Reference Note & Editor Pane */}
        {splitNoteOpen && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
            className="lg:col-span-5 xl:col-span-4 mt-6 lg:mt-0 flex flex-col border border-border/80 rounded-2xl bg-card shadow-sm overflow-hidden min-h-[500px]"
          >
            {/* Note Header Strip */}
            <div className="px-4 py-3 border-b border-border/60 bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                <FileEdit size={14} className="text-primary" />
                <span>Reference & Live Note Pad</span>
              </div>

              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                {savingNote ? (
                  <span className="flex items-center gap-1 text-amber-500">
                    <Loader2 size={10} className="animate-spin" /> Saving...
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-emerald-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Saved
                  </span>
                )}
                <span>·</span>
                <span>{wordCount} words</span>
              </div>
            </div>

            {/* Note Title Input */}
            <div className="p-4 border-b border-border/40">
              <input
                value={localTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Document Title..."
                className="w-full text-base font-semibold text-foreground bg-transparent border-0 outline-none placeholder:text-muted-foreground/30"
              />
            </div>

            {/* Note Content Textarea */}
            <div className="p-4 flex-1 flex flex-col">
              <textarea
                value={localContent}
                onChange={(e) => handleContentChange(e.target.value)}
                placeholder="Write notes, reflections, or study points here in real time..."
                className="w-full flex-1 min-h-[360px] resize-none bg-transparent border-0 outline-none text-xs sm:text-sm leading-relaxed text-foreground font-sans placeholder:text-muted-foreground/30"
              />
            </div>

            {/* Note Footer Tip */}
            <div className="px-4 py-2.5 bg-muted/10 border-t border-border/50 text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Changes autosave to note</span>
              <button
                onClick={() => nav(`/app/n/${noteId}`)}
                className="text-primary hover:underline font-medium"
              >
                Open in Full Editor →
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function FlashcardItem({ q, a, idx, category, onAppend }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <div className="p-5 rounded-2xl border border-border bg-card hover:-translate-y-0.5 hover:shadow-sm transition-all min-h-[170px] flex flex-col justify-between group">
      <div onClick={() => setFlipped((f) => !f)} className="cursor-pointer flex-1">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2.5">
          <span>{flipped ? "Answer" : "Question"}</span>
          {category && <span className="text-primary font-normal">{category}</span>}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={flipped ? "a" : "q"}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -3 }}
            className="text-xs sm:text-sm leading-relaxed font-medium text-foreground"
          >
            {formatInlineText(flipped ? a : q)}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-3 text-[11px] text-muted-foreground/70 flex items-center justify-between border-t border-border/40 pt-2">
        <span onClick={() => setFlipped((f) => !f)} className="cursor-pointer hover:text-foreground">
          #{idx + 1} · Click to flip
        </span>
        {onAppend && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAppend();
            }}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-opacity flex items-center gap-1 text-[11px]"
            title="Append to note pad"
          >
            <Plus size={11} /> Add to note
          </button>
        )}
      </div>
    </div>
  );
}

function QuizItem({ item, idx, onAnswer, onAppend }) {
  const [picked, setPicked] = useState(null);
  const correct = item.answer ?? 0;

  const handlePick = (i) => {
    if (picked !== null) return;
    setPicked(i);
    onAnswer(i === correct);
  };

  return (
    <div className="p-5 rounded-2xl border border-border bg-card shadow-xs" data-testid={`quiz-item-${idx}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold text-xs sm:text-sm leading-snug text-foreground">
          {idx + 1}. {formatInlineText(item.q)}
        </div>
        {onAppend && picked !== null && (
          <button
            onClick={() =>
              onAppend(
                `- **Q**: ${item.q}\n  - **Correct**: ${item.options?.[correct]}\n  - **Takeaway**: ${item.explanation || ""}`
              )
            }
            className="text-[11px] text-muted-foreground hover:text-primary shrink-0 flex items-center gap-1"
            title="Add quiz takeaway to note pad"
          >
            <Plus size={11} /> Add to note
          </button>
        )}
      </div>

      <div className="mt-3.5 grid sm:grid-cols-2 gap-2">
        {item.options?.map((opt, i) => {
          const isPicked = picked === i;
          const isRight = picked !== null && i === correct;
          const isWrong = picked !== null && isPicked && i !== correct;

          return (
            <button
              key={i}
              onClick={() => handlePick(i)}
              disabled={picked !== null}
              className={`text-left px-3.5 py-2.5 rounded-xl border text-xs transition-all ${
                isRight
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium"
                  : isWrong
                  ? "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                  : isPicked
                  ? "border-foreground"
                  : "hover:bg-muted/70 hover:border-foreground/30"
              }`}
              data-testid={`quiz-option-${idx}-${i}`}
            >
              <div className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0">
                  {isRight ? (
                    <Check size={12} className="text-emerald-500" strokeWidth={3} />
                  ) : isWrong ? (
                    <XIcon size={12} className="text-rose-500" strokeWidth={3} />
                  ) : (
                    <span className="text-[11px] font-mono text-muted-foreground">
                      {String.fromCharCode(65 + i)}.
                    </span>
                  )}
                </span>
                <span className="leading-snug">{formatInlineText(opt)}</span>
              </div>
            </button>
          );
        })}
      </div>

      {picked !== null && item.explanation && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-3 pt-2.5 border-t border-border/60 text-xs text-muted-foreground"
        >
          <span className="font-semibold text-foreground">Explanation: </span>
          {formatInlineText(item.explanation)}
        </motion.div>
      )}
    </div>
  );
}
