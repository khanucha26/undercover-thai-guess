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

    const { roomId } = await req.json();

    // Verify user is a member of this room
    const { data: membership } = await supabaseAdmin
      .from("players")
      .select("id")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a room member" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get room to verify it's in result status
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("status")
      .eq("id", roomId)
      .single();

    if (!room || room.status !== "result") {
      return new Response(JSON.stringify({ error: "Game is not finished yet" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all players with their secrets
    const { data: players } = await supabaseAdmin
      .from("players")
      .select("id, name, user_id, is_alive")
      .eq("room_id", roomId)
      .order("joined_at");

    const { data: secrets } = await supabaseAdmin
      .from("player_secrets")
      .select("player_id, role, word, mr_white_answer")
      .eq("room_id", roomId);

    // Merge
    const result = (players || []).map((p: any) => {
      const s = (secrets || []).find((s: any) => s.player_id === p.id);
      return {
        id: p.id,
        name: p.name,
        user_id: p.user_id,
        is_alive: p.is_alive,
        role: s?.role || "civilian",
        word: s?.word || null,
        mr_white_answer: s?.mr_white_answer || null,
      };
    });

    return new Response(JSON.stringify({ players: result }), {
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
