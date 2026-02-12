// ==================== STATE ====================
var words = [];
var currentWord = "";
var currentIndex = 0;
var score = 0;
var timer = null;
var timeLeft = 60;
var maxTime = 60;
var currentDifficulty = "easy";
var gameActive = false;
var usedWords = [];
var reviewWords = [];
var streak = 0;
var bestStreak = 0;
var totalBonusTime = 0;
var wordsCompleted = 0;
var audioPlayCount = 0;
var hiddenKeys = [];
var keyFadeTimer = null;
var playerName = "";
var leaderboardData = {};

// Round system
var currentRound = 1;
var totalRounds = 3;
var wordsPerRound = 6;
var wordInRound = 0;

// Per-word scoring
var wrongLetters = 0;
var wordStartTime = 0;
var wordScores = [];

var RADIUS = 50;
var CIRCUMFERENCE = 2 * Math.PI * RADIUS;
var ALL_KEYS = "qwertyuiopasdfghjklzxcvbnm";

// Difficulty settings: time, bonus, penalty, hint
var DIFF_CONFIG = {
  easy:   { wordTime: 15, letterBonus: 3, penalty: 0, hint: true,  fadeSpeed: 1.0 },
  medium: { wordTime: 10, letterBonus: 2, penalty: 1, hint: false, fadeSpeed: 0.7 },
  hard:   { wordTime: 10, letterBonus: 1, penalty: 1, hint: false, fadeSpeed: 0.5 }
};
var skippedWords = 0;

// ==================== SOUND EFFECTS (Web Audio API) ====================
var audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone(freq, duration, type, vol) {
  try {
    var ctx = getAudioCtx();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.value = freq;
    gain.gain.value = vol || 0.15;
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch(e) {}
}

function sfxCorrect() { playTone(880, 0.1, "sine", 0.12); }
function sfxWrong() {
  playTone(200, 0.2, "square", 0.08);
  setTimeout(function() { playTone(160, 0.2, "square", 0.06); }, 100);
}
function sfxComplete() {
  [523, 659, 784, 1047].forEach(function(n, i) {
    setTimeout(function() { playTone(n, 0.15, "sine", 0.12); }, i * 80);
  });
}
function sfxStreak() {
  playTone(1200, 0.08, "sine", 0.1);
  setTimeout(function() { playTone(1600, 0.12, "sine", 0.12); }, 60);
}
function sfxGameOver() {
  [523, 440, 349, 262].forEach(function(n, i) {
    setTimeout(function() { playTone(n, 0.3, "triangle", 0.1); }, i * 200);
  });
}
function sfxCelebration() {
  var notes = [523, 659, 784, 880, 1047, 1175, 1319, 1568];
  notes.forEach(function(n, i) {
    setTimeout(function() { playTone(n, 0.2, "sine", 0.1); }, i * 60);
  });
  setTimeout(function() {
    playTone(1568, 0.4, "sine", 0.12);
    playTone(1047, 0.4, "sine", 0.08);
  }, notes.length * 60);
}
function sfxPenalty() {
  playTone(150, 0.15, "sawtooth", 0.06);
}

// ==================== CONFETTI ====================
var confettiCanvas, confettiCtx, confettiPieces = [], confettiAnimating = false;

function initConfetti() {
  confettiCanvas = document.getElementById("confetti-canvas");
  confettiCtx = confettiCanvas.getContext("2d");
  resizeConfetti();
  window.addEventListener("resize", resizeConfetti);
}

function resizeConfetti() {
  if (!confettiCanvas) return;
  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
}

function launchConfetti(count) {
  confettiPieces = [];
  var colors = ["#667eea", "#764ba2", "#4ade80", "#facc15", "#ef4444", "#38bdf8", "#fb923c"];
  for (var i = 0; i < (count || 80); i++) {
    confettiPieces.push({
      x: Math.random() * confettiCanvas.width,
      y: -20 - Math.random() * 200,
      w: 6 + Math.random() * 6,
      h: 4 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 10,
      life: 1
    });
  }
  if (!confettiAnimating) { confettiAnimating = true; animateConfetti(); }
}

function animateConfetti() {
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  var alive = false;
  for (var i = 0; i < confettiPieces.length; i++) {
    var p = confettiPieces[i];
    if (p.life <= 0) continue;
    alive = true;
    p.x += p.vx; p.y += p.vy; p.vy += 0.1; p.rot += p.rotSpeed; p.life -= 0.005;
    confettiCtx.save();
    confettiCtx.translate(p.x, p.y);
    confettiCtx.rotate(p.rot * Math.PI / 180);
    confettiCtx.globalAlpha = Math.max(0, p.life);
    confettiCtx.fillStyle = p.color;
    confettiCtx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    confettiCtx.restore();
  }
  if (alive) { requestAnimationFrame(animateConfetti); }
  else { confettiAnimating = false; confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height); }
}

// ==================== LOCAL STORAGE ====================
function getStats() {
  try { return JSON.parse(localStorage.getItem("spelling_bee_stats")) || {}; }
  catch(e) { return {}; }
}
function saveStats(stats) {
  try { localStorage.setItem("spelling_bee_stats", JSON.stringify(stats)); } catch(e) {}
}

function saveGameResult() {
  var stats = getStats();
  stats.totalGames = (stats.totalGames || 0) + 1;
  stats.totalWords = (stats.totalWords || 0) + score;
  if (bestStreak > (stats.bestStreak || 0)) stats.bestStreak = bestStreak;

  var key = "best" + currentDifficulty.charAt(0).toUpperCase() + currentDifficulty.slice(1);
  var isNewBest = false;
  if (score > (stats[key] || 0)) { stats[key] = score; isNewBest = true; }

  saveStats(stats);
  return isNewBest;
}

