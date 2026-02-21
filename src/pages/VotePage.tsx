import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/stores/gameStore";
import { supabase } from "@/integrations/supabase/client";
import { castVote, tallyVotes } from "@/lib/game";
import { Check, Users, Skull } from "lucide-react";

interface Player {
  id: string;
  user_id: string;
  name: string;
  is_alive: boolean;
}

const VotePage = () => {
  const navigate = useNavigate();
  const { userId, roomId, playerId } = useGameStore();
  const [players, setPlayers] = useState<Player[]>([]);
  const [room, setRoom] = useState<any>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [voteCount, setVoteCount] = useState(0);
  const [aliveCount, setAliveCount] = useState(0);
  const [tallyResult, setTallyResult] = useState<any>(null);
  const [mrWhiteGuess, setMrWhiteGuess] = useState("");
  const [showGuessInput, setShowGuessInput] = useState(false);
  const [eliminatedPlayerId, setEliminatedPlayerId] = useState<string | null>(null);

  const isHost = room?.host_id === userId;

  const fetchData = useCallback(async () => {
    if (!roomId) return;

    const { data: roomData } = await supabase.from("rooms").select("*").eq("id", roomId).single();
    if (roomData) {
      setRoom(roomData);
      if (roomData.status === "playing") navigate("/game");
      if (roomData.status === "result") navigate("/result");
      if (roomData.status === "lobby") navigate("/lobby");
    }

    const { data: playersData } = await supabase
      .from("players")
      .select("id, user_id, name, is_alive")
      .eq("room_id", roomId)
      .eq("is_alive", true)
      .order("joined_at");
    if (playersData) {
      setPlayers(playersData);
      setAliveCount(playersData.length);
    }

    // Check if already voted
    if (roomData) {
      const { data: myVote } = await supabase
        .from("votes")
        .select("id")
        .eq("room_id", roomId)
        .eq("round", roomData.current_round)
        .eq("voter_id", userId!)
        .maybeSingle();
      if (myVote) setHasVoted(true);

      // Count votes
      const { count } = await supabase
        .from("votes")
        .select("id", { count: "exact" })
        .eq("room_id", roomId)
        .eq("round", roomData.current_round);
      setVoteCount(count || 0);
    }
  }, [roomId, userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`vote-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, (payload) => {
        const r = payload.new as any;
        setRoom(r);
        if (r.status === "playing") navigate("/game");
        if (r.status === "result") navigate("/result");
        if (r.status === "lobby") navigate("/lobby");
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "votes", filter: `room_id=eq.${roomId}` }, () => {
        setVoteCount((c) => c + 1);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  const handleVote = async () => {
    if (!selectedTarget || !roomId || !userId || !room) return;
    setLoading(true);
    setError("");
    try {
      await castVote(roomId, room.current_round, userId, selectedTarget);
      setHasVoted(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTally = async () => {
    if (!roomId) return;
    setLoading(true);
    setError("");
    try {
      const result = await tallyVotes(roomId);
      setTallyResult(result);
      if (result.result === "mrwhite_guess") {
        setShowGuessInput(true);
        setEliminatedPlayerId(result.eliminatedId);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMrWhiteGuess = async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      const result = await tallyVotes(roomId, mrWhiteGuess);
      setTallyResult(result);
      setShowGuessInput(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // My player
  const myPlayer = players.find((p) => p.user_id === userId);
  const isAlive = myPlayer?.is_alive ?? false;

  return (
    <div className="min-h-screen gradient-dark flex flex-col p-6">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-primary">โหวต</h1>
        <p className="text-muted-foreground text-sm mt-1">
          รอบที่ {room?.current_round || 1} · โหวตแล้ว {voteCount}/{aliveCount}
        </p>
      </div>

      {/* Mr.White guess modal */}
      {showGuessInput && isHost && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card rounded-xl border border-primary/30 p-6 mb-6 card-glow"
        >
          <h2 className="text-lg font-bold text-danger mb-2 flex items-center gap-2">
            <Skull className="w-5 h-5" />
            Mr.White ถูกโหวตออก!
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            ให้ Mr.White เดาคำของกลุ่มหลัก
          </p>
          <input
            type="text"
            value={mrWhiteGuess}
            onChange={(e) => setMrWhiteGuess(e.target.value)}
            placeholder="พิมพ์คำที่เดา..."
            className="w-full px-4 py-3 rounded-lg bg-secondary border border-border text-foreground text-lg font-medium placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 mb-3"
          />
          <button
            onClick={handleMrWhiteGuess}
            disabled={!mrWhiteGuess.trim() || loading}
            className="w-full py-3 rounded-lg gradient-gold text-primary-foreground font-bold disabled:opacity-50"
          >
            ยืนยันคำตอบ
          </button>
        </motion.div>
      )}

      {/* Tally result */}
      {tallyResult && !showGuessInput && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-card rounded-xl border border-border p-6 mb-6 card-glow text-center"
        >
          {tallyResult.result === "tie" ? (
            <p className="text-lg font-bold text-muted-foreground">เสมอ! ไม่มีใครถูกคัดออก</p>
          ) : tallyResult.result === "game_over" ? (
            <div>
              <p className="text-lg font-bold text-primary mb-2">🏆 เกมจบ!</p>
              <p className="text-muted-foreground">
                {tallyResult.winner === "civilian" && "กลุ่มหลักชนะ!"}
                {tallyResult.winner === "undercover" && "Undercover ชนะ!"}
                {tallyResult.winner === "mrwhite" && "Mr.White ชนะ!"}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-lg font-bold text-danger mb-2">
                {players.find((p) => p.id === tallyResult.eliminatedId)?.name} ถูกคัดออก
              </p>
              <p className="text-sm text-muted-foreground">
                คำ: {tallyResult.eliminatedWord || "ไม่มีคำ"}
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* Player selection */}
      {!hasVoted && isAlive && !tallyResult && (
        <div className="flex-1 space-y-2 mb-6">
          {players
            .filter((p) => p.id !== playerId)
            .map((player, i) => (
              <motion.button
                key={player.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedTarget(player.id)}
                className={`w-full flex items-center justify-between px-4 py-4 rounded-lg border transition-all ${
                  selectedTarget === player.id
                    ? "bg-danger/15 border-danger/50"
                    : "bg-card border-border hover:border-muted-foreground/30"
                }`}
              >
                <span className="font-semibold text-lg">{player.name}</span>
                {selectedTarget === player.id && (
                  <Check className="w-5 h-5 text-danger" />
                )}
              </motion.button>
            ))}
        </div>
      )}

      {hasVoted && !tallyResult && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-muted-foreground text-lg font-medium animate-pulse">
            รอผู้เล่นคนอื่นโหวต...
          </p>
        </div>
      )}

      {error && <p className="text-danger text-sm text-center mb-3">{error}</p>}

      {/* Actions */}
      <div className="space-y-3">
        {!hasVoted && isAlive && !tallyResult && (
          <button
            onClick={handleVote}
            disabled={!selectedTarget || loading}
            className="w-full py-4 rounded-lg bg-danger text-accent-foreground font-bold text-lg hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? "กำลังโหวต..." : "ยืนยันโหวต"}
          </button>
        )}

        {isHost && voteCount >= aliveCount && !tallyResult && (
          <button
            onClick={handleTally}
            disabled={loading}
            className="w-full py-4 rounded-lg gradient-gold text-primary-foreground font-bold text-lg btn-glow hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? "กำลังนับ..." : "นับคะแนน"}
          </button>
        )}
      </div>
    </div>
  );
};

export default VotePage;
