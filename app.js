const video = document.getElementById("video");
const outputCanvas = document.getElementById("outputCanvas");
const outputCtx = outputCanvas.getContext("2d");

const effectCanvas = document.getElementById("effectCanvas");
const effectCtx = effectCanvas.getContext("2d");

const statusEl = document.getElementById("status");
const techniqueText = document.getElementById("techniqueText");
const flashEl = document.getElementById("flash");

const sounds = {
  red: new Audio("assets/red.mp3"),
  blue: new Audio("assets/blue.mp3"),
  purple: new Audio("assets/purple.mp3"),
  boom: new Audio("assets/boom.mp3"),
  domain: new Audio("assets/domain.mp3")
};

let particles = [];
let currentTechnique = "none";
let lastTriggerTime = 0;
let lastDetectedGesture = "none";
const cooldownMs = 1400;

let activeGesture = "none";
let gestureHoldStart = 0;
let lastGesturePoint = null;

// domain state
let domainActiveUntil = 0;

// -----------------------------
// Camera setup
// -----------------------------
async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      width: 1280,
      height: 720,
      facingMode: "user"
    },
    audio: false
  });

  video.srcObject = stream;

  return new Promise((resolve) => {
    video.onloadedmetadata = () => {
      video.play();
      resolve();
    };
  });
}

// -----------------------------
// Canvas helpers
// -----------------------------
function resizeCanvases() {
  const width = video.videoWidth || window.innerWidth;
  const height = video.videoHeight || window.innerHeight;

  outputCanvas.width = width;
  outputCanvas.height = height;

  effectCanvas.width = width;
  effectCanvas.height = height;
}

function normalizedToCanvas(point) {
  return {
    x: (1 - point.x) * effectCanvas.width,
    y: point.y * effectCanvas.height
  };
}

// -----------------------------
// General helpers
// -----------------------------
function canTrigger() {
  return Date.now() - lastTriggerTime > cooldownMs;
}

function playSound(name) {
  const sound = sounds[name];
  if (!sound) return;

  try {
    sound.currentTime = 0;
    sound.play().catch(() => {});
  } catch (_) {}
}

function showTechniqueText(text, modeClass, duration = 700) {
  techniqueText.textContent = text;
  techniqueText.className = "";
  techniqueText.classList.add("show", modeClass);

  setTimeout(() => {
    techniqueText.classList.remove("show");
  }, duration);
}

function flashScreen(className, duration = 700) {
  flashEl.className = "";
  void flashEl.offsetWidth;
  flashEl.classList.add(className);

  setTimeout(() => {
    flashEl.className = "";
  }, duration);
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function hexToRgba(hex, alpha) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// -----------------------------
// Gesture helpers
// -----------------------------
function isFingerUp(tipIndex, pipIndex, landmarks) {
  return landmarks[tipIndex].y < landmarks[pipIndex].y;
}

function isFingerCurled(tipIndex, pipIndex, landmarks) {
  return landmarks[tipIndex].y > landmarks[pipIndex].y;
}

function detectGesture(landmarks) {
  const indexUp = isFingerUp(8, 6, landmarks);
  const middleUp = isFingerUp(12, 10, landmarks);
  const ringUp = isFingerUp(16, 14, landmarks);
  const pinkyUp = isFingerUp(20, 18, landmarks);

  const middleCurled = isFingerCurled(12, 10, landmarks);
  const ringCurled = isFingerCurled(16, 14, landmarks);
  const pinkyCurled = isFingerCurled(20, 18, landmarks);

  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const crossedDistance = distance(indexTip, middleTip);

  // DOMAIN = crossed fingers look
  // index + middle up, very close together, ring/pinky down
  const domainSign =
    indexUp &&
    middleUp &&
    !ringUp &&
    !pinkyUp &&
    crossedDistance < 0.05;

  // HOLLOW PURPLE = bull horns
  const purpleSign =
    indexUp &&
    pinkyUp &&
    middleCurled &&
    ringCurled;

  // BLUE = index + middle up, clearly separated
  const blueSign =
    indexUp &&
    middleUp &&
    !ringUp &&
    !pinkyUp &&
    crossedDistance >= 0.05;

  // RED = index only
  const redSign =
    indexUp &&
    !middleUp &&
    !ringUp &&
    !pinkyUp;

  if (domainSign) return "domain";
  if (purpleSign) return "purple";
  if (blueSign) return "blue";
  if (redSign) return "red";

  return "none";
}

// -----------------------------
// Particle system
// -----------------------------
function createParticles(x, y, color, count, speedMultiplier = 1) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (Math.random() * 4 + 2) * speedMultiplier;

    particles.push({
      type: "particle",
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: Math.random() * 6 + 2,
      life: 35 + Math.random() * 20,
      maxLife: 55,
      color
    });
  }
}