// ==================== SCREENS ====================
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(function(s) {
    s.classList.remove("active");
    s.classList.remove("screen-enter");
  });
  var screen = document.getElementById(id);
  screen.classList.add("active");
  setTimeout(function() { screen.classList.add("screen-enter"); }, 20);
}

// ==================== ATMOSPHERE (Canvas-based) ====================
var atmoCanvas, atmoCtx, atmoMode = null, atmoAnimating = false, atmoTime = 0;
var atmoParticles = [];

function initAtmo() {
  atmoCanvas = document.getElementById("atmo-canvas");
  atmoCtx = atmoCanvas.getContext("2d");
  resizeAtmo();
  window.addEventListener("resize", resizeAtmo);
}

function resizeAtmo() {
  if (!atmoCanvas) return;
  atmoCanvas.width = window.innerWidth;
  atmoCanvas.height = window.innerHeight;
}

function setAtmosphere(difficulty) {
  document.body.classList.remove("theme-easy", "theme-medium", "theme-hard");
  document.body.classList.add("theme-" + difficulty);
  atmoMode = difficulty;
  atmoTime = 0;
  atmoParticles = [];
  var W = window.innerWidth, H = window.innerHeight;

  if (difficulty === "easy") {
    // Clouds built from many small round puffs (like confetti particles)
    for (var i = 0; i < 5; i++) {
      var cx = Math.random() * W;
      var cy = 30 + Math.random() * (H * 0.55);
      var spd = 0.15 + Math.random() * 0.15;
      // Each cloud = 15-25 overlapping round circles
      var n = 15 + Math.floor(Math.random() * 11);
      for (var p = 0; p < n; p++) {
        atmoParticles.push({
          x: cx + (Math.random() - 0.5) * 160,
          y: cy + (Math.random() - 0.5) * 50,
          r: 30 + Math.random() * 50,
          vx: spd,
          alpha: 0.25 + Math.random() * 0.15,
          phase: Math.random() * Math.PI * 2,
          groupX: cx
        });
      }
    }
  } else if (difficulty === "medium") {
    // Embers rising
    for (var k = 0; k < 35; k++) {
      atmoParticles.push({
        type: "ember",
        x: Math.random() * W,
        y: H + Math.random() * 200,
        speed: 0.4 + Math.random() * 1.2,
        drift: (Math.random() - 0.5) * 0.8,
        size: 3 + Math.random() * 8,
        alpha: 0.5 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2
      });
    }
  } else if (difficulty === "hard") {
    // Flame particles — same simple model as clouds: position + velocity
    for (var j = 0; j < 80; j++) {
      atmoParticles.push({
        x: Math.random() * W,
        y: H - Math.random() * H * 0.5,
        r: 20 + Math.random() * 40,
        vy: 0.5 + Math.random() * 2,
        vx: (Math.random() - 0.5) * 0.3,
        hue: Math.random() * 50,
        phase: Math.random() * Math.PI * 2,
        alpha: 0.3 + Math.random() * 0.4
      });
    }
  }

  if (!atmoAnimating) { atmoAnimating = true; animateAtmo(); }
}

function clearAtmosphere() {
  atmoMode = null;
  atmoParticles = [];
  document.body.classList.remove("theme-easy", "theme-medium", "theme-hard");
  if (atmoCtx && atmoCanvas) atmoCtx.clearRect(0, 0, atmoCanvas.width, atmoCanvas.height);
}

