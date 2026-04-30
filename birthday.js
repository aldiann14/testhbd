// === Pages setup ===
const deck       = document.getElementById('deck');
const panels     = Array.from(deck.querySelectorAll('.panel'));
const navPrev    = document.getElementById('navPrev');
const navNext    = document.getElementById('navNext');
const curIdxEl   = document.getElementById('curIdx');
const totalIdxEl = document.getElementById('totalIdx');

let current = 0;
totalIdxEl.textContent = panels.length;
let resetSolveFn = () => {};

panels.forEach(panel => {
  panel.querySelectorAll('.anim').forEach(el => {
    const text = el.textContent;
    el.textContent = '';
    const parts = text.split(/(\s+)/);
    let wi = 0;
    parts.forEach(p => {
      if (/^\s+$/.test(p)) {
        const s = document.createElement('span');
        s.className = 'space'; s.innerHTML = '&nbsp;';
        el.appendChild(s);
      } else {
        const w = document.createElement('span');
        w.className = 'word'; w.textContent = p;
        w.style.transitionDelay = (wi * 60) + 'ms';
        el.appendChild(w); wi++;
      }
    });
  });
});

const showPanel = (idx) => {
  if (idx < 0 || idx >= panels.length || idx === current) return;
  const oldPanel = panels[current];
  oldPanel.classList.remove('active');
  oldPanel.querySelectorAll('.word.show').forEach(w => w.classList.remove('show'));
  current = idx;
  const next = panels[current];
  next.classList.add('active');
  setTimeout(() => {
    next.querySelectorAll('.word').forEach(w => w.classList.add('show'));
  }, 120);
  curIdxEl.textContent = idx + 1;
  navPrev.disabled = (idx === 0);
  navNext.disabled = (idx === panels.length - 1);
  document.body.classList.toggle('on-puzzle', next.dataset.panel === 'puzzle');
  document.body.classList.toggle('on-solve',  next.dataset.panel === 'solve');
    if (next.dataset.panel === 'solve')  resetSolveFn();
};

setTimeout(() => panels[0].querySelectorAll('.word').forEach(w => w.classList.add('show')), 120);
navPrev.disabled = true;

navPrev.addEventListener('click', (e) => { e.stopPropagation(); showPanel(current - 1); });
navNext.addEventListener('click', (e) => { e.stopPropagation(); showPanel(current + 1); });

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); showPanel(current + 1); }
  if (e.key === 'ArrowLeft') { e.preventDefault(); showPanel(current - 1); }
});

// === Swipe nav untuk HP ===
let touchStartX = 0;
let touchStartY = 0;
let touchStartTime = 0;
const SWIPE_MIN = 50;
const SWIPE_MAX_TIME = 600;

window.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
  touchStartTime = performance.now();
}, { passive: true });

window.addEventListener('touchend', (e) => {
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;
  const dt = performance.now() - touchStartTime;
  if (dt > SWIPE_MAX_TIME) return;
  if (Math.abs(dx) < SWIPE_MIN) return;
  if (Math.abs(dx) < Math.abs(dy) * 1.3) return;
  const target = e.target;
  if (target && target.closest && target.closest('.puzzle, .solve-btn, .claim-btn, .puzzle-shuffle, .puzzle-giveup, .audio-toast, .claim-modal')) return;
  if (dx < 0) showPanel(current + 1);
  else showPanel(current - 1);
}, { passive: true });

// === Hidden timer ===
const startedAt = performance.now();
const RUPIAH_PER_MS = 0.5;
const fmtRupiah = (n) => 'Rp ' + Math.floor(n).toLocaleString('id-ID');
const fmtDuration = (ms) => {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m > 0) return `${m} menit ${s} detik`;
  return `${s} detik`;
};

