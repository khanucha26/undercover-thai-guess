import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// 100+ Thai word pairs
const WORD_PAIRS: [string, string][] = [
  ["ข้าวผัด", "ข้าวต้ม"],
  ["กาแฟ", "ชา"],
  ["แมว", "สุนัข"],
  ["ทะเล", "แม่น้ำ"],
  ["ดวงจันทร์", "ดวงอาทิตย์"],
  ["รถไฟ", "รถเมล์"],
  ["กีตาร์", "อูคูเลเล่"],
  ["ฟุตบอล", "บาสเก็ตบอล"],
  ["พิซซ่า", "แฮมเบอร์เกอร์"],
  ["ภูเขา", "เนินเขา"],
  ["หมอน", "ผ้าห่ม"],
  ["ปากกา", "ดินสอ"],
  ["โทรศัพท์", "แท็บเล็ต"],
  ["รองเท้า", "รองเท้าแตะ"],
  ["แว่นตา", "แว่นกันแดด"],
  ["จักรยาน", "มอเตอร์ไซค์"],
  ["ไอศกรีม", "เค้ก"],
  ["หนังสือ", "นิตยสาร"],
  ["กล้วย", "มะม่วง"],
  ["ส้ม", "แมนดาริน"],
  ["ช้อน", "ส้อม"],
  ["เก้าอี้", "โซฟา"],
  ["โต๊ะ", "เคาน์เตอร์"],
  ["หมวก", "หมวกแก๊ป"],
  ["นาฬิกา", "นาฬิกาข้อมือ"],
  ["กระเป๋า", "กระเป๋าเป้"],
  ["เสื้อยืด", "เสื้อเชิ้ต"],
  ["กางเกงขาสั้น", "กางเกงขายาว"],
  ["ร่ม", "เสื้อกันฝน"],
  ["ตู้เย็น", "ตู้แช่แข็ง"],
  ["ไมโครเวฟ", "เตาอบ"],
  ["โทรทัศน์", "จอคอมพิวเตอร์"],
  ["หนัง", "ซีรีส์"],
  ["เพลง", "พอดแคสต์"],
  ["ว่ายน้ำ", "ดำน้ำ"],
  ["วิ่ง", "เดิน"],
  ["เต้นรำ", "โยคะ"],
  ["ข้าวเหนียว", "ข้าวสวย"],
  ["ส้มตำ", "ยำ"],
  ["ต้มยำ", "ต้มข่า"],
  ["แกงเขียวหวาน", "แกงเผ็ด"],
  ["ผัดไทย", "ผัดซีอิ๊ว"],
  ["ลูกชิ้น", "ไส้กรอก"],
  ["น้ำส้ม", "น้ำมะนาว"],
  ["นม", "โยเกิร์ต"],
  ["ขนมปัง", "ครัวซองต์"],
  ["ถุงเท้า", "ถุงมือ"],
  ["ผ้าพันคอ", "เนคไท"],
  ["แหวน", "กำไล"],
  ["สร้อยคอ", "ต่างหู"],
  ["กุญแจ", "แม่กุญแจ"],
  ["เทียน", "ตะเกียง"],
  ["ดอกกุหลาบ", "ดอกมะลิ"],
  ["ต้นไม้", "ดอกไม้"],
  ["นก", "ผีเสื้อ"],
  ["ปลา", "กุ้ง"],
  ["ไก่", "เป็ด"],
  ["หมู", "วัว"],
  ["ช้าง", "ยีราฟ"],
  ["สิงโต", "เสือ"],
  ["กบ", "คางคก"],
  ["งู", "จิ้งจก"],
  ["มด", "ผึ้ง"],
  ["ยุง", "แมลงวัน"],
  ["ดาว", "ดาวตก"],
  ["เมฆ", "หมอก"],
  ["ฝน", "หิมะ"],
  ["ลม", "พายุ"],
  ["ทราย", "หิน"],
  ["เกาะ", "แหลม"],
  ["ถ้ำ", "อุโมงค์"],
  ["สะพาน", "ทางด่วน"],
  ["วัด", "โบสถ์"],
  ["โรงเรียน", "มหาวิทยาลัย"],
  ["โรงพยาบาล", "คลินิก"],
  ["ร้านอาหาร", "คาเฟ่"],
  ["ตลาด", "ห้างสรรพสินค้า"],
  ["สวนสาธารณะ", "สนามเด็กเล่น"],
  ["สระว่ายน้ำ", "สวนน้ำ"],
  ["สนามบิน", "สถานีรถไฟ"],
  ["ธนาคาร", "ไปรษณีย์"],
  ["ตำรวจ", "ทหาร"],
  ["หมอ", "พยาบาล"],
  ["ครู", "อาจารย์"],
  ["นักร้อง", "นักดนตรี"],
  ["นักแสดง", "ตลก"],
  ["จิตรกร", "ช่างภาพ"],
  ["พ่อครัว", "บาริสต้า"],
  ["วิศวกร", "สถาปนิก"],
  ["ทนายความ", "ผู้พิพากษา"],
  ["นักบิน", "กัปตันเรือ"],
  ["มายากล", "กายกรรม"],
  ["หมากรุก", "หมากฮอส"],
  ["ไพ่", "ลูกเต๋า"],
  ["ว่าว", "บูมเมอแรง"],
  ["ตกปลา", "ล่าสัตว์"],
  ["แคมป์ปิ้ง", "ปิกนิก"],
  ["คาราโอเกะ", "ดิสโก้"],
  ["ซูชิ", "ซาชิมิ"],
  ["ราเมน", "อุด้ง"],
  ["วาฟเฟิล", "แพนเค้ก"],
  ["ช็อกโกแลต", "คุกกี้"],
  ["มะพร้าว", "สับปะรด"],
  ["แตงโม", "แคนตาลูป"],
  ["องุ่น", "บลูเบอร์รี่"],
  ["สตรอว์เบอร์รี่", "ราสเบอร์รี่"],
  ["ถั่วลิสง", "อัลมอนด์"],
  ["เนย", "ชีส"],
  ["ซอสพริก", "ซอสมะเขือเทศ"],
  ["น้ำปลา", "ซีอิ๊ว"],
  ["เกลือ", "น้ำตาล"],
  ["พริก", "พริกไทย"],
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
    if (!roomId) {
      return new Response(JSON.stringify({ error: "roomId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify host
    const { data: room } = await supabaseAdmin
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    if (!room || room.host_id !== userId) {
      return new Response(JSON.stringify({ error: "Only host can start" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (room.status !== "lobby" && room.status !== "result") {
      return new Response(JSON.stringify({ error: "Game already started" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get players
    const { data: players } = await supabaseAdmin
      .from("players")
      .select("*")
      .eq("room_id", roomId);

    if (!players || players.length < 3) {
      return new Response(
        JSON.stringify({ error: "Need at least 3 players" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check all ready
    const allReady = players.every((p: any) => p.is_ready);
    if (!allReady) {
      return new Response(
        JSON.stringify({ error: "Not all players are ready" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const settings = room.settings || {};
    const undercoverCount = settings.undercoverCount || 1;
    const mrWhiteCount = settings.mrWhiteCount || 0;

    if (undercoverCount + mrWhiteCount >= players.length) {
      return new Response(
        JSON.stringify({ error: "Too many special roles for player count" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Pick random word pair
    const pair = WORD_PAIRS[Math.floor(Math.random() * WORD_PAIRS.length)];
    const civilianWord = pair[0];
    const undercoverWord = pair[1];

    // Shuffle and assign roles
    const shuffled = shuffle(players);
    const secrets: any[] = [];

    for (let i = 0; i < shuffled.length; i++) {
      let role = "civilian";
      let word: string | null = civilianWord;

      if (i < undercoverCount) {
        role = "undercover";
        word = undercoverWord;
      } else if (i < undercoverCount + mrWhiteCount) {
        role = "mrwhite";
        word = null;
      }

      secrets.push({
        player_id: shuffled[i].id,
        room_id: roomId,
        user_id: shuffled[i].user_id,
        word,
        role,
      });
    }

    // Clear old secrets and votes if replaying
    await supabaseAdmin
      .from("player_secrets")
      .delete()
      .eq("room_id", roomId);
    await supabaseAdmin.from("votes").delete().eq("room_id", roomId);
    await supabaseAdmin
      .from("vote_results")
      .delete()
      .eq("room_id", roomId);

    // Reset players alive status
    await supabaseAdmin
      .from("players")
      .update({ is_alive: true, is_ready: false })
      .eq("room_id", roomId);

    // Insert secrets
    const { error: secretsError } = await supabaseAdmin
      .from("player_secrets")
      .insert(secrets);

    if (secretsError) {
      console.error("Error inserting secrets:", secretsError);
      return new Response(
        JSON.stringify({ error: "Failed to assign words" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update room status
    await supabaseAdmin
      .from("rooms")
      .update({ status: "playing", current_round: 1 })
      .eq("id", roomId);

    return new Response(JSON.stringify({ success: true }), {
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
