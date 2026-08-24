(function () {
  "use strict";

  var root = document.getElementById("elevator-game");
  if (!root) return;

  var C = {
    floors: 10, capacity: 6, maxMisses: 5, simRate: 10,
    patience: 300, floorTravel: 1, dwell: 0.72, shiftSeconds: 14400,
    unlocks: [0, 25, 75, 150], storage: "nolandElevatorGame."
  };
  var achievementDefs = [
    ["first", "First Ride", "Deliver one passenger."],
    ["busy", "Getting Busy", "Deliver 25 passengers."],
    ["double", "Double Service", "Unlock Elevator 2."],
    ["triple", "Triple Service", "Unlock Elevator 3."],
    ["full", "Full Bank", "Unlock all four elevators."],
    ["century", "Century", "Deliver 100 passengers."],
    ["perfect", "No One Left Behind", "Clear a shift without a miss."],
    ["rush", "Rush Hour Pro", "Finish a rush with no one giving up."]
  ];
  var state;
  var raf = 0;
  var lastFrame = 0;
  var passengerId = 0;
  var rngState = 1;
  var audioContext = null;
  var storage = {
    best: readNumber("best", 0),
    sound: readBoolean("sound", false),
    achievements: readArray("achievements")
  };

  var el = {};
  ["start", "play", "score", "waiting", "misses", "best", "clock", "phase", "shift",
    "next-unlock", "building", "elevator-cards", "achievement-count", "sound", "live",
    "toasts", "pause-overlay", "pause-reason", "gameover", "new-best", "final-score",
    "final-time", "final-missed", "final-elevators", "help", "achievements",
    "achievement-list", "restart-confirm", "intro-best"].forEach(function (name) {
      el[name] = document.getElementById("eg-" + name);
    });

  function readRaw(key) {
    try { return localStorage.getItem(C.storage + key); } catch (_) { return null; }
  }
  function writeRaw(key, value) {
    try { localStorage.setItem(C.storage + key, value); } catch (_) {}
  }
  function readNumber(key, fallback) {
    var value = Number(readRaw(key));
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
  }
  function readBoolean(key, fallback) {
    var value = readRaw(key);
    return value === "true" ? true : value === "false" ? false : fallback;
  }
  function readArray(key) {
    try {
      var value = JSON.parse(readRaw(key) || "[]");
      return Array.isArray(value) ? value.filter(function (item) { return typeof item === "string"; }) : [];
    } catch (_) { return []; }
  }
  function saveAchievements() { writeRaw("achievements", JSON.stringify(storage.achievements)); }

  function seededRandom() {
    rngState |= 0;
    rngState = (rngState + 0x6D2B79F5) | 0;
    var t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function randomInt(min, max) { return Math.floor(seededRandom() * (max - min + 1)) + min; }
  function freshElevator(index) {
    return {
      id: index + 1, unlocked: index === 0, position: 1, target: null, direction: 0,
      optional: [], passengers: [], dwellLeft: 0, state: "Idle", justUnlocked: false
    };
  }
  function freshState() {
    rngState = ((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0) || 1;
    passengerId = 0;
    return {
      mode: "playing", paused: false, autoPaused: false, score: 0, misses: 0,
      elapsed: 0, spawnIn: 1.2, selectedElevator: 0, selectedFloor: 1,
      startingBest: storage.best,
      passengers: [], elevators: [0, 1, 2, 3].map(freshElevator),
      phase: "Opening", shift: 1, lastPhase: "Opening", missesAtRushStart: 0,
      missesAtShiftStart: 0, highestElevators: 1, lastRenderedSecond: -1
    };
  }

  function buildBoard() {
    el.building.textContent = "";
    var floors = document.createElement("div");
    floors.className = "eg-floors";
    for (var floor = C.floors; floor >= 1; floor -= 1) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "eg-floor";
      button.dataset.floor = floor;
      button.setAttribute("aria-label", "Floor " + floor + ", assign optional stop");
      var label = document.createElement("span");
      label.className = "eg-floor-label";
      label.textContent = floor === 1 ? "1 · Lobby" : String(floor);
      var queue = document.createElement("span");
      queue.className = "eg-floor-queue";
      queue.id = "eg-floor-queue-" + floor;
      var stops = document.createElement("span");
      stops.className = "eg-floor-stops";
      stops.id = "eg-floor-stops-" + floor;
      button.appendChild(label); button.appendChild(queue); button.appendChild(stops);
      floors.appendChild(button);
    }
    var shafts = document.createElement("div");
    shafts.className = "eg-shafts";
    for (var i = 0; i < 4; i += 1) {
      var shaft = document.createElement("div");
      shaft.className = "eg-shaft";
      shaft.id = "eg-shaft-" + i;
      var car = document.createElement("div");
      car.className = "eg-car eg-car-" + (i + 1);
      car.id = "eg-car-" + i;
      var carLabel = document.createElement("span"); carLabel.textContent = "E" + (i + 1);
      var carCount = document.createElement("small"); carCount.id = "eg-car-count-" + i; carCount.textContent = "0/6";
      var carDoor = document.createElement("i"); carDoor.setAttribute("aria-hidden", "true");
      car.appendChild(carLabel); car.appendChild(carCount); car.appendChild(carDoor);
      shaft.appendChild(car); shafts.appendChild(shaft);
    }
    el.building.appendChild(floors); el.building.appendChild(shafts);
  }

  function startGame() {
    cancelAnimationFrame(raf);
    state = freshState();
    buildBoard();
    el.start.hidden = true; el.play.hidden = false; el.gameover.hidden = true;
    closeAllOverlays();
    renderElevatorCards(); render(true);
    lastFrame = performance.now();
    raf = requestAnimationFrame(frame);
    root.focus({ preventScroll: true });
    announce("Shift started. Elevator 1 is ready at the lobby.");
  }

  function frame(now) {
    if (!state || state.mode !== "playing") return;
    var realDelta = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;
    if (!state.paused) update(realDelta);
    render(false);
    raf = requestAnimationFrame(frame);
  }

  function update(dt) {
    var previousElapsed = state.elapsed;
    state.elapsed += dt * C.simRate;
    updatePhase(previousElapsed);
    state.spawnIn -= dt;
    if (state.spawnIn <= 0) {
      spawnPassenger();
      state.spawnIn = nextSpawnDelay();
    }
    updatePassengers();
    if (state.mode !== "playing") return;
    state.elevators.forEach(function (elevator) { if (elevator.unlocked) updateElevator(elevator, dt); });
  }

  function currentPhase(simSeconds) {
    var within = simSeconds % C.shiftSeconds;
    if (within < 1800) return "Opening";
    if (within < 5400) return "Morning Rush";
    if (within < 10800) return "Normal Traffic";
    if (within < 13800) return "Evening Rush";
    return "Closing";
  }
  function isRush(phase) { return phase.indexOf("Rush") !== -1; }
  function updatePhase(previousElapsed) {
    var nextShift = Math.floor(state.elapsed / C.shiftSeconds) + 1;
    if (nextShift !== state.shift) {
      var clear = waitingPassengers().length === 0 && onboardCount() === 0;
      if (clear && state.misses === state.missesAtShiftStart) {
        unlockAchievement("perfect"); toast("Perfect Shift", "Building cleared with no misses", "success");
      } else toast("Shift " + nextShift, "Demand is increasing", "info");
      state.shift = nextShift; state.missesAtShiftStart = state.misses;
    }
    var phase = currentPhase(state.elapsed);
    if (phase !== state.phase) {
      var endedCleanRush = isRush(state.phase) && state.misses === state.missesAtRushStart;
      if (endedCleanRush) unlockAchievement("rush");
      state.lastPhase = state.phase; state.phase = phase;
      if (isRush(phase)) {
        state.missesAtRushStart = state.misses;
        toast(phase.toUpperCase(), phase === "Morning Rush" ? "Lobby traffic is surging" : "Everyone is heading down", "rush");
        announce(phase + " has begun.");
      } else if (isRush(state.lastPhase)) {
        toast("Rush easing", "Traffic is returning to normal", "info");
      }
    }
  }

  function nextSpawnDelay() {
    var progress = Math.min(state.elapsed / 1800, 1) + Math.min(state.score / 180, 1);
    var base = Math.max(2.4, 5.8 - progress * 1.7 - (state.shift - 1) * 0.25);
    if (isRush(state.phase)) base *= Math.max(0.55, 0.72 - (state.shift - 1) * 0.025);
    return base * (0.78 + seededRandom() * 0.48);
  }
  function spawnPassenger() {
    var origin, destination;
    if (state.phase === "Morning Rush" && seededRandom() < 0.72) {
      origin = 1; destination = randomInt(2, 10);
    } else if (state.phase === "Evening Rush" && seededRandom() < 0.72) {
      origin = randomInt(2, 10); destination = 1;
    } else {
      origin = randomInt(1, 10);
      do { destination = randomInt(1, 10); } while (destination === origin);
    }
    state.passengers.push({
      id: ++passengerId, origin: origin, destination: destination,
      created: state.elapsed, status: "waiting", elevatorId: null
    });
  }
  function updatePassengers() {
    state.passengers.slice().forEach(function (passenger) {
      if (passenger.status !== "waiting") return;
      if (state.elapsed - passenger.created >= C.patience) missPassenger(passenger);
    });
  }
  function missPassenger(passenger) {
    passenger.status = "missed";
    state.passengers = state.passengers.filter(function (item) { return item !== passenger; });
    state.misses += 1;
    toast("Took the stairs", "A rider on Floor " + passenger.origin + " gave up", "danger");
    announce("A passenger on Floor " + passenger.origin + " gave up. " + state.misses + " of 5 misses.");
    if (state.misses >= C.maxMisses) endGame();
  }

  function mandatoryStops(elevator) {
    var unique = [];
    elevator.passengers.forEach(function (passenger) {
      if (unique.indexOf(passenger.destination) === -1) unique.push(passenger.destination);
    });
    return unique;
  }
  function routeFor(elevator) {
    var all = mandatoryStops(elevator).concat(elevator.optional).filter(function (floor, index, list) {
      return list.indexOf(floor) === index && Math.abs(floor - elevator.position) > 0.04;
    });
    var direction = elevator.direction || (all.length ? Math.sign(all[0] - elevator.position) : 0);
    var ahead = all.filter(function (floor) { return direction >= 0 ? floor > elevator.position : floor < elevator.position; });
    var behind = all.filter(function (floor) { return ahead.indexOf(floor) === -1; });
    ahead.sort(function (a, b) { return direction >= 0 ? a - b : b - a; });
    behind.sort(function (a, b) { return direction >= 0 ? b - a : a - b; });
    return ahead.concat(behind);
  }
  function updateElevator(elevator, dt) {
    if (elevator.dwellLeft > 0) {
      elevator.dwellLeft -= dt;
      elevator.state = "Doors open";
      if (elevator.dwellLeft <= 0) elevator.state = "Idle";
      return;
    }
    var route = routeFor(elevator);
    if (!route.length) {
      elevator.target = null; elevator.direction = 0; elevator.state = "Idle"; return;
    }
    elevator.target = route[0];
    elevator.direction = Math.sign(elevator.target - elevator.position);
    elevator.state = elevator.direction > 0 ? "Moving up" : "Moving down";
    elevator.position += elevator.direction * dt / C.floorTravel;
    if ((elevator.direction > 0 && elevator.position >= elevator.target) ||
        (elevator.direction < 0 && elevator.position <= elevator.target)) {
      elevator.position = elevator.target;
      serviceFloor(elevator, elevator.target);
    }
  }
  function serviceFloor(elevator, floor) {
    elevator.state = "Doors open"; elevator.dwellLeft = C.dwell;
    elevator.optional = elevator.optional.filter(function (item) { return item !== floor; });
    var delivered = elevator.passengers.filter(function (passenger) { return passenger.destination === floor; });
    delivered.forEach(function (passenger) { passenger.status = "delivered"; passenger.elevatorId = null; });
    elevator.passengers = elevator.passengers.filter(function (passenger) { return passenger.destination !== floor; });
    if (delivered.length) state.passengers = state.passengers.filter(function (passenger) { return delivered.indexOf(passenger) === -1; });
    if (delivered.length) addScore(delivered.length);
    var room = C.capacity - elevator.passengers.length;
    waitingPassengers(floor).slice(0, room).forEach(function (passenger) {
      passenger.status = "onboard"; passenger.elevatorId = elevator.id; elevator.passengers.push(passenger);
    });
    ding();
  }
  function addScore(amount) {
    state.score += amount;
    if (state.score >= 1) unlockAchievement("first");
    if (state.score >= 25) unlockAchievement("busy");
    if (state.score >= 100) unlockAchievement("century");
    C.unlocks.forEach(function (threshold, index) {
      if (index > 0 && state.score >= threshold && !state.elevators[index].unlocked) unlockElevator(index);
    });
    if (state.score > storage.best) {
      storage.best = state.score; writeRaw("best", String(storage.best));
    }
  }
  function unlockElevator(index) {
    var elevator = state.elevators[index];
    elevator.unlocked = true; elevator.justUnlocked = true;
    state.highestElevators = index + 1;
    renderElevatorCards();
    setTimeout(function () { elevator.justUnlocked = false; }, 2200);
    var ids = [null, "double", "triple", "full"];
    unlockAchievement(ids[index]);
    toast("Elevator " + (index + 1) + " unlocked", "A new car is ready at the lobby", "success");
    announce("Elevator " + (index + 1) + " unlocked and ready at the lobby.");
  }

  function waitingPassengers(floor) {
    return state.passengers.filter(function (p) { return p.status === "waiting" && (floor === undefined || p.origin === floor); });
  }
  function onboardCount() {
    return state.elevators.reduce(function (sum, elevator) { return sum + elevator.passengers.length; }, 0);
  }
  function urgency(passenger) {
    var ratio = (state.elapsed - passenger.created) / C.patience;
    if (ratio >= 0.82) return ["Critical", "critical"];
    if (ratio >= 0.58) return ["Impatient", "impatient"];
    if (ratio >= 0.3) return ["Waiting", "waiting"];
    return ["Calm", "calm"];
  }

  function toggleStop(floor) {
    if (!state || state.mode !== "playing" || state.paused) return;
    var elevator = state.elevators[state.selectedElevator];
    if (!elevator || !elevator.unlocked) return;
    var mandatory = mandatoryStops(elevator);
    if (mandatory.indexOf(floor) !== -1) {
      announce("Floor " + floor + " is a mandatory passenger destination."); return;
    }
    var index = elevator.optional.indexOf(floor);
    if (index === -1) {
      if (Math.abs(elevator.position - floor) < 0.04) {
        if (elevator.dwellLeft <= 0) serviceFloor(elevator, floor);
        announce("Elevator " + elevator.id + " is serving Floor " + floor + ".");
        return;
      }
      elevator.optional.push(floor); announce("Floor " + floor + " added to Elevator " + elevator.id + ".");
    } else {
      elevator.optional.splice(index, 1); announce("Floor " + floor + " removed from Elevator " + elevator.id + ".");
    }
    render(false);
  }
  function selectElevator(index) {
    if (!state || !state.elevators[index] || !state.elevators[index].unlocked) return;
    state.selectedElevator = index; renderElevatorCards(); renderFloors();
    announce("Elevator " + (index + 1) + " selected.");
  }

  function render(force) {
    if (!state) return;
    renderCars();
    var second = Math.floor(state.elapsed);
    if (!force && second === state.lastRenderedSecond) return;
    state.lastRenderedSecond = second;
    el.score.textContent = state.score;
    el.waiting.textContent = waitingPassengers().length;
    el.misses.textContent = state.misses + " / " + C.maxMisses;
    el.best.textContent = storage.best;
    el.clock.textContent = formatClock(state.elapsed);
    el.phase.textContent = state.phase;
    el.phase.classList.toggle("is-rush", isRush(state.phase));
    el.shift.textContent = "Shift " + state.shift;
    var next = C.unlocks.find(function (threshold, index) { return index > 0 && state.score < threshold; });
    el["next-unlock"].textContent = next ? "Next elevator at " + next + " deliveries" : "Full elevator bank active";
    renderFloors(); renderElevatorCards(); renderAchievements();
  }
  function renderCars() {
    if (!state) return;
    state.elevators.forEach(function (elevator, index) {
      var shaft = document.getElementById("eg-shaft-" + index);
      var car = document.getElementById("eg-car-" + index);
      if (!shaft || !car) return;
      shaft.classList.toggle("is-locked", !elevator.unlocked);
      shaft.classList.toggle("is-selected", state.selectedElevator === index && elevator.unlocked);
      car.classList.toggle("is-open", elevator.dwellLeft > 0);
      car.classList.toggle("is-new", elevator.justUnlocked);
      car.style.transform = "translateY(" + (-((elevator.position - 1) / 9) * 900) + "%)";
      car.setAttribute("aria-label", "Elevator " + elevator.id + ", " + elevator.state + ", near floor " + Math.round(elevator.position));
      document.getElementById("eg-car-count-" + index).textContent = elevator.passengers.length + "/" + C.capacity;
    });
  }
  function renderFloors() {
    if (!state) return;
    var selected = state.elevators[state.selectedElevator];
    for (var floor = 1; floor <= C.floors; floor += 1) {
      var button = el.building.querySelector("[data-floor='" + floor + "']");
      var queue = document.getElementById("eg-floor-queue-" + floor);
      var stops = document.getElementById("eg-floor-stops-" + floor);
      var waiting = waitingPassengers(floor);
      button.classList.toggle("is-key-selected", state.selectedFloor === floor);
      button.classList.toggle("is-optional", selected.optional.indexOf(floor) !== -1);
      button.classList.toggle("is-required", mandatoryStops(selected).indexOf(floor) !== -1);
      button.setAttribute("aria-label", "Floor " + floor + ", " + waiting.length + " waiting. Toggle stop for Elevator " + selected.id);
      queue.textContent = "";
      waiting.slice(0, 8).forEach(function (passenger) {
        var level = urgency(passenger);
        var person = document.createElement("span");
        person.className = "eg-person is-" + level[1];
        person.title = level[0] + ", going to Floor " + passenger.destination;
        person.setAttribute("aria-label", level[0] + " passenger going to Floor " + passenger.destination);
        var figure = document.createElement("i"); figure.setAttribute("aria-hidden", "true");
        var badge = document.createElement("b"); badge.textContent = (passenger.destination > floor ? "↑" : "↓") + passenger.destination;
        person.appendChild(figure); person.appendChild(badge); queue.appendChild(person);
      });
      if (waiting.length > 8) {
        var more = document.createElement("span"); more.className = "eg-more"; more.textContent = "+" + (waiting.length - 8); queue.appendChild(more);
      }
      var marks = [];
      state.elevators.forEach(function (elevator) {
        if (!elevator.unlocked) return;
        if (mandatoryStops(elevator).indexOf(floor) !== -1) marks.push("◆E" + elevator.id);
        else if (elevator.optional.indexOf(floor) !== -1) marks.push("○E" + elevator.id);
      });
      stops.textContent = marks.join(" ");
    }
  }
  function renderElevatorCards() {
    if (!state) return;
    el["elevator-cards"].textContent = "";
    state.elevators.forEach(function (elevator, index) {
      var card = document.createElement("button");
      card.type = "button"; card.className = "eg-elevator-card eg-e" + elevator.id;
      card.dataset.elevator = index;
      card.disabled = !elevator.unlocked;
      card.classList.toggle("is-selected", index === state.selectedElevator);
      card.classList.toggle("is-new", elevator.justUnlocked);
      var route = routeFor(elevator);
      var routeText = route.length ? route.map(function (floor) {
        return (mandatoryStops(elevator).indexOf(floor) !== -1 ? "◆" : "○") + floor;
      }).join(" → ") : "No stops";
      var floorText = Math.abs(elevator.position - Math.round(elevator.position)) < 0.08 ? Math.round(elevator.position) : elevator.position.toFixed(1);
      var title = document.createElement("strong"); title.textContent = "E" + elevator.id;
      var status = document.createElement("span"); status.textContent = elevator.unlocked ? elevator.state + " · Floor " + floorText : "Unlocks at " + C.unlocks[index];
      var load = document.createElement("small"); load.textContent = elevator.unlocked ? elevator.passengers.length + "/" + C.capacity + " riders" : "Locked";
      var routeLine = document.createElement("em"); routeLine.textContent = elevator.unlocked ? routeText : "—";
      card.appendChild(title); card.appendChild(status); card.appendChild(load); card.appendChild(routeLine);
      el["elevator-cards"].appendChild(card);
    });
  }
  function renderAchievements() {
    el["achievement-count"].textContent = storage.achievements.length + " / " + achievementDefs.length;
    el["achievement-list"].textContent = "";
    achievementDefs.forEach(function (definition) {
      var unlocked = storage.achievements.indexOf(definition[0]) !== -1;
      var item = document.createElement("div"); item.className = "eg-achievement" + (unlocked ? " is-earned" : "");
      var icon = document.createElement("span"); icon.textContent = unlocked ? "★" : "◇";
      var copy = document.createElement("p");
      var name = document.createElement("strong"); name.textContent = definition[1];
      var detail = document.createElement("small"); detail.textContent = definition[2];
      copy.appendChild(name); copy.appendChild(detail); item.appendChild(icon); item.appendChild(copy);
      el["achievement-list"].appendChild(item);
    });
  }

  function formatClock(seconds) {
    var startMinutes = 8 * 60;
    var total = startMinutes + Math.floor(seconds / 60);
    var hours = Math.floor(total / 60) % 24;
    var minutes = total % 60;
    var suffix = hours >= 12 ? "PM" : "AM";
    var display = hours % 12 || 12;
    return display + ":" + String(minutes).padStart(2, "0") + " " + suffix;
  }
  function formatDuration(seconds) {
    var minutes = Math.floor(seconds / 60);
    return Math.floor(minutes / 60) + "h " + String(minutes % 60).padStart(2, "0") + "m";
  }
  function announce(message) {
    el.live.textContent = "";
    setTimeout(function () { el.live.textContent = message; }, 20);
  }
  function toast(title, detail, type) {
    var node = document.createElement("div"); node.className = "eg-toast is-" + type;
    var strong = document.createElement("strong"); strong.textContent = title;
    var small = document.createElement("span"); small.textContent = detail;
    node.appendChild(strong); node.appendChild(small); el.toasts.appendChild(node);
    setTimeout(function () { node.classList.add("is-leaving"); }, 3000);
    setTimeout(function () { node.remove(); }, 3600);
  }
  function unlockAchievement(id) {
    if (!id || storage.achievements.indexOf(id) !== -1) return;
    var definition = achievementDefs.find(function (item) { return item[0] === id; });
    if (!definition) return;
    storage.achievements.push(id); saveAchievements(); renderAchievements();
    toast("Achievement unlocked", definition[1], "achievement"); announce("Achievement unlocked: " + definition[1] + ".");
  }

  function ding() {
    if (!storage.sound) return;
    try {
      var AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      if (!audioContext) audioContext = new AudioCtor();
      if (audioContext.state === "suspended") audioContext.resume();
      var oscillator = audioContext.createOscillator();
      var gain = audioContext.createGain();
      oscillator.type = "sine"; oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.32);
      oscillator.connect(gain); gain.connect(audioContext.destination);
      oscillator.start(); oscillator.stop(audioContext.currentTime + 0.34);
    } catch (_) {}
  }

  function setPaused(paused, automatic) {
    if (!state || state.mode !== "playing" || state.paused === paused) return;
    state.paused = paused; state.autoPaused = Boolean(automatic);
    el["pause-overlay"].hidden = !paused;
    el["pause-reason"].textContent = automatic ? "You stepped away, so the building was paused. Resume when ready." : "Passenger patience and building time are frozen.";
    if (paused) {
      announce("Game paused."); document.getElementById("eg-resume").focus();
    } else {
      closeOverlay(el["pause-overlay"]); lastFrame = performance.now(); root.focus({ preventScroll: true }); announce("Game resumed.");
    }
  }
  function endGame() {
    state.mode = "gameover"; state.paused = true; cancelAnimationFrame(raf);
    el["final-score"].textContent = state.score;
    el["final-time"].textContent = formatDuration(state.elapsed);
    el["final-missed"].textContent = state.misses;
    el["final-elevators"].textContent = state.highestElevators;
    el["new-best"].hidden = state.score === 0 || state.score <= state.startingBest;
    el.gameover.hidden = false;
    document.getElementById("eg-replay").focus();
    announce("Game over. Final score " + state.score + ".");
  }
  function closeOverlay(overlay) { if (overlay) overlay.hidden = true; }
  function closeAllOverlays() {
    [el["pause-overlay"], el.help, el.achievements, el["restart-confirm"]].forEach(closeOverlay);
  }
  function openOverlay(name) {
    var overlay = el[name]; if (!overlay) return;
    if (state && state.mode === "playing" && !state.paused) setPaused(true, false);
    overlay.hidden = false;
    var target = overlay.querySelector("button"); if (target) target.focus();
  }
  function closeTopOverlay() {
    var overlays = [el["restart-confirm"], el.achievements, el.help];
    for (var i = 0; i < overlays.length; i += 1) {
      if (!overlays[i].hidden) { closeOverlay(overlays[i]); return true; }
    }
    return false;
  }

  root.addEventListener("click", function (event) {
    var floor = event.target.closest("[data-floor]");
    if (floor) { state.selectedFloor = Number(floor.dataset.floor); toggleStop(state.selectedFloor); }
    var elevator = event.target.closest("[data-elevator]");
    if (elevator) selectElevator(Number(elevator.dataset.elevator));
    var opener = event.target.closest("[data-eg-open]");
    if (opener) openOverlay(opener.dataset.egOpen);
    if (event.target.closest("[data-eg-close]")) closeTopOverlay();
  });
  root.addEventListener("keydown", function (event) {
    if (!state || state.mode !== "playing") return;
    if (event.key === "Escape") { if (closeTopOverlay()) return; if (state.paused) setPaused(false, false); return; }
    if (event.key.toLowerCase() === "p") { event.preventDefault(); setPaused(!state.paused, false); return; }
    if (state.paused) return;
    if (/^[1-4]$/.test(event.key)) { selectElevator(Number(event.key) - 1); return; }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault(); state.selectedFloor = Math.max(1, Math.min(10, state.selectedFloor + (event.key === "ArrowUp" ? 1 : -1))); renderFloors(); return;
    }
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggleStop(state.selectedFloor); }
    if (event.key.toLowerCase() === "r") { event.preventDefault(); openOverlay("restart-confirm"); }
  });

  document.getElementById("eg-start-button").addEventListener("click", startGame);
  document.getElementById("eg-replay").addEventListener("click", startGame);
  document.getElementById("eg-pause").addEventListener("click", function () { setPaused(true, false); });
  document.getElementById("eg-resume").addEventListener("click", function () { setPaused(false, false); });
  document.getElementById("eg-restart").addEventListener("click", function () { openOverlay("restart-confirm"); });
  document.getElementById("eg-restart-yes").addEventListener("click", startGame);
  el.sound.checked = storage.sound;
  el.sound.addEventListener("change", function () { storage.sound = el.sound.checked; writeRaw("sound", String(storage.sound)); if (storage.sound) ding(); });
  document.addEventListener("visibilitychange", function () { if (document.hidden && state && state.mode === "playing" && !state.paused) setPaused(true, true); });
  window.addEventListener("blur", function () { if (state && state.mode === "playing" && !state.paused) setPaused(true, true); });

  el["intro-best"].textContent = storage.best;
  renderAchievements();
})();
