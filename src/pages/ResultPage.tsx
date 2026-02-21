import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useGameStore } from "@/stores/gameStore";
import { supabase } from "@/integrations/supabase/client";
import { resetToLobby } from "@/lib/game";
import { Trophy, RotateCcw, Home, Crown, Skull, Eye } from "lucide-react";

interface PlayerWithSecret {
  id: string;
  name: string;
  is_alive: boolean;
  user_id: string;
  secret?: { word: string | null; role: string };
}

const ResultPage = () => {
  const navigate = useNavigate();
  const { userId, roomId, reset } = useGameStore();
  const [room, setRoom] = useState<any>(null);
  const [players, setPlayers] = useState<PlayerWithSecret[]>([]);
  const [voteResult, setVoteResult] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const isHost = room?.host_id === userId;

  const fetchData = useCallback(async () => {
    if (!roomId) return;

    const { data: roomData } = await supabase.from("rooms").select("*").eq("id", roomId).single();
    if (roomData) {
      setRoom(roomData);
      if (roomData.status === "lobby") { navigate("/lobby"); return; }
    }

    // Get latest vote result
    const { data: results } = await supabase
      .from("vote_results")
      .select("*")
      .eq("room_id", roomId)
      .eq("game_over", true)
      .order("created_at", { ascending: false })
      .limit(1);
    if (results && results.length > 0) setVoteResult(results[0]);

    // Get all players - we can see their secrets now since game is over
    // Actually we can only see our own secrets via RLS, so we'll use the vote_results
    const { data: playersData } = await supabase
      .from("players")
      .select("id, name, is_alive, user_id")
      .eq("room_id", roomId)
      .order("joined_at");
    
    setPlayers(playersData || []);
    setLoading(false);
  }, [roomId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Listen for room changes (replay)
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`result-${roomId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, (payload) => {
        const r = payload.new as any;
        if (r.status === "lobby") navigate("/lobby");
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  const handleReplay = async () => {
    if (!roomId) return;
    try {
      await resetToLobby(roomId);
    } catch (e: any) {
      console.error(e);
    }
  };

  const handleHome = () => {
    reset();
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-dark flex items-center justify-center">
        <div className="text-muted-foreground animate-pulse text-lg">กำลังโหลด...</div>
      </div>
    );
  }

  const winnerText = (() => {
    if (!voteResult) return "เกมจบ!";
    switch (voteResult.winner) {
      case "civilian": return "🎉 กลุ่มหลักชนะ!";
      case "undercover": return "🕵️ Undercover ชนะ!";
      case "mrwhite": return "👻 Mr.White ชนะ!";
      default: return "เกมจบ!";
    }
  })();

  return (
    <div className="min-h-screen gradient-dark flex flex-col items-center p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mt-12 mb-8"
      >
        <Trophy className="w-16 h-16 text-primary mx-auto mb-4" />
        <h1 className="text-3xl font-extrabold text-primary text-glow">{winnerText}</h1>
      </motion.div>

      {/* Player results */}
      <div className="w-full max-w-sm space-y-2 mb-8">
        {players.map((player, i) => (
          <motion.div
            key={player.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className={`flex items-center justify-between px-4 py-3 rounded-lg border ${
              player.is_alive
                ? "bg-success/10 border-success/30"
                : "bg-card border-border opacity-60"
            }`}
          >
            <div className="flex items-center gap-2">
              {player.user_id === room?.host_id && <Crown className="w-4 h-4 text-primary" />}
              {!player.is_alive && <Skull className="w-4 h-4 text-danger" />}
              <span className="font-semibold">{player.name}</span>
            </div>
            <div className="flex items-center gap-2">
              {!player.is_alive && (
                <span className="text-xs text-danger font-medium">ออก</span>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Actions */}
      <div className="w-full max-w-sm space-y-3">
        {isHost && (
          <button
            onClick={handleReplay}
            className="w-full py-4 rounded-lg gradient-gold text-primary-foreground font-bold text-lg btn-glow hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-5 h-5" />
            เล่นอีกรอบ
          </button>
        )}
        <button
          onClick={handleHome}
          className="w-full py-3 rounded-lg bg-secondary text-secondary-foreground font-bold hover:bg-secondary/80 transition-all flex items-center justify-center gap-2"
        >
          <Home className="w-5 h-5" />
          หน้าแรก
        </button>
      </div>
    </div>
  );
};

export default ResultPage;
