---
title: "Sorting Shirts with Permutations"
date: 2026-08-01
categories: [math, code]
excerpt: "An interactive look at permutations, cycle decomposition, and the minimum number of swaps needed to match three shirts with their hangers."
---

<div class="screenplay-scene">
  <p class="scene-heading">INT. BEDROOM CLOSET — MORNING</p>
  <p class="scene-action">Three shirts hang in a row: blue on the red hanger, red on the green hanger, and green on the blue hanger. Close—but completely wrong.</p>
  <p class="scene-character">NOLAN (V.O.)</p>
  <p class="scene-dialogue">How many swaps does it take to put every shirt where it belongs?</p>
  <p class="scene-transition">CUT TO: THE MATH.</p>
</div>

At first, this felt like the sort of tiny problem I should be able to solve just by staring into my closet. But the moment I asked for the *fewest possible* swaps, it became something more interesting: a problem about permutations, cycles, and how to prove a solution is actually optimal.

<div class="shirt-sorter" id="shirt-sorter">
  <div class="shirt-sorter-heading">
    <div><p class="eyebrow">Interactive permutation</p><h2>Match every shirt to its hanger</h2></div>
    <p>Randomize the shirts, inspect the cycles, and watch the optimal swaps.</p>
  </div>

  <div class="hanger-stage" aria-label="Three colored hangers and their currently assigned shirts">
    <div class="hanger-row" aria-hidden="true">
      <div class="hanger hanger-red"><span>Red hanger</span><svg viewBox="0 0 120 70"><path d="M60 25c0-13 18-12 18-1 0 8-18 11-18 22"/><path d="M60 45 12 65h96L60 45Z"/></svg></div>
      <div class="hanger hanger-green"><span>Green hanger</span><svg viewBox="0 0 120 70"><path d="M60 25c0-13 18-12 18-1 0 8-18 11-18 22"/><path d="M60 45 12 65h96L60 45Z"/></svg></div>
      <div class="hanger hanger-blue"><span>Blue hanger</span><svg viewBox="0 0 120 70"><path d="M60 25c0-13 18-12 18-1 0 8-18 11-18 22"/><path d="M60 45 12 65h96L60 45Z"/></svg></div>
    </div>
    <div class="shirt-row">
      <div class="shirt-slot" data-slot="0"></div>
      <div class="shirt-slot" data-slot="1"></div>
      <div class="shirt-slot" data-slot="2"></div>
    </div>
  </div>

  <div class="sort-controls">
    <button type="button" id="randomize-shirts">Randomize</button>
    <button type="button" class="solve-button" id="solve-shirts">Solve optimally</button>
  </div>

  <div class="permutation-readout">
    <div><span>Permutation</span><strong id="permutation-value"></strong></div>
    <div><span>Cycles</span><strong id="cycles-value"></strong></div>
    <div><span>Minimum swaps</span><strong id="minimum-value"></strong></div>
    <div><span>Swaps performed</span><strong id="performed-value">0</strong></div>
  </div>
  <p class="sort-status" id="sort-status" aria-live="polite">Ready to solve.</p>
</div>

## Why you never need more than two swaps

Every arrangement of the shirts is a **permutation**—just a rearrangement of the same three colors. To see what needs fixing, draw an arrow from each hanger color to the shirt color beneath it. The arrows naturally break into loops called cycles.

For example, the arrangement `(Blue, Red, Green)` creates one cycle:

<div class="cycle-example" aria-label="Cycle from Red to Blue to Green and back to Red">
  <span class="red">Red</span><b>→</b><span class="blue">Blue</span><b>→</b><span class="green">Green</span><b>→</b><span class="red">Red</span>
</div>

A cycle containing *k* shirts takes exactly *k* − 1 swaps to repair. One swap breaks part of the loop; keep going and each shirt falls into place. More generally, a swap can increase the number of cycles by at most one. Since the solved arrangement has *n* one-shirt cycles, an arrangement that begins with *c* cycles needs at least *n* − *c* swaps. The algorithm hits that lower bound exactly:

