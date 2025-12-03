import { useSignal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;
const PADDLE_WIDTH = 10;
const PADDLE_HEIGHT = 80;
const BALL_SIZE = 10;
const PADDLE_SPEED = 5;
const BALL_SPEED = 1.5; // Slower initial speed
const RALLY_SPEED_INCREMENT = 0.015; // Very gradual speed increase per rally hit
const MAX_RALLY_SPEED_MULTIPLIER = 2.5; // Cap the speed increase
const SPIN_FACTOR = 0.3;
const SPIN_DECAY = 0.997;
const SPIN_CURVE = 0.06;
const WALL_KICK = 2.5;
const TRAIL_LENGTH = 12;

// Particle types
interface Particle {
  x: number;
  y: number;
  velX: number;
  velY: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

// Power-up types
type PowerUpType = "speed" | "slow" | "big" | "small" | "multi";
interface PowerUp {
  x: number;
  y: number;
  type: PowerUpType;
  pulse: number;
}

// Trail point
interface TrailPoint {
  x: number;
  y: number;
  age: number;
}

// Difficulty settings
const DIFFICULTIES = {
  easy: { aiSpeed: 0.4, aiDeadzone: 45, name: "Easy" },
  medium: { aiSpeed: 0.55, aiDeadzone: 30, name: "Medium" },
  hard: { aiSpeed: 0.75, aiDeadzone: 15, name: "Hard" },
};

export default function PongGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerScore = useSignal(0);
  const aiScore = useSignal(0);
  const gameStarted = useSignal(false);
  const gameOver = useSignal(false);
  const winner = useSignal("");
  const difficulty = useSignal<keyof typeof DIFFICULTIES>("medium");
  const showMenu = useSignal(true);
  const highScore = useSignal(0);

  // Load high score from server (Deno KV)
  useEffect(() => {
    fetch("/api/highscore")
      .then((res) => res.json())
      .then((data) => {
        if (data.highScore) highScore.value = data.highScore;
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Game state
    let playerY = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;
    let playerPaddleHeight = PADDLE_HEIGHT;
    let playerVelY = 0;
    let prevPlayerY = playerY;
    let aiY = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;
    let aiPaddleHeight = PADDLE_HEIGHT;
    let aiVelY = 0;
    let prevAiY = aiY;
    let ballX = CANVAS_WIDTH / 2;
    let ballY = CANVAS_HEIGHT / 2;
    let ballVelX = BALL_SPEED;
    let ballVelY = BALL_SPEED * (Math.random() > 0.5 ? 1 : -1);
    let ballSpin = 0;
    let ballSpeedMultiplier = 1;
    let rallySpeedMultiplier = 1; // Increases with each rally hit

    // Audio context and sounds
    let audioCtx: AudioContext | null = null;
    const initAudio = () => {
      if (!audioCtx) audioCtx = new AudioContext();
    };

    const playSound = (freq: number, duration: number, type: OscillatorType = "square", volume: number = 0.1) => {
      if (!audioCtx) return;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(volume, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    };

    const playPaddleHit = (isPlayer: boolean) => {
      playSound(isPlayer ? 440 : 380, 0.1, "square", 0.08);
    };

    const playWallHit = () => {
      playSound(220, 0.08, "triangle", 0.05);
    };

    const playScore = (playerScored: boolean) => {
      if (playerScored) {
        playSound(523, 0.1, "square", 0.1);
        setTimeout(() => playSound(659, 0.1, "square", 0.1), 100);
        setTimeout(() => playSound(784, 0.15, "square", 0.1), 200);
      } else {
        playSound(330, 0.15, "sawtooth", 0.1);
        setTimeout(() => playSound(262, 0.2, "sawtooth", 0.1), 150);
      }
    };

    const playPowerUp = () => {
      playSound(880, 0.05, "sine", 0.1);
      setTimeout(() => playSound(1100, 0.05, "sine", 0.1), 50);
      setTimeout(() => playSound(1320, 0.1, "sine", 0.1), 100);
    };

    const playNewHighScore = () => {
      [523, 659, 784, 1047].forEach((freq, i) => {
        setTimeout(() => playSound(freq, 0.2, "sine", 0.12), i * 100);
      });
    };

    // Extra balls for multi-ball power-up
    let extraBalls: { x: number; y: number; velX: number; velY: number; spin: number }[] = [];

    // Visual effects
    let particles: Particle[] = [];
    let trail: TrailPoint[] = [];
    let screenShake = 0;
    let screenShakeX = 0;
    let screenShakeY = 0;

    // Power-ups
    let powerUp: PowerUp | null = null;
    let powerUpTimer = 0;
    let activePowerUp: { type: PowerUpType; timer: number; target: "player" | "ai" } | null = null;

    // Rally tracking
    let rallyCount = 0;
    let bestRally = 0;
    let lastHitter: "player" | "ai" | null = null;

    // Countdown
    let countdown = 0;

    // Stats
    let longestRally = 0;

    const keys: Record<string, boolean> = {};

    const handleKeyDown = (e: KeyboardEvent) => {
      keys[e.key] = true;
      if (showMenu.value) {
        if (e.key === "1") difficulty.value = "easy";
        if (e.key === "2") difficulty.value = "medium";
        if (e.key === "3") difficulty.value = "hard";
        if (e.key === " " || e.key === "Enter") {
          initAudio();
          showMenu.value = false;
          countdown = 180;
        }
      } else if (e.key === " " && !gameStarted.value && !gameOver.value && countdown === 0) {
        countdown = 180;
      }
      if (e.key === "r" && gameOver.value) {
        playerScore.value = 0;
        aiScore.value = 0;
        gameOver.value = false;
        gameStarted.value = false;
        winner.value = "";
        showMenu.value = true;
        resetBall();
        particles = [];
        extraBalls = [];
        powerUp = null;
        activePowerUp = null;
        rallyCount = 0;
        playerPaddleHeight = PADDLE_HEIGHT;
        aiPaddleHeight = PADDLE_HEIGHT;
        ballSpeedMultiplier = 1;
      }
      if (e.key === "Escape" && !gameOver.value) {
        showMenu.value = true;
        gameStarted.value = false;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.key] = false;
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    globalThis.addEventListener("keyup", handleKeyUp);

    function resetBall() {
      ballX = CANVAS_WIDTH / 2;
      ballY = CANVAS_HEIGHT / 2;
      ballVelX = BALL_SPEED * (Math.random() > 0.5 ? 1 : -1);
      ballVelY = BALL_SPEED * (Math.random() > 0.5 ? 1 : -1);
      ballSpin = 0;
      ballSpeedMultiplier = 1;
      rallySpeedMultiplier = 1; // Reset rally speed
      trail = [];
      extraBalls = [];
      rallyCount = 0;
      lastHitter = null;
      playerPaddleHeight = PADDLE_HEIGHT;
      aiPaddleHeight = PADDLE_HEIGHT;
      activePowerUp = null;
    }

    function spawnParticles(x: number, y: number, color: string, count: number, speed: number = 3) {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        particles.push({
          x, y,
          velX: Math.cos(angle) * speed * (0.5 + Math.random()),
          velY: Math.sin(angle) * speed * (0.5 + Math.random()),
          life: 1,
          maxLife: 30 + Math.random() * 20,
          color,
          size: 2 + Math.random() * 3,
        });
      }
    }

    function spawnScoreExplosion(x: number, color: string) {
      for (let i = 0; i < 30; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 5;
        particles.push({
          x, y: CANVAS_HEIGHT / 2,
          velX: Math.cos(angle) * speed,
          velY: Math.sin(angle) * speed,
          life: 1,
          maxLife: 40 + Math.random() * 30,
          color,
          size: 3 + Math.random() * 4,
        });
      }
      screenShake = 15;
    }

    function spawnPowerUp() {
      const types: PowerUpType[] = ["speed", "slow", "big", "small", "multi"];
      powerUp = {
        x: CANVAS_WIDTH / 2 - 15 + (Math.random() - 0.5) * 200,
        y: 50 + Math.random() * (CANVAS_HEIGHT - 100),
        type: types[Math.floor(Math.random() * types.length)],
        pulse: 0,
      };
    }

    function applyPowerUp(type: PowerUpType, target: "player" | "ai") {
      activePowerUp = { type, timer: 600, target };
      switch (type) {
        case "speed": ballSpeedMultiplier = 1.5; break;
        case "slow": ballSpeedMultiplier = 0.6; break;
        case "big":
          if (target === "player") playerPaddleHeight = PADDLE_HEIGHT * 1.5;
          else aiPaddleHeight = PADDLE_HEIGHT * 1.5;
          break;
        case "small":
          if (target === "player") aiPaddleHeight = PADDLE_HEIGHT * 0.6;
          else playerPaddleHeight = PADDLE_HEIGHT * 0.6;
          break;
        case "multi":
          for (let i = 0; i < 2; i++) {
            extraBalls.push({
              x: ballX, y: ballY,
              velX: ballVelX * (0.8 + Math.random() * 0.4),
              velY: ballVelY + (Math.random() - 0.5) * 3,
              spin: ballSpin,
            });
          }
          break;
      }
      spawnParticles(powerUp!.x + 15, powerUp!.y + 15, getPowerUpColor(type), 20, 4);
      playPowerUp();
      powerUp = null;
    }

    function getPowerUpColor(type: PowerUpType): string {
      switch (type) {
        case "speed": return "#ff6b6b";
        case "slow": return "#4ecdc4";
        case "big": return "#ffe66d";
        case "small": return "#ff6b6b";
        case "multi": return "#c44dff";
      }
    }

    function getPowerUpIcon(type: PowerUpType): string {
      switch (type) {
        case "speed": return "fast";
        case "slow": return "slow";
        case "big": return "BIG";
        case "small": return "smol";
        case "multi": return "x3";
      }
    }

    function update() {
      if (countdown > 0) {
        countdown--;
        if (countdown === 0) gameStarted.value = true;
        return;
      }
      if (!gameStarted.value || gameOver.value || showMenu.value) return;

      if (screenShake > 0) {
        screenShake *= 0.9;
        screenShakeX = (Math.random() - 0.5) * screenShake;
        screenShakeY = (Math.random() - 0.5) * screenShake;
      } else {
        screenShakeX = 0;
        screenShakeY = 0;
      }

      powerUpTimer++;
      if (!powerUp && powerUpTimer > 300 && Math.random() < 0.005) {
        spawnPowerUp();
        powerUpTimer = 0;
      }

      if (activePowerUp) {
        activePowerUp.timer--;
        if (activePowerUp.timer <= 0) {
          ballSpeedMultiplier = 1;
          playerPaddleHeight = PADDLE_HEIGHT;
          aiPaddleHeight = PADDLE_HEIGHT;
          activePowerUp = null;
        }
      }

      if (powerUp) powerUp.pulse += 0.1;

      particles = particles.filter((p) => {
        p.x += p.velX;
        p.y += p.velY;
        p.velX *= 0.98;
        p.velY *= 0.98;
        p.life -= 1 / p.maxLife;
        return p.life > 0;
      });

      playerVelY = playerY - prevPlayerY;
      prevPlayerY = playerY;
      aiVelY = aiY - prevAiY;
      prevAiY = aiY;

      if ((keys["ArrowUp"] || keys["w"]) && playerY > 0) playerY -= PADDLE_SPEED;
      if ((keys["ArrowDown"] || keys["s"]) && playerY < CANVAS_HEIGHT - playerPaddleHeight) playerY += PADDLE_SPEED;

      const diffSettings = DIFFICULTIES[difficulty.value];
      const aiCenter = aiY + aiPaddleHeight / 2;
      const aiSpeed = PADDLE_SPEED * diffSettings.aiSpeed;
      const aiDeadzone = diffSettings.aiDeadzone;
      const targetY = ballY + ballSpin * 10;
      if (aiCenter < targetY - aiDeadzone && aiY < CANVAS_HEIGHT - aiPaddleHeight) aiY += aiSpeed;
      else if (aiCenter > targetY + aiDeadzone && aiY > 0) aiY -= aiSpeed;

      ballVelY += ballSpin * SPIN_CURVE;
      ballSpin *= SPIN_DECAY;

      const totalSpeedMultiplier = ballSpeedMultiplier * rallySpeedMultiplier;
      ballX += ballVelX * totalSpeedMultiplier;
      ballY += ballVelY * totalSpeedMultiplier;

      trail.unshift({ x: ballX + BALL_SIZE / 2, y: ballY + BALL_SIZE / 2, age: 0 });
      if (trail.length > TRAIL_LENGTH) trail.pop();
      trail.forEach((t) => t.age++);

      if (ballY <= 0 || ballY >= CANVAS_HEIGHT - BALL_SIZE) {
        ballVelY = -ballVelY;
        ballVelY += ballSpin * WALL_KICK;
        ballSpin = -ballSpin * 0.7;
        ballY = ballY <= 0 ? 0 : CANVAS_HEIGHT - BALL_SIZE;
        spawnParticles(ballX + BALL_SIZE / 2, ballY <= 0 ? 5 : CANVAS_HEIGHT - 5, "#ffffff", 8, 2);
        screenShake = Math.min(Math.abs(ballSpin) * 3, 5);
        playWallHit();
      }

      if (ballX <= PADDLE_WIDTH + 20 && ballX >= 20 && ballY + BALL_SIZE >= playerY && ballY <= playerY + playerPaddleHeight) {
        ballVelX = Math.abs(ballVelX) * 1.01; // Reduced from 1.02
        const hitPos = (ballY - playerY) / playerPaddleHeight;
        ballVelY = (hitPos - 0.5) * BALL_SPEED * 2;
        ballSpin = playerVelY * SPIN_FACTOR;
        if (lastHitter !== "player") {
          rallyCount++;
          lastHitter = "player";
          // Gradually increase speed with rally
          rallySpeedMultiplier = Math.min(1 + rallyCount * RALLY_SPEED_INCREMENT, MAX_RALLY_SPEED_MULTIPLIER);
        }
        spawnParticles(PADDLE_WIDTH + 25, ballY + BALL_SIZE / 2, "#00d4ff", 10, 2);
        screenShake = 3 + Math.abs(playerVelY) * 0.5;
        playPaddleHit(true);
      }

      if (ballX >= CANVAS_WIDTH - PADDLE_WIDTH - 20 - BALL_SIZE && ballX <= CANVAS_WIDTH - 20 && ballY + BALL_SIZE >= aiY && ballY <= aiY + aiPaddleHeight) {
        ballVelX = -Math.abs(ballVelX) * 1.01; // Reduced from 1.02
        const hitPos = (ballY - aiY) / aiPaddleHeight;
        ballVelY = (hitPos - 0.5) * BALL_SPEED * 2;
        ballSpin = aiVelY * SPIN_FACTOR;
        if (lastHitter !== "ai") {
          rallyCount++;
          lastHitter = "ai";
          // Gradually increase speed with rally
          rallySpeedMultiplier = Math.min(1 + rallyCount * RALLY_SPEED_INCREMENT, MAX_RALLY_SPEED_MULTIPLIER);
        }
        spawnParticles(CANVAS_WIDTH - PADDLE_WIDTH - 25, ballY + BALL_SIZE / 2, "#ff6b6b", 10, 2);
        screenShake = 3;
        playPaddleHit(false);
      }

      if (powerUp) {
        const dx = ballX + BALL_SIZE / 2 - (powerUp.x + 15);
        const dy = ballY + BALL_SIZE / 2 - (powerUp.y + 15);
        if (Math.sqrt(dx * dx + dy * dy) < 20) applyPowerUp(powerUp.type, lastHitter || "player");
      }

      extraBalls = extraBalls.filter((eb) => {
        eb.x += eb.velX * ballSpeedMultiplier;
        eb.y += eb.velY * ballSpeedMultiplier;
        eb.velY += eb.spin * SPIN_CURVE;
        eb.spin *= SPIN_DECAY;
        if (eb.y <= 0 || eb.y >= CANVAS_HEIGHT - BALL_SIZE) { eb.velY = -eb.velY; eb.y = eb.y <= 0 ? 0 : CANVAS_HEIGHT - BALL_SIZE; }
        if (eb.x <= PADDLE_WIDTH + 20 && eb.x >= 20 && eb.y + BALL_SIZE >= playerY && eb.y <= playerY + playerPaddleHeight) eb.velX = Math.abs(eb.velX);
        if (eb.x >= CANVAS_WIDTH - PADDLE_WIDTH - 20 - BALL_SIZE && eb.x <= CANVAS_WIDTH - 20 && eb.y + BALL_SIZE >= aiY && eb.y <= aiY + aiPaddleHeight) eb.velX = -Math.abs(eb.velX);
        return eb.x > 0 && eb.x < CANVAS_WIDTH;
      });

      if (ballX < 0) {
        if (rallyCount > bestRally) bestRally = rallyCount;
        if (rallyCount > longestRally) longestRally = rallyCount;
        // Check for new high score
        if (rallyCount > highScore.value) {
          highScore.value = rallyCount;
          fetch("/api/highscore", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ score: rallyCount }),
          }).catch(() => {});
          playNewHighScore();
        }
        aiScore.value++;
        spawnScoreExplosion(50, "#ff6b6b");
        playScore(false);
        if (aiScore.value >= 5) { gameOver.value = true; winner.value = "AI"; }
        else { resetBall(); countdown = 120; gameStarted.value = false; }
      } else if (ballX > CANVAS_WIDTH) {
        if (rallyCount > bestRally) bestRally = rallyCount;
        if (rallyCount > longestRally) longestRally = rallyCount;
        // Check for new high score
        if (rallyCount > highScore.value) {
          highScore.value = rallyCount;
          fetch("/api/highscore", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ score: rallyCount }),
          }).catch(() => {});
          playNewHighScore();
        }
        playerScore.value++;
        spawnScoreExplosion(CANVAS_WIDTH - 50, "#00d4ff");
        playScore(true);
        if (playerScore.value >= 5) { gameOver.value = true; winner.value = "Player"; }
        else { resetBall(); countdown = 120; gameStarted.value = false; }
      }
    }

    function draw() {
      if (!ctx) return;
      ctx.save();
      ctx.translate(screenShakeX, screenShakeY);

      ctx.fillStyle = "rgba(26, 26, 46, 0.85)";
      ctx.fillRect(-10, -10, CANVAS_WIDTH + 20, CANVAS_HEIGHT + 20);

      ctx.strokeStyle = "#4a4a6a";
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.moveTo(CANVAS_WIDTH / 2, 0);
      ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
      ctx.stroke();
      ctx.setLineDash([]);

      particles.forEach((p) => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      trail.forEach((t, i) => {
        const alpha = 1 - i / TRAIL_LENGTH;
        const size = (BALL_SIZE / 2) * (1 - i / TRAIL_LENGTH * 0.5);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.4})`;
        ctx.beginPath();
        ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
        ctx.fill();
      });

      if (powerUp) {
        const pulse = Math.sin(powerUp.pulse) * 0.2 + 1;
        const color = getPowerUpColor(powerUp.type);
        ctx.fillStyle = color + "44";
        ctx.beginPath();
        ctx.arc(powerUp.x + 15, powerUp.y + 15, 20 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(powerUp.x + 15, powerUp.y + 15, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = "10px monospace";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(getPowerUpIcon(powerUp.type), powerUp.x + 15, powerUp.y + 15);
      }

      if (Math.abs(playerVelY) > 0.5) { ctx.shadowBlur = 20; ctx.shadowColor = "#00d4ff"; }
      ctx.fillStyle = "#00d4ff";
      ctx.fillRect(20, playerY, PADDLE_WIDTH, playerPaddleHeight);
      ctx.shadowBlur = 0;

      if (Math.abs(aiVelY) > 0.5) { ctx.shadowBlur = 20; ctx.shadowColor = "#ff6b6b"; }
      ctx.fillStyle = "#ff6b6b";
      ctx.fillRect(CANVAS_WIDTH - PADDLE_WIDTH - 20, aiY, PADDLE_WIDTH, aiPaddleHeight);
      ctx.shadowBlur = 0;

      extraBalls.forEach((eb) => {
        ctx.fillStyle = "rgba(200, 100, 255, 0.8)";
        ctx.beginPath();
        ctx.arc(eb.x + BALL_SIZE / 2, eb.y + BALL_SIZE / 2, BALL_SIZE / 2, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(ballX + BALL_SIZE / 2, ballY + BALL_SIZE / 2, BALL_SIZE / 2, 0, Math.PI * 2);
      ctx.fill();

      if (Math.abs(ballSpin) > 0.1) {
        const spinIntensity = Math.min(Math.abs(ballSpin) * 3, 1);
        ctx.beginPath();
        ctx.arc(ballX + BALL_SIZE / 2, ballY + BALL_SIZE / 2, BALL_SIZE / 2 + 3, 0, Math.PI * 2);
        ctx.strokeStyle = ballSpin > 0 ? `rgba(255, 100, 100, ${spinIntensity})` : `rgba(100, 100, 255, ${spinIntensity})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.font = "48px monospace";
      ctx.fillStyle = "#00d4ff";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(String(playerScore.value), CANVAS_WIDTH / 4, 20);
      ctx.fillStyle = "#ff6b6b";
      ctx.fillText(String(aiScore.value), (CANVAS_WIDTH / 4) * 3, 20);

      if (rallyCount > 0 && gameStarted.value) {
        ctx.font = "24px monospace";
        ctx.fillStyle = rallyCount >= 20 ? "#ff6b6b" : rallyCount >= 10 ? "#ffe66d" : "#888888";
        ctx.fillText(`Rally: ${rallyCount}`, CANVAS_WIDTH / 2, 20);
        // Show speed indicator
        ctx.font = "10px monospace";
        ctx.fillStyle = "#666666";
        const speedPercent = Math.round((rallySpeedMultiplier - 1) * 100);
        ctx.fillText(`+${speedPercent}% speed`, CANVAS_WIDTH / 2, 42);
      }
      // Always show high score
      ctx.font = "12px monospace";
      ctx.fillStyle = "#ffe66d";
      ctx.fillText(`High Score: ${highScore.value}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 15);

      if (activePowerUp) {
        const barWidth = 100;
        const progress = activePowerUp.timer / 600;
        ctx.fillStyle = "#333";
        ctx.fillRect(CANVAS_WIDTH / 2 - barWidth / 2, CANVAS_HEIGHT - 30, barWidth, 6);
        ctx.fillStyle = getPowerUpColor(activePowerUp.type);
        ctx.fillRect(CANVAS_WIDTH / 2 - barWidth / 2, CANVAS_HEIGHT - 30, barWidth * progress, 6);
        ctx.font = "12px monospace";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(getPowerUpIcon(activePowerUp.type) + " Active", CANVAS_WIDTH / 2, CANVAS_HEIGHT - 40);
      }

      if (countdown > 0) {
        const num = Math.ceil(countdown / 60);
        ctx.font = "72px monospace";
        ctx.fillStyle = "#ffffff";
        ctx.textBaseline = "middle";
        ctx.fillText(String(num), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      }

      if (showMenu.value) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.font = "48px monospace";
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("PONG", CANVAS_WIDTH / 2, 100);
        ctx.font = "24px monospace";
        ctx.fillText("Select Difficulty", CANVAS_WIDTH / 2, 180);
        const diffKeys = Object.keys(DIFFICULTIES) as (keyof typeof DIFFICULTIES)[];
        diffKeys.forEach((key, i) => {
          const isSelected = difficulty.value === key;
          ctx.font = isSelected ? "bold 28px monospace" : "20px monospace";
          ctx.fillStyle = isSelected ? "#ffe66d" : "#888888";
          ctx.fillText(`[${i + 1}] ${DIFFICULTIES[key].name}${isSelected ? " <" : ""}`, CANVAS_WIDTH / 2, 240 + i * 50);
        });
        ctx.font = "18px monospace";
        ctx.fillStyle = "#00d4ff";
        ctx.fillText("Press SPACE or ENTER to start", CANVAS_WIDTH / 2, 420);
        ctx.font = "14px monospace";
        ctx.fillStyle = "#666666";
        ctx.fillText("W/S or Arrow Keys to move | ESC for menu", CANVAS_WIDTH / 2, 460);
      }

      if (gameOver.value) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.font = "48px monospace";
        ctx.fillStyle = winner.value === "Player" ? "#00d4ff" : "#ff6b6b";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${winner.value} Wins!`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60);
        ctx.font = "20px monospace";
        ctx.fillStyle = "#ffe66d";
        ctx.fillText(`Longest Rally: ${longestRally}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 10);
        ctx.font = "16px monospace";
        ctx.fillStyle = longestRally >= highScore.value ? "#00ff00" : "#888888";
        ctx.fillText(`High Score: ${highScore.value}${longestRally >= highScore.value ? " NEW!" : ""}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 15);
        ctx.font = "24px monospace";
        ctx.fillStyle = "#ffffff";
        ctx.fillText("Press R to play again", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 60);
      }

      ctx.restore();
    }

    let animationId: number;
    function gameLoop() { update(); draw(); animationId = requestAnimationFrame(gameLoop); }
    gameLoop();

    return () => {
      globalThis.removeEventListener("keydown", handleKeyDown);
      globalThis.removeEventListener("keyup", handleKeyUp);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <div class="flex flex-col items-center gap-4">
      <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} class="border-4 border-gray-700 rounded-lg shadow-2xl" />
      <div class="text-gray-400 text-sm text-center">
        <div><span class="text-cyan-400">Player (Left)</span> vs <span class="text-red-400">AI (Right)</span> | First to 5 wins!</div>
        <div class="text-xs mt-1 text-gray-500">Move fast when hitting for spin! | Collect power-ups for bonuses!</div>
      </div>
    </div>
  );
}
