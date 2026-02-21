import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useGameStore } from "@/stores/gameStore";
import { supabase } from "@/integrations/supabase/client";
import { toggleReady, startGame, updateRoomSettings, resetToLobby } from "@/lib/game";
import { Crown, Check, Copy, Settings, Play, Users } from "lucide-react";

interface Player {
  id: string;
  user_id: string;
  name: string;
  is_ready: boolean;
}

interface Room {
  id: string;
  room_code: string;
  status: string;
  host_id: string;
  settings: { undercoverCount: number; mrWhiteCount: number };
  current_round: number;
}

const LobbyPage = () => {
  const navigate = useNavigate();
  const { userId, roomId, roomCode, playerId, reset } = useGameStore();
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [ucCount, setUcCount] = useState(1);
  const [mwCount, setMwCount] = useState(0);

  const isHost = room?.host_id === userId;

  const fetchRoom = useCallback(async () => {
    if (!roomId) return;
    const { data } = await supabase.from("rooms").select("*").eq("id", roomId).single();
    if (data) {
      setRoom(data as any);
      setUcCount((data.settings as any)?.undercoverCount || 1);
      setMwCount((data.settings as any)?.mrWhiteCount || 0);
    }
  }, [roomId]);

  const fetchPlayers = useCallback(async () => {
    if (!roomId) return;
    const { data } = await supabase
      .from("players")
      .select("id, user_id, name, is_ready")
      .eq("room_id", roomId)
      .order("joined_at");
    if (data) setPlayers(data);
  }, [roomId]);

  useEffect(() => {
    if (!roomId) { navigate("/"); return; }
    fetchRoom();
    fetchPlayers();
  }, [roomId]);

  // Real-time subscriptions
  useEffect(() => {
    if (!roomId) return;

    const channel = supabase
      .channel(`lobby-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, (payload) => {
        const newRoom = payload.new as any;
        setRoom(newRoom);
        if (newRoom.status === "playing") navigate("/game");
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `room_id=eq.${roomId}` }, () => {
        fetchPlayers();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  const handleCopy = () => {
    navigator.clipboard.writeText(roomCode || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReady = async () => {
    if (!playerId) return;
    const me = players.find((p) => p.id === playerId);
    if (!me) return;
    try {
      await toggleReady(playerId, me.is_ready);
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleStart = async () => {
    if (!roomId) return;
    setLoading(true);
    setError("");
    try {
      await startGame(roomId);
    } catch (e: any) {
      setError(e.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!roomId) return;
    try {
      await updateRoomSettings(roomId, { undercoverCount: ucCount, mrWhiteCount: mwCount });
      setShowSettings(false);
      fetchRoom();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const handleLeave = () => {
    reset();
    navigate("/");
  };

  const allReady = players.length >= 3 && players.every((p) => p.is_ready);
  const myPlayer = players.find((p) => p.id === playerId);

  return (
    <div className="min-h-screen gradient-dark flex flex-col p-6">
      {/* Header */}
      <div className="text-center mb-6">
        <p className="text-muted-foreground text-sm mb-1">รหัสห้อง</p>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-card border border-border hover:border-primary/50 transition-all"
        >
          <span className="text-3xl font-extrabold text-primary tracking-[0.25em]">
            {roomCode}
          </span>
          {copied ? (
            <Check className="w-5 h-5 text-success" />
          ) : (
            <Copy className="w-5 h-5 text-muted-foreground" />
          )}
        </button>
      </div>

      {/* Player count */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Users className="w-4 h-4" />
          <span className="text-sm font-medium">{players.length} ผู้เล่น</span>
        </div>
        {isHost && (
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <Settings className="w-4 h-4" />
            ตั้งค่า
          </button>
        )}
      </div>

      {/* Settings panel */}
      <AnimatePresence>
        {showSettings && isHost && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="bg-card rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Undercover</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setUcCount(Math.max(1, ucCount - 1))} className="w-8 h-8 rounded bg-secondary flex items-center justify-center font-bold">-</button>
                  <span className="text-lg font-bold text-primary w-6 text-center">{ucCount}</span>
                  <button onClick={() => setUcCount(ucCount + 1)} className="w-8 h-8 rounded bg-secondary flex items-center justify-center font-bold">+</button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Mr.White</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setMwCount(Math.max(0, mwCount - 1))} className="w-8 h-8 rounded bg-secondary flex items-center justify-center font-bold">-</button>
                  <span className="text-lg font-bold text-primary w-6 text-center">{mwCount}</span>
                  <button onClick={() => setMwCount(mwCount + 1)} className="w-8 h-8 rounded bg-secondary flex items-center justify-center font-bold">+</button>
                </div>
              </div>
              <button
                onClick={handleSaveSettings}
                className="w-full py-2 rounded bg-primary text-primary-foreground font-bold text-sm"
              >
                บันทึก
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Player list */}
      <div className="flex-1 space-y-2 mb-6">
        <AnimatePresence>
          {players.map((player, i) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center justify-between px-4 py-3 rounded-lg border transition-all ${
                player.is_ready
                  ? "bg-success/10 border-success/30"
                  : "bg-card border-border"
              }`}
            >
              <div className="flex items-center gap-3">
                {player.user_id === room?.host_id && (
                  <Crown className="w-4 h-4 text-primary" />
                )}
                <span className="font-semibold text-lg">{player.name}</span>
              </div>
              {player.is_ready && (
                <span className="text-sm font-medium text-success flex items-center gap-1">
                  <Check className="w-4 h-4" /> พร้อม
                </span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {error && (
        <p className="text-danger text-sm text-center mb-3 font-medium">{error}</p>
      )}

      {/* Actions */}
      <div className="space-y-3">
        {isHost && allReady ? (
          <button
            onClick={handleStart}
            disabled={loading}
            className="w-full py-4 rounded-lg gradient-gold text-primary-foreground font-bold text-lg btn-glow hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5" />
            {loading ? "กำลังเริ่ม..." : "เริ่มเกม"}
          </button>
        ) : isHost ? (
          <div className="text-center text-muted-foreground text-sm py-4">
            รอผู้เล่นทั้งหมดกดพร้อม (ขั้นต่ำ 3 คน)
          </div>
        ) : null}

        {!isHost && myPlayer && (
          <button
            onClick={handleReady}
            className={`w-full py-4 rounded-lg font-bold text-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 ${
              myPlayer.is_ready
                ? "bg-success/20 text-success border border-success/30"
                : "gradient-gold text-primary-foreground btn-glow hover:opacity-90"
            }`}
          >
            <Check className="w-5 h-5" />
            {myPlayer.is_ready ? "พร้อมแล้ว ✓" : "กดพร้อม"}
          </button>
        )}

        <button
          onClick={handleLeave}
          className="w-full py-3 text-muted-foreground font-medium hover:text-foreground transition-colors text-sm"
        >
          ออกจากห้อง
        </button>
      </div>
    </div>
  );
};

export default LobbyPage;
