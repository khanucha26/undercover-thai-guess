
CREATE UNIQUE INDEX idx_vote_results_room_round ON public.vote_results(room_id, round);