function animateAtmo() {
  if (!atmoMode) { atmoAnimating = false; return; }
  var W = atmoCanvas.width, H = atmoCanvas.height;
  atmoCtx.clearRect(0, 0, W, H);
  atmoTime += 0.016;

  if (atmoMode === "easy") {
    // Each particle is a simple filled circle — many overlapping = cloud shape
    for (var i = 0; i < atmoParticles.length; i++) {
      var c = atmoParticles[i];
      c.x += c.vx;
      if (c.x - c.r > W + 100) c.x = -c.r - 100;
      var bob = Math.sin(atmoTime * 0.4 + c.phase) * 4;
      var breathe = 1 + 0.05 * Math.sin(atmoTime * 0.3 + c.phase);
      var cr = c.r * breathe;
      var cy = c.y + bob;
      var grad = atmoCtx.createRadialGradient(c.x, cy, cr * 0.1, c.x, cy, cr);
      grad.addColorStop(0, "rgba(255,255,255," + c.alpha + ")");
      grad.addColorStop(0.5, "rgba(255,255,255," + (c.alpha * 0.6) + ")");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      atmoCtx.fillStyle = grad;
      atmoCtx.beginPath();
      atmoCtx.arc(c.x, cy, cr, 0, Math.PI * 2);
      atmoCtx.fill();
    }

  } else if (atmoMode === "medium") {
    // Pulsing amber vignette
    var pulse = 0.5 + 0.5 * Math.sin(atmoTime * 1.8);
    var grad = atmoCtx.createRadialGradient(W * 0.5, H * 1.05, 0, W * 0.5, H * 1.05, H * 0.85);
    grad.addColorStop(0, "rgba(255, 180, 30, " + (0.35 + 0.15 * pulse) + ")");
    grad.addColorStop(0.3, "rgba(251, 146, 60, " + (0.15 + 0.1 * pulse) + ")");
    grad.addColorStop(0.7, "rgba(230, 120, 40, " + (0.04 + 0.03 * pulse) + ")");
    grad.addColorStop(1, "rgba(200, 100, 30, 0)");
    atmoCtx.fillStyle = grad;
    atmoCtx.fillRect(0, 0, W, H);

    // Embers
    for (var m = 0; m < atmoParticles.length; m++) {
      var em = atmoParticles[m];
      em.y -= em.speed;
      em.x += em.drift + Math.sin(atmoTime * 2 + em.phase) * 0.5;
      if (em.y < -30) { em.y = H + 30; em.x = Math.random() * W; }
      var flicker = 0.4 + 0.6 * Math.sin(atmoTime * 8 + em.phase);
      var eGrad = atmoCtx.createRadialGradient(em.x, em.y, 0, em.x, em.y, em.size * 4);
      eGrad.addColorStop(0, "rgba(255, 230, 100, " + (em.alpha * flicker) + ")");
      eGrad.addColorStop(0.15, "rgba(255, 180, 40, " + (em.alpha * flicker * 0.7) + ")");
      eGrad.addColorStop(0.4, "rgba(255, 120, 20, " + (em.alpha * flicker * 0.2) + ")");
      eGrad.addColorStop(1, "rgba(200, 80, 10, 0)");
      atmoCtx.fillStyle = eGrad;
      atmoCtx.fillRect(em.x - em.size * 4, em.y - em.size * 4, em.size * 8, em.size * 8);
    }

  } else if (atmoMode === "hard") {
    // Base glow
    var baseGrad = atmoCtx.createLinearGradient(0, H, 0, H * 0.3);
    baseGrad.addColorStop(0, "rgba(255, 40, 0, 0.6)");
    baseGrad.addColorStop(0.3, "rgba(255, 60, 5, 0.25)");
    baseGrad.addColorStop(0.6, "rgba(200, 30, 0, 0.06)");
    baseGrad.addColorStop(1, "rgba(150, 10, 0, 0)");
    atmoCtx.fillStyle = baseGrad;
    atmoCtx.fillRect(0, H * 0.3, W, H * 0.7);

    // Flame particles — exact same pattern as clouds: move, wrap, draw circle
    for (var j = 0; j < atmoParticles.length; j++) {
      var f = atmoParticles[j];
      // Move upward + sway
      f.y -= f.vy;
      f.x += f.vx + Math.sin(atmoTime * 3 + f.phase) * 0.6;
      // Reset to bottom when off top
      if (f.y + f.r < 0) {
        f.y = H + f.r;
        f.x = Math.random() * W;
      }
      // Height ratio: 0 at bottom, 1 at top
      var heightRatio = 1 - (f.y / H);
      if (heightRatio < 0) heightRatio = 0;
      if (heightRatio > 1) heightRatio = 1;
      // Brighter at bottom, fade at top
      var flicker = 0.6 + 0.4 * Math.sin(atmoTime * 7 + f.phase);
      var alpha = f.alpha * (1 - heightRatio * 0.8) * flicker;
      var cr = f.r * (1 - heightRatio * 0.3);
      // Color: yellow at bottom → orange → red at top
      var rr = 255;
      var gg = Math.round(Math.max(0, 200 - heightRatio * 180 + f.hue));
      var bb = Math.round(Math.max(0, 50 - heightRatio * 50));

      var fGrad = atmoCtx.createRadialGradient(f.x, f.y, cr * 0.05, f.x, f.y, cr);
      fGrad.addColorStop(0, "rgba(" + rr + "," + gg + "," + bb + "," + alpha + ")");
      fGrad.addColorStop(0.4, "rgba(" + rr + "," + Math.round(gg * 0.5) + "," + Math.round(bb * 0.3) + "," + (alpha * 0.5) + ")");
      fGrad.addColorStop(1, "rgba(150,10,0,0)");
      atmoCtx.fillStyle = fGrad;
      atmoCtx.beginPath();
      atmoCtx.arc(f.x, f.y, cr, 0, Math.PI * 2);
      atmoCtx.fill();
    }
  }

  requestAnimationFrame(animateAtmo);
}

// ==================== PICK WORD ====================
function pickWord() {
  var available = words.filter(function(w) { return usedWords.indexOf(w) === -1; });
  if (available.length === 0) { usedWords = []; available = words.slice(); }
  var word = available[Math.floor(Math.random() * available.length)];
  usedWords.push(word);
  currentWord = word;
  return word;
}

// ==================== REFERENCE IMAGE ====================
function updateRefImage(word) {
  var emojiEl = document.getElementById("ref-image");
  var photoEl = document.getElementById("ref-image-photo");
  emojiEl.textContent = "";
  emojiEl.classList.remove("ref-image-enter");
  photoEl.classList.add("hidden");
  photoEl.src = "";

  fetch("/image/" + encodeURIComponent(word))
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.url) {
        photoEl.src = data.url;
        photoEl.classList.remove("hidden");
        photoEl.classList.remove("ref-image-enter");
        void photoEl.offsetWidth;
        photoEl.classList.add("ref-image-enter");
        emojiEl.textContent = "";
      } else {
        emojiEl.textContent = data.emoji || "";
        emojiEl.classList.remove("ref-image-enter");
        void emojiEl.offsetWidth;
        emojiEl.classList.add("ref-image-enter");
        photoEl.classList.add("hidden");
      }
    })
    .catch(function() {
      emojiEl.textContent = "";
      photoEl.classList.add("hidden");
    });
}

