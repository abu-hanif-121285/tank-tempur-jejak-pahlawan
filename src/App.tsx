import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import heroUrl from "./assets/hero.jpg";
import VirtualJoystick from "./components/VirtualJoystick";
import { GameAudio } from "./game/audio";
import { ThreeGame, type Telemetry } from "./game/ThreeGame";
import { LETTERS, QUESTIONS, ZONES, validateBank, zoneForQuestion } from "./data/questions";

type Phase = "menu" | "intro" | "playing" | "feedback" | "result" | "review";

type AnswerRecord = {
  questionId: number;
  chosen: string;
  chosenText: string;
  correctLetter: string;
  correct: boolean;
  explanation: string;
};

type Session = {
  playerName: string;
  questionIndex: number;
  lives: number;
  correct: number;
  wrong: number;
  rawScore: number;
  score: number;
  results: AnswerRecord[];
  startTime: number;
  finishedAt: number | null;
  endedEarly: boolean;
};

type Feedback = {
  correct: boolean;
  chosen: string;
  chosenText: string;
  correctLetter: string;
  correctText: string;
  explanation: string;
  pointsEarned: number;
  zoneBonus: number;
  missionBonus: number;
  isFinal: boolean;
  endedEarly: boolean;
  zoneTitle: string;
  questionNumber: number;
};

const MAX_SCORE = 2200;

function createSession(name: string): Session {
  return {
    playerName: name.trim() || "KOMANDAN",
    questionIndex: 0,
    lives: 3,
    correct: 0,
    wrong: 0,
    rawScore: 0,
    score: 0,
    results: [],
    startTime: Date.now(),
    finishedAt: null,
    endedEarly: false,
  };
}

function formatTime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60).toString().padStart(2, "0");
  const seconds = (total % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function achievement(percent: number) {
  if (percent >= 90) return { title: "COMMANDER ELITE", color: "#ffd35c", note: "Penguasaan materi sangat luar biasa." };
  if (percent >= 80) return { title: "MASTER TANK", color: "#9ff08a", note: "Akurasi dan pemahaman materi sangat baik." };
  if (percent >= 70) return { title: "SKILLED SOLDIER", color: "#7dd8ff", note: "Misi berhasil dengan kemampuan yang solid." };
  if (percent >= 60) return { title: "ROOKIE SOLDIER", color: "#f4b76b", note: "Terus latih bidikan dan pemahaman materi." };
  return { title: "KEEP TRAINING", color: "#ff8a76", note: "Ulangi materi Bab 3 Pertemuan 1 lalu coba lagi." };
}

function GameLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`logo-wrap ${compact ? "logo-compact" : ""}`}>
      <div className="logo-emblem">
        <span className="logo-emblem-bar" />
        <span className="logo-emblem-star">★</span>
      </div>
      <div className="leading-none">
        <div className="logo-title">TANK BATTLE</div>
        <div className="logo-subtitle">MISSION INDONESIA</div>
      </div>
    </div>
  );
}

