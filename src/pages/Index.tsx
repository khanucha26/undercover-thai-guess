import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useGameStore } from "@/stores/gameStore";
import { ensureAuth, createRoom, joinRoom } from "@/lib/game";
import { Eye, Users, ArrowRight } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();
  const { userId, playerName, roomId, setUser, setPlayerName, setRoom, setPlayerId } = useGameStore();
  const [name, setName] = useState(playerName || "");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"home" | "join">("home");

  useEffect(() => {
    ensureAuth().then(setUser).catch(console.error);
  }, []);

  // Reconnect to existing room
  useEffect(() => {
    if (roomId) {
      navigate("/lobby");
    }
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) { setError("กรุณาตั้งชื่อ"); return; }
    if (!userId) { setError("กำลังเชื่อมต่อ..."); return; }
    setLoading(true);
    setError("");
    try {
      setPlayerName(name.trim());
      const room = await createRoom(userId);
      setRoom(room.id, room.room_code);
      // Auto-join as host
      const result = await joinRoom(room.room_code, userId, name.trim());
      setPlayerId(result.player.id);
      navigate("/lobby");
    } catch (e: any) {
      setError(e.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!name.trim()) { setError("กรุณาตั้งชื่อ"); return; }
    if (!code.trim()) { setError("กรุณาใส่รหัสห้อง"); return; }
    if (!userId) { setError("กำลังเชื่อมต่อ..."); return; }
    setLoading(true);
    setError("");
    try {
      setPlayerName(name.trim());
      const result = await joinRoom(code.trim(), userId, name.trim());
      setRoom(result.room.id, result.room.room_code);
      setPlayerId(result.player.id);
      navigate("/lobby");
    } catch (e: any) {
      setError(e.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen gradient-dark flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        <div className="flex items-center justify-center gap-3 mb-3">
          <Eye className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-4xl font-extrabold text-primary text-glow tracking-tight">
          Undercover
        </h1>
        <p className="text-lg text-primary/70 font-medium mt-1">ไทย</p>
        <p className="text-muted-foreground text-sm mt-2">หลายเครื่อง · เล่นกับเพื่อน</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.15 }}
        className="w-full max-w-sm space-y-4"
      >
        {/* Name Input */}
        <div>
          <label className="block text-sm font-medium text-muted-foreground mb-1.5">
            ชื่อของคุณ
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ใส่ชื่อ..."
            maxLength={20}
            className="w-full px-4 py-3 rounded-lg bg-card border border-border text-foreground text-lg font-medium placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-danger text-sm text-center font-medium"
          >
            {error}
          </motion.p>
        )}

        {mode === "home" ? (
          <div className="space-y-3 pt-2">
            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full py-4 rounded-lg gradient-gold text-primary-foreground font-bold text-lg btn-glow hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Users className="w-5 h-5" />
              สร้างห้อง
            </button>
            <button
              onClick={() => setMode("join")}
              className="w-full py-4 rounded-lg bg-secondary text-secondary-foreground font-bold text-lg hover:bg-secondary/80 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <ArrowRight className="w-5 h-5" />
              เข้าร่วมห้อง
            </button>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                รหัสห้อง
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="รหัส 4 หลัก"
                maxLength={4}
                className="w-full px-4 py-3 rounded-lg bg-card border border-border text-foreground text-2xl font-bold text-center tracking-[0.3em] placeholder:text-muted-foreground/50 placeholder:text-lg placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>
            <button
              onClick={handleJoin}
              disabled={loading}
              className="w-full py-4 rounded-lg gradient-gold text-primary-foreground font-bold text-lg btn-glow hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {loading ? "กำลังเข้าร่วม..." : "เข้าร่วม"}
            </button>
            <button
              onClick={() => setMode("home")}
              className="w-full py-3 text-muted-foreground font-medium hover:text-foreground transition-colors"
            >
              ← กลับ
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Index;