function createExplosionParticles(x, y, color, count, power = 1) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (Math.random() * 7 + 4) * power;

    particles.push({
      type: "particle",
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: Math.random() * 7 + 3,
      life: 40 + Math.random() * 25,
      maxLife: 65,
      color
    });
  }
}

function createShockwave(x, y, color, startRadius, endRadius, life = 20) {
  particles.push({
    type: "shockwave",
    x,
    y,
    color,
    radius: startRadius,
    startRadius,
    endRadius,
    life,
    maxLife: life
  });
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];

    if (p.type === "particle") {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.life -= 1;

      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    } else if (p.type === "shockwave") {
      const progress = 1 - p.life / p.maxLife;
      p.radius = p.startRadius + (p.endRadius - p.startRadius) * progress;
      p.life -= 1;

      if (p.life <= 0) {
        particles.splice(i, 1);
      }
    }
  }
}

function drawParticles() {
  for (const p of particles) {
    if (p.type === "particle") {
      const alpha = Math.max(p.life / p.maxLife, 0);

      effectCtx.beginPath();
      effectCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      effectCtx.fillStyle = hexToRgba(p.color, alpha);
      effectCtx.shadowBlur = 20;
      effectCtx.shadowColor = p.color;
      effectCtx.fill();
    }

    if (p.type === "shockwave") {
      const alpha = Math.max(p.life / p.maxLife, 0);

      effectCtx.beginPath();
      effectCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      effectCtx.lineWidth = 8;
      effectCtx.strokeStyle = hexToRgba(p.color, alpha * 0.9);
      effectCtx.shadowBlur = 25;
      effectCtx.shadowColor = p.color;
      effectCtx.stroke();
    }
  }

  effectCtx.shadowBlur = 0;
}

// -----------------------------
// Energy / aura
// -----------------------------
function drawEnergyOrb(x, y, color, outerRadius = 50, innerRadius = 16, charge = 1) {
  const scaledOuter = outerRadius * charge;
  const scaledInner = innerRadius * (0.9 + charge * 0.15);

  const gradient = effectCtx.createRadialGradient(
    x, y, 0,
    x, y, scaledOuter
  );

  gradient.addColorStop(0, "rgba(255,255,255,0.98)");
  gradient.addColorStop(0.12, hexToRgba(color, 0.98));
  gradient.addColorStop(0.42, hexToRgba(color, 0.48));
  gradient.addColorStop(1, hexToRgba(color, 0));

  effectCtx.beginPath();
  effectCtx.arc(x, y, scaledOuter, 0, Math.PI * 2);
  effectCtx.fillStyle = gradient;
  effectCtx.fill();

  effectCtx.beginPath();
  effectCtx.arc(x, y, scaledInner, 0, Math.PI * 2);
  effectCtx.fillStyle = "rgba(255,255,255,0.96)";
  effectCtx.shadowBlur = 30;
  effectCtx.shadowColor = color;
  effectCtx.fill();
  effectCtx.shadowBlur = 0;
}

function drawAura(landmarks, technique, charge = 1) {
  if (technique === "none") return;

  let center;
  let color = "#ffffff";
  let radius = 60;

  if (technique === "red") {
    center = normalizedToCanvas(landmarks[8]);
    color = "#ff2d2d";
    radius = 55 * charge;
  } else if (technique === "blue") {
    center = normalizedToCanvas(landmarks[8]);
    color = "#33aaff";
    radius = 60 * charge;
  } else if (technique === "purple") {
    center = normalizedToCanvas(landmarks[9]);
    color = "#c066ff";
    radius = 95 * charge;
  } else if (technique === "domain") {
    center = normalizedToCanvas(landmarks[9]);
    color = "#ffffff";
    radius = 110 * charge;
  }

  const gradient = effectCtx.createRadialGradient(
    center.x,
    center.y,
    8,
    center.x,
    center.y,
    radius
  );

  gradient.addColorStop(0, hexToRgba(color, 0.82));
  gradient.addColorStop(0.3, hexToRgba(color, 0.34));
  gradient.addColorStop(1, hexToRgba(color, 0));

  effectCtx.beginPath();
  effectCtx.arc(center.x, center.y, radius, 0, Math.PI * 2);
  effectCtx.fillStyle = gradient;
  effectCtx.fill();
}