function MiniMap({ questionIndex }: { questionIndex: number }) {
  return (
    <div className="minimap pointer-events-none">
      <div className="minimap-inner">
        <svg viewBox="0 0 160 160" className="absolute inset-0 h-full w-full">
          <defs>
            <radialGradient id="radarGlow">
              <stop offset="0%" stopColor="#31543a" />
              <stop offset="100%" stopColor="#101c14" />
            </radialGradient>
          </defs>
          <circle cx="80" cy="80" r="78" fill="url(#radarGlow)" />
          <g fill="#7b894f" opacity="0.68">
            <path d="M20 62 C34 54 45 57 56 62 C65 66 70 61 77 58 L81 66 C72 71 62 75 51 70 C39 65 31 66 22 70 Z" />
            <path d="M43 88 C54 83 70 86 78 91 C73 98 61 100 48 96 Z" />
            <path d="M88 55 C95 52 104 55 108 61 C104 69 96 68 90 64 Z" />
            <path d="M98 88 C112 84 130 89 140 95 C129 101 111 100 100 95 Z" />
            <path d="M87 108 C96 104 105 108 108 115 C102 121 93 118 88 114 Z" />
          </g>
          <g stroke="#476c48" strokeWidth="1" opacity="0.45">
            <circle cx="80" cy="80" r="28" fill="none" />
            <circle cx="80" cy="80" r="53" fill="none" />
            <path d="M80 4 V156 M4 80 H156" />
          </g>
          <g fill="#ff5544">
            <circle cx="43" cy="48" r="4" />
            <circle cx="116" cy="49" r="4" />
            <circle cx="29" cy="101" r="4" />
            <circle cx="124" cy="112" r="4" />
          </g>
          <path d="M76 116 L84 116 L80 103 Z" fill="#ffe04a" />
          <path d="M80 80 L80 102" stroke="#ffe04a" strokeWidth="2" strokeDasharray="3 3" opacity="0.8" />
          <circle cx="80" cy="80" r="72" fill="none" stroke="#89967a" strokeWidth="2" opacity="0.5" />
        </svg>
        <div className="radar-sweep" />
        <div className="minimap-label">RADAR • Z{Math.floor(questionIndex / 5) + 1}</div>
      </div>
    </div>
  );
}

