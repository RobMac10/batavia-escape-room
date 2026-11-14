/* In Case of Emergency — interactive story. No build step. Progress in localStorage. */
(function () {
  "use strict";

  const STORAGE_KEY = "batavia-escape-room-v1";
  const S = window.STORY;
  const $ = (sel, el) => (el || document).querySelector(sel);
  const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));

  function defaultState() {
    return {
      screen: "title",
      puzzle: null,
      seenOpening: false,
      seenLocked: false,
      solved: [],
      letters: ["", "", "", "", "", "", "", ""],
      envelopeOpened: false,
      envelopeDone: false,
      jumbleTried: false,
      unscrambled: false,
      doorOpened: false,
      hints: {},
    };
  }

  let state = load();
  let keypadBuffer = "";
  let doorAnimDone = false;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const s = Object.assign(defaultState(), JSON.parse(raw));
      if (!Array.isArray(s.solved)) s.solved = [];
      s.solved = s.solved.map(Number).filter((n) => n >= 1 && n <= 8);
      if (!Array.isArray(s.letters) || s.letters.length !== 8) {
        s.letters = ["", "", "", "", "", "", "", ""];
      }
      if (!s.hints || typeof s.hints !== "object") s.hints = {};
      return s;
    } catch (err) {
      return defaultState();
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      /* private mode etc. */
    }
  }

  function go(screen, extra) {
    state.screen = screen;
    if (extra) Object.assign(state, extra);
    save();
    doorAnimDone = false;
    render();
    const stage = $("#stage");
    if (stage) {
      stage.focus({ preventScroll: true });
    }
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function allSolved() {
    return S.puzzles.every((p) => state.solved.includes(p.n));
  }
  function unlocked(n) {
    return n === 1 || state.solved.includes(n - 1);
  }
  function currentMark() {
    for (const p of S.puzzles) {
      if (!state.solved.includes(p.n)) return p.n;
    }
    return null;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  function verseHTML(lines) {
    const paras = [];
    let buf = [];
    const flush = () => {
      if (buf.length) {
        paras.push("<p>" + buf.join("<br>") + "</p>");
        buf = [];
      }
    };
    (lines || []).forEach((line) => {
      if (line === "") flush();
      else buf.push(escapeHtml(line));
    });
    flush();
    return '<div class="verse">' + paras.join("") + "</div>";
  }

  function paraHTML(lines) {
    return (lines || [])
      .map((l) => (l === "" ? "<br>" : "<p>" + escapeHtml(l) + "</p>"))
      .join("");
  }

  function art(name, alt) {
    return (
      '<figure class="frame story-art"><img src="assets/images/' +
      escapeHtml(name) +
      '.jpg" alt="' +
      escapeHtml(alt) +
      '"></figure>'
    );
  }

  /* ---------- header / tray ---------- */
  function renderTray() {
    const tray = $("#tray");
    const hideOn = ["title", "opening", "teachers", "howto"];
    const visible = !hideOn.includes(state.screen) && (state.seenLocked || state.screen === "locked");
    tray.hidden = !visible;
    document.body.classList.toggle("has-tray", visible);
    if (!visible) return;
    const wordMode = state.unscrambled || state.doorOpened;
    tray.classList.toggle("word-mode", wordMode);
    $("#tray-label").textContent = wordMode
      ? "The word for the door"
      : "Letters as you find them";
    const letters = wordMode ? S.passcode.split("") : state.letters;
    $("#tray-boxes").innerHTML = letters
      .map((ch, i) => {
        const label = wordMode
          ? ch
          : "Box " + (i + 1) + (ch ? ": " + ch : ", empty");
        return (
          '<div class="tray-box" aria-label="' +
          escapeHtml(label) +
          '">' +
          (wordMode ? "" : "<i>" + (i + 1) + "</i>") +
          escapeHtml(ch || "") +
          "</div>"
        );
      })
      .join("");
  }

  function closeMenu() {
    $("#menu").hidden = true;
    $("#btn-menu").setAttribute("aria-expanded", "false");
  }

  function renderHeader() {
    const showMap =
      state.seenLocked &&
      state.screen !== "map" &&
      state.screen !== "title";
    $("#btn-map").hidden = !showMap;
    closeMenu();
  }

  /* ---------- screens ---------- */
  function renderTitle() {
    const continued = state.seenOpening || state.solved.length > 0;
    return (
      '<section class="screen title-screen">' +
      '<div class="hero-art">' +
      art("closing", "From an observation deck, four children look down into a hall at the reconstructed stern of a ship. They are seen from behind, in late afternoon light.") +
      "</div>" +
      '<div class="title-copy">' +
      '<p class="kicker">Year 4, and anyone still looking</p>' +
      "<h1>" +
      escapeHtml(S.title) +
      "</h1>" +
      '<p class="sub">' +
      escapeHtml(S.subtitle) +
      "</p>" +
      '<p class="lead">Four friends stay for one more look at an old ship. The museum closes. A story map is waiting on the wall. Eight marks. Eight letters. A word for the door.</p>' +
      '<div class="actions">' +
      (continued
        ? '<button type="button" class="btn-gold" data-go="continue">Continue the night</button>' +
          '<button type="button" class="btn" data-action="restart-ask">Start again</button>'
        : '<button type="button" class="btn-gold" data-go="opening">Begin</button>') +
      '<button type="button" class="btn-ghost" data-go="howto">For teachers</button>' +
      "</div></div></section>"
    );
  }

  function renderOpening() {
    const o = S.opening[0];
    return (
      '<section class="screen spread">' +
      art("closing", "Four children on an observation deck look down at the reconstructed stern of a ship. Faces turned away.") +
      "<div>" +
      '<p class="kicker">' +
      escapeHtml(o.kicker) +
      "</p>" +
      verseHTML(o.text) +
      '<div class="actions"><button type="button" class="btn-gold" data-go="locked">The bell has gone</button></div>' +
      "</div></section>"
    );
  }

  function renderLocked() {
    const o = S.opening[1];
    return (
      '<section class="screen spread art-right">' +
      art("keypad", "Night beyond a locked glass door. A keypad waits. Four children stand at the door, seen from behind.") +
      "<div>" +
      '<p class="kicker">' +
      escapeHtml(o.kicker) +
      "</p>" +
      verseHTML(o.text) +
      '<div class="trail-card"><strong>The ship keeps the door.</strong>Follow the story, in order.<br>Eight marks. Eight letters.<br>Collect them as you go.<br>At the door, you will need a word.<br>Stay together.</div>' +
      '<div class="actions"><button type="button" class="btn-gold" data-action="open-map">Open the story map</button></div>' +
      "</div></section>"
    );
  }

  function renderMap() {
    const pins = S.puzzles
      .map((p) => {
        const pos = S.iconPos[String(p.n)];
        const isSolved = state.solved.includes(p.n);
        const isOpen = unlocked(p.n);
        const isCurrent = currentMark() === p.n;
        const cls =
          "map-pin" +
          (isSolved ? " solved" : isCurrent ? " current" : isOpen ? "" : " locked");
        const title = isOpen
          ? "Mark " + p.n + " · " + p.kicker
          : "Mark " + p.n + " is still locked. Do the marks in order.";
        return (
          '<button type="button" class="' +
          cls +
          '" data-mark="' +
          p.n +
          '" style="left:' +
          pos[0] +
          "%;top:" +
          pos[1] +
          '%" title="' +
          escapeHtml(title) +
          '" aria-label="' +
          escapeHtml(title) +
          '"' +
          (isOpen ? "" : " disabled") +
          ">" +
          '<span class="map-pin-face"><img src="assets/icons/mark-' +
          p.n +
          '.png" alt=""></span>' +
          (isOpen && !isSolved ? "" : '<span class="lock-dot">' + (isSolved ? "✓" : "•") + "</span>") +
          "</button>"
        );
      })
      .join("");

    const list = S.puzzles
      .map((p) => {
        const isSolved = state.solved.includes(p.n);
        const isOpen = unlocked(p.n);
        const isCurrent = currentMark() === p.n;
        const cls =
          "mark-btn" +
          (isSolved ? " solved" : isCurrent ? " current" : isOpen ? "" : " locked");
        const status = isSolved
          ? "Letter collected"
          : isOpen
          ? "Open"
          : "Locked until you reach it";
        return (
          '<button type="button" class="' +
          cls +
          '" data-mark="' +
          p.n +
          '"' +
          (isOpen ? "" : " disabled") +
          ">" +
          '<img src="assets/icons/mark-' +
          p.n +
          '.png" alt="">' +
          '<span class="meta"><strong>Mark ' +
          p.n +
          " · " +
          escapeHtml(p.kicker) +
          "</strong><span>" +
          escapeHtml(status) +
          "</span></span></button>"
        );
      })
      .join("");

    const extras = [];
    if (allSolved() && !state.envelopeDone) {
      extras.push(
        '<button type="button" class="btn-gold" data-go="envelope">The envelope is waiting</button>'
      );
    } else if (state.envelopeDone && !state.doorOpened) {
      extras.push(
        '<button type="button" class="btn-gold" data-go="keypad">Back to the door</button>'
      );
    } else if (state.doorOpened) {
      extras.push(
        '<button type="button" class="btn-gold" data-go="ending">The open door</button>'
      );
    }

    return (
      '<section class="screen map-screen">' +
      '<div class="map-head"><div>' +
      '<p class="kicker">The story map</p>' +
      "<h2 style=\"font-family:'Playfair Display',Georgia,serif;font-style:italic;font-weight:400;margin:0 0 .2rem;color:var(--brown)\">WA Shipwrecks Museum</h2>" +
      '<p class="exhibit">Cliff Street, Fremantle / Walyalup. Room names are real. This is not the museum’s official evacuation plan.</p>' +
      "</div></div>" +
      '<div class="map-desk">' +
      '<div class="map-board" aria-label="Story map of the museum">' +
      '<img class="plan" src="assets/images/story-map-plan.jpg" alt="A simplified story map of the WA Shipwrecks Museum, with a ground floor and a Level 1, and eight picture marks for the trail.">' +
      pins +
      "</div>" +
      '<div class="mark-grid">' +
      list +
      "</div></div>" +
      (extras.length ? '<div class="map-extras">' + extras.join("") + "</div>" : "") +
      '<p class="map-caption">This is a story map. Room names are real. Paths are simplified. It is not the museum’s official evacuation plan. Do the eight marks in order. The letters you collect are not yet the word for the door. Stay together.</p></section>'
    );
  }


  const PUZZLE_PROMPTS = {
    1: "In which city was the ship built? Write the city, nine letters. Then take letter number 6.",
    2: "A typographic line — not a photograph of the journal — says the moon was ______ and clear. Unscramble the missing word. Take the first letter.",
    3: "Write the five-letter word for the thing they needed, and could not find, on those first islands. Take the first letter.",
    4: "Write the one-word name for the ship’s biggest boat — eight letters. Take the first letter.",
    5: "On a higher island they ______ for a long time. What is the missing word? Take the second letter.",
    6: "A man from the higher island reached the rescue ship first. What was his name, five letters? Take the first letter.",
    7: "On which day of the week does the journal open? Take the second letter.",
    8: "You are looking at the back of the ship. What is the name for the back of a ship? Take the first letter."
  };

  function renderPuzzle() {
    const p = S.puzzles.find((x) => x.n === state.puzzle);
    if (!p) return renderMap();
    const solved = state.solved.includes(p.n);
    const alt = "Illustration for mark " + p.n + ", " + p.kicker + ".";
    return (
      '<section class="screen puzzle-screen">' +
      '<p class="kicker">Mark ' +
      p.n +
      " · " +
      escapeHtml(p.kicker) +
      "</p>" +
      '<p class="exhibit">' +
      escapeHtml(p.exhibit) +
      "</p>" +
      '<div class="puzzle-body">' +
      art(p.image, alt) +
      '<div class="story">' +
      verseHTML(p.text) +
      "</div>" +
      '<div class="card interact" id="interact">' +
      "<h3>" +
      escapeHtml(p.card_title) +
      "</h3>" +
      "<p>" +
      escapeHtml(PUZZLE_PROMPTS[p.n]) +
      "</p>" +
      '<div id="puzzle-ui"></div>' +
      '<p class="feedback" id="feedback" aria-live="polite"></p>' +
      (solved ? letterWonHTML(p) : "") +
      '<div class="hint-row">' +
      (solved
        ? '<button type="button" class="btn-gold" data-action="after-puzzle">Back to the map</button>'
        : '<button type="button" class="btn" data-action="check">Try this</button>' +
          '<button type="button" class="btn-ghost" data-action="hint">Need a hint?</button>') +
      "</div>" +
      '<p class="hint-text" id="hint-text"' +
      (state.hints[p.n] ? "" : " hidden") +
      ">" +
      escapeHtml(p.hint) +
      "</p>" +
      "</div></div></section>"
    );
  }

  function letterWonHTML(p) {
    const nth =
      p.n === 1
        ? "the sixth letter"
        : p.how.toLowerCase().indexOf("second") >= 0
        ? "the second letter"
        : "the first letter";
    return (
      '<div class="letter-won" id="letter-won">' +
      '<div class="big">' +
      escapeHtml(p.char) +
      "</div>" +
      "<div><strong>That’s it.</strong> " +
      escapeHtml(p.answer_word) +
      " — take " +
      nth +
      ". Put the letter " +
      escapeHtml(p.char) +
      " in box " +
      p.n +
      ".</div></div>"
    );
  }

  function renderEnvelope() {
    const st = S.strange;
    return (
      '<section class="screen spread">' +
      '<div class="envelope-wrap">' +
      '<p class="kicker">' +
      escapeHtml(st.kicker) +
      "</p>" +
      '<button type="button" class="envelope' +
      (state.envelopeOpened ? " open" : "") +
      '" id="envelope" aria-expanded="' +
      (state.envelopeOpened ? "true" : "false") +
      '" aria-label="A brown envelope. Tap to open.">' +
      '<span class="back"></span>' +
      '<div class="note">Two were set ashore.<br>W.L.&nbsp;&nbsp;&nbsp;J.P.<br>Mid-November 1629.<br>After that the records stop.<br><div class="button-token" title="A dull brass button"></div></div>' +
      '<span class="flap"></span><span class="front"></span>' +
      "</button>" +
      (!state.envelopeOpened
        ? "<p class=\"exhibit\">Phoebe takes the envelope from behind the map.</p>"
        : "") +
      "</div>" +
      "<div>" +
      (state.envelopeOpened
        ? verseHTML(st.text) +
          '<div class="actions"><button type="button" class="btn-gold" data-action="leave-envelope">Leave it on the desk, and go to the door</button></div>'
        : "<p class=\"lead\">A brown envelope was tucked at the corner of the map, as if it did not quite belong.</p>") +
      "</div></section>"
    );
  }

  function renderKeypad() {
    const e = S.ending;
    const collected = state.letters.join(" ");
    const showUnscramble = state.jumbleTried && !state.unscrambled && !state.doorOpened;
    const buffer = keypadBuffer || (state.jumbleTried ? "" : state.letters.join(""));
    if (!keypadBuffer && !state.jumbleTried) keypadBuffer = state.letters.join("");

    const slots = [];
    for (let i = 0; i < 8; i++) {
      slots.push("<span>" + escapeHtml((keypadBuffer || "")[i] || "") + "</span>");
    }
    const keys = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
      .split("")
      .map((ch) => '<button type="button" data-key="' + ch + '">' + ch + "</button>")
      .join("");

    const layoutCls = "keypad-layout" + (showUnscramble ? " unscramble-mode" : "");
    return (
      '<section class="screen keypad-screen">' +
      '<p class="kicker">' +
      escapeHtml(e.kicker) +
      "</p>" +
      '<div class="' + layoutCls + '">' +
      "<div>" +
      art("keypad", "A keypad by a still-locked glass door at night. Four children stand before it, seen from behind.") +
      '<div class="' + (showUnscramble ? "keypad-verse-short" : "") + '">' +
      verseHTML(e.text) +
      "</div></div><div>" +
      '<div class="lock-panel" id="lock-panel">' +
      "<h3>The door</h3>" +
      '<p style="margin:0 0 .6rem;font-style:italic;opacity:.85">Letters as you found them: ' +
      escapeHtml(collected) +
      "</p>" +
      '<div class="lock-slots" aria-label="Letters typed at the door">' +
      slots.join("") +
      "</div>" +
      (showUnscramble
        ? '<button type="button" class="letter-toggle" id="toggle-keys">Type at the keypad instead</button>'
        : "") +
      '<div class="keys' + (showUnscramble ? "" : "") + '" id="keys"' +
      (showUnscramble ? " hidden" : "") +
      ">" +
      keys +
      '<button type="button" class="wide" data-key="DEL">Delete</button>' +
      '<button type="button" class="wide" data-key="CLR">Clear</button>' +
      '<button type="button" class="wide" data-key="TRY">Try the lock</button>' +
      "</div></div>" +
      (showUnscramble
        ? '<div class="card" style="margin-top:.8rem"><h3>' +
          escapeHtml(e.card_title) +
          "</h3>" +
          "<p>The lock will not open for the letters in the order you found them. They make one word: the old name of the islands where the ship struck.</p>" +
          '<div class="chart-clue"><strong>Houtman</strong> <span class="blank">_ _ _ _ _ _ _ _</span><br><span style="font-style:italic;font-size:.95rem">eight letters · the old name of the islands where the ship struck</span></div>' +
          '<div id="unscramble-ui"></div>' +
          '<p class="feedback" id="feedback" aria-live="polite"></p>' +
          '<div class="hint-row"><button type="button" class="btn-ghost" data-action="hint-door">Need a hint?</button></div>' +
          '<p class="hint-text" id="hint-text"' +
          (state.hints.door ? "" : " hidden") +
          ">" +
          escapeHtml(e.hint) +
          "</p></div>"
        : "") +
      "</div></div></section>"
    );
  }

  function renderEnding() {
    const e = S.ending;
    const openClass = state.doorOpened ? " open" : "";
    return (
      '<section class="screen ending-screen">' +
      '<p class="kicker">Cliff Street</p>' +
      '<div class="ending-grid">' +
      '<div class="door-stage' +
      openClass +
      '" id="door-stage">' +
      '<img class="street" src="assets/images/door.jpg" alt="The door stands open onto Cliff Street at night. A bright, clear moon hangs over the harbour. Four children walk out, seen from behind.">' +
      '<div class="door-leaf"><img src="assets/images/keypad.jpg" alt=""></div>' +
      "</div>" +
      '<div class="ending-copy">' +
      verseHTML(e.close.slice(0, e.close.indexOf('What can the records') >= 0 ? e.close.indexOf('What can the records') : e.close.length).filter((line,i,a) => !(i===a.length-1 && line===''))) +
      '<p class="ending-q">What can the records still not tell us?</p>' +
      '<p>The file is still open. You can look further in the case that sits with this story.</p>' +
      '<p><a class="case-link" href="' +
      escapeHtml(S.caseUrl) +
      '" target="_blank" rel="noopener">Open the Batavia case</a></p>' +
      '<div class="actions">' +
      '<button type="button" class="btn" data-go="map">Back to the story map</button>' +
      '<button type="button" class="btn-ghost" data-go="teachers">Answers &amp; Author’s Note</button>' +
      "</div></div></div></section>"
    );
  }

  function renderHowto() {
    const c = S.teacherCard;
    const hooks = c.hooks
      .map((h, i) => "<li><strong>" + (i + 1) + ".</strong> " + escapeHtml(h) + "</li>")
      .join("");
    return (
      '<section class="screen howto">' +
      '<p class="kicker">' +
      escapeHtml(c.kicker) +
      "</p>" +
      "<h1>" +
      escapeHtml(c.title) +
      "</h1>" +
      "<p>" +
      escapeHtml(c.intro) +
      "</p>" +
      "<h2>" +
      escapeHtml(c.questionLabel) +
      "</h2>" +
      '<p class="big-q">' +
      escapeHtml(c.question) +
      "</p>" +
      "<h2>" +
      escapeHtml(c.hooksLabel) +
      "</h2>" +
      "<ol>" +
      hooks +
      "</ol>" +
      "<h2>" +
      escapeHtml(c.trailLabel) +
      "</h2>" +
      "<p>" +
      escapeHtml(c.trail) +
      "</p>" +
      "<h2>" +
      escapeHtml(c.debriefLabel) +
      "</h2>" +
      "<p>" +
      escapeHtml(c.debrief) +
      "</p>" +
      "<p>" +
      escapeHtml(c.caseLine) +
      ' <a class="case-link" href="' +
      escapeHtml(c.caseUrl) +
      '" target="_blank" rel="noopener">' +
      escapeHtml(c.caseUrl) +
      "</a></p>" +
      '<div class="qr-block"><img src="assets/images/qr-map.png" alt="QR code with a folded story map and a you-are-here mark, linking to the escape-room story.">' +
      "<p>Scan to open the escape-room story<br><a class=\"case-link\" href=\"https://robmac10.github.io/batavia-escape-room/\" target=\"_blank\" rel=\"noopener\">robmac10.github.io/batavia-escape-room</a></p></div>" +
      '<div class="actions">' +
      '<button type="button" class="btn" data-go="teachers">Answers &amp; Author’s Note</button>' +
      '<button type="button" class="btn-ghost" data-go="title">Back</button>' +
      "</div></section>"
    );
  }

  function renderTeachers() {
    const answers = S.answers.map((a) => "<li>" + escapeHtml(a) + "</li>").join("");
    const code = S.answersCode.map((p) => "<p>" + escapeHtml(p) + "</p>").join("");
    const notes = S.noteParas.map((p) => "<p>" + escapeHtml(p) + "</p>").join("");
    const intro = S.answersIntro.map((p) => "<p>" + escapeHtml(p) + "</p>").join("");
    return (
      '<section class="screen teachers">' +
      "<h1>Answers &amp; Author’s Note</h1>" +
      '<p class="exhibit">For teachers, and for anyone who has already tried the puzzles.</p>' +
      '<div class="warn">' +
      intro +
      "</div>" +
      "<h2>Answers</h2>" +
      "<ol style=\"padding-left:1.1rem;list-style:none\">" +
      answers +
      "</ol>" +
      code +
      "<h2>" +
      escapeHtml(S.noteTitle) +
      "</h2>" +
      notes +
      '<p><a class="case-link" href="' +
      escapeHtml(S.caseUrl) +
      '" target="_blank" rel="noopener">The interactive case: ' +
      escapeHtml(S.caseUrl) +
      "</a></p>" +
      '<div class="actions"><button type="button" class="btn" data-go="title">Back</button></div>' +
      "</section>"
    );
  }

  /* ---------- puzzle UIs ---------- */
  function mountPuzzleUI() {
    const p = S.puzzles.find((x) => x.n === state.puzzle);
    if (!p) return;
    const root = $("#puzzle-ui");
    if (!root) return;
    if (p.n === 2) {
      mountAnagram(root, "TIGHBR".split(""), "BRIGHT", "bright-board");
    } else if (p.n === 7) {
      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      root.innerHTML =
        '<div class="days" role="group" aria-label="Days of the week">' +
        days
          .map(
            (d) =>
              '<button type="button" class="day-btn" data-day="' +
              d.toUpperCase() +
              '">' +
              d +
              "</button>"
          )
          .join("") +
        "</div>";
    } else if (p.n === 8) {
      root.innerHTML =
        '<div class="ship-chart">' +
        '<p class="prompt">Tap the back of the ship.</p>' +
        '<svg class="ship" viewBox="0 0 420 160" role="img" aria-label="A simple plan of a ship, with the front, the middle, and the back to choose from.">' +
        '<text x="70" y="22">front (bow)</text>' +
        '<text x="200" y="22">middle</text>' +
        '<text x="320" y="22">back (stern)</text>' +
        '<g>' +
        '<button type="button" data-part="BOW"><polygon points="20,80 110,40 110,130" /></button>' +
        "</g></svg>" +
        '<div class="ship-btns" style="display:flex;gap:.5rem;flex-wrap:wrap;justify-content:center">' +
        '<button type="button" class="choice-btn" data-part="BOW">Bow (front)</button>' +
        '<button type="button" class="choice-btn" data-part="MID">Middle</button>' +
        '<button type="button" class="choice-btn" data-part="STERN">Stern (back)</button>' +
        "</div></div>";
      // Replace incomplete SVG with a proper one
      root.querySelector("svg").innerHTML =
        '<text x="55" y="24">front (bow)</text>' +
        '<text x="185" y="24">middle</text>' +
        '<text x="310" y="24">back (stern)</text>' +
        '<polygon class="part" data-part="BOW" points="20,90 120,45 120,135" fill="#F4EDE0" stroke="#2B221C" stroke-width="2" tabindex="0" role="button" aria-label="Bow, the front of the ship"></polygon>' +
        '<rect class="part" data-part="MID" x="120" y="45" width="140" height="90" fill="#F4EDE0" stroke="#2B221C" stroke-width="2" tabindex="0" role="button" aria-label="The middle of the ship"></rect>' +
        '<polygon class="part" data-part="STERN" points="260,45 400,55 400,125 260,135" fill="#F4EDE0" stroke="#2B221C" stroke-width="2" tabindex="0" role="button" aria-label="Stern, the back of the ship"></polygon>' +
        '<line x1="40" y1="90" x2="20" y2="70" stroke="#2B221C" stroke-width="2"></line>' +
        '<circle cx="70" cy="90" r="0"></circle>';
    } else if (p.n === 1) {
      root.innerHTML =
        '<p class="prompt">In which city was the ship built?</p>' +
        '<div class="type-row"><input type="text" id="answer-input" maxlength="20" autocomplete="off" spellcheck="false" aria-label="The city, nine letters" placeholder="Nine letters"></div>';
    } else if (p.n === 3) {
      mountPattern(root, "__T__", "WATER");
    } else if (p.n === 4) {
      mountPattern(root, "L_NGB_AT", "LONGBOAT");
    } else if (p.n === 5) {
      mountPattern(root, "_OOKED", "LOOKED");
    } else if (p.n === 6) {
      root.innerHTML =
        '<p class="prompt">What was his name? Five letters, as he is often known.</p>' +
        '<div class="type-row"><input type="text" id="answer-input" maxlength="24" autocomplete="off" spellcheck="false" aria-label="His name" placeholder="H _ Y E S"></div>';
    }
    if (state.solved.includes(p.n)) lockPuzzleUI();
  }

  function mountPattern(root, pattern, answer) {
    const slots = pattern
      .split("")
      .map((ch, i) => {
        if (ch === "_") {
          return (
            '<input class="slot" data-i="' +
            i +
            '" maxlength="1" aria-label="Letter ' +
            (i + 1) +
            '" autocomplete="off" spellcheck="false">'
          );
        }
        return '<span class="slot locked" data-i="' + i + '">' + ch + "</span>";
      })
      .join("");
    root.innerHTML =
      '<div class="word-input" id="pattern-board" data-answer="' +
      answer +
      '">' +
      slots +
      "</div>";
  }

  function readPattern(root) {
    const board = $("#pattern-board", root) || $("#pattern-board");
    if (!board) return "";
    const chars = [];
    Array.from(board.children).forEach((el) => {
      if (el.tagName === "INPUT") chars.push((el.value || "").toUpperCase());
      else chars.push((el.textContent || "").toUpperCase());
    });
    return chars.join("");
  }

  function mountAnagram(root, letters, answer, id) {
    const shuffled = letters.slice();
    // stable-enough shuffle so TIGHBR (book order) is used for puzzle 2
    const pool = shuffled
      .map((ch, i) => {
        return (
          '<button type="button" class="tile" draggable="true" data-ch="' +
          ch +
          '" data-id="' +
          i +
          '">' +
          ch +
          "</button>"
        );
      })
      .join("");
    const slots = answer
      .split("")
      .map((_, i) => '<button type="button" class="slot" data-slot="' + i + '" aria-label="Place letter ' + (i + 1) + '"></button>')
      .join("");
    root.innerHTML =
      '<p class="prompt">Drag the letters, or tap a letter and then a box, to make the word.</p>' +
      '<div class="slots" id="' +
      id +
      '-slots">' +
      slots +
      "</div>" +
      '<div class="pool" id="' +
      id +
      '-pool">' +
      pool +
      "</div>";
    bindAnagram(root, answer, id);
  }

  function bindAnagram(root, answer, id) {
    const slots = $("#" + id + "-slots", root) || $("#" + id + "-slots");
    const pool = $("#" + id + "-pool", root) || $("#" + id + "-pool");
    if (!slots || !pool) return;
    let held = null;

    function placedWord() {
      return $$(".slot", slots)
        .map((s) => s.dataset.ch || "")
        .join("");
    }
    function place(tile, slot) {
      if (!tile || !slot) return;
      if (slot.dataset.tid) {
        const old = pool.querySelector('[data-id="' + slot.dataset.tid + '"]');
        if (old) old.classList.remove("used");
      }
      tile.classList.add("used");
      slot.classList.add("filled");
      slot.textContent = tile.dataset.ch;
      slot.dataset.ch = tile.dataset.ch;
      slot.dataset.tid = tile.dataset.id;
      held = null;
      $$(".tile", pool).forEach((t) => t.classList.remove("active"));
      maybeAuto();
    }
    function clearSlot(slot) {
      if (!slot.dataset.tid) return;
      const old = pool.querySelector('[data-id="' + slot.dataset.tid + '"]');
      if (old) old.classList.remove("used");
      slot.classList.remove("filled");
      slot.textContent = "";
      delete slot.dataset.ch;
      delete slot.dataset.tid;
    }
    function maybeAuto() {
      const word = placedWord();
      if (word.length === answer.length) {
        if (word === answer) {
          if (id === "door-board") succeedDoor();
          else succeedPuzzle();
        } else {
          setFeedback("Not that word — try a different order.", "no");
        }
      }
    }

    pool.addEventListener("click", (ev) => {
      const tile = ev.target.closest(".tile");
      if (!tile || tile.classList.contains("used")) return;
      $$(".tile", pool).forEach((t) => t.classList.remove("active"));
      tile.classList.add("active");
      held = tile;
    });
    slots.addEventListener("click", (ev) => {
      const slot = ev.target.closest(".slot");
      if (!slot) return;
      if (held) {
        place(held, slot);
      } else if (slot.dataset.tid) {
        clearSlot(slot);
      }
    });

    // drag
    let dragTile = null;
    pool.addEventListener("dragstart", (ev) => {
      const tile = ev.target.closest(".tile");
      if (!tile || tile.classList.contains("used")) return;
      dragTile = tile;
      ev.dataTransfer.setData("text/plain", tile.dataset.id);
      ev.dataTransfer.effectAllowed = "move";
    });
    slots.addEventListener("dragover", (ev) => {
      ev.preventDefault();
    });
    slots.addEventListener("drop", (ev) => {
      ev.preventDefault();
      const slot = ev.target.closest(".slot");
      if (slot && dragTile) place(dragTile, slot);
      dragTile = null;
    });

    // pointer drag for touch (visual)
    let pointerTile = null;
    pool.addEventListener("pointerdown", (ev) => {
      const tile = ev.target.closest(".tile");
      if (!tile || tile.classList.contains("used")) return;
      pointerTile = tile;
    });
    document.addEventListener("pointerup", (ev) => {
      if (!pointerTile) return;
      const slot = document.elementFromPoint(ev.clientX, ev.clientY);
      const s = slot && slot.closest && slot.closest("#" + id + "-slots .slot");
      if (s) place(pointerTile, s);
      pointerTile = null;
    });
  }

  function lockPuzzleUI() {
    $$("#puzzle-ui input, #puzzle-ui button, #puzzle-ui .part").forEach((el) => {
      el.disabled = true;
    });
  }

  function setFeedback(msg, kind) {
    const el = $("#feedback");
    if (!el) return;
    el.textContent = msg;
    el.className = "feedback" + (kind ? " " + kind : "");
  }

  function normalise(s) {
    return String(s || "")
      .toUpperCase()
      .replace(/[^A-Z]/g, "");
  }

  function checkPuzzle() {
    const p = S.puzzles.find((x) => x.n === state.puzzle);
    if (!p || state.solved.includes(p.n)) return;
    let got = "";
    if (p.n === 2) {
      got = $$("#bright-board-slots .slot")
        .map((s) => s.dataset.ch || "")
        .join("");
    } else if (p.n === 7) {
      const sel = $(".day-btn[aria-pressed='true']");
      got = sel ? sel.dataset.day : "";
    } else if (p.n === 8) {
      const sel = $(".choice-btn[aria-pressed='true'], .part.chosen");
      got = sel ? sel.dataset.part : "";
    } else if (p.n === 1) {
      got = normalise($("#answer-input") && $("#answer-input").value);
    } else if (p.n === 6) {
      got = normalise($("#answer-input") && $("#answer-input").value);
    } else {
      got = readPattern();
    }

    const ok = isCorrect(p, got);
    if (ok) succeedPuzzle();
    else setFeedback("Not that — have another look, or try the hint.", "no");
  }

  function isCorrect(p, got) {
    const g = normalise(got);
    if (p.n === 1) return g === "AMSTERDAM";
    if (p.n === 2) return g === "BRIGHT";
    if (p.n === 3) return g === "WATER";
    if (p.n === 4) return g === "LONGBOAT";
    if (p.n === 5) return g === "LOOKED";
    if (p.n === 6) {
      return g === "HAYES" || g === "HAIJES" || g === "WIEBBEHAYES" || g === "WIEBBEHAIJES" || g === "WIEBBEHAIJES" || g === "WIEBBEHAIJES";
    }
    if (p.n === 7) return g === "MONDAY";
    if (p.n === 8) return g === "STERN";
    return false;
  }

  function succeedPuzzle() {
    const p = S.puzzles.find((x) => x.n === state.puzzle);
    if (!p || state.solved.includes(p.n)) return;
    state.solved.push(p.n);
    state.solved.sort((a, b) => a - b);
    state.letters[p.n - 1] = p.char;
    state.hints[p.n] = state.hints[p.n] || false;
    save();
    setFeedback("That’s it.", "ok");
    // re-render puzzle in solved state, keep place
    const y = window.scrollY;
    render();
    window.scrollTo(0, y);
  }

  function afterPuzzle() {
    if (allSolved() && !state.envelopeDone) go("envelope");
    else go("map");
  }

  function succeedDoor() {
    state.unscrambled = true;
    state.doorOpened = true;
    save();
    go("ending");
  }

  function tryLock() {
    const typed = normalise(keypadBuffer).slice(0, 8);
    const panel = $("#lock-panel");
    if (typed === S.passcode) {
      succeedDoor();
      return;
    }
    if (typed === S.jumble || typed === state.letters.join("")) {
      state.jumbleTried = true;
      save();
      if (panel) panel.classList.add("shake");
      setTimeout(() => {
        render();
        setFeedback("The lock said nothing at all.", "no");
      }, 450);
      return;
    }
    if (panel) panel.classList.add("shake");
    setTimeout(() => panel && panel.classList.remove("shake"), 450);
    // If they haven't tried the jumble, gently nudge
    if (!state.jumbleTried) {
      setFeedback("That isn’t the word. Try the letters as you found them first.", "no");
    } else {
      setFeedback("The lock said nothing at all. Try rearranging the letters.", "no");
    }
    // need a feedback node on keypad even before unscramble card
    if (!$("#feedback")) {
      const p = document.createElement("p");
      p.className = "feedback no";
      p.id = "key-feedback";
      p.textContent = $("#feedback") ? "" : (state.jumbleTried
        ? "The lock said nothing at all."
        : "The lock said nothing at all.");
      panel && panel.appendChild(p);
    }
  }

  /* ---------- modal / restart ---------- */
  function askRestart() {
    const root = $("#modal-root");
    root.innerHTML =
      '<div class="modal-back" id="modal-back" role="dialog" aria-modal="true" aria-labelledby="rst-title">' +
      '<div class="modal"><h2 id="rst-title">Start the night again?</h2>' +
      "<p>This will erase the letters you have collected, and begin at the closing bell.</p>" +
      '<div class="actions"><button type="button" class="btn-gold" id="rst-yes">Start again</button>' +
      '<button type="button" class="btn" id="rst-no">Keep going</button></div>' +
      "</div></div>";
    $("#rst-yes").onclick = () => {
      root.innerHTML = "";
      doRestart();
    };
    $("#rst-no").onclick = () => {
      root.innerHTML = "";
    };
    $("#modal-back").addEventListener("click", (ev) => {
      if (ev.target.id === "modal-back") root.innerHTML = "";
    });
  }

  function doRestart() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {}
    state = defaultState();
    keypadBuffer = "";
    go("title");
  }

  function continueNight() {
    if (state.doorOpened) go("ending");
    else if (state.envelopeDone) go("keypad");
    else if (allSolved()) go("envelope");
    else if (state.seenLocked) go("map");
    else if (state.seenOpening) go("locked");
    else go("opening");
  }

  /* ---------- bind / render ---------- */
  function bind() {
    $$("[data-go]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const dest = btn.getAttribute("data-go");
        if (dest === "continue") continueNight();
        else if (dest === "opening") {
          state.seenOpening = true;
          go("opening");
        } else if (dest === "locked") {
          state.seenOpening = true;
          go("locked");
        } else if (dest === "envelope") {
          go("envelope");
        } else if (dest === "keypad") {
          keypadBuffer = state.jumbleTried ? keypadBuffer || "" : state.letters.join("");
          go("keypad");
        } else {
          go(dest);
        }
      });
    });

    $$("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const a = btn.getAttribute("data-action");
        if (a === "open-map") {
          state.seenOpening = true;
          state.seenLocked = true;
          go("map");
        } else if (a === "restart-ask") askRestart();
        else if (a === "check") checkPuzzle();
        else if (a === "hint") {
          state.hints[state.puzzle] = true;
          save();
          const h = $("#hint-text");
          if (h) h.hidden = false;
        } else if (a === "hint-door") {
          state.hints.door = true;
          save();
          const h = $("#hint-text");
          if (h) h.hidden = false;
        } else if (a === "after-puzzle") afterPuzzle();
        else if (a === "leave-envelope") {
          state.envelopeOpened = true;
          state.envelopeDone = true;
          keypadBuffer = state.letters.join("");
          go("keypad");
        }
      });
    });

    $$("[data-mark]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const n = Number(btn.getAttribute("data-mark"));
        if (!unlocked(n)) return;
        go("puzzle", { puzzle: n });
      });
    });

    if (state.screen === "puzzle") {
      mountPuzzleUI();
      const input = $("#answer-input");
      if (input) {
        input.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") checkPuzzle();
        });
      }
      const board = $("#pattern-board");
      if (board) {
        $$("input.slot", board).forEach((inp, idx, all) => {
          inp.addEventListener("input", () => {
            inp.value = (inp.value || "").replace(/[^a-zA-Z]/g, "").slice(-1).toUpperCase();
            if (inp.value && all[idx + 1]) all[idx + 1].focus();
          });
          inp.addEventListener("keydown", (ev) => {
            if (ev.key === "Backspace" && !inp.value && all[idx - 1]) {
              all[idx - 1].focus();
            } else if (ev.key === "Enter") checkPuzzle();
          });
        });
      }
      $$(".day-btn").forEach((b) => {
        b.addEventListener("click", () => {
          $$(".day-btn").forEach((x) => x.setAttribute("aria-pressed", "false"));
          b.setAttribute("aria-pressed", "true");
          if (b.dataset.day === "MONDAY") checkPuzzle();
          else setFeedback("Not that day — look at the typographic page again.", "no");
        });
      });
      $$(".choice-btn, .part").forEach((b) => {
        b.addEventListener("click", () => {
          $$(".choice-btn").forEach((x) => x.setAttribute("aria-pressed", "false"));
          $$(".part").forEach((x) => x.classList.remove("chosen"));
          b.setAttribute && b.setAttribute("aria-pressed", "true");
          b.classList && b.classList.add("chosen");
          checkPuzzle();
        });
      });
    }

    if (state.screen === "envelope") {
      const env = $("#envelope");
      if (env) {
        env.addEventListener("click", () => {
          if (state.envelopeOpened) return;
          state.envelopeOpened = true;
          save();
          render();
        });
      }
    }

    if (state.screen === "keypad") {
      const tog = $("#toggle-keys");
      if (tog) {
        tog.addEventListener("click", () => {
          const keys = $("#keys");
          const show = keys.hasAttribute("hidden");
          if (show) keys.removeAttribute("hidden");
          else keys.setAttribute("hidden", "");
          tog.textContent = show ? "Hide the keypad" : "Type at the keypad instead";
        });
      }
      $("#keys") &&
        $("#keys").addEventListener("click", (ev) => {
          const b = ev.target.closest("button");
          if (!b) return;
          const k = b.dataset.key;
          if (k === "DEL") keypadBuffer = keypadBuffer.slice(0, -1);
          else if (k === "CLR") keypadBuffer = "";
          else if (k === "TRY") {
            tryLock();
            return;
          } else if (k && k.length === 1) {
            if (keypadBuffer.length < 8) keypadBuffer += k;
          }
          // refresh slots only
          const slots = $$(".lock-slots span");
          slots.forEach((el, i) => {
            el.textContent = keypadBuffer[i] || "";
          });
        });
      if (state.jumbleTried && !state.doorOpened) {
        const host = $("#unscramble-ui");
        if (host) {
          // Use the collected letters (RBALOHOS) as tiles
          const letters = (state.letters.join("") || S.jumble).split("");
          mountAnagram(host, letters, S.passcode, "door-board");
        }
      }
    }

    if (state.screen === "ending") {
      const stage = $("#door-stage");
      if (stage && !stage.classList.contains("open")) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            stage.classList.add("open");
            state.doorOpened = true;
            state.unscrambled = true;
            save();
            renderTray();
          });
        });
      }
    }
  }

  function render() {
    renderHeader();
    renderTray();
    const stage = $("#stage");
    const sc = state.screen;
    if (sc === "title") stage.innerHTML = renderTitle();
    else if (sc === "opening") stage.innerHTML = renderOpening();
    else if (sc === "locked") stage.innerHTML = renderLocked();
    else if (sc === "map") stage.innerHTML = renderMap();
    else if (sc === "puzzle") stage.innerHTML = renderPuzzle();
    else if (sc === "envelope") stage.innerHTML = renderEnvelope();
    else if (sc === "keypad") stage.innerHTML = renderKeypad();
    else if (sc === "ending") stage.innerHTML = renderEnding();
    else if (sc === "howto") stage.innerHTML = renderHowto();
    else if (sc === "teachers") stage.innerHTML = renderTeachers();
    else stage.innerHTML = renderTitle();
    bind();
  }

  /* ---------- chrome ---------- */
  $("#btn-menu").addEventListener("click", (ev) => {
    ev.stopPropagation();
    const menu = $("#menu");
    const open = menu.hidden;
    menu.hidden = !open;
    $("#btn-menu").setAttribute("aria-expanded", open ? "true" : "false");
  });
  $("#btn-map").addEventListener("click", () => go("map"));
  $("#btn-restart").addEventListener("click", () => {
    closeMenu();
    askRestart();
  });
  document.addEventListener("click", (ev) => {
    const menu = $("#menu");
    if (!menu.hidden && !menu.contains(ev.target) && ev.target !== $("#btn-menu")) {
      closeMenu();
    }
  });
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") {
      closeMenu();
      $("#modal-root").innerHTML = "";
    }
  });

  /* ---------- screenshot seeding (no visible cheat UI) ---------- */
  function applyShot() {
    const params = new URLSearchParams(location.search);
    const shot = params.get("shot");
    if (!shot) return;
    const s = defaultState();
    s.seenOpening = true;
    s.seenLocked = true;
    if (shot === "map") {
      s.solved = [1, 2, 3];
      s.letters = ["R", "B", "A", "", "", "", "", ""];
      s.screen = "map";
    } else if (shot === "puzzle") {
      s.solved = [1];
      s.letters = ["R", "", "", "", "", "", "", ""];
      s.screen = "puzzle";
      s.puzzle = 2;
    } else if (shot === "keypad") {
      s.solved = [1, 2, 3, 4, 5, 6, 7, 8];
      s.letters = S.jumble.split("");
      s.envelopeOpened = true;
      s.envelopeDone = true;
      s.jumbleTried = true;
      s.hints.door = true;
      s.screen = "keypad";
      keypadBuffer = "";
    } else if (shot === "door") {
      s.solved = [1, 2, 3, 4, 5, 6, 7, 8];
      s.letters = S.jumble.split("");
      s.envelopeOpened = true;
      s.envelopeDone = true;
      s.jumbleTried = true;
      s.unscrambled = true;
      s.doorOpened = true;
      s.screen = "ending";
    } else {
      return;
    }
    state = s;
  }

  applyShot();
  render();
})();
