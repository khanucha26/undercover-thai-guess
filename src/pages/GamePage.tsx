import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useGameStore } from "@/stores/gameStore";
import { supabase } from "@/integrations/supabase/client";
import { getMySecret, startVoting } from "@/lib/game";
import { Eye, EyeOff, Vote } from "lucide-react";

const GamePage = () => {
  const navigate = useNavigate();
  const { userId, roomId, playerId } = useGameStore();
  const [word, setWord] = useState<string | null>(null);
  const [showWord, setShowWord] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [room, setRoom] = useState<any>(null);
  const [isHost, setIsHost] = useState(false);

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

      if (roomData.status === "voting") {
        navigate("/vote");
        return;
      }
      if (roomData.status === "result") {
        navigate("/result");
        return;
      }
      if (roomData.status === "lobby") {
        navigate("/lobby");
        return;
      }
    }

    const secret = await getMySecret(roomId, userId);
    setWord(secret?.word ?? null);
    setLoading(false);
  }, [roomId, userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Listen for status changes
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
    try {
      await startVoting(roomId);
    } catch (e: any) {
      setError(e.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-dark flex items-center justify-center">
        <div className="text-muted-foreground animate-pulse text-lg">กำลังโหลด...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-dark flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm"
      >
        {/* Round indicator */}
        <div className="text-center mb-8">
          <span className="text-sm text-muted-foreground font-medium">
            รอบที่ {room?.current_round || 1}
          </span>
        </div>

        {/* Word card */}
        <motion.div
          className="relative w-full aspect-[3/2] rounded-2xl bg-card border border-border card-glow flex items-center justify-center mb-8 cursor-pointer select-none overflow-hidden"
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

        <p className="text-center text-muted-foreground text-sm mb-8">
          พูดคุยกับเพื่อนเพื่อหาตัว Undercover!
        </p>

        {error && (
          <p className="text-danger text-sm text-center mb-3">{error}</p>
        )}

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