// === Puzzle ===
function initPuzzle() {
  const el = document.getElementById('puzzle');
  if (!el) return;
  const N = parseInt(el.dataset.size || '3', 10);
  const COUNT = N * N;
  const img = el.dataset.image;
  const quote = document.getElementById('puzzleQuote');
  const quoteTextEl = quote.querySelector('.quote-text');
  const shuffleBtn = document.getElementById('puzzleShuffle');
  const giveupBtn = document.getElementById('puzzleGiveup');

  const QUOTES = [
    '"Seperti puzzle ini, hubungan kita mungkin sempat berantakan, tapi selalu kita satukan lagi."',
    '"dan ibarat tombol "selesaikan puzzle" adalah solusi yg pasti ketika kita menghela nafas sedikit untuk menyelesaikan masalah dengan baik"'
  ];

  let tiles = [];
  let emptyPos = COUNT - 1;
  let giveupTimer = null;
  let giveupReady = false;
  let quoteIdx = 0;
  let quoteInterval = null;
  let quoteSwapTimeout = null;

  const build = () => {
    el.innerHTML = '';
    tiles.forEach((tileId, pos) => {
      const div = document.createElement('div');
      div.className = 'puzzle-tile';
      if (pos === 0) div.classList.add('tl');
      if (pos === N - 1) div.classList.add('tr');
      if (pos === COUNT - N) div.classList.add('bl');
      if (pos === COUNT - 1) div.classList.add('br');
      const isEmpty = (tileId === COUNT - 1) && !el.classList.contains('solved');
      if (isEmpty) {
        div.classList.add('empty');
      } else {
        const row = Math.floor(tileId / N);
        const col = tileId % N;
        div.style.backgroundImage = `url("${img}")`;
        div.style.backgroundSize = `${N * 100}% ${N * 100}%`;
        div.style.backgroundPosition = `${(col / (N - 1)) * 100}% ${(row / (N - 1)) * 100}%`;
      }
      div.addEventListener('click', (e) => { e.stopPropagation(); tryMove(pos); });
      el.appendChild(div);
    });
  };

  const stopQuoteRotation = () => {
    if (quoteInterval) { clearInterval(quoteInterval); quoteInterval = null; }
    if (quoteSwapTimeout) { clearTimeout(quoteSwapTimeout); quoteSwapTimeout = null; }
    if (quoteTextEl) quoteTextEl.classList.remove('swap-out');
  };
  const startQuoteRotation = () => {
    if (!quoteTextEl || quoteInterval) return;
    quoteIdx = 0;
    quoteTextEl.textContent = QUOTES[quoteIdx];
    quoteInterval = setInterval(() => {
      quoteTextEl.classList.add('swap-out');
      quoteSwapTimeout = setTimeout(() => {
        quoteIdx = (quoteIdx + 1) % QUOTES.length;
        quoteTextEl.textContent = QUOTES[quoteIdx];
        quoteTextEl.classList.remove('swap-out');
      }, 350);
    }, 3000);
  };

  const markSolved = () => {
    el.classList.add('solved'); build();
    setTimeout(() => { quote.classList.add('show'); startQuoteRotation(); }, 400);
  };
  const tryMove = (pos) => {
    if (el.classList.contains('solved')) return;
    const r1 = Math.floor(pos / N), c1 = pos % N;
    const r2 = Math.floor(emptyPos / N), c2 = emptyPos % N;
    if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) return;
    [tiles[pos], tiles[emptyPos]] = [tiles[emptyPos], tiles[pos]];
    emptyPos = pos;
    const ok = tiles.every((t, i) => t === i);
    if (ok) markSolved(); else build();
  };
  const shuffle = () => {
    el.classList.remove('solved');
    quote.classList.remove('show'); stopQuoteRotation();
    tiles = Array.from({ length: COUNT }, (_, i) => i);
    emptyPos = COUNT - 1;
    let prev = -1;
    for (let k = 0; k < 240; k++) {
      const r = Math.floor(emptyPos / N), c = emptyPos % N;
      const opts = [];
      if (r > 0) opts.push(emptyPos - N);
      if (r < N - 1) opts.push(emptyPos + N);
      if (c > 0) opts.push(emptyPos - 1);
      if (c < N - 1) opts.push(emptyPos + 1);
      const filtered = opts.filter(p => p !== prev);
      const pick = filtered[Math.floor(Math.random() * filtered.length)];
      [tiles[pick], tiles[emptyPos]] = [tiles[emptyPos], tiles[pick]];
      prev = emptyPos; emptyPos = pick;
    }
    build();
  };
  const giveUp = () => {
    if (el.classList.contains('solved')) return;
    if (!giveupReady) return;
    tiles = Array.from({ length: COUNT }, (_, i) => i);
    emptyPos = COUNT - 1; markSolved();
  };
  const startGiveupTimer = () => {
    if (giveupReady || giveupTimer) return;
    giveupTimer = setTimeout(() => {
      giveupReady = true;
      giveupBtn.classList.add('show');
    }, 30000);
  };
  const checkPanel = () => {
    const active = document.querySelector('.panel.active');
    if (active && active.dataset.panel === 'puzzle') startGiveupTimer();
  };
  checkPanel();
  const observer = new MutationObserver(checkPanel);
  document.querySelectorAll('.panel').forEach(p => {
    observer.observe(p, { attributes: true, attributeFilter: ['class'] });
  });

  shuffleBtn.addEventListener('click', (e) => { e.stopPropagation(); shuffle(); });
  giveupBtn.addEventListener('click', (e) => { e.stopPropagation(); giveUp(); });
  shuffle();

    resetPuzzleFn = () => {
    if (giveupTimer) { clearTimeout(giveupTimer); giveupTimer = null; }
    giveupReady = false;
    giveupBtn.classList.remove('show');
  };
}
initPuzzle();