function drawPurpleBeam() {
  const beamWidth = 180;
  const x = effectCanvas.width / 2 - beamWidth / 2;

  const gradient = effectCtx.createLinearGradient(x, 0, x + beamWidth, 0);
  gradient.addColorStop(0, "rgba(120,0,255,0)");
  gradient.addColorStop(0.18, "rgba(170,70,255,0.65)");
  gradient.addColorStop(0.5, "rgba(255,255,255,1)");
  gradient.addColorStop(0.82, "rgba(170,70,255,0.65)");
  gradient.addColorStop(1, "rgba(120,0,255,0)");

  effectCtx.save();
  effectCtx.shadowBlur = 40;
  effectCtx.shadowColor = "#c066ff";
  effectCtx.fillStyle = gradient;
  effectCtx.fillRect(x, 0, beamWidth, effectCanvas.height);
  effectCtx.restore();
}

// -----------------------------
// Domain effect
// -----------------------------
function drawDomainBackground() {
  const now = Date.now();
  if (now > domainActiveUntil) return;

  const remaining = domainActiveUntil - now;
  const alpha = clamp(remaining / 4500, 0, 1);

  // darken the whole screen heavily
  effectCtx.save();
  effectCtx.fillStyle = `rgba(0, 0, 0, ${0.88 * alpha})`;
  effectCtx.fillRect(0, 0, effectCanvas.width, effectCanvas.height);

  const cx = effectCanvas.width / 2;
  const cy = effectCanvas.height / 2;
  const maxR = Math.max(effectCanvas.width, effectCanvas.height) * 0.65;

  const gradient = effectCtx.createRadialGradient(cx, cy, 30, cx, cy, maxR);
  gradient.addColorStop(0, `rgba(0,0,0,${0.08 * alpha})`);
  gradient.addColorStop(0.08, `rgba(0,0,0,${0.10 * alpha})`);
  gradient.addColorStop(0.22, `rgba(0,0,0,${0.55 * alpha})`);
  gradient.addColorStop(0.55, `rgba(0,0,0,${0.90 * alpha})`);
  gradient.addColorStop(1, `rgba(0,0,0,${0.98 * alpha})`);

  effectCtx.fillStyle = gradient;
  effectCtx.fillRect(0, 0, effectCanvas.width, effectCanvas.height);

  // white stars
  for (let i = 0; i < 140; i++) {
    const angle = (i * 137.5) * (Math.PI / 180);
    const radius = (i / 140) * maxR * (0.7 + 0.2 * Math.sin(now / 1200));
    const x = cx + Math.cos(angle + now / 6000) * radius;
    const y = cy + Math.sin(angle + now / 6000) * radius;

    const dotSize = i % 8 === 0 ? 2.8 : 1.2;
    const dotAlpha = ((i % 9) / 9) * 0.45 + 0.20;

    effectCtx.beginPath();
    effectCtx.arc(x, y, dotSize, 0, Math.PI * 2);
    effectCtx.fillStyle = `rgba(255,255,255,${dotAlpha * alpha})`;
    effectCtx.shadowBlur = 18;
    effectCtx.shadowColor = "#ffffff";
    effectCtx.fill();
  }

  // central black hole look
  const hole = effectCtx.createRadialGradient(cx, cy, 10, cx, cy, 180);
  hole.addColorStop(0, `rgba(0,0,0,${1 * alpha})`);
  hole.addColorStop(0.4, `rgba(0,0,0,${0.95 * alpha})`);
  hole.addColorStop(0.75, `rgba(255,255,255,${0.04 * alpha})`);
  hole.addColorStop(1, `rgba(255,255,255,0)`);

  effectCtx.beginPath();
  effectCtx.arc(cx, cy, 180, 0, Math.PI * 2);
  effectCtx.fillStyle = hole;
  effectCtx.fill();

  // domain text slowly appears
  const progress = 1 - clamp(remaining / 4500, 0, 1);
  const titleAlpha = clamp(progress * 1.4, 0, 1);

  effectCtx.textAlign = "center";
  effectCtx.fillStyle = `rgba(255,255,255,${titleAlpha})`;
  effectCtx.shadowBlur = 25;
  effectCtx.shadowColor = "#ffffff";

  effectCtx.font = "900 56px Arial";
  effectCtx.fillText("DOMAIN EXPANSION", cx, cy - 30);

  effectCtx.font = "900 42px Arial";
  effectCtx.fillText("INFINITE VOID", cx, cy + 28);

  effectCtx.restore();
  effectCtx.shadowBlur = 0;
}

