
-- Add mr_white_answer to player_secrets for Mr.White to store their answer
ALTER TABLE public.player_secrets ADD COLUMN mr_white_answer text DEFAULT NULL;

-- Add first_player_id to rooms for random first player selection
ALTER TABLE public.rooms ADD COLUMN first_player_id uuid DEFAULT NULL;

-- Allow players to update their own mr_white_answer
CREATE POLICY "Players can update own mr_white_answer"
ON public.player_secrets
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
