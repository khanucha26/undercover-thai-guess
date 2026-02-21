import { create } from "zustand";

interface GameState {
  userId: string | null;
  playerName: string | null;
  roomId: string | null;
  roomCode: string | null;
  playerId: string | null;
  setUser: (userId: string) => void;
  setPlayerName: (name: string) => void;
  setRoom: (roomId: string, roomCode: string) => void;
  setPlayerId: (playerId: string) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  userId: localStorage.getItem("uc_userId"),
  playerName: localStorage.getItem("uc_playerName"),
  roomId: localStorage.getItem("uc_roomId"),
  roomCode: localStorage.getItem("uc_roomCode"),
  playerId: localStorage.getItem("uc_playerId"),
  setUser: (userId) => {
    localStorage.setItem("uc_userId", userId);
    set({ userId });
  },
  setPlayerName: (name) => {
    localStorage.setItem("uc_playerName", name);
    set({ playerName: name });
  },
  setRoom: (roomId, roomCode) => {
    localStorage.setItem("uc_roomId", roomId);
    localStorage.setItem("uc_roomCode", roomCode);
    set({ roomId, roomCode });
  },
  setPlayerId: (playerId) => {
    localStorage.setItem("uc_playerId", playerId);
    set({ playerId });
  },
  reset: () => {
    localStorage.removeItem("uc_roomId");
    localStorage.removeItem("uc_roomCode");
    localStorage.removeItem("uc_playerId");
    set({ roomId: null, roomCode: null, playerId: null });
  },
}));