function triggerDomainExpansion(landmarks) {
  const center = normalizedToCanvas(landmarks[9]);

  lastTriggerTime = Date.now();
  currentTechnique = "domain";
  activeGesture = "domain";
  gestureHoldStart = Date.now();
  lastGesturePoint = center;

  domainActiveUntil = Date.now() + 4500;

  createExplosionParticles(center.x, center.y, "#ffffff", 120, 1.5);
  createShockwave(center.x, center.y, "#cfe1ff", 50, 260, 24);
  flashScreen("flash-domain", 950);
  playSound("domain");
}

// -----------------------------
// Hold / release helpers
// -----------------------------
function getGesturePoint(landmarks, gesture) {
  if (gesture === "red" || gesture === "blue") {
    return normalizedToCanvas(landmarks[8]);
  }

  if (gesture === "purple" || gesture === "domain") {
    return normalizedToCanvas(landmarks[9]);
  }

  return null;
}

function getHoldCharge() {
  if (activeGesture === "none" || gestureHoldStart === 0) return 1;

  const heldMs = Date.now() - gestureHoldStart;
  return 1 + clamp(heldMs / 1200, 0, 1.2);
}

function explodeGesture(gesture, point, heldMs = 0) {
  if (!point) return;

  const holdScale = 1 + clamp(heldMs / 1500, 0, 1.4);

  if (gesture === "red") {
    createExplosionParticles(point.x, point.y, "#ff2d2d", Math.floor(55 * holdScale), 1.3 * holdScale);
    createShockwave(point.x, point.y, "#ff5a5a", 20, 90 * holdScale, 18);
    flashScreen("flash-red");
    showTechniqueText("RED", "redMode");
    playSound("boom");
  }

  if (gesture === "blue") {
    createExplosionParticles(point.x, point.y, "#33aaff", Math.floor(60 * holdScale), 1.35 * holdScale);
    createShockwave(point.x, point.y, "#66c8ff", 22, 100 * holdScale, 18);
    flashScreen("flash-blue");
    showTechniqueText("BLUE", "blueMode");
    playSound("boom");
  }

  if (gesture === "purple") {
    createExplosionParticles(point.x, point.y, "#c066ff", Math.floor(90 * holdScale), 1.7 * holdScale);
    createShockwave(point.x, point.y, "#d18cff", 30, 140 * holdScale, 22);
    flashScreen("flash-purple");
    showTechniqueText("HOLLOW PURPLE", "purpleMode");
    playSound("boom");
  }
}

function handleGestureRelease() {
  if (activeGesture === "none" || !lastGesturePoint) return;

  const heldMs = Date.now() - gestureHoldStart;

  if (activeGesture !== "domain") {
    explodeGesture(activeGesture, lastGesturePoint, heldMs);
  }

  activeGesture = "none";
  gestureHoldStart = 0;
  lastGesturePoint = null;

  if (Date.now() > domainActiveUntil) {
    currentTechnique = "none";
  }
}

// -----------------------------
// Triggers
// -----------------------------
function triggerRed(landmarks) {
  const finger = normalizedToCanvas(landmarks[8]);
  lastTriggerTime = Date.now();
  currentTechnique = "red";
  activeGesture = "red";
  gestureHoldStart = Date.now();
  lastGesturePoint = finger;

  createParticles(finger.x, finger.y, "#ff2d2d", 24, 0.9);
  showTechniqueText("RED", "redMode");
  flashScreen("flash-red");
  playSound("red");
}

function triggerBlue(landmarks) {
  const finger = normalizedToCanvas(landmarks[8]);
  lastTriggerTime = Date.now();
  currentTechnique = "blue";
  activeGesture = "blue";
  gestureHoldStart = Date.now();
  lastGesturePoint = finger;

  createParticles(finger.x, finger.y, "#33aaff", 28, 0.95);
  showTechniqueText("BLUE", "blueMode");
  flashScreen("flash-blue");
  playSound("blue");
}

function triggerPurple(landmarks) {
  const palm = normalizedToCanvas(landmarks[9]);
  lastTriggerTime = Date.now();
  currentTechnique = "purple";
  activeGesture = "purple";
  gestureHoldStart = Date.now();
  lastGesturePoint = palm;

  createParticles(palm.x, palm.y, "#c066ff", 40, 1.2);
  showTechniqueText("HOLLOW PURPLE", "purpleMode");
  flashScreen("flash-purple");
  playSound("purple");
}