<div class="swap-formula"><span>minimum swaps</span><strong>n − number of cycles</strong></div>

With three shirts, the worst case is one three-item cycle, so the answer can never be more than two swaps.

## The solution, on the page

The code scans the hangers from left to right. When it finds the wrong shirt, it tracks down the right one and swaps it into place. Each move fixes a hanger without undoing the work that came before it.

```python
import random

COLORS = ["Red", "Green", "Blue"]

def random_assignment():
    shirts = COLORS.copy()
    random.shuffle(shirts)
    return shirts

def optimal_swaps(shirts):
    """
    shirts[i] is the shirt currently on hanger i.
    Hanger order is Red, Green, Blue.
    Returns a list of optimal swaps.
    """

    target = {color: i for i, color in enumerate(COLORS)}
    pos = {shirt: i for i, shirt in enumerate(shirts)}
    swaps = []

    for hanger in range(3):
        correct = COLORS[hanger]

        if shirts[hanger] == correct:
            continue

        current = pos[correct]
        swaps.append((hanger, current))

        shirts[hanger], shirts[current] = shirts[current], shirts[hanger]
        pos[shirts[current]] = current
        pos[shirts[hanger]] = hanger

    return swaps
```

For `['Blue', 'Red', 'Green']`, the algorithm first swaps the red and green hanger positions, then swaps the remaining blue and green shirts. The result is `['Red', 'Green', 'Blue']` in two moves—the exact minimum predicted by the cycle formula.

What looks like a simple sorting demo is really a compact graph-theory problem. The picture makes the cycles intuitive; the proof guarantees optimality; and the algorithm turns that proof into a sequence of visible moves.

