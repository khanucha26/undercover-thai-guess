import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useGameStore } from "@/stores/gameStore";
import { supabase } from "@/integrations/supabase/client";
import { getMySecret, startVoting, saveMrWhiteAnswer } from "@/lib/game";
import { Eye, EyeOff, Vote, UserRound, Send } from "lucide-react";

const GamePage = () => {
  const navigate = useNavigate();
  const { userId, roomId, playerId } = useGameStore();
  const [word, setWord] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [showWord, setShowWord] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [room, setRoom] = useState<any>(null);
  const [isHost, setIsHost] = useState(false);
  const [firstPlayerName, setFirstPlayerName] = useState<string | null>(null);
  const [mrWhiteAnswer, setMrWhiteAnswer] = useState("");
  const [answerSaved, setAnswerSaved] = useState(false);

  const fetchData = useCallback(async () => {
    if (!roomId || !userId) return;

    const { data: roomData } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    if (roomData) {
      setRoom(roomData);
      setIsHost(roomData.host_id === userId);

      if (roomData.status === "voting") { navigate("/vote"); return; }
      if (roomData.status === "result") { navigate("/result"); return; }
      if (roomData.status === "lobby") { navigate("/lobby"); return; }

      // Get first player name
      if (roomData.first_player_id) {
        const { data: fp } = await supabase
          .from("players")
          .select("name")
          .eq("id", roomData.first_player_id)
          .single();
        if (fp) setFirstPlayerName(fp.name);
      }
    }

    const secret = await getMySecret(roomId, userId);
    setWord(secret?.word ?? null);
    setRole(secret?.role ?? null);
    if ((secret as any)?.mr_white_answer) {
      setMrWhiteAnswer((secret as any).mr_white_answer);
      setAnswerSaved(true);
    }
    setLoading(false);
  }, [roomId, userId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`game-${roomId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, (payload) => {
        const newRoom = payload.new as any;
        setRoom(newRoom);
        if (newRoom.status === "voting") navigate("/vote");
        if (newRoom.status === "result") navigate("/result");
        if (newRoom.status === "lobby") navigate("/lobby");
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  const handleStartVoting = async () => {
    if (!roomId) return;
    setError("");
    try { await startVoting(roomId); } catch (e: any) { setError(e.message); }
  };

  const handleSaveAnswer = async () => {
    if (!roomId || !userId || !mrWhiteAnswer.trim()) return;
    try {
      await saveMrWhiteAnswer(roomId, userId, mrWhiteAnswer.trim());
      setAnswerSaved(true);
    } catch (e: any) { setError(e.message); }
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-dark flex items-center justify-center">
        <div className="text-muted-foreground animate-pulse text-lg">กำลังโหลด...</div>
      </div>
    );
  }

  const isMrWhite = role === "mrwhite";

  return (
    <div className="min-h-screen gradient-dark flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm"
      >
        {/* Round indicator */}
        <div className="text-center mb-4">
          <span className="text-sm text-muted-foreground font-medium">
            รอบที่ {room?.current_round || 1}
          </span>
        </div>

        {/* First player announcement */}
        {firstPlayerName && room?.current_round === 1 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-primary/10 border border-primary/30 rounded-xl px-4 py-3 mb-6 flex items-center gap-3"
          >
            <UserRound className="w-5 h-5 text-primary shrink-0" />
            <p className="text-sm font-semibold text-primary">
              <span className="text-foreground">{firstPlayerName}</span> เริ่มก่อน!
            </p>
          </motion.div>
        )}

        {/* Word card */}
        <motion.div
          className="relative w-full aspect-[3/2] rounded-2xl bg-card border border-border card-glow flex items-center justify-center mb-6 cursor-pointer select-none overflow-hidden"
          onClick={() => setShowWord(!showWord)}
          whileTap={{ scale: 0.97 }}
        >
          {showWord ? (
            <div className="text-center p-6">
              {word ? (
                <p className="text-3xl font-extrabold text-primary text-glow">{word}</p>
              ) : (
                <p className="text-2xl font-bold text-danger">คุณไม่มีคำ</p>
              )}
            </div>
          ) : (
            <div className="text-center">
              <EyeOff className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">แตะเพื่อดูคำ</p>
            </div>
          )}
        </motion.div>

        {/* Mr.White answer input */}
        {isMrWhite && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-xl p-4 mb-6"
          >
            <p className="text-sm text-muted-foreground mb-2 font-medium">คำตอบของคุณ (ลับ)</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={mrWhiteAnswer}
                onChange={(e) => { setMrWhiteAnswer(e.target.value); setAnswerSaved(false); }}
                placeholder="พิมพ์คำตอบของคุณ..."
                className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                onClick={handleSaveAnswer}
                disabled={!mrWhiteAnswer.trim() || answerSaved}
                className="px-3 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50 flex items-center gap-1"
              >
                <Send className="w-4 h-4" />
                {answerSaved ? "บันทึกแล้ว" : "บันทึก"}
              </button>
            </div>
          </motion.div>
        )}

        <p className="text-center text-muted-foreground text-sm mb-8">
          พูดคุยกับเพื่อนเพื่อหาตัว Undercover!
        </p>

        {error && <p className="text-danger text-sm text-center mb-3">{error}</p>}

        {isHost && (
          <button
            onClick={handleStartVoting}
            className="w-full py-4 rounded-lg gradient-gold text-primary-foreground font-bold text-lg btn-glow hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <Vote className="w-5 h-5" />
            เข้าสู่โหมดโหวต
          </button>
        )}

        {!isHost && (
          <div className="text-center text-muted-foreground text-sm py-4">
            รอ Host เริ่มโหวต
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default GamePage;