// -----------------------------
// Main render
// -----------------------------
function onResults(results) {
  resizeCanvases();

  outputCtx.save();
  outputCtx.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
  outputCtx.translate(outputCanvas.width, 0);
  outputCtx.scale(-1, 1);
  outputCtx.drawImage(results.image, 0, 0, outputCanvas.width, outputCanvas.height);
  outputCtx.restore();

  effectCtx.clearRect(0, 0, effectCanvas.width, effectCanvas.height);

  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    const landmarks = results.multiHandLandmarks[0];
    const gesture = detectGesture(landmarks);

    drawConnectors(outputCtx, landmarks, HAND_CONNECTIONS, {
      color: "#00ff99",
      lineWidth: 3
    });

    drawLandmarks(outputCtx, landmarks, {
      color: "#ff0055",
      lineWidth: 1,
      radius: 4
    });

    statusEl.textContent = `Detected: ${gesture.toUpperCase()}`;

    const isNewGesture = gesture !== "none" && gesture !== lastDetectedGesture;

    if (activeGesture !== "none" && gesture !== activeGesture && gesture === "none") {
      handleGestureRelease();
    }

    if (isNewGesture && canTrigger()) {
      if (gesture === "red") {
        triggerRed(landmarks);
      } else if (gesture === "blue") {
        triggerBlue(landmarks);
      } else if (gesture === "purple") {
        triggerPurple(landmarks);
      } else if (gesture === "domain") {
        triggerDomainExpansion(landmarks);
      }
    }

    if (gesture !== "none" && activeGesture === gesture) {
      lastGesturePoint = getGesturePoint(landmarks, gesture);
      const charge = getHoldCharge();

      drawAura(landmarks, gesture, charge);

      if (gesture === "red") {
        const finger = normalizedToCanvas(landmarks[8]);
        drawEnergyOrb(finger.x, finger.y, "#ff2d2d", 42, 12, charge);
        if (Math.random() < 0.20) {
          createParticles(finger.x, finger.y, "#ff2d2d", 1, 0.7);
        }
      }

      if (gesture === "blue") {
        const finger = normalizedToCanvas(landmarks[8]);
        drawEnergyOrb(finger.x, finger.y, "#33aaff", 46, 13, charge);
        if (Math.random() < 0.22) {
          createParticles(finger.x, finger.y, "#33aaff", 1, 0.75);
        }
      }

      if (gesture === "purple") {
        const palm = normalizedToCanvas(landmarks[9]);
        drawEnergyOrb(palm.x, palm.y, "#c066ff", 62, 16, charge);
        if (Date.now() - lastTriggerTime < 500) {
          drawPurpleBeam();
        }
        if (Math.random() < 0.28) {
          createParticles(palm.x, palm.y, "#c066ff", 2, 0.85);
        }
      }

      if (gesture === "domain") {
        const palm = normalizedToCanvas(landmarks[9]);
        drawEnergyOrb(palm.x, palm.y, "#ffffff", 68, 16, charge);
        if (Math.random() < 0.30) {
          createParticles(palm.x, palm.y, "#ffffff", 2, 0.8);
        }
      }
    } else if (gesture !== "none") {
      drawAura(landmarks, gesture, 1);

      if (gesture === "red") {
        const finger = normalizedToCanvas(landmarks[8]);
        drawEnergyOrb(finger.x, finger.y, "#ff2d2d", 42, 12, 1);
      }

      if (gesture === "blue") {
        const finger = normalizedToCanvas(landmarks[8]);
        drawEnergyOrb(finger.x, finger.y, "#33aaff", 46, 13, 1);
      }

      if (gesture === "purple") {
        const palm = normalizedToCanvas(landmarks[9]);
        drawEnergyOrb(palm.x, palm.y, "#c066ff", 62, 16, 1);
      }

      if (gesture === "domain") {
        const palm = normalizedToCanvas(landmarks[9]);
        drawEnergyOrb(palm.x, palm.y, "#ffffff", 68, 16, 1);
      }
    }

    lastDetectedGesture = gesture;
  } else {
    statusEl.textContent = "Waiting for hand...";

    if (activeGesture !== "none") {
      handleGestureRelease();
    }

    lastDetectedGesture = "none";
  }

  drawDomainBackground();
  updateParticles();
  drawParticles();
}

// -----------------------------
// Start app
// -----------------------------
async function startApp() {
  await setupCamera();
  resizeCanvases();

  const hands = new Hands({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7
  });

  hands.onResults(onResults);

  const camera = new Camera(video, {
    onFrame: async () => {
      await hands.send({ image: video });
    },
    width: 1280,
    height: 720
  });

  camera.start();
}

window.addEventListener("resize", resizeCanvases);

startApp().catch((error) => {
  console.error("Failed to start app:", error);
  statusEl.textContent = "Could not access webcam. Check camera permission.";
});