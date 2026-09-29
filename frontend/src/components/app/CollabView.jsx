import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Users2,
  MessageSquare,
  Share2,
  Clock,
  Send,
  Trash2,
  CheckCircle,
  Copy,
  UserPlus,
  ShieldCheck,
  Eye,
  Edit3,
  Sparkles,
  Loader2,
} from "lucide-react";
import api from "@/lib/api";
import { getAIPayloadExtra } from "@/lib/aiSettings";
import LiveCursors from "./LiveCursors";

export default function CollabView({
  noteId,
  noteTitle,
  noteContent,
  user,
  collaborators = [],
  readerCount = 1,
  remoteCursors = {},
  onMouseMove,
}) {
  const [activeTab, setActiveTab] = useState("comments"); // comments | activity | share | facilitator
  const [comments, setComments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [sharedCollaborators, setSharedCollaborators] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [loading, setLoading] = useState(false);
  const [facilitateResult, setFacilitateResult] = useState("");
  const [facilitating, setFacilitating] = useState(false);
  const [facilitatePrompt, setFacilitatePrompt] = useState("");

  // Fetch comments, activity, and shared collaborators
  useEffect(() => {
    if (!noteId) return;
    loadCollabData();
  }, [noteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCollabData = async () => {
    try {
      const [cRes, aRes, sRes] = await Promise.all([
        api.get(`/notes/${noteId}/comments`),
        api.get(`/notes/${noteId}/activity`),
        api.get(`/notes/${noteId}/collaborators`),
      ]);
      setComments(cRes.data.comments || []);
      setActivities(aRes.data.activities || []);
      setSharedCollaborators(sRes.data.collaborators || []);
    } catch {
      // Ignore initial load errors gracefully
    }
  };

  const handleAddComment = async (e) => {
    e?.preventDefault();
    if (!newComment.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.post(`/notes/${noteId}/comments`, {
        text: newComment.trim(),
        anchor_text: "",
      });
      setComments((prev) => [...prev, data]);
      setNewComment("");
      toast.success("Comment added");
      // Refresh activity timeline
      api.get(`/notes/${noteId}/activity`).then(({ data }) => setActivities(data.activities || []));
    } catch {
      toast.error("Could not post comment");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await api.delete(`/notes/${noteId}/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      toast.success("Comment resolved");
    } catch {
      toast.error("Could not resolve comment");
    }
  };

  const handleShare = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteEmail.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post(`/notes/${noteId}/share`, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setSharedCollaborators((prev) => {
        const filtered = prev.filter((c) => c.email !== inviteEmail.trim());
        return [...filtered, data.collaborator];
      });
      setInviteEmail("");
      toast.success(`Invite sent to ${inviteEmail}`);
      // Refresh activity
      api.get(`/notes/${noteId}/activity`).then(({ data }) => setActivities(data.activities || []));
    } catch {
      toast.error("Could not share note");
    } finally {
      setLoading(false);
    }
  };

  const copyShareLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    toast.success("Shareable note link copied to clipboard");
  };

  const handleFacilitate = async () => {
    setFacilitating(true);
    toast.info("Spark Facilitator: Synthesizing team discussion...");
    try {
      const extra = getAIPayloadExtra();
      const { data } = await api.post("/ai/facilitate", {
        note_id: noteId,
        note_title: noteTitle,
        note_content: noteContent,
        comments,
        activities,
        prompt: facilitatePrompt,
        ...extra,
      });
      setFacilitateResult(data.synthesis || "");
      toast.success("Discussion synthesized");
    } catch {
      toast.error("Could not synthesize discussion");
    } finally {
      setFacilitating(false);
    }
  };

  return (
    <div
      className="relative flex-1 flex flex-col lg:flex-row overflow-hidden"
      onMouseMove={onMouseMove}
      data-testid="collab-view"
    >
      {/* Live Remote Cursors Canvas Overlay */}
      <LiveCursors remoteCursors={remoteCursors} />

      {/* Main Canvas Area: Collaborative Reading & Discussion Anchor */}
      <div className="flex-1 overflow-y-auto px-6 sm:px-12 py-8 max-w-4xl mx-auto w-full">
        {/* Presence Status Banner */}
        <div className="mb-6 p-4 rounded-2xl glass-card flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Users2 size={20} />
            </div>
            <div>
              <div className="text-sm font-semibold flex items-center gap-2">
                <span>Collaborative Canvas</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <div className="text-xs text-muted-foreground">
                {readerCount > 1
                  ? `${readerCount} people currently viewing this note in real-time`
                  : "You are the only person currently viewing this note"}
              </div>
            </div>
          </div>

          {/* Active Collaborator Avatars */}
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2 overflow-hidden p-1">
              <div
                title={`${user?.name || "You"} (You)`}
                className="h-8 w-8 rounded-full border-2 border-background bg-primary text-primary-foreground font-semibold text-xs flex items-center justify-center shadow-sm"
              >
                {(user?.name || "U")[0].toUpperCase()}
              </div>
              {collaborators.map((c, i) => (
                <div
                  key={c.user_id || i}
                  title={`${c.name || "Collaborator"} is active`}
                  className="h-8 w-8 rounded-full border-2 border-background text-white font-bold text-xs flex items-center justify-center shadow-sm"
                  style={{ backgroundColor: c.color || "#3B82F6" }}
                >
                  {(c.name || "U")[0].toUpperCase()}
                </div>
              ))}
            </div>
            <button
              onClick={copyShareLink}
              className="h-8 px-3 rounded-full border bg-background hover:bg-muted text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
              title="Copy share link"
            >
              <Share2 size={12} />
              <span>Share</span>
            </button>
          </div>
        </div>

        {/* Note Preview for Co-Reading */}
        <div className="rounded-2xl p-6 sm:p-8 bg-card border shadow-ambient">
          <h1 className="text-3xl font-bold tracking-tight mb-4" style={{ fontFamily: "Outfit" }}>
            {noteTitle || "Untitled"}
          </h1>
          <div className="prose-note whitespace-pre-wrap leading-relaxed opacity-90">
            {noteContent || (
              <span className="italic text-muted-foreground">This note has no content yet. Switch to Create Mode to write.</span>
            )}
          </div>
        </div>
      </div>

      {/* Collaboration Sidebar Panel (Comments, Activity, Sharing, Facilitator) */}
      <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l bg-card/60 backdrop-blur-md flex flex-col h-auto lg:h-full">
        {/* Panel Tabs */}
        <div className="flex items-center border-b px-2 py-2 gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab("comments")}
            className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-xl flex items-center justify-center gap-1 transition-colors shrink-0 ${
              activeTab === "comments"
                ? "bg-secondary text-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageSquare size={13} />
            <span>Comments</span>
            {comments.length > 0 && (
              <span className="h-4 px-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                {comments.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("activity")}
            className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-xl flex items-center justify-center gap-1 transition-colors shrink-0 ${
              activeTab === "activity"
                ? "bg-secondary text-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Clock size={13} />
            <span>Activity</span>
          </button>

          <button
            onClick={() => setActiveTab("share")}
            className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-xl flex items-center justify-center gap-1 transition-colors shrink-0 ${
              activeTab === "share"
                ? "bg-secondary text-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Share2 size={13} />
            <span>Sharing</span>
          </button>

          <button
            onClick={() => setActiveTab("facilitator")}
            className={`flex-1 py-1.5 px-2 text-xs font-medium rounded-xl flex items-center justify-center gap-1 transition-colors shrink-0 ${
              activeTab === "facilitator"
                ? "bg-secondary text-foreground font-semibold shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
            title="Spark Facilitator"
          >
            <Sparkles size={13} className="text-amber-500" />
            <span>Facilitator</span>
          </button>
        </div>

        {/* Tab 1: Comments */}
        {activeTab === "comments" && (
          <div className="flex-1 flex flex-col p-4 overflow-hidden">
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {comments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs space-y-2">
                  <MessageSquare size={28} className="mx-auto opacity-40 mb-2" />
                  <p className="font-medium text-foreground">No comments yet</p>
                  <p>Leave a note or feedback for your team members below.</p>
                </div>
              ) : (
                comments.map((c) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3.5 rounded-2xl border bg-background/90 shadow-sm space-y-2 group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-accent/20 text-accent-foreground text-[10px] font-bold flex items-center justify-center">
                          {(c.user_name || "U")[0].toUpperCase()}
                        </div>
                        <span className="text-xs font-semibold text-foreground">{c.user_name || "Teammate"}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {c.created_at ? new Date(c.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        className="opacity-0 group-hover:opacity-100 h-6 w-6 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-red-500 transition-all"
                        title="Resolve comment"
                      >
                        <CheckCircle size={13} />
                      </button>
                    </div>
                    <p className="text-xs text-foreground leading-relaxed pl-8">{c.text}</p>
                  </motion.div>
                ))
              )}
            </div>

            {/* Comment Input */}
            <form onSubmit={handleAddComment} className="pt-3 border-t mt-3 flex items-center gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 h-9 px-3 rounded-xl border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={loading || !newComment.trim()}
                className="h-9 w-9 rounded-xl bg-foreground text-background flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-opacity"
              >
                <Send size={13} />
              </button>
            </form>
          </div>
        )}

        {/* Tab 2: Activity Timeline */}
        {activeTab === "activity" && (
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Chronological History
            </div>
            {activities.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-xs">
                <Clock size={28} className="mx-auto opacity-40 mb-2" />
                <p>No recorded activity yet.</p>
              </div>
            ) : (
              <div className="space-y-3 relative pl-4 border-l-2 border-border/80 ml-2">
                {activities.map((a, i) => (
                  <div key={a.id || i} className="relative space-y-1">
                    <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                    <div className="text-xs font-medium text-foreground">{a.description}</div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                      <span>{a.user_name || "Author"}</span>
                      <span>·</span>
                      <span>
                        {a.created_at ? new Date(a.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Just now"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Sharing & Permissions */}
        {activeTab === "share" && (
          <div className="flex-1 p-4 overflow-y-auto space-y-5">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1.5">Invite Teammate</label>
              <form onSubmit={handleShare} className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="flex-1 h-9 px-3 rounded-xl border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="h-9 px-2 rounded-xl border bg-background text-xs text-foreground focus:outline-none"
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={loading || !inviteEmail}
                  className="w-full h-8 rounded-xl bg-foreground text-background text-xs font-medium inline-flex items-center justify-center gap-1.5 hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  <UserPlus size={13} />
                  <span>Send Invite</span>
                </button>
              </form>
            </div>

            <div className="border-t pt-4">
              <label className="text-xs font-semibold text-foreground block mb-2">Active Collaborators</label>
              <div className="space-y-2">
                <div className="p-2.5 rounded-xl border bg-background flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground font-bold text-[10px] flex items-center justify-center">
                      {(user?.name || "Y")[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-foreground">{user?.name || "You"} (You)</div>
                      <div className="text-[10px] text-muted-foreground">{user?.email}</div>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary font-medium">Owner</span>
                </div>

                {sharedCollaborators.map((sc) => (
                  <div
                    key={sc.id || sc.email}
                    className="p-2.5 rounded-xl border bg-background flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-amber-500/20 text-amber-600 font-bold text-[10px] flex items-center justify-center">
                        {sc.email[0].toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{sc.email}</div>
                        <div className="text-[10px] text-muted-foreground">Invited collaborator</div>
                      </div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary font-medium capitalize">
                      {sc.role || "Editor"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-4">
              <button
                onClick={copyShareLink}
                className="w-full h-9 rounded-xl border bg-card hover:bg-muted text-xs font-medium inline-flex items-center justify-center gap-2 transition-colors"
              >
                <Copy size={13} />
                <span>Copy Shareable Workspace Link</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 4: Spark Facilitator */}
        {activeTab === "facilitator" && (
          <div className="flex-1 flex flex-col p-4 overflow-y-auto">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={16} className="text-amber-500" />
                <h3 className="text-xs font-semibold text-foreground">Spark Collaboration Facilitator</h3>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Synthesize document revisions, collaborator comments, and open questions into consensus and next steps.
              </p>
            </div>

            <div className="mb-3 space-y-2">
              <input
                type="text"
                value={facilitatePrompt}
                onChange={(e) => setFacilitatePrompt(e.target.value)}
                placeholder="Optional focus: e.g. resolve open questions..."
                className="w-full h-8 px-2.5 rounded-lg border bg-background text-xs outline-none focus:border-primary/50 text-foreground"
              />
              <button
                onClick={handleFacilitate}
                disabled={facilitating}
                className="w-full h-8 rounded-xl bg-foreground text-background hover:opacity-90 font-medium text-xs inline-flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {facilitating ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Synthesizing...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={13} className="text-amber-400" />
                    <span>Synthesize Discussion</span>
                  </>
                )}
              </button>
            </div>

            {facilitateResult ? (
              <div className="flex-1 border rounded-xl p-3 bg-background/50 text-xs overflow-y-auto space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <span className="font-semibold text-muted-foreground text-[11px]">Synthesis Summary</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(facilitateResult);
                      toast.success("Copied synthesis to clipboard");
                    }}
                    className="h-6 px-2 rounded-lg border hover:bg-muted text-[11px] inline-flex items-center gap-1"
                  >
                    <Copy size={11} /> Copy
                  </button>
                </div>
                <div className="prose-note whitespace-pre-wrap leading-relaxed text-xs">
                  {facilitateResult}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-muted-foreground text-xs border rounded-xl border-dashed">
                <Users2 size={28} className="opacity-30 mb-2" />
                <p className="font-medium text-foreground">No synthesis yet</p>
                <p className="text-[11px] mt-1">
                  Click 'Synthesize Discussion' to produce an executive alignment report covering all review comments and the document thesis.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
