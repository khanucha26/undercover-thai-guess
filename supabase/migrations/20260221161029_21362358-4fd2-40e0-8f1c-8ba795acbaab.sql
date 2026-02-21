
-- Rooms table
CREATE TABLE public.rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_code VARCHAR(6) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'playing', 'voting', 'result')),
  host_id UUID NOT NULL,
  settings JSONB NOT NULL DEFAULT '{"undercoverCount": 1, "mrWhiteCount": 0}'::jsonb,
  current_round INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rooms_room_code ON public.rooms(room_code);

-- Players table (public info only)
CREATE TABLE public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name VARCHAR(50) NOT NULL,
  is_ready BOOLEAN NOT NULL DEFAULT false,
  is_alive BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id),
  UNIQUE(room_id, name)
);

CREATE INDEX idx_players_user_id ON public.players(user_id);
CREATE INDEX idx_players_room_id ON public.players(room_id);

-- Player secrets (word + role, private per player)
CREATE TABLE public.player_secrets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE UNIQUE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  word TEXT,
  role VARCHAR(20) NOT NULL DEFAULT 'civilian' CHECK (role IN ('civilian', 'undercover', 'mrwhite')),
  UNIQUE(room_id, user_id)
);

-- Votes table
CREATE TABLE public.votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  round INT NOT NULL,
  voter_id UUID NOT NULL,
  target_player_id UUID NOT NULL REFERENCES public.players(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(room_id, round, voter_id)
);

-- Vote results (revealed after vote)
CREATE TABLE public.vote_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  round INT NOT NULL,
  eliminated_player_id UUID REFERENCES public.players(id),
  eliminated_word TEXT,
  eliminated_role VARCHAR(20),
  game_over BOOLEAN NOT NULL DEFAULT false,
  winner VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vote_results;

-- Enable RLS
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vote_results ENABLE ROW LEVEL SECURITY;

-- Helper function: is user in room
CREATE OR REPLACE FUNCTION public.is_room_member(p_user_id UUID, p_room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.players
    WHERE user_id = p_user_id AND room_id = p_room_id
  );
$$;

-- Helper function: is user host of room
CREATE OR REPLACE FUNCTION public.is_room_host(p_user_id UUID, p_room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rooms
    WHERE id = p_room_id AND host_id = p_user_id
  );
$$;

-- ROOMS policies
CREATE POLICY "Anyone can create rooms" ON public.rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Room members can view room" ON public.rooms FOR SELECT USING (public.is_room_member(auth.uid(), id) OR status = 'lobby');
CREATE POLICY "Host can update room" ON public.rooms FOR UPDATE USING (host_id = auth.uid());

-- PLAYERS policies
CREATE POLICY "Room members can view players" ON public.players FOR SELECT USING (public.is_room_member(auth.uid(), room_id) OR user_id = auth.uid());
CREATE POLICY "Users can join rooms" ON public.players FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Players can update own record" ON public.players FOR UPDATE USING (user_id = auth.uid());

-- PLAYER_SECRETS policies (only own record)
CREATE POLICY "Players can view own secret" ON public.player_secrets FOR SELECT USING (user_id = auth.uid());

-- VOTES policies
CREATE POLICY "Room members can view votes" ON public.votes FOR SELECT USING (public.is_room_member(auth.uid(), room_id));
CREATE POLICY "Players can cast vote" ON public.votes FOR INSERT WITH CHECK (voter_id = auth.uid() AND public.is_room_member(auth.uid(), room_id));

-- VOTE_RESULTS policies
CREATE POLICY "Room members can view results" ON public.vote_results FOR SELECT USING (public.is_room_member(auth.uid(), room_id));
