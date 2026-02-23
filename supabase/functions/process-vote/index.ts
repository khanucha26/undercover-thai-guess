import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } =
      await supabaseUser.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { roomId, action } = await req.json();

    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    if (!room) {
      return new Response(JSON.stringify({ error: "Room not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: start voting phase
    if (action === "start-voting") {
      if (room.host_id !== userId) {
        return new Response(
          JSON.stringify({ error: "Only host can start voting" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabaseAdmin
        .from("rooms")
        .update({ status: "voting" })
        .eq("id", roomId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: tally votes
    if (action === "tally") {
      if (room.host_id !== userId) {
        return new Response(
          JSON.stringify({ error: "Only host can tally" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const round = room.current_round;

      const { data: alivePlayers } = await supabaseAdmin
        .from("players")
        .select("*")
        .eq("room_id", roomId)
        .eq("is_alive", true);

      const { data: votes } = await supabaseAdmin
        .from("votes")
        .select("*")
        .eq("room_id", roomId)
        .eq("round", round);

      if (!votes || !alivePlayers || votes.length < alivePlayers.length) {
        return new Response(
          JSON.stringify({ error: "Not all votes are in yet" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Count votes
      const voteCounts: Record<string, number> = {};
      for (const p of alivePlayers) voteCounts[p.id] = 0;
      for (const v of votes) voteCounts[v.target_player_id] = (voteCounts[v.target_player_id] || 0) + 1;

      // Build vote summary
      const voteSummary = alivePlayers.map((p) => ({
        playerId: p.id,
        name: p.name,
        votes: voteCounts[p.id] || 0,
      })).sort((a, b) => b.votes - a.votes);

      // Find max votes & handle ties by random selection
      const maxVotes = Math.max(...Object.values(voteCounts));
      const topPlayers = Object.entries(voteCounts).filter(([, count]) => count === maxVotes);
      const eliminatedId = topPlayers[Math.floor(Math.random() * topPlayers.length)][0];

      // Eliminate player
      await supabaseAdmin
        .from("players")
        .update({ is_alive: false })
        .eq("id", eliminatedId);

      // Get eliminated player's secret
      const { data: secret } = await supabaseAdmin
        .from("player_secrets")
        .select("*")
        .eq("player_id", eliminatedId)
        .single();

      const eliminatedRole = secret?.role || "civilian";

      // If Mr.White is eliminated, check their stored answer
      if (eliminatedRole === "mrwhite") {
        const mrWhiteAnswer = secret?.mr_white_answer?.trim() || "";

        // Get civilian word
        const { data: civilianSecret } = await supabaseAdmin
          .from("player_secrets")
          .select("word")
          .eq("room_id", roomId)
          .eq("role", "civilian")
          .limit(1)
          .single();

        if (civilianSecret && mrWhiteAnswer && mrWhiteAnswer === civilianSecret.word?.trim()) {
          // Mr.White guessed correctly → Mr.White wins!
          await supabaseAdmin.from("vote_results").upsert(
            {
              room_id: roomId,
              round,
              eliminated_player_id: eliminatedId,
              eliminated_word: null,
              eliminated_role: "mrwhite",
              game_over: true,
              winner: "mrwhite",
            },
            { onConflict: "room_id,round", ignoreDuplicates: false }
          );

          await supabaseAdmin
            .from("rooms")
            .update({ status: "result" })
            .eq("id", roomId);

          return new Response(
            JSON.stringify({
              success: true,
              result: "game_over",
              winner: "mrwhite",
              eliminatedId,
              voteSummary,
              message: "Mr.White ตอบถูก และชนะเกม!",
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Mr.White answer wrong → continue game normally (Mr.White is still eliminated)
      }

      // Save vote result
      await supabaseAdmin.from("vote_results").upsert(
        {
          room_id: roomId,
          round,
          eliminated_player_id: eliminatedId,
          eliminated_word: null,
          eliminated_role: eliminatedRole,
          game_over: false,
          winner: null,
        },
        { onConflict: "room_id,round", ignoreDuplicates: false }
      );

      // Check win conditions
      const { data: remainingPlayers } = await supabaseAdmin
        .from("players")
        .select("id")
        .eq("room_id", roomId)
        .eq("is_alive", true);

      const { data: remainingSecrets } = await supabaseAdmin
        .from("player_secrets")
        .select("player_id, role")
        .eq("room_id", roomId)
        .in("player_id", (remainingPlayers || []).map((p: any) => p.id));

      const aliveSpecial = (remainingSecrets || []).filter((s: any) => s.role !== "civilian");
      const aliveCivilian = (remainingSecrets || []).filter((s: any) => s.role === "civilian");

      let gameOver = false;
      let winner: string | null = null;

      if (aliveSpecial.length === 0) {
        gameOver = true;
        winner = "civilian";
      } else if ((remainingPlayers || []).length <= 2 && aliveSpecial.length > 0) {
        gameOver = true;
        winner = "undercover";
      }

      if (gameOver) {
        await supabaseAdmin.from("vote_results").upsert(
          {
            room_id: roomId,
            round,
            eliminated_player_id: eliminatedId,
            eliminated_word: null,
            eliminated_role: eliminatedRole,
            game_over: true,
            winner,
          },
          { onConflict: "room_id,round", ignoreDuplicates: false }
        );

        await supabaseAdmin
          .from("rooms")
          .update({ status: "result" })
          .eq("id", roomId);

        return new Response(
          JSON.stringify({
            success: true,
            result: "game_over",
            winner,
            eliminatedId,
            voteSummary,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Continue to next round
      await supabaseAdmin
        .from("rooms")
        .update({ status: "playing", current_round: round + 1 })
        .eq("id", roomId);

      return new Response(
        JSON.stringify({
          success: true,
          result: "eliminated",
          eliminatedId,
          voteSummary,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
