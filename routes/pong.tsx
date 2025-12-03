import { Head } from "fresh/runtime";
import { define } from "../utils.ts";
import PongGame from "../islands/PongGame.tsx";

export default define.page(function Pong() {
  return (
    <div class="px-4 py-8 mx-auto bg-gray-900 min-h-screen">
      <Head>
        <title>Pong Game</title>
      </Head>
      <div class="max-w-screen-lg mx-auto flex flex-col items-center justify-center">
        <h1 class="text-4xl font-bold text-white mb-2">🏓 Pong</h1>
        <p class="text-gray-400 mb-6">Classic arcade game built with HTML Canvas</p>
        <PongGame />
        <a
          href="/"
          class="mt-8 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
        >
          ← Back to Home
        </a>
      </div>
    </div>
  );
});
