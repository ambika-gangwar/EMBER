import { useEffect, useState, useCallback } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import api from "@/lib/api";
import { getAIPayloadExtra } from "@/lib/aiSettings";

export default function StudyView({ noteId, embedded = false }) {
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

  // Ember Tutor State (Multi-depth & Multi-style)
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

  const nav = useNavigate();

  // Load Note and Persisted Study Set
  useEffect(() => {
    if (!noteId) return;
    api.get(`/notes/${noteId}`).then(({ data }) => setNote(data)).catch(() => {});
    api
      .get(`/notes/${noteId}/study`)
      .then(({ data }) => {
        if (data.cards && data.cards.length > 0) setCards(data.cards);
        if (data.quiz && data.quiz.length > 0) setQuiz(data.quiz);
      })
      .catch(() => {});
  }, [noteId]);

  const genCards = async () => {
    if (!note) return;
    setLoadingCards(true);
    setFlipped(false);
    setCurrentIdx(0);
    try {
      const extra = getAIPayloadExtra();
      const { data } = await api.post("/ai/flashcards", {
        text: `${note.title || ""}\n\n${note.content || ""}`,
        note_title: note.title,
        note_context: note.content,
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
    if (!note) return;
    setLoadingQuiz(true);
    setScore(0);
    setAnsweredCount(0);
    setQuizFinished(false);
    try {
      const extra = getAIPayloadExtra();
      const { data } = await api.post("/ai/quiz", {
        text: `${note.title || ""}\n\n${note.content || ""}`,
        note_title: note.title,
        note_context: note.content,
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
    if (!note) return;
    setLoadingSummary(true);
    try {
      const extra = getAIPayloadExtra();
      const [sRes, kRes] = await Promise.all([
        api.post("/ai/summarize", {
          text: `${note.title || ""}\n\n${note.content || ""}`,
          note_title: note.title,
          ...extra,
        }),
        api.post("/ai/keypoints", {
          text: `${note.title || ""}\n\n${note.content || ""}`,
          note_title: note.title,
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
        note_title: note?.title || "",
        note_context: note?.content || "",
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

  return (
    <div className={`w-full max-w-3xl mx-auto ${embedded ? "py-4 px-2" : "py-8 px-6 sm:px-8"} space-y-5`}>
      {/* Header with Title and Mode Breadcrumb */}
      {!embedded && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => nav(`/app/n/${noteId}`)}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors"
          >
            <ArrowLeft size={13} /> Back to note
          </button>
        </div>
      )}

      {/* Retention & Progress Analytics Strip */}
      <div className="p-3.5 rounded-xl border border-border/70 bg-secondary/30 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <GraduationCap size={16} className="text-foreground opacity-80" />
          <span className="font-medium text-foreground">Study Studio</span>
          <span className="text-muted-foreground">· {note?.title ? `"${note.title}"` : "Active recall"}</span>
        </div>

        {/* Analytics Badges */}
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
            <span className="text-xs text-muted-foreground">
              {cards.length > 0 ? (
                <span>
                  Card <strong className="text-foreground">{currentIdx + 1}</strong> of {cards.length} ·{" "}
                  <span className="font-mono text-[11px] opacity-75">
                    [Space] flip · [1-4] grade · [←/→] navigate
                  </span>
                </span>
              ) : (
                "No cards generated yet"
              )}
            </span>

            <div className="flex items-center gap-1.5">
              {cards.length > 0 && (
                <button
                  onClick={() => setDeckMode(deckMode === "deck" ? "grid" : "deck")}
                  className="h-7 px-2.5 rounded-md border border-border/60 bg-background text-xs font-medium hover:bg-muted transition-colors"
                >
                  {deckMode === "deck" ? "Grid" : "Deck"}
                </button>
              )}
              <button
                onClick={genCards}
                disabled={loadingCards}
                className="h-7 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium inline-flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {loadingCards ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
                <span>{cards.length === 0 ? "Generate Flashcards" : "Regenerate"}</span>
              </button>
            </div>
          </div>

          {cards.length === 0 && !loadingCards ? (
            <div className="p-10 rounded-xl border border-dashed border-border/80 text-center space-y-2.5">
              <Layers size={28} className="mx-auto opacity-30 text-foreground" />
              <div className="font-medium text-sm text-foreground">No study cards generated yet</div>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Generate high-yield active-recall flashcards directly from this document's core concepts.
              </p>
              <button
                onClick={genCards}
                className="h-8 px-4 rounded-md bg-primary text-primary-foreground text-xs font-medium inline-flex items-center gap-1.5"
              >
                <Sparkles size={12} /> Generate Flashcards
              </button>
            </div>
          ) : deckMode === "deck" && currentCard ? (
            <div className="space-y-3">
              {/* Progress bar */}
              <div className="w-full bg-secondary h-1 rounded-full overflow-hidden">
                <div
                  className="bg-primary h-full transition-all duration-200"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* 3D Flip Card Container */}
              <div
                style={{ perspective: 1200 }}
                className="min-h-[260px] sm:min-h-[300px] w-full cursor-pointer select-none"
                onClick={() => setFlipped((f) => !f)}
              >
                <motion.div
                  animate={{ rotateY: flipped ? 180 : 0 }}
                  transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
                  style={{ transformStyle: "preserve-3d" }}
                  className="relative w-full h-full min-h-[260px] sm:min-h-[300px] rounded-xl border border-border/80 shadow-xs bg-card p-6 sm:p-8 flex flex-col justify-between"
                >
                  {/* Card Category & Flip Indicator */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {currentCard.category || "Active Recall"}
                    </span>
                    <span className="text-[10px] font-mono opacity-50">Click or [Space] to flip</span>
                  </div>

                  {/* Question (Front) or Answer (Back) */}
                  <div className="my-auto py-4">
                    {!flipped ? (
                      <div>
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block mb-1.5">
                          Prompt
                        </span>
                        <div className="text-base sm:text-xl font-medium leading-relaxed text-foreground">
                          {currentCard.q}
                        </div>
                      </div>
                    ) : (
                      <div style={{ transform: "rotateY(180deg)" }}>
                        <span className="text-[10px] uppercase font-semibold tracking-wider text-accent block mb-1.5">
                          Answer
                        </span>
                        <div className="text-sm sm:text-base font-normal leading-relaxed text-foreground">
                          {currentCard.a}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Navigation Footer */}
                  <div className="flex items-center justify-between border-t border-border/40 pt-3 text-xs text-muted-foreground">
                    <span className="font-mono text-[11px]">
                      #{currentIdx + 1} of {cards.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          prevCard();
                        }}
                        className="h-7 w-7 rounded-md border border-border/60 bg-background hover:bg-muted flex items-center justify-center transition-colors"
                      >
                        <ChevronLeft size={13} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          nextCard();
                        }}
                        className="h-7 w-7 rounded-md border border-border/60 bg-background hover:bg-muted flex items-center justify-center transition-colors"
                      >
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Spaced Repetition Grading Controls */}
              {flipped && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-4 gap-2 pt-2 select-none"
                >
                  <button
                    onClick={() => gradeCard("1")}
                    className="p-2.5 rounded-xl border border-border/80 bg-card hover:bg-muted/60 text-foreground text-xs font-medium transition-all text-center shadow-ambient"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                      <span>Again</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">1</div>
                  </button>
                  <button
                    onClick={() => gradeCard("2")}
                    className="p-2.5 rounded-xl border border-border/80 bg-card hover:bg-muted/60 text-foreground text-xs font-medium transition-all text-center shadow-ambient"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span>Hard</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">2</div>
                  </button>
                  <button
                    onClick={() => gradeCard("3")}
                    className="p-2.5 rounded-xl border border-border/80 bg-card hover:bg-muted/60 text-foreground text-xs font-medium transition-all text-center shadow-ambient"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      <span>Good</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">3</div>
                  </button>
                  <button
                    onClick={() => gradeCard("4")}
                    className="p-2.5 rounded-xl border border-border/80 bg-card hover:bg-muted/60 text-foreground text-xs font-medium transition-all text-center shadow-ambient"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>Easy</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">4</div>
                  </button>
                </motion.div>
              )}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {cards.map((c, i) => (
                <FlashcardItem key={i} q={c.q} a={c.a} idx={i} category={c.category} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Practice Quiz */}
      {activeTab === "quiz" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {quiz.length > 0 ? `${quiz.length} multiple choice conceptual questions` : "No quiz yet"}
            </span>
            <button
              onClick={genQuiz}
              disabled={loadingQuiz}
              className="h-8 px-3.5 rounded-full bg-foreground text-background text-xs font-medium inline-flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loadingQuiz ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              <span>{quiz.length === 0 ? "Generate Quiz" : "Regenerate"}</span>
            </button>
          </div>

          {quizFinished && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-6 rounded-3xl border bg-primary/5 border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Award size={20} className="text-amber-500" />
                  <span className="font-semibold text-lg text-foreground" style={{ fontFamily: "Outfit" }}>
                    Quiz Completed!
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  You scored <strong className="text-foreground">{score}</strong> out of{" "}
                  <strong>{quiz.length}</strong> ({Math.round((score / quiz.length) * 100)}%).
                </p>
              </div>

              <button
                onClick={genQuiz}
                className="h-8 px-4 rounded-full bg-foreground text-background text-xs font-medium hover:opacity-90 transition-all inline-flex items-center gap-1.5"
              >
                <RotateCcw size={12} /> Retry Quiz
              </button>
            </motion.div>
          )}

          <div className="space-y-4">
            {quiz.map((q, i) => (
              <QuizItem key={i} item={q} idx={i} onAnswer={handleQuizAnswer} />
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Key Takeaways */}
      {activeTab === "takeaways" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Executive synthesis and essential realization bullets</span>
            <button
              onClick={genTakeaways}
              disabled={loadingSummary}
              className="h-8 px-3.5 rounded-full bg-foreground text-background text-xs font-medium inline-flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loadingSummary ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              <span>{summary ? "Refresh Takeaways" : "Distill Takeaways"}</span>
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 rounded-3xl border bg-card shadow-ambient space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                <BookOpen size={14} /> Executive Summary
              </div>
              <div className="prose-note text-sm leading-relaxed whitespace-pre-wrap">
                {summary || "Click Distill Takeaways to synthesize this note into an executive summary."}
              </div>
            </div>

            <div className="p-6 rounded-3xl border bg-card shadow-ambient space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <Lightbulb size={14} /> Core Insights
              </div>
              <div className="prose-note text-sm leading-relaxed whitespace-pre-wrap">
                {keypoints || "Click Distill Takeaways to extract self-contained mental models."}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Multi-Depth Ember Tutor */}
      {activeTab === "tutor" && (
        <div className="rounded-3xl border bg-card shadow-ambient flex flex-col h-[580px] overflow-hidden">
          {/* Header & Controls */}
          <div className="p-4 border-b bg-muted/30 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl overflow-hidden border border-violet-500/30 flex items-center justify-center shrink-0 shadow-xs">
                  <img src="/logo.png" alt="Ember" className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    Ember Tutor
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                      Factual & Concrete
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Understands this note and general concepts (e.g. recursion, algorithms)
                  </div>
                </div>
              </div>
              <button
                onClick={() =>
                  setTutorMessages([
                    {
                      role: "assistant",
                      content:
                        "Session reset. What concept would you like to explore? Feel free to ask about this note or any general topic.",
                    },
                  ])
                }
                className="text-xs text-muted-foreground hover:text-foreground font-medium"
                data-testid="tutor-reset-btn"
              >
                Reset
              </button>
            </div>

            {/* Depth & Style Selectors */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 text-[11px]">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground mr-1">Depth:</span>
                {[
                  { key: "eli5", label: "ELI5" },
                  { key: "beginner", label: "Beginner" },
                  { key: "intermediate", label: "Intermediate" },
                  { key: "advanced", label: "Advanced" },
                ].map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setTutorLevel(d.key)}
                    className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                      tutorLevel === d.key
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                    }`}
                    data-testid={`tutor-depth-${d.key}`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1">
                <span className="text-muted-foreground mr-1">Style:</span>
                {[
                  { key: "socratic", label: "Socratic" },
                  { key: "analogies", label: "Analogies" },
                  { key: "practice", label: "Practice Drill" },
                  { key: "knowledge_check", label: "Knowledge Check" },
                ].map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setTutorStyle(s.key)}
                    className={`px-2 py-0.5 rounded-md font-medium transition-colors ${
                      tutorStyle === s.key
                        ? "bg-foreground text-background font-semibold"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                    }`}
                    data-testid={`tutor-style-${s.key}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
            {tutorMessages.map((m, i) => (
              <div
                key={i}
                className={`flex gap-2.5 max-w-[88%] ${m.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}
              >
                <div
                  className={`h-7 w-7 rounded-xl flex items-center justify-center text-xs shrink-0 font-bold overflow-hidden ${
                    m.role === "user"
                      ? "bg-foreground text-background"
                      : "border border-amber-500/30"
                  }`}
                >
                  {m.role === "user" ? (
                    "Y"
                  ) : (
                    <img src="/logo.png" alt="Ember" className="w-full h-full object-cover" />
                  )}
                </div>
                <div
                  className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                    m.role === "user"
                      ? "bg-foreground text-background"
                      : "bg-muted/70 text-foreground border border-border/60"
                  }`}
                >
                  {m.mode && (
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1">
                      {m.mode === "general" ? "General Concept" : "Note-Grounded"} · {m.level} · {m.style}
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">{m.content}</div>
                </div>
              </div>
            ))}
            {tutorBusy && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground italic pl-10">
                <Loader2 size={12} className="animate-spin" /> Ember is formulating explanation...
              </div>
            )}
          </div>

          {/* Quick Prompts */}
          <div className="px-4 py-2 bg-muted/20 border-t flex items-center gap-2 overflow-x-auto text-[11px] text-muted-foreground">
            <span className="shrink-0 font-medium">Quick:</span>
            {[
              "Explain like I'm 5",
              "Give an intuitive analogy",
              "Give me a practice problem",
              "What are the failure modes?",
            ].map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setTutorInput(p);
                }}
                className="shrink-0 px-2 py-0.5 rounded-full border bg-background hover:bg-muted hover:text-foreground transition-colors"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Input Form */}
          <form onSubmit={handleTutorSubmit} className="p-3 border-t flex items-center gap-2 bg-background">
            <input
              type="text"
              value={tutorInput}
              onChange={(e) => setTutorInput(e.target.value)}
              placeholder="Ask about this note or any concept (e.g., 'What is recursion?')..."
              className="flex-1 h-9 px-3 rounded-xl border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              data-testid="tutor-input"
            />
            <button
              type="submit"
              disabled={tutorBusy || !tutorInput.trim()}
              className="h-9 px-4 rounded-xl bg-foreground text-background text-xs font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center gap-1.5"
              data-testid="tutor-submit-btn"
            >
              <Send size={12} />
              <span>Ask Ember</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function FlashcardItem({ q, a, idx, category }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button
      onClick={() => setFlipped((f) => !f)}
      className="text-left p-6 rounded-3xl border bg-card hover:-translate-y-0.5 hover:shadow-ambient transition-all min-h-[180px] flex flex-col justify-between"
      data-testid={`flashcard-${idx}`}
    >
      <div>
        <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-3">
          <span>{flipped ? "Answer" : "Question"}</span>
          {category && <span className="text-primary font-normal">{category}</span>}
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={flipped ? "a" : "q"}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-sm leading-relaxed font-medium text-foreground"
          >
            {flipped ? a : q}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mt-4 text-[11px] text-muted-foreground/70 flex items-center justify-between border-t pt-2">
        <span>Click to flip</span>
        <span className="font-mono">#{idx + 1}</span>
      </div>
    </button>
  );
}

function QuizItem({ item, idx, onAnswer }) {
  const [picked, setPicked] = useState(null);
  const correct = item.answer ?? 0;

  const handlePick = (i) => {
    if (picked !== null) return;
    setPicked(i);
    onAnswer(i === correct);
  };

  return (
    <div className="p-6 rounded-3xl border bg-card shadow-sm" data-testid={`quiz-item-${idx}`}>
      <div className="font-semibold text-sm sm:text-base leading-snug">
        {idx + 1}. {item.q}
      </div>

      <div className="mt-4 grid sm:grid-cols-2 gap-2.5">
        {item.options?.map((opt, i) => {
          const isPicked = picked === i;
          const isRight = picked !== null && i === correct;
          const isWrong = picked !== null && isPicked && i !== correct;

          return (
            <button
              key={i}
              onClick={() => handlePick(i)}
              disabled={picked !== null}
              className={`text-left px-4 py-3 rounded-2xl border text-xs sm:text-sm transition-all ${
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
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0">
                  {isRight ? (
                    <Check size={13} className="text-emerald-500" strokeWidth={3} />
                  ) : isWrong ? (
                    <XIcon size={13} className="text-rose-500" strokeWidth={3} />
                  ) : (
                    <span className="text-xs font-mono text-muted-foreground">
                      {String.fromCharCode(65 + i)}.
                    </span>
                  )}
                </span>
                <span className="leading-snug">{opt}</span>
              </div>
            </button>
          );
        })}
      </div>

      {picked !== null && item.explanation && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-4 pt-3 border-t text-xs sm:text-sm text-muted-foreground"
        >
          <span className="font-semibold text-foreground">Explanation: </span>
          {item.explanation}
        </motion.div>
      )}
    </div>
  );
}
