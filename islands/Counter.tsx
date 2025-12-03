import { useSignal } from "@preact/signals";
import { Button } from "../components/Button.tsx";

interface CounterProps {
  initialCount: number;
}

export default function Counter(props: CounterProps) {
  const count = useSignal(props.initialCount);

  // Save counter value to server whenever it changes
  const updateCount = (delta: number) => {
    count.value += delta;
    fetch("/api/counter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: count.value }),
    }).catch(() => {});
  };

  return (
    <div class="flex gap-8 py-6">
      <Button id="decrement" onClick={() => updateCount(-1)}>-1</Button>
      <p class="text-3xl tabular-nums">{count}</p>
      <Button id="increment" onClick={() => updateCount(1)}>+1</Button>
    </div>
  );
}
