import { define } from "../../utils.ts";

const kv = await Deno.openKv();

export const handler = define.handlers({
  // Get counter value
  async GET(_ctx) {
    const result = await kv.get<number>(["counter", "value"]);
    return new Response(JSON.stringify({ count: result.value ?? 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  },

  // Update counter value
  async POST(ctx) {
    try {
      const body = await ctx.req.json();
      const count = Number(body.count);

      if (isNaN(count)) {
        return new Response(JSON.stringify({ error: "Invalid count" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      await kv.set(["counter", "value"], count);
      return new Response(JSON.stringify({ count }), {
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