<script>
(function () {
  const root = document.getElementById("shirt-sorter");
  if (!root) return;

  const colors = ["Red", "Green", "Blue"];
  const slots = Array.from(root.querySelectorAll(".shirt-slot"));
  const randomizeButton = document.getElementById("randomize-shirts");
  const solveButton = document.getElementById("solve-shirts");
  const permutationValue = document.getElementById("permutation-value");
  const cyclesValue = document.getElementById("cycles-value");
  const minimumValue = document.getElementById("minimum-value");
  const performedValue = document.getElementById("performed-value");
  const status = document.getElementById("sort-status");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let shirts = ["Blue", "Red", "Green"];
  let swapsPerformed = 0;
  let solving = false;

  function cycleDecomposition(values) {
    const mapping = values.map(color => colors.indexOf(color));
    const visited = Array(colors.length).fill(false);
    const cycles = [];

    for (let start = 0; start < colors.length; start += 1) {
      if (visited[start]) continue;
      const cycle = [];
      let current = start;
      while (!visited[current]) {
        visited[current] = true;
        cycle.push(colors[current]);
        current = mapping[current];
      }
      cycles.push(cycle);
    }
    return cycles;
  }

  function formatCycles(cycles) {
    return cycles.map(cycle => `(${cycle.join(" ")})`).join(" ");
  }

  function shirtMarkup(color) {
    const lower = color.toLowerCase();
    return `<div class="shirt-token shirt-${lower}" data-color="${color}"><div class="shirt-shape"><span>${color}</span></div></div>`;
  }

  function render() {
    slots.forEach((slot, index) => { slot.innerHTML = shirtMarkup(shirts[index]); });
    const cycles = cycleDecomposition(shirts);
    permutationValue.textContent = `(${shirts.join(", ")})`;
    cyclesValue.textContent = formatCycles(cycles);
    minimumValue.textContent = String(colors.length - cycles.length);
    performedValue.textContent = String(swapsPerformed);
  }

  function optimalPlan(values) {
    const working = values.slice();
    const positions = Object.fromEntries(working.map((color, index) => [color, index]));
    const swaps = [];

    for (let hanger = 0; hanger < colors.length; hanger += 1) {
      const correct = colors[hanger];
      if (working[hanger] === correct) continue;
      const current = positions[correct];
      swaps.push([hanger, current]);
      [working[hanger], working[current]] = [working[current], working[hanger]];
      positions[working[current]] = current;
      positions[working[hanger]] = hanger;
    }
    return swaps;
  }

  async function animateSwap(first, second) {
    const firstShirt = slots[first].querySelector(".shirt-token");
    const secondShirt = slots[second].querySelector(".shirt-token");
    const firstRect = firstShirt.getBoundingClientRect();
    const secondRect = secondShirt.getBoundingClientRect();
    const distance = secondRect.left - firstRect.left;
    const duration = reduceMotion ? 1 : 650;
    const timing = { duration, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" };

    const firstAnimation = firstShirt.animate([
      { transform: "translate(0, 0)" },
      { transform: `translate(${distance / 2}px, -22px)` },
      { transform: `translate(${distance}px, 0)` }
    ], timing);
    const secondAnimation = secondShirt.animate([
      { transform: "translate(0, 0)" },
      { transform: `translate(${-distance / 2}px, 22px)` },
      { transform: `translate(${-distance}px, 0)` }
    ], timing);

    await Promise.all([firstAnimation.finished, secondAnimation.finished]);
  }

  function randomPermutation() {
    if (solving) return;
    let next;
    do {
      next = colors.slice();
      for (let index = next.length - 1; index > 0; index -= 1) {
        const randomIndex = Math.floor(Math.random() * (index + 1));
        [next[index], next[randomIndex]] = [next[randomIndex], next[index]];
      }
    } while (next.every((color, index) => color === shirts[index]));

    shirts = next;
    swapsPerformed = 0;
    status.textContent = "New permutation ready.";
    render();
  }

  async function solve() {
    if (solving) return;
    const plan = optimalPlan(shirts);
    if (plan.length === 0) {
      status.textContent = "Already solved: every shirt matches its hanger.";
      return;
    }

    solving = true;
    randomizeButton.disabled = true;
    solveButton.disabled = true;
    swapsPerformed = 0;
    const total = plan.length;

    for (let move = 0; move < plan.length; move += 1) {
      const [first, second] = plan[move];
      status.textContent = `Swap ${move + 1} of ${total}: hanger ${first + 1} with hanger ${second + 1}.`;
      await animateSwap(first, second);
      [shirts[first], shirts[second]] = [shirts[second], shirts[first]];
      swapsPerformed += 1;
      render();
    }

    status.textContent = `Solved optimally in ${swapsPerformed} swap${swapsPerformed === 1 ? "" : "s"}.`;
    solving = false;
    randomizeButton.disabled = false;
    solveButton.disabled = false;
  }

  randomizeButton.addEventListener("click", randomPermutation);
  solveButton.addEventListener("click", solve);
  render();
}());
</script>

<p class="scene-transition scene-break">DISSOLVE TO: A MUCH FULLER CLOSET.</p>

## Then real life gets involved

Of course, nobody's closet contains exactly one red, one green, and one blue shirt. There are stacks of black tees, a few nearly identical grays, some white shirts, and then the one loud color you forgot you owned. Research on clothing preferences found that black, white, and gray account for about 60% of selections, while sales data for men's T-shirts also puts black and white first, followed by navy and dark gray. So I modeled the closet around a heavy neutral core with a long tail of other colors. ([Clothing-color study](https://www.jstage.jst.go.jp/article/senshoshi1960/49/12/49_12_881/_article), [men's T-shirt sales report](https://www.particl.com/assets/reports/mens-tees.pdf))

The simulator below uses this modeled distribution:

<div class="closet-distribution" aria-label="Modeled shirt color distribution">
  <span style="--share:25%;--color:#202124">Black <b>25%</b></span>
  <span style="--share:19%;--color:#f5f2ea">White <b>19%</b></span>
  <span style="--share:15%;--color:#8b8d91">Gray <b>15%</b></span>
  <span style="--share:8%;--color:#263c67">Navy <b>8%</b></span>
  <span style="--share:6%;--color:#397db5">Blue <b>6%</b></span>
  <span style="--share:6%;--color:#8a6245">Brown/tan <b>6%</b></span>
  <span style="--share:5%;--color:#b65c8a">Multicolor <b>5%</b></span>
  <span style="--share:4%;--color:#bd3b34">Red <b>4%</b></span>
  <span style="--share:3%;--color:#438054">Green <b>3%</b></span>
  <span style="--share:2%;--color:#dd82a6">Pink <b>2%</b></span>
  <span style="--share:2%;--color:#76549c">Purple <b>2%</b></span>
  <span style="--share:2%;--color:#d9ac2f">Yellow <b>2%</b></span>
  <span style="--share:1%;--color:#d77732">Orange <b>1%</b></span>
  <span style="--share:1%;--color:#278f91">Teal <b>1%</b></span>
  <span style="--share:1%;--color:#a1988d">Other <b>1%</b></span>
</div>

There is one catch: a perfect match is possible only if there are just as many hangers of each color as there are shirts of that color. The generator handles that for us. It creates one matching hanger per shirt, then scrambles everything until **no shirt begins on its matching color**.

<div class="closet-lab" id="closet-lab">
  <div class="closet-lab-heading">
    <div><p class="eyebrow">Duplicate-color assignment</p><h2>Build an arbitrarily large closet</h2></div>
    <label for="closet-size">Items <input id="closet-size" type="number" min="6" max="500" step="1" value="60"></label>
  </div>

  <div class="closet-actions">
    <button type="button" id="generate-closet">Generate mismatched closet</button>
    <button type="button" class="match-button" id="match-closet">Match the closet</button>
  </div>

  <div class="closet-summary">
    <div><span>Items</span><strong id="closet-total">60</strong></div>
    <div><span>Matched</span><strong id="closet-matched">0</strong></div>
    <div><span>Mismatched</span><strong id="closet-mismatched">60</strong></div>
    <div><span>Swaps</span><strong id="closet-swaps">0</strong></div>
  </div>

  <div class="closet-key"><span><i class="key-hanger"></i>Hanger</span><span><i class="key-shirt"></i>Shirt</span><span><i class="key-match"></i>Matched pair</span></div>
  <div class="closet-grid" id="closet-grid" aria-label="Randomly mismatched closet"></div>
  <p class="closet-status" id="closet-status" aria-live="polite">Every shirt begins on a different-colored hanger.</p>
</div>

### Matching repeated colors

With duplicate colors, individual black shirts are interchangeable; it does not matter which black shirt reaches a black hanger. The algorithm works from left to right:

1. Leave every correctly matched position alone.
2. At a mismatch, find a later shirt with the required color.
3. Prefer a reciprocal swap that fixes both positions at once.
4. Otherwise, make a swap that fixes the current position and continue.

This always finishes with every shirt matched and never disturbs an earlier position that has already been fixed. For a closet of *n* items, this straightforward implementation uses linear space for its working copy and returned swap list, and at most *n* − 1 swaps. Its search is quadratic in the worst case, which remains comfortable for the hundreds of items a real closet might contain.

```python
def match_closet(hangers, shirts):
    """Return swaps that match duplicate-colored shirts and hangers."""
    if sorted(hangers) != sorted(shirts):
        raise ValueError("Hangers and shirts must have matching color counts")

    shirts = shirts.copy()
    swaps = []

    for i, required in enumerate(hangers):
        if shirts[i] == required:
            continue

        # Prefer a swap that fixes both mismatched positions.
        reciprocal = next((
            j for j in range(i + 1, len(shirts))
            if shirts[j] == required and hangers[j] == shirts[i]
        ), None)

        if reciprocal is not None:
            j = reciprocal
        else:
            j = next(
                j for j in range(i + 1, len(shirts))
                if shirts[j] == required and shirts[j] != hangers[j]
            )

        shirts[i], shirts[j] = shirts[j], shirts[i]
        swaps.append((i, j))

    return swaps
```

The original three-shirt puzzle is a permutation of distinct objects. This version is a many-to-one color assignment: there may be dozens of equivalent correct answers because shirts of the same color can trade identities without changing the closet.

<script>
(function () {
  const root = document.getElementById("closet-lab");
  if (!root) return;

  const palette = [
    { name: "Black", weight: 25, hex: "#202124" },
    { name: "White", weight: 19, hex: "#f5f2ea" },
    { name: "Gray", weight: 15, hex: "#8b8d91" },
    { name: "Navy", weight: 8, hex: "#263c67" },
    { name: "Blue", weight: 6, hex: "#397db5" },
    { name: "Brown/tan", weight: 6, hex: "#8a6245" },
    { name: "Multicolor", weight: 5, hex: "#b65c8a" },
    { name: "Red", weight: 4, hex: "#bd3b34" },
    { name: "Green", weight: 3, hex: "#438054" },
    { name: "Pink", weight: 2, hex: "#dd82a6" },
    { name: "Purple", weight: 2, hex: "#76549c" },
    { name: "Yellow", weight: 2, hex: "#d9ac2f" },
    { name: "Orange", weight: 1, hex: "#d77732" },
    { name: "Teal", weight: 1, hex: "#278f91" },
    { name: "Other", weight: 1, hex: "#a1988d" }
  ];

  const sizeInput = document.getElementById("closet-size");
  const generateButton = document.getElementById("generate-closet");
  const matchButton = document.getElementById("match-closet");
  const grid = document.getElementById("closet-grid");
  const totalValue = document.getElementById("closet-total");
  const matchedValue = document.getElementById("closet-matched");
  const mismatchedValue = document.getElementById("closet-mismatched");
  const swapsValue = document.getElementById("closet-swaps");
  const status = document.getElementById("closet-status");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const colorLookup = Object.fromEntries(palette.map(color => [color.name, color.hex]));

  let hangers = [];
  let shirts = [];
  let swapsPerformed = 0;
  let matching = false;
  let highlighted = [];

  function clampSize() {
    const parsed = Number.parseInt(sizeInput.value, 10);
    const size = Number.isFinite(parsed) ? Math.min(500, Math.max(6, parsed)) : 60;
    sizeInput.value = String(size);
    return size;
  }

  function countsForSize(size) {
    const allocations = palette.map((color, index) => {
      const exact = size * color.weight / 100;
      return { index, count: Math.floor(exact), remainder: exact - Math.floor(exact) };
    });
    let remaining = size - allocations.reduce((sum, item) => sum + item.count, 0);
    allocations.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
    for (let index = 0; index < remaining; index += 1) allocations[index].count += 1;
    allocations.sort((a, b) => a.index - b.index);
    return allocations.map(item => item.count);
  }

  function shuffle(values) {
    for (let index = values.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [values[index], values[randomIndex]] = [values[randomIndex], values[index]];
    }
    return values;
  }

  function createDerangement(values) {
    const counts = Object.entries(values.reduce((result, color) => {
      result[color] = (result[color] || 0) + 1;
      return result;
    }, {})).sort((a, b) => b[1] - a[1]);
    const grouped = counts.flatMap(([color, count]) => Array(count).fill(color));
    const shift = counts[0][1];
    const rotated = grouped.slice(shift).concat(grouped.slice(0, shift));
    const pairs = grouped.map((hanger, index) => ({ hanger, shirt: rotated[index] }));
    shuffle(pairs);
    return {
      hangerValues: pairs.map(pair => pair.hanger),
      shirtValues: pairs.map(pair => pair.shirt)
    };
  }

  function countMatches() {
    return hangers.reduce((count, hanger, index) => count + (hanger === shirts[index] ? 1 : 0), 0);
  }

  function render() {
    const matched = countMatches();
    totalValue.textContent = String(hangers.length);
    matchedValue.textContent = String(matched);
    mismatchedValue.textContent = String(hangers.length - matched);
    swapsValue.textContent = String(swapsPerformed);
    grid.style.setProperty("--closet-columns", String(Math.max(3, Math.min(12, Math.ceil(Math.sqrt(hangers.length))))));
    grid.innerHTML = hangers.map((hanger, index) => {
      const shirt = shirts[index];
      const correct = hanger === shirt;
      const active = highlighted.includes(index);
      return `<div class="closet-pair${correct ? " is-matched" : ""}${active ? " is-active" : ""}" title="Hanger: ${hanger}; shirt: ${shirt}">
        <span class="mini-hanger" style="--pair-color:${colorLookup[hanger]}"></span>
        <span class="mini-shirt" style="--pair-color:${colorLookup[shirt]}"></span>
        <small>${correct ? "✓" : ""}</small>
      </div>`;
    }).join("");
  }

  function generate() {
    if (matching) return;
    const size = clampSize();
    const counts = countsForSize(size);
    const colors = counts.flatMap((count, index) => Array(count).fill(palette[index].name));
    const deranged = createDerangement(colors);
    hangers = deranged.hangerValues;
    shirts = deranged.shirtValues;
    swapsPerformed = 0;
    highlighted = [];
    status.textContent = `Generated ${size} items with zero starting matches.`;
    render();
  }

  function buildPlan() {
    const working = shirts.slice();
    const swaps = [];
    for (let index = 0; index < hangers.length; index += 1) {
      if (working[index] === hangers[index]) continue;
      let partner = -1;
      for (let candidate = index + 1; candidate < working.length; candidate += 1) {
        if (working[candidate] === hangers[index] && hangers[candidate] === working[index]) {
          partner = candidate;
          break;
        }
      }
      if (partner === -1) {
        for (let candidate = index + 1; candidate < working.length; candidate += 1) {
          if (working[candidate] === hangers[index] && working[candidate] !== hangers[candidate]) {
            partner = candidate;
            break;
          }
        }
      }
      if (partner === -1) throw new Error("No valid matching shirt found");
      [working[index], working[partner]] = [working[partner], working[index]];
      swaps.push([index, partner]);
    }
    return swaps;
  }

  function pause(milliseconds) {
    return new Promise(resolve => window.setTimeout(resolve, milliseconds));
  }

  async function matchCloset() {
    if (matching) return;
    const plan = buildPlan();
    if (plan.length === 0) {
      status.textContent = "Already matched.";
      return;
    }
    matching = true;
    generateButton.disabled = true;
    matchButton.disabled = true;
    swapsPerformed = 0;
    const delay = reduceMotion ? 0 : hangers.length <= 40 ? 180 : hangers.length <= 100 ? 75 : 20;

    for (let move = 0; move < plan.length; move += 1) {
      const [first, second] = plan[move];
      highlighted = [first, second];
      status.textContent = `Swap ${move + 1} of ${plan.length}: positions ${first + 1} and ${second + 1}.`;
      render();
      if (delay) await pause(delay);
      [shirts[first], shirts[second]] = [shirts[second], shirts[first]];
      swapsPerformed += 1;
      render();
      if (delay) await pause(Math.max(15, delay / 2));
    }

    highlighted = [];
    render();
    status.textContent = `Every shirt matched in ${swapsPerformed} swap${swapsPerformed === 1 ? "" : "s"}.`;
    matching = false;
    generateButton.disabled = false;
    matchButton.disabled = false;
  }

  generateButton.addEventListener("click", generate);
  matchButton.addEventListener("click", matchCloset);
  sizeInput.addEventListener("change", generate);
  generate();
}());
</script>
