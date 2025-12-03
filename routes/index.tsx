import { Head } from "fresh/runtime";
import { define } from "../utils.ts";
import Counter from "../islands/Counter.tsx";

const kv = await Deno.openKv();

export default define.page(async function Home(ctx) {
  // Load initial count from KV on the server
  const result = await kv.get<number>(["counter", "value"]);
  const initialCount = result.value ?? 0;

  console.log("Shared value " + ctx.state.shared);

  return (
    <div class="px-4 py-8 mx-auto fresh-gradient min-h-screen">
      <Head>
        <title>Fresh counter</title>
      </Head>
      <div class="max-w-screen-md mx-auto flex flex-col items-center justify-center">
        <img
          class="my-6"
          src="/logo.svg"
          width="128"
          height="128"
          alt="the Fresh logo: a sliced lemon dripping with juice"
        />
        <h1 class="text-4xl font-bold">Welcome to Fresh</h1>
        <Counter initialCount={initialCount} />
        <a
          href="/pong"
          class="mt-6 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors shadow-lg"
        >
          🏓 Play Pong
        </a>
      </div>
    </div>
  );
});
