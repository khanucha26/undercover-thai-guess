import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useGameStore } from "@/stores/gameStore";
import { supabase } from "@/integrations/supabase/client";
import { resetToLobby } from "@/lib/game";
import { Trophy, RotateCcw, Home, Crown, Skull, Eye, Ghost, Shield, UserRound } from "lucide-react";

interface PlayerResult {
  id: string;
  name: string;
  is_alive: boolean;
  user_id: string;
  role: string;
  word: string | null;
  mr_white_answer: string | null;
}

const ROLE_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  civilian: { label: "Civilian", icon: Shield, color: "text-success" },
  undercover: { label: "Undercover", icon: Eye, color: "text-primary" },
  mrwhite: { label: "Mr.White", icon: Ghost, color: "text-danger" },
};

const ResultPage = () => {
  const navigate = useNavigate();
  const { userId, roomId, reset } = useGameStore();
  const [room, setRoom] = useState<any>(null);
  const [players, setPlayers] = useState<PlayerResult[]>([]);
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

    // Get full reveal via edge function
    const { data, error } = await supabase.functions.invoke("get-game-results", {
      body: { roomId },
    });
    if (data?.players) {
      setPlayers(data.players);
    }
    setLoading(false);
  }, [roomId]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
    try { await resetToLobby(roomId); } catch (e: any) { console.error(e); }
  };

  const handleHome = () => { reset(); navigate("/"); };

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

  // Get civilian and undercover words for header display
  const civilianWord = players.find((p) => p.role === "civilian")?.word;
  const undercoverWord = players.find((p) => p.role === "undercover")?.word;

  return (
    <div className="min-h-screen gradient-dark flex flex-col items-center p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mt-8 mb-4"
      >
        <Trophy className="w-14 h-14 text-primary mx-auto mb-3" />
        <h1 className="text-3xl font-extrabold text-primary text-glow">{winnerText}</h1>
      </motion.div>

      {/* Word reveal */}
      {(civilianWord || undercoverWord) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full max-w-sm bg-card border border-border rounded-xl p-4 mb-4 flex gap-4 justify-center"
        >
          {civilianWord && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">คำ Civilian</p>
              <p className="text-lg font-extrabold text-success">{civilianWord}</p>
            </div>
          )}
          {undercoverWord && (
            <div className="text-center">
              <p className="text-xs text-muted-foreground mb-1">คำ Undercover</p>
              <p className="text-lg font-extrabold text-primary">{undercoverWord}</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Player results with full reveal */}
      <div className="w-full max-w-sm space-y-2 mb-6">
        {players.map((player, i) => {
          const rc = ROLE_CONFIG[player.role] || ROLE_CONFIG.civilian;
          const RoleIcon = rc.icon;
          return (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.08 }}
              className={`px-4 py-3 rounded-lg border ${
                player.is_alive
                  ? "bg-card border-border"
                  : "bg-card border-border opacity-60"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {player.user_id === room?.host_id && <Crown className="w-4 h-4 text-primary" />}
                  {!player.is_alive && <Skull className="w-4 h-4 text-danger" />}
                  <span className="font-semibold">{player.name}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <RoleIcon className={`w-4 h-4 ${rc.color}`} />
                  <span className={`text-sm font-bold ${rc.color}`}>{rc.label}</span>
                </div>
              </div>
              {/* Show Mr.White's answer */}
              {player.role === "mrwhite" && player.mr_white_answer && (
                <p className="text-xs text-muted-foreground mt-1">
                  คำตอบ: <span className="font-semibold text-foreground">{player.mr_white_answer}</span>
                </p>
              )}
            </motion.div>
          );
        })}
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