// === Solve panel ===
function initSolvePanel() {
  const panel = document.querySelector('[data-panel="solve"]');
  const btn = document.getElementById('solveBtn');
  const chatArea = document.getElementById('solveChat');
  if (!panel || !btn || !chatArea) return;

  const messages = [
    "Tarik nafas dulu, pelan-pelan.",
    "Setiap masalah pasti ada jalan keluarnya.",
    "Kamu jauh lebih kuat dari yang kamu kira."
  ];
  let triggered = false;

  const showChats = () => {
    messages.forEach((text, i) => {
      setTimeout(() => {
        const existing = Array.from(chatArea.querySelectorAll('.chat-bubble'));
        const beforeRects = existing.map(b => b.getBoundingClientRect());
        const bubble = document.createElement('div');
        bubble.className = 'chat-bubble';
        bubble.textContent = text;
        chatArea.appendChild(bubble);
        requestAnimationFrame(() => {
          existing.forEach((b, idx) => {
            const after = b.getBoundingClientRect();
            const dy = beforeRects[idx].top - after.top;
            if (dy !== 0) {
              b.style.transition = 'none';
              b.style.transform = `translateY(${dy}px)`;
            }
          });
          requestAnimationFrame(() => {
            existing.forEach(b => {
              b.style.transition = 'transform 0.55s cubic-bezier(0.34, 1.56, 0.64, 1)';
              b.style.transform = '';
            });
            bubble.classList.add('show');
          });
        });
      }, 1100 + i * 500);
    });
  };

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (triggered) return;
    triggered = true;
    panel.classList.add('solve-done');
    showChats();
  });

    resetSolveFn = () => {
    panel.classList.remove('solve-done');
    chatArea.innerHTML = '';
    triggered = false;
  };
}
initSolvePanel();

// === Audio ===
const audio  = document.getElementById('bgm');
const aBtn   = document.getElementById('audioToggle');
const aLabel = document.getElementById('audioLabel');
audio.volume = 0.45;

const tryPlay = async () => {
  try { await audio.play(); aLabel.textContent = 'music on'; }
  catch { aLabel.textContent = 'tap to play music'; }
};
tryPlay();

const onFirst = async () => {
  if (audio.paused) {
    try { await audio.play(); aLabel.textContent = 'music on'; } catch {}
  }
};
window.addEventListener('pointerdown', onFirst, { once: true });
window.addEventListener('keydown', onFirst, { once: true });

aBtn.addEventListener('click', async (e) => {
  e.stopPropagation();
  if (audio.paused) {
    try { await audio.play(); aLabel.textContent = 'music on'; } catch {}
  } else {
    audio.pause();
    aLabel.textContent = 'music paused';
  }
});

// === Claim button ===
const claimBtn         = document.getElementById('claimBtn');
const claimForm        = document.getElementById('claimForm');
const claimAmountInput = document.getElementById('claimAmount');
const claimSuccess     = document.getElementById('claimSuccess');
const claimClose       = document.getElementById('claimClose');
const claimModalText   = document.getElementById('claimModalText');

const showClaimSuccess = () => {
  claimSuccess.classList.add('show');
  claimSuccess.setAttribute('aria-hidden', 'false');
};
const hideClaimSuccess = () => {
  claimSuccess.classList.remove('show');
  claimSuccess.setAttribute('aria-hidden', 'true');
};

claimBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (claimBtn.disabled) return;
  const elapsedMs  = performance.now() - startedAt;
  const balance    = elapsedMs * RUPIAH_PER_MS;
  const amountText = fmtRupiah(balance);
  const duration   = fmtDuration(elapsedMs);
  claimAmountInput.value = `${amountText} (${duration})`;
  claimBtn.disabled = true;
  claimBtn.classList.add('is-loading');
  try { claimForm.submit(); } catch (_) {}
  setTimeout(() => {
    claimBtn.classList.remove('is-loading');
    claimModalText.innerHTML =
      `Hadiahmu: <strong class="modal-amount">${amountText}</strong>` +
      `<span class="modal-sub">terkumpul dari ${duration}</span>` +
      `<span class="modal-sub">notifikasi akan dikirim ke HP-mu sebentar lagi.</span>`;
    showClaimSuccess();
  }, 600);
});

claimClose.addEventListener('click', (e) => { e.stopPropagation(); hideClaimSuccess(); });
claimSuccess.addEventListener('click', (e) => { if (e.target === claimSuccess) hideClaimSuccess(); });