export default function App() {
  const validation = useMemo(() => validateBank(), []);
  const [playerName, setPlayerName] = useState("");
  const [phase, setPhase] = useState<Phase>("menu");
  const phaseRef = useRef<Phase>("menu");
  const [soundOn, setSoundOn] = useState(true);
  const [session, setSession] = useState<Session>(() => createSession("KOMANDAN"));
  const sessionRef = useRef<Session>(session);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const feedbackRef = useRef<Feedback | null>(null);
  const [aimed, setAimed] = useState<string | null>(null);
  const [telemetry, setTelemetry] = useState<Telemetry>({ turret: 0, elevation: 3, speed: 0, camera: "CHASE" });
  const [toast, setToast] = useState<string | null>(null);
  const [zoneBanner, setZoneBanner] = useState<{ zone: number; title: string; description: string } | null>(null);

  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<ThreeGame | null>(null);
  const audioRef = useRef<GameAudio | null>(null);
  const answerHandlerRef = useRef<(letter: string) => void>(() => {});
  const missHandlerRef = useRef<() => void>(() => {});
  const enemyFireHandlerRef = useRef<() => void>(() => {});
  const introTimerRef = useRef<number | null>(null);
  const zoneTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const setGamePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const commit = useCallback((mutator: (draft: Session) => void) => {
    mutator(sessionRef.current);
    setSession({ ...sessionRef.current });
  }, []);

  const clearTimers = useCallback(() => {
    if (introTimerRef.current !== null) window.clearTimeout(introTimerRef.current);
    if (zoneTimerRef.current !== null) window.clearTimeout(zoneTimerRef.current);
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    introTimerRef.current = null;
    zoneTimerRef.current = null;
    toastTimerRef.current = null;
  }, []);

  const finishSession = useCallback((endedEarly: boolean) => {
    clearTimers();
    gameRef.current?.setActive(false);
    audioRef.current?.setEngine(0.12);
    commit((draft) => {
      draft.finishedAt = Date.now();
      draft.endedEarly = endedEarly;
    });
    setFeedback(null);
    feedbackRef.current = null;
    setToast(null);
    setZoneBanner(null);
    setGamePhase("result");
  }, [clearTimers, commit, setGamePhase]);

  const beginQuestion = useCallback((index: number) => {
    if (introTimerRef.current !== null) {
      window.clearTimeout(introTimerRef.current);
      introTimerRef.current = null;
    }
    if (index >= QUESTIONS.length) {
      finishSession(false);
      return;
    }
    const zone = zoneForQuestion(index);
    commit((draft) => { draft.questionIndex = index; });
    setFeedback(null);
    feedbackRef.current = null;
    setToast(null);
    setAimed(null);
    if (index % 5 === 0) {
      setZoneBanner({ zone: Math.floor(index / 5) + 1, title: zone.title, description: zone.description });
      if (zoneTimerRef.current !== null) window.clearTimeout(zoneTimerRef.current);
      zoneTimerRef.current = window.setTimeout(() => setZoneBanner(null), 2800);
    }
    setGamePhase("playing");
    gameRef.current?.startQuestion(index, QUESTIONS[index], zone);
    gameRef.current?.setActive(true);
  }, [commit, finishSession, setGamePhase]);

  const handleTargetHit = useCallback((letter: string) => {
    if (phaseRef.current !== "playing") return;
    const current = sessionRef.current;
    const question = QUESTIONS[current.questionIndex];
    const correctLetter = LETTERS[question.answer];
    const correct = letter === correctLetter;
    const chosenIndex = LETTERS.findIndex((l) => l === letter);
    const chosenText = question.options[Math.max(0, chosenIndex)];
    const correctText = question.options[question.answer];
    const zoneBonus = (current.questionIndex + 1) % 5 === 0 ? 100 : 0;
    const missionBonus = current.questionIndex === QUESTIONS.length - 1 ? 200 : 0;
    const pointsEarned = correct ? 100 : 0;

    commit((draft) => {
      if (correct) draft.correct += 1;
      else {
        draft.wrong += 1;
        draft.lives = Math.max(0, draft.lives - 1);
      }
      draft.rawScore += pointsEarned + zoneBonus + missionBonus;
      draft.score = Math.min(MAX_SCORE, draft.rawScore);
      draft.results.push({
        questionId: question.id,
        chosen: letter,
        chosenText,
        correctLetter,
        correct,
        explanation: question.explanation,
      });
    });

    const endedEarly = sessionRef.current.lives <= 0 && current.questionIndex !== QUESTIONS.length - 1;
    const isFinal = endedEarly || current.questionIndex === QUESTIONS.length - 1;
    const nextFeedback: Feedback = {
      correct,
      chosen: letter,
      chosenText,
      correctLetter,
      correctText,
      explanation: question.explanation,
      pointsEarned,
      zoneBonus,
      missionBonus,
      isFinal,
      endedEarly,
      zoneTitle: zoneForQuestion(current.questionIndex).title,
      questionNumber: current.questionIndex + 1,
    };
    feedbackRef.current = nextFeedback;
    setFeedback(nextFeedback);
    gameRef.current?.setActive(false);
    setGamePhase("feedback");
  }, [commit, setGamePhase]);

  const handleMiss = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    setToast("TEMBAKAN MELENCENG — ARAHKAN MERIAM KE PAPAN TARGET");
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 1700);
  }, []);

  const handleEnemyFire = useCallback(() => {
    if (phaseRef.current !== "playing") return;
    setToast("⚠ MUSUH MENEMBAK BALIK — ARMOR TANK TERKENA!");
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 1250);
  }, []);

  answerHandlerRef.current = handleTargetHit;
  missHandlerRef.current = handleMiss;
  enemyFireHandlerRef.current = handleEnemyFire;

  useEffect(() => {
    if (!audioRef.current) audioRef.current = new GameAudio();
    if (!canvasHostRef.current) return;
    const game = new ThreeGame(canvasHostRef.current, {
      audio: audioRef.current,
      onTargetHit: (letter) => answerHandlerRef.current(letter),
      onMiss: () => missHandlerRef.current(),
      onEnemyFire: () => enemyFireHandlerRef.current(),
      onAimChange: setAimed,
      onTelemetry: (data) => {
        if (phaseRef.current === "playing" || phaseRef.current === "feedback") setTelemetry(data);
      },
      onCameraMode: (mode) => setTelemetry((old) => ({ ...old, camera: mode })),
    });
    gameRef.current = game;
    game.setActive(false);
    return () => {
      game.dispose();
      gameRef.current = null;
      audioRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    audioRef.current?.setEnabled(soundOn);
  }, [soundOn]);

  useEffect(() => clearTimers, [clearTimers]);

  const startMission = useCallback(() => {
    if (!validation.valid) return;
    if (!audioRef.current) audioRef.current = new GameAudio();
    clearTimers();
    audioRef.current.start();
    audioRef.current.setEnabled(soundOn);
    const fresh = createSession(playerName);
    sessionRef.current = fresh;
    setSession({ ...fresh });
    setFeedback(null);
    feedbackRef.current = null;
    setToast(null);
    setAimed(null);
    setZoneBanner(null);
    setGamePhase("intro");
    gameRef.current?.playIntro();
    introTimerRef.current = window.setTimeout(() => beginQuestion(0), 4600);
  }, [beginQuestion, clearTimers, playerName, setGamePhase, soundOn, validation.valid]);

  const skipIntro = () => beginQuestion(0);

  const continueMission = () => {
    const currentFeedback = feedbackRef.current;
    if (!currentFeedback) return;
    if (currentFeedback.isFinal) finishSession(currentFeedback.endedEarly);
    else beginQuestion(sessionRef.current.questionIndex + 1);
  };

  const backToMenu = () => {
    clearTimers();
    gameRef.current?.setActive(false);
    audioRef.current?.setEngine(0.12);
    setFeedback(null);
    feedbackRef.current = null;
    setToast(null);
    setZoneBanner(null);
    setGamePhase("menu");
  };

  const toggleSound = () => {
    if (!audioRef.current) audioRef.current = new GameAudio();
    audioRef.current.start();
    audioRef.current.setEnabled(!soundOn);
    setSoundOn(!soundOn);
  };

  const handleJoystick = useCallback((x: number, y: number) => {
    gameRef.current?.setJoystick(x, y);
  }, []);

  const currentQuestion = QUESTIONS[Math.min(session.questionIndex, QUESTIONS.length - 1)];
  const currentZone = zoneForQuestion(Math.min(session.questionIndex, QUESTIONS.length - 1));
  const solved = session.results.length;
  const progress = (solved / QUESTIONS.length) * 100;
  const percent = Math.round((session.correct / QUESTIONS.length) * 100);
  const rank = achievement(percent);
  const elapsedMs = (session.finishedAt ?? Date.now()) - session.startTime;

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-[#050806] text-white">
      <div
        ref={canvasHostRef}
        className="absolute inset-0 z-0 transition-opacity duration-700"
        style={{
          opacity: phase === "menu" ? 0 : 1,
          pointerEvents: phase === "playing" ? "auto" : "none",
          filter: phase === "result" || phase === "review" ? "blur(3px) brightness(0.65)" : "none",
        }}
      />
      {phase === "menu" && (
        <div className="menu-hero absolute inset-0 z-0" style={{ backgroundImage: `url(${heroUrl})` }} />
      )}
      <div className="vignette pointer-events-none absolute inset-0 z-10" />
      <div className="scanlines pointer-events-none absolute inset-0 z-10" />

      {phase === "menu" && (
        <section className="menu-screen pointer-events-auto absolute inset-0 z-20 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-[1500px] flex-col px-5 py-5 sm:px-9 lg:px-14 lg:py-8">
            <header className="flex flex-wrap items-center justify-between gap-4">
              <GameLogo />
              <div className="flex items-center gap-3">
                <span className="hud-chip hidden sm:inline-flex">BAB 3 • PERTEMUAN 1</span>
                <span className="hud-chip hidden md:inline-flex">KELAS 6 SD</span>
                <button className="sound-toggle" onClick={toggleSound} type="button">
                  <span>{soundOn ? "◖))" : "◖×"}</span> SOUND {soundOn ? "ON" : "OFF"}
                </button>
              </div>
            </header>

            <div className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:gap-14">
              <div className="max-w-3xl">
                <div className="mission-kicker">INTERACTIVE 3D LEARNING ASSESSMENT</div>
                <h1 className="hero-title">TANK BATTLE<span>MISSION INDONESIA</span></h1>
                <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#d4ddcf] sm:text-lg">
                  Kendalikan tank tempur dan bidik salah satu dari empat tank musuh yang membawa
                  papan jawaban besar. Tembak pilihan yang benar — jawaban salah membuat musuh
                  menembak balik. Pengetahuanmu tentang Bab 3 Pertemuan 1 adalah senjatamu.
                </p>

                <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end">
                  <label className="name-field">
                    <span>NAMA KOMANDAN</span>
                    <input
                      value={playerName}
                      onChange={(e) => setPlayerName(e.target.value)}
                      maxLength={24}
                      placeholder="Masukkan nama kamu"
                    />
                  </label>
                  <button className="start-button" onClick={startMission} disabled={!validation.valid} type="button">
                    <span className="start-button-icon">▶</span>
                    <span>START MISSION</span>
                  </button>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-3 text-xs font-bold tracking-[0.16em] text-[#aab8a5]">
                  <span>20 SOAL</span><i /> <span>4 ZONA</span><i /> <span>3 KESEMPATAN</span><i /> <span>MAKS 2.200 POIN</span>
                </div>
              </div>

              <aside className="menu-sidebar">
                <div className="hud-panel p-5">
                  <div className="panel-heading">KONTROL PERTEMPURAN</div>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <div>
                      <div className="panel-subheading">DESKTOP / LAPTOP</div>
                      <ul className="control-list">
                        <li><kbd>W</kbd><kbd>S</kbd><span>Maju / mundur</span></li>
                        <li><kbd>A</kbd><kbd>D</kbd><span>Belok kiri / kanan</span></li>
                        <li><kbd>MOUSE</kbd><span>Arahkan meriam</span></li>
                        <li><kbd>CLICK</kbd><span>Tembak target</span></li>
                        <li><kbd>SCROLL</kbd><span>Jarak kamera</span></li>
                      </ul>
                    </div>
                    <div>
                      <div className="panel-subheading">SMARTPHONE</div>
                      <ul className="control-list">
                        <li><kbd>JOYSTICK</kbd><span>Gerakkan tank</span></li>
                        <li><kbd>GESER</kbd><span>Arahkan meriam</span></li>
                        <li><kbd>FIRE</kbd><span>Tembakkan peluru</span></li>
                        <li><kbd>CAMERA</kbd><span>Ubah sudut pandang</span></li>
                        <li><kbd>MULTITOUCH</kbd><span>Gerak + bidik</span></li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="hud-panel mt-4 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="panel-heading">VALIDASI BANK SOAL</div>
                    <span className={`validation-badge ${validation.valid ? "valid" : "invalid"}`}>
                      {validation.valid ? "✓ TERVERIFIKASI" : "✕ GAGAL"}
                    </span>
                  </div>
                  <div className="mt-3 text-xs leading-relaxed text-[#c5d0bd]">
                    Sumber: dokumen Materi Pembelajaran Bab 3 Pertemuan 1. Kunci jawaban disimpan terpisah dan tidak ditampilkan sebelum pemain menembak.
                  </div>
                  <div className="validation-grid mt-4">
                    {validation.checks.map((check) => (
                      <div key={check.label} className="validation-item">
                        <span>{check.ok ? "✓" : "✕"}</span>{check.label}
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#80906f33] pt-4 text-[10px] font-bold tracking-[0.2em] text-[#8fa086]">
              <span>THREE.JS / WEBGL / REAL-TIME PROJECTILE COLLISION</span>
              <span>YOUR KNOWLEDGE IS YOUR WEAPON</span>
            </footer>
          </div>
        </section>
      )}

      {phase === "intro" && (
        <section className="intro-screen pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center">
          <div className="intro-boot" style={{ animationDelay: "0.1s" }}>INITIALIZING TROPICAL BATTLEFIELD • ENGINE START</div>
          <div className="intro-main" style={{ animationDelay: "1s" }}>MISSION INDONESIA</div>
          <div className="intro-tagline" style={{ animationDelay: "2.35s" }}>YOUR KNOWLEDGE IS YOUR WEAPON!</div>
          <div className="intro-progress"><span /></div>
          <button className="intro-skip pointer-events-auto" onClick={skipIntro} type="button">SKIP INTRO ▸</button>
          <div className="intro-corner">TANK BATTLE • CINEMATIC SEQUENCE</div>
        </section>
      )}

      {(phase === "playing" || phase === "feedback") && (
        <div className="pointer-events-none absolute inset-0 z-20">
          <header className="hud-topbar">
            <GameLogo compact />
            <div className="hud-zone"><span>ZONE {currentZone.id}</span><strong>{currentZone.short}</strong></div>
            <div className="hud-stat"><span>SOAL</span><strong>{String(session.questionIndex + 1).padStart(2, "0")}/20</strong></div>
            <div className="hud-stat score-stat"><span>SKOR</span><strong>⭐ {session.score}</strong></div>
            <div className="hud-lives">
              <span>ARMOR</span>
              <div>{[0, 1, 2].map((i) => <i key={i} className={i < session.lives ? "heart" : "heart lost"}>♥</i>)}</div>
            </div>
            <button className="hud-sound pointer-events-auto" onClick={toggleSound} type="button">{soundOn ? "SOUND ON" : "SOUND OFF"}</button>
          </header>

          <MiniMap questionIndex={session.questionIndex} />

          <div className="question-panel">
            <div className="question-panel-top">
              <span>MISI {String(session.questionIndex + 1).padStart(2, "0")} / 20</span>
              <span className="zone-name">ZONE {currentZone.id} — {currentZone.title}</span>
              <span>WAKTU {formatTime(Date.now() - session.startTime)}</span>
            </div>
            <div className="question-text">{currentQuestion.question}</div>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
            <div className="progress-meta">
              <span>{solved} SELESAI</span><span>4 TANK MUSUH</span><span>✓ {session.correct} BENAR</span><span>✕ {session.wrong} SALAH</span><span>MAX {MAX_SCORE}</span>
            </div>
          </div>

          <div className={`crosshair ${aimed ? "locked" : ""}`}>
            <span className="crosshair-ring" />
            <span className="crosshair-dot" />
            <span className="crosshair-line top" /><span className="crosshair-line bottom" />
            <span className="crosshair-line left" /><span className="crosshair-line right" />
            {aimed && <div className="lock-label">ENEMY TANK LOCK · {aimed}</div>}
          </div>

          {toast && <div className={`game-toast ${toast.startsWith("⚠") ? "enemy" : ""}`}>{toast}</div>}
          {toast?.startsWith("⚠") && <div className="enemy-flash" />}

          {zoneBanner && (
            <div className="zone-banner" key={zoneBanner.zone}>
              <span>ENTERING ZONE {zoneBanner.zone}</span>
              <strong>{zoneBanner.title}</strong>
              <small>{zoneBanner.description}</small>
            </div>
          )}

          <div className="hud-bottom-left">
            <VirtualJoystick key={session.questionIndex} onMove={handleJoystick} />
          </div>

          <div className="hud-bottom-right">
            <div className="right-controls-row">
              <div className="aim-hint"><span>⌖</span><small>DRAG TO AIM</small></div>
              <button className="camera-button pointer-events-auto" onClick={() => gameRef.current?.cycleCamera()} type="button">
                <span>◎</span><small>CAMERA</small>
              </button>
            </div>
            <button className="fire-button pointer-events-auto" onPointerDown={() => gameRef.current?.fire()} type="button">
              <span className="fire-bullet">✦</span>
              <strong>FIRE</strong>
            </button>
          </div>

          <div className="telemetry-panel">
            <div><span>TURRET</span><strong>{telemetry.turret > 0 ? "+" : ""}{telemetry.turret}°</strong></div>
            <div><span>ELEV</span><strong>{telemetry.elevation}°</strong></div>
            <div><span>SPEED</span><strong>{telemetry.speed} km/h</strong></div>
            <div><span>TANK</span><strong>{Math.round((session.lives / 3) * 100)}%</strong></div>
            <div><span>VIEW</span><strong>{telemetry.camera}</strong></div>
          </div>
        </div>
      )}

      {phase === "feedback" && feedback && (
        <section className="feedback-screen pointer-events-auto absolute inset-0 z-40 flex items-center justify-center p-4">
          <div className={`feedback-card ${feedback.correct ? "correct" : "wrong"}`}>
            <div className="feedback-stripe">{feedback.correct ? "GREAT SHOT!" : "TARGET MISSED!"}</div>
            {!feedback.correct && <div className="feedback-alert">⚠ MUSUH MENEMBAK BALIK • ARMOR −1</div>}
            <div className="feedback-result">{feedback.correct ? "CORRECT!" : "WRONG ANSWER!"}</div>
            <div className="feedback-question">
              SOAL {String(feedback.questionNumber).padStart(2, "0")} • {feedback.zoneTitle}
            </div>
            <div className="feedback-answers">
              <div><span>JAWABAN ANDA</span><strong className={feedback.correct ? "ok" : "bad"}>{feedback.chosen} — {feedback.chosenText}</strong></div>
              <div><span>KUNCI JAWABAN</span><strong className="ok">{feedback.correctLetter} — {feedback.correctText}</strong></div>
            </div>
            <div className="feedback-explanation">
              <b>INTEL BRIEF / PEMBAHASAN</b>
              <p>{feedback.explanation}</p>
            </div>
            <div className="feedback-points">
              <div><span>JAWABAN</span><strong>+{feedback.pointsEarned}</strong></div>
              {feedback.zoneBonus > 0 && <div><span>ZONE CLEAR</span><strong>+{feedback.zoneBonus}</strong></div>}
              {feedback.missionBonus > 0 && <div><span>MISSION COMPLETE</span><strong>+{feedback.missionBonus}</strong></div>}
              <div><span>TOTAL SKOR</span><strong>{session.score}</strong></div>
              {!feedback.correct && <div><span>ARMOR</span><strong className="bad">−1 ♥</strong></div>}
            </div>
            <button className="continue-button" onClick={continueMission} type="button">
              {feedback.isFinal ? "LIHAT HASIL AKHIR ▸" : "LANJUTKAN MISI ▸"}
            </button>
            <div className="feedback-note">{feedback.isFinal && feedback.endedEarly ? "KESEMPATAN HABIS — MISI DIHENTIKAN" : "BACA PEMBAHASAN SEBELUM MELANJUTKAN"}</div>
          </div>
        </section>
      )}

      {phase === "result" && (
        <section className="result-screen pointer-events-auto absolute inset-0 z-40 overflow-y-auto p-4 sm:p-8">
          <div className="result-bg absolute inset-0" style={{ backgroundImage: `url(${heroUrl})` }} />
          <div className="relative mx-auto flex min-h-full max-w-5xl flex-col items-center justify-center py-6">
            <div className="result-eyebrow">{session.endedEarly ? "MISSION TERMINATED • KESEMPATAN HABIS" : "MISSION COMPLETE • ALL TARGETS ENGAGED"}</div>
            <div className="result-panel">
              <div className="result-header">
                <GameLogo compact />
                <div className="text-right">
                  <div className="text-[10px] font-bold tracking-[0.24em] text-[#a0ad98]">LAPORAN AKHIR KOMANDAN</div>
                  <div className="text-xl font-black tracking-wide text-white sm:text-2xl">{session.playerName.toUpperCase()}</div>
                </div>
              </div>
              <div className="result-score-grid">
                <div className="result-score-main">
                  <span>TOTAL SKOR</span>
                  <strong>{session.score}</strong>
                  <small>/ {MAX_SCORE} POIN</small>
                </div>
                <div className="result-rank" style={{ borderColor: rank.color }}>
                  <span>PREDIKAT PENCAPAIAN</span>
                  <strong style={{ color: rank.color }}>{rank.title}</strong>
                  <small>{rank.note}</small>
                </div>
              </div>
              <div className="result-metrics">
                <div><span>PERSENTASE</span><strong>{percent}%</strong></div>
                <div><span>JAWABAN BENAR</span><strong className="ok">{session.correct}</strong></div>
                <div><span>JAWABAN SALAH</span><strong className="bad">{session.wrong}</strong></div>
                <div><span>SOAL SELESAI</span><strong>{solved}/20</strong></div>
                <div><span>WAKTU</span><strong>{formatTime(elapsedMs)}</strong></div>
                <div><span>SISA ARMOR</span><strong>{session.lives}/3</strong></div>
              </div>
              <div className="result-buttons">
                <button className="primary-action" onClick={startMission} type="button">↻ PLAY AGAIN</button>
                <button className="secondary-action" onClick={() => setGamePhase("review")} type="button">▤ REVIEW ANSWERS</button>
                <button className="secondary-action" onClick={backToMenu} type="button">⌂ BACK TO MENU</button>
              </div>
            </div>
            <div className="mt-4 text-[10px] font-bold tracking-[0.25em] text-[#9daa94]">TANK BATTLE: MISSION INDONESIA • BAB 3 PERTEMUAN 1</div>
          </div>
        </section>
      )}

      {phase === "review" && (
        <section className="review-screen pointer-events-auto absolute inset-0 z-40 overflow-y-auto p-4 sm:p-8">
          <div className="mx-auto max-w-5xl">
            <div className="review-header">
              <div>
                <div className="result-eyebrow">REVIEW ANSWERS • {session.playerName.toUpperCase()}</div>
                <h2 className="review-title">PEMBAHASAN 20 SOAL</h2>
              </div>
              <div className="review-actions">
                <button className="secondary-action" onClick={() => setGamePhase("result")} type="button">◂ HASIL</button>
                <button className="secondary-action" onClick={backToMenu} type="button">⌂ MENU</button>
              </div>
            </div>
            <div className="review-summary">
              <span>✓ {session.correct} BENAR</span><span>✕ {session.wrong} SALAH</span><span>⭐ {session.score} POIN</span><span>◷ {formatTime(elapsedMs)}</span>
            </div>
            <div className="review-list">
              {QUESTIONS.map((question, index) => {
                const record = session.results[index];
                const correctLetter = LETTERS[question.answer];
                return (
                  <article className={`review-item ${record ? (record.correct ? "is-correct" : "is-wrong") : "unanswered"}`} key={question.id}>
                    <div className="review-item-head">
                      <span className="review-number">{String(question.id).padStart(2, "0")}</span>
                      <div>
                        <div className="review-zone">ZONE {Math.floor(index / 5) + 1} — {ZONES[Math.floor(index / 5)].title}</div>
                        <h3>{question.question}</h3>
                      </div>
                      <span className={`review-status ${record?.correct ? "ok" : record ? "bad" : ""}`}>
                        {record ? (record.correct ? "BENAR" : "SALAH") : "TIDAK DIJAWAB"}
                      </span>
                    </div>
                    <div className="review-options">
                      {question.options.map((option, optionIndex) => {
                        const letter = LETTERS[optionIndex];
                        const isKey = letter === correctLetter;
                        const isChosen = record?.chosen === letter;
                        return (
                          <div className={`review-option ${isKey ? "key" : ""} ${isChosen ? (record?.correct ? "chosen-ok" : "chosen-bad") : ""}`} key={letter}>
                            <b>{letter}</b><span>{option}</span>
                            {isKey && <em>KUNCI</em>}
                            {isChosen && <em>PILIHANMU</em>}
                          </div>
                        );
                      })}
                    </div>
                    <div className="review-answer-row">
                      <span>JAWABAN PEMAIN: <b>{record ? `${record.chosen} — ${record.chosenText}` : "Tidak dijawab"}</b></span>
                      <span>KUNCI: <b className="ok">{correctLetter} — {question.options[question.answer]}</b></span>
                    </div>
                    <p className="review-explanation"><b>PEMBAHASAN:</b> {question.explanation}</p>
                  </article>
                );
              })}
            </div>
            <div className="mt-5 flex justify-center">
              <button className="primary-action" onClick={startMission} type="button">↻ PLAY AGAIN</button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