// ==================== KEYBOARD FADE SYSTEM ====================
function getLettersNotInWord(word) {
  var clean = word.replace(/ /g, "");
  var wordLetters = {};
  for (var i = 0; i < clean.length; i++) wordLetters[clean[i]] = true;
  var others = [];
  for (var j = 0; j < ALL_KEYS.length; j++) {
    if (!wordLetters[ALL_KEYS[j]]) others.push(ALL_KEYS[j]);
  }
  return others;
}

function shuffleArray(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function resetKeyboardVisibility() {
  hiddenKeys = [];
  var keys = document.querySelectorAll(".key");
  for (var i = 0; i < keys.length; i++) {
    keys[i].classList.remove("key-faded");
    keys[i].style.opacity = "";
    keys[i].style.pointerEvents = "";
  }
  clearInterval(keyFadeTimer);
  keyFadeTimer = null;
}

function startKeyFading() {
  resetKeyboardVisibility();
  var config = DIFF_CONFIG[currentDifficulty] || DIFF_CONFIG.easy;
  var lettersToHide = shuffleArray(getLettersNotInWord(currentWord));
  var fadeIndex = 0;
  var totalToHide = lettersToHide.length;
  var fadeInterval = Math.max(800, Math.floor((config.time * 1000 * config.fadeSpeed) / (totalToHide + 2)));

  keyFadeTimer = setInterval(function() {
    if (!gameActive || fadeIndex >= totalToHide) { clearInterval(keyFadeTimer); return; }
    var letter = lettersToHide[fadeIndex];
    var keyEl = document.querySelector('.key[data-letter="' + letter + '"]');
    if (keyEl) { keyEl.classList.add("key-faded"); hiddenKeys.push(letter); }
    fadeIndex++;
  }, fadeInterval);
}

// ==================== GAME START ====================
function startGame(difficulty) {
  playerName = document.getElementById("player-name").value.trim();
  if (!playerName) {
    document.getElementById("player-name").focus();
    document.getElementById("player-name").classList.add("input-shake");
    setTimeout(function() { document.getElementById("player-name").classList.remove("input-shake"); }, 500);
    return;
  }

  localStorage.setItem("spelling_bee_name", playerName);

  var config = DIFF_CONFIG[difficulty] || DIFF_CONFIG.easy;
  currentDifficulty = difficulty;
  maxTime = config.wordTime;
  timeLeft = maxTime;
  skippedWords = 0;
  score = 0;
  usedWords = [];
  reviewWords = [];
  streak = 0;
  bestStreak = 0;
  totalBonusTime = 0;
  wordsCompleted = 0;
  audioPlayCount = 0;
  currentRound = 1;
  wordInRound = 0;
  wrongLetters = 0;
  wordScores = [];
  updateScore();
  updateStreak();
  updateRoundIndicator();

  var badge = document.getElementById("difficulty-badge");
  badge.textContent = difficulty.toUpperCase();
  badge.className = "difficulty-badge " + difficulty;

  document.getElementById("player-tag").textContent = playerName;

  setAtmosphere(difficulty);

  fetch("/words?difficulty=" + difficulty)
    .then(function(res) { return res.json(); })
    .then(function(data) {
      words = data.words;
      var word = pickWord();
      showScreen("game-screen");
      renderBoxes(word);
      updateRefImage(word);
      buildKeyboard();
      startKeyFading();
      playAudio();
      wordStartTime = Date.now();
      wrongLetters = 0;
      startTimer();
      gameActive = true;
    })
    .catch(function(err) {
      console.error("Failed to load words:", err);
      alert("Could not load words. Is the server running?");
    });
}

function playAgain() { startGame(currentDifficulty); }

function returnToMenu() {
  gameActive = false;
  clearInterval(timer);
  resetKeyboardVisibility();
  clearAtmosphere();
  showScreen("menu-screen");
}

// ==================== QUIT CONFIRMATION ====================
var gamePausedForQuit = false;

function confirmQuit() {
  gamePausedForQuit = gameActive;
  gameActive = false;
  clearInterval(timer);
  document.getElementById("quit-modal").classList.remove("hidden");
}

function closeQuitModal() {
  document.getElementById("quit-modal").classList.add("hidden");
  if (gamePausedForQuit) { gameActive = true; startTimer(); }
}

function quitGame() {
  document.getElementById("quit-modal").classList.add("hidden");
  gamePausedForQuit = false;
  returnToMenu();
}

// ==================== LEADERBOARD ====================
var currentLbTab = "easy";

function showLeaderboard() {
  fetch("/leaderboard")
    .then(function(res) { return res.json(); })
    .then(function(data) {
      console.log("Leaderboard data:", data);
      leaderboardData = data;
      currentLbTab = "easy";
      renderLbTab("easy");
      updateLbTabButtons();
      document.getElementById("leaderboard-modal").classList.remove("hidden");
    })
    .catch(function(err) {
      console.error("Leaderboard fetch error:", err);
      document.getElementById("leaderboard-modal").classList.remove("hidden");
    });
}

function closeLeaderboard() {
  document.getElementById("leaderboard-modal").classList.add("hidden");
}

function switchLbTab(tab) {
  currentLbTab = tab;
  renderLbTab(tab);
  updateLbTabButtons();
}

function updateLbTabButtons() {
  var tabs = document.querySelectorAll(".lb-tab");
  tabs.forEach(function(t) { t.classList.remove("active"); });
  var labels = { easy: "Easy", medium: "Medium", hard: "Hard" };
  tabs.forEach(function(t) {
    if (t.textContent === labels[currentLbTab]) t.classList.add("active");
  });
}

function renderLbTab(tab) {
  var list = document.getElementById("lb-list");
  var entries = (leaderboardData[tab] || []).slice(0, 10);

  if (entries.length === 0) {
    list.innerHTML = '<p class="lb-empty">No scores yet. Be the first!</p>';
    return;
  }

  var html = '<table class="lb-table"><thead><tr><th>#</th><th>Name</th><th>Score</th><th>Streak</th></tr></thead><tbody>';
  var medals = ["🥇", "🥈", "🥉"];
  entries.forEach(function(e, i) {
    var rank = i < 3 ? medals[i] : (i + 1);
    var highlight = (e.name === playerName) ? ' class="lb-highlight"' : '';
    html += '<tr' + highlight + '><td>' + rank + '</td><td>' + escapeHtml(e.name) + '</td><td>' + e.score + '</td><td>' + (e.streak || 0) + '</td></tr>';
  });
  html += '</tbody></table>';
  list.innerHTML = html;
}

function renderGameOverLeaderboard(board, playerScore) {
  var container = document.getElementById("game-over-leaderboard");
  if (!board || board.length === 0) {
    container.innerHTML = '<div class="go-lb-section"><h3 class="go-lb-title">🏆 Leaderboard — ' + currentDifficulty.toUpperCase() + '</h3><p class="lb-empty">No scores yet.</p></div>';
    return;
  }

  var entries = board.slice(0, 10);
  var userRank = -1;
  for (var i = 0; i < entries.length; i++) {
    if (entries[i].name === playerName && entries[i].score === playerScore) { userRank = i + 1; break; }
  }

  var html = '<div class="go-lb-section">';
  html += '<h3 class="go-lb-title">🏆 Leaderboard — ' + currentDifficulty.toUpperCase() + '</h3>';
  if (userRank > 0) {
    var medals = ["🥇", "🥈", "🥉"];
    var rankText = userRank <= 3 ? medals[userRank - 1] + " " : "";
    html += '<div class="go-lb-rank">' + rankText + 'You placed #' + userRank + '!</div>';
  }
  html += '<table class="lb-table lb-mini"><thead><tr><th>#</th><th>Name</th><th>Score</th><th>Streak</th></tr></thead><tbody>';
  var medals = ["🥇", "🥈", "🥉"];
  entries.forEach(function(e, i) {
    var rank = i < 3 ? medals[i] : (i + 1);
    var isUser = (e.name === playerName && e.score === playerScore);
    var highlight = isUser ? ' class="lb-highlight"' : '';
    html += '<tr' + highlight + '><td>' + rank + '</td><td>' + escapeHtml(e.name) + '</td><td>' + e.score + '</td><td>' + (e.streak || 0) + '</td></tr>';
  });
  html += '</tbody></table></div>';
  container.innerHTML = html;
}

function fetchAndShowGameOverLeaderboard(playerScore) {
  fetch("/leaderboard")
    .then(function(res) { return res.json(); })
    .then(function(data) {
      var board = data[currentDifficulty] || [];
      renderGameOverLeaderboard(board, playerScore);
    })
    .catch(function(err) {
      console.error("Game over leaderboard fetch error:", err);
    });
}

function escapeHtml(str) {
  var div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ==================== GAME OVER ====================
function endGame() {
  gameActive = false;
  clearInterval(timer);
  resetKeyboardVisibility();

  var isNewBest = saveGameResult();

  var scoreEl = document.getElementById("final-score-number");
  animateNumber(scoreEl, 0, score, 600);

  document.getElementById("final-streak").textContent = bestStreak;
  document.getElementById("final-words-completed").textContent = wordsCompleted + "/" + (totalRounds * wordsPerRound);

  // Build score breakdown table
  var breakdownEl = document.getElementById("score-breakdown");
  if (breakdownEl) {
    var html = "<table class='breakdown-table'><tr><th>Word</th><th>Time</th><th>Errors</th><th>Score</th></tr>";
    for (var i = 0; i < wordScores.length; i++) {
      var ws = wordScores[i];
      var rowClass = ws.skipped ? " class='skipped'" : (ws.errors === 0 ? " class='perfect'" : "");
      html += "<tr" + rowClass + "><td>" + ws.word + "</td><td>" + ws.time + "s</td><td>" + ws.errors + "</td><td>" + ws.score + "</td></tr>";
    }
    html += "</table>";
    breakdownEl.innerHTML = html;
  }

  var newBestEl = document.getElementById("new-best");
  if (isNewBest && score > 0) {
    newBestEl.classList.remove("hidden");
    launchConfetti(120);
    sfxCelebration();
  } else {
    newBestEl.classList.add("hidden");
    if (score > 0) { launchConfetti(40); sfxCelebration(); }
    else { sfxGameOver(); }
  }

  // Review words
  var section = document.getElementById("review-section");
  var container = document.getElementById("review-words");
  container.innerHTML = "";
  if (reviewWords.length > 0) {
    section.classList.remove("hidden");
    reviewWords.forEach(function(word) {
      var chip = document.createElement("span");
      chip.className = "review-chip";
      chip.textContent = word;
      container.appendChild(chip);
    });
  } else { section.classList.add("hidden"); }

  // Submit score to leaderboard, then fetch and display full board
  var finalScore = score;
  document.getElementById("final-rank").classList.add("hidden");
  document.getElementById("game-over-leaderboard").innerHTML = "";

  if (playerName && finalScore > 0) {
    fetch("/leaderboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: playerName, score: finalScore, difficulty: currentDifficulty, streak: bestStreak })
    })
      .then(function(res) { return res.json(); })
      .then(function() {
        // After saving, fetch the full leaderboard to show rankings
        fetchAndShowGameOverLeaderboard(finalScore);
      })
      .catch(function(err) {
        console.error("Score submit error:", err);
        // Still try to show leaderboard even if submit failed
        fetchAndShowGameOverLeaderboard(finalScore);
      });
  } else {
    // No score to submit, just show existing leaderboard
    fetchAndShowGameOverLeaderboard(finalScore);
  }

  showScreen("game-over-screen");
}

function animateNumber(el, from, to, duration) {
  var start = performance.now();
  function update(now) {
    var progress = Math.min((now - start) / duration, 1);
    var eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(from + (to - from) * eased);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// ==================== STREAK ====================
function updateStreak() {
  var el = document.getElementById("streak-display");
  var countEl = document.getElementById("streak-count");
  if (streak >= 2) {
    el.classList.remove("hidden");
    countEl.textContent = streak;
    el.classList.add("streak-pop");
    setTimeout(function() { el.classList.remove("streak-pop"); }, 300);
  } else { el.classList.add("hidden"); }
}

function showBonus(text) {
  var popup = document.getElementById("bonus-popup");
  popup.textContent = text;
  popup.classList.remove("hidden");
  popup.classList.add("bonus-animate");
  setTimeout(function() { popup.classList.add("hidden"); popup.classList.remove("bonus-animate"); }, 1200);
}

function showPenalty(text) {
  var popup = document.getElementById("penalty-popup");
  popup.textContent = text;
  popup.classList.remove("hidden");
  popup.classList.add("penalty-animate");
  setTimeout(function() { popup.classList.add("hidden"); popup.classList.remove("penalty-animate"); }, 1000);
}

// ==================== RENDER BOXES ====================
function renderBoxes(word) {
  var container = document.getElementById("word-display");
  container.innerHTML = "";
  currentIndex = 0;

  var config = DIFF_CONFIG[currentDifficulty] || DIFF_CONFIG.easy;

  for (var i = 0; i < word.length; i++) {
    if (word[i] === " ") {
      var spacer = document.createElement("div");
      spacer.className = "letter-spacer";
      container.appendChild(spacer);
      continue;
    }

    var box = document.createElement("div");
    box.className = "letter-box";
    box.setAttribute("data-pos", i);

    if (i === 0 && config.hint) {
      box.textContent = word[0];
      box.classList.add("hint");
    }

    box.style.animationDelay = (i * 0.05) + "s";
    box.classList.add("box-enter");
    // Hard mode: unfilled boxes tremble
    if (currentDifficulty === "hard" && !(i === 0 && config.hint)) {
      box.classList.add("tremor");
    }
    container.appendChild(box);
  }

  // Skip spaces and hint letter
  currentIndex = 0;
  if (config.hint) currentIndex = 1;
  while (currentIndex < word.length && word[currentIndex] === " ") currentIndex++;
}

// ==================== KEYBOARD ====================
function buildKeyboard() {
  var bank = document.getElementById("letter-bank");
  bank.innerHTML = "";
  var rows = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
  rows.forEach(function(row, rowIndex) {
    var rowDiv = document.createElement("div");
    rowDiv.className = "keyboard-row";
    for (var c = 0; c < row.length; c++) {
      var ch = row[c];
      var key = document.createElement("button");
      key.className = "key";
      key.textContent = ch;
      key.setAttribute("data-letter", ch);
      key.onclick = (function(letter) { return function() { handleLetter(letter); }; })(ch);
      key.style.animationDelay = (rowIndex * 0.05 + c * 0.02) + "s";
      key.classList.add("key-enter");
      rowDiv.appendChild(key);
    }
    bank.appendChild(rowDiv);
  });
}

// Physical keyboard
document.addEventListener("keydown", function(e) {
  if (!gameActive) return;
  if (e.key === " ") { e.preventDefault(); return; }
  if (/^[a-zA-Z]$/.test(e.key)) {
    var letter = e.key.toLowerCase();
    handleLetter(letter);
    var keyEl = document.querySelector('.key[data-letter="' + letter + '"]');
    if (keyEl) {
      keyEl.classList.add("key-pressed");
      setTimeout(function() { keyEl.classList.remove("key-pressed"); }, 150);
    }
  }
});

// ==================== HANDLE LETTER ====================
function handleLetter(letter) {
  if (!gameActive) return;

  // Skip spaces
  while (currentIndex < currentWord.length && currentWord[currentIndex] === " ") currentIndex++;

  var boxes = document.querySelectorAll(".letter-box");
  // Find the box for current position (accounting for spacers)
  var boxIndex = 0;
  for (var p = 0; p < currentIndex; p++) {
    if (currentWord[p] !== " ") boxIndex++;
  }
  var box = boxes[boxIndex];
  if (!box) return;

  var config = DIFF_CONFIG[currentDifficulty] || DIFF_CONFIG.easy;

  if (letter === currentWord[currentIndex]) {
    sfxCorrect();
    box.textContent = letter;
    box.classList.remove("tremor");
    box.classList.add("correct");
    box.classList.add("pop");
    // Add bonus time for correct letter
    timeLeft = Math.min(timeLeft + config.letterBonus, maxTime);
    startTimer();
    currentIndex++;

    // Skip spaces after correct letter
    while (currentIndex < currentWord.length && currentWord[currentIndex] === " ") currentIndex++;

    if (currentIndex >= currentWord.length) {
      streak++;
      if (streak > bestStreak) bestStreak = streak;
      wordsCompleted++;
      wordInRound++;

      // Calculate per-word score
      var timeTaken = (Date.now() - wordStartTime) / 1000;
      var wordLen = currentWord.replace(/ /g, "").length;
      var timeScore = Math.max(0, Math.round((maxTime - timeTaken) / maxTime * 50));
      var accuracyScore = Math.max(0, Math.round((1 - wrongLetters / wordLen) * 50));
      var wordScore = timeScore + accuracyScore;
      wordScores.push({ word: currentWord, score: wordScore, time: Math.round(timeTaken * 10) / 10, errors: wrongLetters });
      score = wordScores.reduce(function(sum, w) { return sum + w.score; }, 0);
      updateScore();
      updateStreak();
      updateRoundIndicator();

      sfxComplete();
      if (streak >= 3) { sfxStreak(); launchConfetti(30 + streak * 5); }

      gameActive = false;
      clearInterval(timer);
      for (var i = 0; i < boxes.length; i++) {
        (function(b, delay) { setTimeout(function() { b.classList.add("celebrate"); }, delay); })(boxes[i], i * 60);
      }

      // Check if round is done
      if (wordInRound >= wordsPerRound) {
        if (currentRound >= totalRounds) {
          setTimeout(function() { endGame(); }, 1000);
          return;
        }
        // Show round transition overlay, then continue
        setTimeout(function() {
          showRoundTransition(function() {
            currentRound++;
            wordInRound = 0;
            timeLeft = maxTime;
            updateRoundIndicator();
            nextWord();
          });
        }, 800);
      } else {
        // Next word in same round — time carries over
        setTimeout(function() { nextWord(); }, 800);
      }
    }
  } else {
    sfxWrong();
    wrongLetters++;
    streak = 0;
    updateStreak();
    box.classList.add("error");
    if (reviewWords.indexOf(currentWord) === -1) reviewWords.push(currentWord);
    setTimeout(function() { box.classList.remove("error"); }, 400);

    // Time penalty for medium and hard
    if (config.penalty > 0) {
      timeLeft = Math.max(0, timeLeft - config.penalty);
      showPenalty("-" + config.penalty + "s");
      sfxPenalty();
      if (timeLeft <= 0) { clearInterval(timer); endGame(); }
    }

    // Screen shake on hard mode
    if (currentDifficulty === "hard") {
      document.getElementById("game-screen").classList.add("screen-shake");
      setTimeout(function() { document.getElementById("game-screen").classList.remove("screen-shake"); }, 300);
    }
  }
}

// ==================== NEXT WORD ====================
function nextWord() {
  var word = pickWord();
  renderBoxes(word);
  updateRefImage(word);
  audioPlayCount = 0;
  resetKeyboardVisibility();
  startKeyFading();
  playAudio();
  wordStartTime = Date.now();
  wrongLetters = 0;
  startTimer();
  gameActive = true;
}

// ==================== ROUND INDICATOR ====================
function updateRoundIndicator() {
  var el = document.getElementById("round-indicator");
  if (el) el.textContent = "Round " + currentRound + "/" + totalRounds + "  •  Word " + (wordInRound + 1) + "/" + wordsPerRound;
}

// ==================== ROUND TRANSITION ====================
function showRoundTransition(callback) {
  clearInterval(timer);
  var overlay = document.getElementById("round-transition");
  if (!overlay) { callback(); return; }

  // Calculate round score (sum of wordScores from this round)
  var roundStart = (currentRound - 1) * wordsPerRound;
  var roundEnd = currentRound * wordsPerRound;
  var roundScore = 0;
  for (var i = roundStart; i < roundEnd && i < wordScores.length; i++) {
    roundScore += wordScores[i].score;
  }

  var emojis = ["🎉", "🔥", "⭐"];
  document.getElementById("rt-emoji").textContent = emojis[currentRound - 1] || "🎉";
  document.getElementById("rt-title").textContent = "Round " + currentRound + " Complete!";
  document.getElementById("rt-round-score").textContent = roundScore;
  document.getElementById("rt-total-score").textContent = score;
  document.getElementById("rt-streak").textContent = bestStreak;
  document.getElementById("rt-next").textContent = "⚡ Round " + (currentRound + 1) + " starting...";

  var fill = document.getElementById("rt-progress-fill");
  fill.style.transition = "none";
  fill.style.width = "0%";

  overlay.classList.remove("hidden");

  // Start progress bar after a tiny delay for CSS to reset
  setTimeout(function() {
    fill.style.transition = "width 3s linear";
    fill.style.width = "100%";
  }, 50);

  // After 3.5s, hide overlay and continue
  setTimeout(function() {
    overlay.classList.add("hidden");
    callback();
  }, 3500);
}

// ==================== SCORE ====================
function updateScore() {
  var el = document.getElementById("score");
  el.textContent = score;
  el.classList.add("score-pop");
  setTimeout(function() { el.classList.remove("score-pop"); }, 300);
}

// ==================== TIMER ====================
function startTimer() {
  var circle = document.getElementById("timer-circle");
  var text = document.getElementById("timer-text");
  circle.style.strokeDasharray = CIRCUMFERENCE;
  circle.classList.remove("timer-warning", "timer-critical");
  text.classList.remove("timer-critical-text");
  text.textContent = timeLeft;

  // Update circle to reflect current time vs maxTime
  var offset = CIRCUMFERENCE - (timeLeft / maxTime) * CIRCUMFERENCE;
  circle.style.strokeDashoffset = Math.min(offset, CIRCUMFERENCE);

  clearInterval(timer);
  timer = setInterval(function() {
    timeLeft--;
    text.textContent = Math.max(timeLeft, 0);

    var offset = CIRCUMFERENCE - (timeLeft / maxTime) * CIRCUMFERENCE;
    circle.style.strokeDashoffset = Math.min(offset, CIRCUMFERENCE);

    // Warning thresholds relative to per-word time
    var warnAt = Math.ceil(maxTime * 0.4);
    var critAt = Math.ceil(maxTime * 0.2);
    if (timeLeft <= critAt) {
      circle.classList.add("timer-critical");
      text.classList.add("timer-critical-text");
    } else if (timeLeft <= warnAt) {
      circle.classList.add("timer-warning");
      circle.classList.remove("timer-critical");
      text.classList.remove("timer-critical-text");
    } else {
      circle.classList.remove("timer-warning", "timer-critical");
      text.classList.remove("timer-critical-text");
    }

    if (timeLeft <= 0) {
      clearInterval(timer);
      skipWord();
    }
  }, 1000);
}

function skipWord() {
  skippedWords++;
  wordInRound++;
  streak = 0;
  updateStreak();
  if (reviewWords.indexOf(currentWord) === -1) reviewWords.push(currentWord);
  sfxWrong();

  // Score 0 for skipped word
  wordScores.push({ word: currentWord, score: 0, time: maxTime, errors: wrongLetters, skipped: true });
  score = wordScores.reduce(function(sum, w) { return sum + w.score; }, 0);
  updateScore();

  // Flash boxes red
  var boxes = document.querySelectorAll(".letter-box");
  for (var i = 0; i < boxes.length; i++) {
    boxes[i].classList.remove("tremor");
    boxes[i].classList.add("error");
  }

  // Show the correct word briefly
  var wordChars = currentWord.split("");
  var bi = 0;
  for (var w = 0; w < wordChars.length; w++) {
    if (wordChars[w] === " ") continue;
    if (boxes[bi]) boxes[bi].textContent = wordChars[w];
    bi++;
  }

  showPenalty("TIME'S UP!");

  gameActive = false;

  // Check if round is done
  if (wordInRound >= wordsPerRound) {
    if (currentRound >= totalRounds) {
      setTimeout(function() { endGame(); }, 1200);
      return;
    }
    setTimeout(function() {
      showRoundTransition(function() {
        currentRound++;
        wordInRound = 0;
        timeLeft = maxTime;
        updateRoundIndicator();
        nextWord();
      });
    }, 1200);
  } else {
    setTimeout(function() {
      timeLeft = maxTime;
      updateRoundIndicator();
      nextWord();
    }, 1200);
  }
}

// ==================== TTS AUDIO ====================
function playAudio() {
  var btn = document.querySelector(".sound-btn");
  if (btn) btn.classList.add("sound-playing");

  audioPlayCount++;
  var url = audioPlayCount > 1
    ? "/speak_slow/" + encodeURIComponent(currentWord)
    : "/speak/" + encodeURIComponent(currentWord);

  fetch(url)
    .then(function(res) { return res.blob(); })
    .then(function(blob) {
      var audio = new Audio(URL.createObjectURL(blob));
      audio.play();
      audio.onended = function() { if (btn) btn.classList.remove("sound-playing"); };
    })
    .catch(function() { if (btn) btn.classList.remove("sound-playing"); });
}

// ==================== BEE FLIGHT ====================
var beeAngle = 0;

function initBeeFlight() {
  animateBee();
}

function animateBee() {
  requestAnimationFrame(animateBee);

  var bee = document.getElementById("flying-bee");
  var area = document.querySelector(".bee-flight-area");
  if (!bee || !area || area.offsetParent === null) return;

  // Elliptical orbit parameters
  var radiusX = 65;
  var radiusY = 20;
  var speed = 0.012;
  beeAngle += speed;

  // Position on ellipse
  var x = Math.cos(beeAngle) * radiusX;
  var y = Math.sin(beeAngle) * radiusY;

  // Depth: when angle is near PI (back of circle), bee is "far away"
  var depth = 0.5 + 0.5 * Math.sin(beeAngle);
  var sc = 0.55 + depth * 0.5;

  // Horizontal velocity: derivative of cos(angle) = -sin(angle)
  var dx = -Math.sin(beeAngle);
  var flipX = dx >= 0 ? -1 : 1;

  // Slight tilt based on vertical movement
  var dy = Math.cos(beeAngle);
  var tilt = dy * -8;

  // Bounce wobble
  var bounce = Math.sin(beeAngle * 6) * 3 * sc;

  // Center of flight area
  var cx = 80;
  var cy = 40;
  var beeSize = 44 * sc;
  var px = cx + x - beeSize / 2;
  var py = cy + y + bounce - beeSize / 2;

  bee.style.transform = "translate(" + px + "px, " + py + "px) scale(" + sc + ") scaleX(" + flipX + ") rotate(" + tilt + "deg)";
}

// ==================== INIT ====================
document.addEventListener("DOMContentLoaded", function() {
  initConfetti();
  initAtmo();
  initBeeFlight();

  var savedName = localStorage.getItem("spelling_bee_name");
  if (savedName) document.getElementById("player-name").value = savedName;
});
