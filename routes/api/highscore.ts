import { define } from "../../utils.ts";

const kv = await Deno.openKv();

export const handler = define.handlers({
  // Get high score
  async GET(_ctx) {
    const result = await kv.get<number>(["pong", "highscore"]);
    return new Response(JSON.stringify({ highScore: result.value ?? 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  },

  // Update high score
  async POST(ctx) {
    try {
      const body = await ctx.req.json();
      const newScore = Number(body.score);

      if (isNaN(newScore) || newScore < 0) {
        return new Response(JSON.stringify({ error: "Invalid score" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      // Get current high score
      const current = await kv.get<number>(["pong", "highscore"]);
      const currentScore = current.value ?? 0;

      // Only update if new score is higher
      if (newScore > currentScore) {
        await kv.set(["pong", "highscore"], newScore);
        return new Response(JSON.stringify({ highScore: newScore, isNewRecord: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ highScore: currentScore, isNewRecord: false }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
});
