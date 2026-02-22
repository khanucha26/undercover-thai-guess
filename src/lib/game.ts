import { supabase } from "@/integrations/supabase/client";

// Anonymous sign in
export async function ensureAuth(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) return session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.user!.id;
}

// Generate 6-char room code
export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Create room
export async function createRoom(hostId: string) {
  const code = generateRoomCode();
  const { data, error } = await supabase
    .from("rooms")
    .insert({
      room_code: code,
      host_id: hostId,
      status: "lobby",
      settings: { undercoverCount: 1, mrWhiteCount: 0 },
      current_round: 0,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Join room
export async function joinRoom(roomCode: string, userId: string, name: string) {
  // Find room
  const { data: room, error: roomErr } = await supabase
    .from("rooms")
    .select("*")
    .eq("room_code", roomCode.toUpperCase())
    .single();

  if (roomErr || !room) throw new Error("ไม่พบห้องนี้");
  if (room.status !== "lobby") throw new Error("เกมเริ่มแล้ว ไม่สามารถเข้าร่วมได้");

  // Check duplicate name
  const { data: existing } = await supabase
    .from("players")
    .select("name")
    .eq("room_id", room.id)
    .eq("name", name);

  if (existing && existing.length > 0) throw new Error("ชื่อนี้ถูกใช้แล้วในห้องนี้");

  // Join
  const { data: player, error: joinErr } = await supabase
    .from("players")
    .insert({
      room_id: room.id,
      user_id: userId,
      name,
      is_ready: false,
      is_alive: true,
    })
    .select()
    .single();

  if (joinErr) {
    if (joinErr.code === "23505") throw new Error("คุณอยู่ในห้องนี้แล้ว");
    throw joinErr;
  }

  return { room, player };
}

// Toggle ready
export async function toggleReady(playerId: string, isReady: boolean) {
  const { error } = await supabase
    .from("players")
    .update({ is_ready: !isReady })
    .eq("id", playerId);
  if (error) throw error;
}

// Start game (calls edge function)
export async function startGame(roomId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  const { data, error } = await supabase.functions.invoke("start-game", {
    body: { roomId },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

// Start voting
export async function startVoting(roomId: string) {
  const { data, error } = await supabase.functions.invoke("process-vote", {
    body: { roomId, action: "start-voting" },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
}

// Cast vote
export async function castVote(roomId: string, round: number, voterId: string, targetId: string) {
  const { error } = await supabase
    .from("votes")
    .insert({
      room_id: roomId,
      round,
      voter_id: voterId,
      target_player_id: targetId,
    });
  if (error) {
    if (error.code === "23505") throw new Error("คุณโหวตรอบนี้แล้ว");
    throw error;
  }
}

// Tally votes
export async function tallyVotes(roomId: string, guess?: string) {
  const { data, error } = await supabase.functions.invoke("process-vote", {
    body: { roomId, action: "tally", guess },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

// Get own secret
export async function getMySecret(roomId: string, userId: string) {
  const { data, error } = await supabase
    .from("player_secrets")
    .select("*")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .single();
  if (error) return null;
  return data;
}

// Save Mr.White's answer
export async function saveMrWhiteAnswer(roomId: string, userId: string, answer: string) {
  const { error } = await supabase
    .from("player_secrets")
    .update({ mr_white_answer: answer } as any)
    .eq("room_id", roomId)
    .eq("user_id", userId);
  if (error) throw error;
}

// Update room settings
export async function updateRoomSettings(roomId: string, settings: { undercoverCount: number; mrWhiteCount: number }) {
  const { error } = await supabase
    .from("rooms")
    .update({ settings })
    .eq("id", roomId);
  if (error) throw error;
}

// Reset room to lobby for replay
export async function resetToLobby(roomId: string) {
  const { error } = await supabase
    .from("rooms")
    .update({ status: "lobby", current_round: 0 })
    .eq("id", roomId);
  if (error) throw error;

  // Reset player ready states
  await supabase
    .from("players")
    .update({ is_ready: false, is_alive: true })
    .eq("room_id", roomId);
}
