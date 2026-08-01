---
title: "Sorting Shirts with Permutations"
date: 2026-08-01
categories: [math, code]
excerpt: "An interactive look at permutations, cycle decomposition, and the minimum number of swaps needed to match three shirts with their hangers."
---

Suppose there are three colored hangers—red, green, and blue—and three matching shirts. The shirts have been hung in the wrong places. What is the fewest number of swaps needed to put every shirt on its matching hanger?

It looks like a tiny sorting puzzle. Underneath, it is a clean demonstration of permutations, cycle decomposition, and optimal algorithms.

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

## Why the solution is optimal

Every arrangement of the shirts is a **permutation**. Draw an arrow from each hanger color to the color of the shirt currently beneath it. Those arrows split the permutation into cycles.

For example, the arrangement `(Blue, Red, Green)` creates one cycle:

<div class="cycle-example" aria-label="Cycle from Red to Blue to Green and back to Red">
  <span class="red">Red</span><b>→</b><span class="blue">Blue</span><b>→</b><span class="green">Green</span><b>→</b><span class="red">Red</span>
</div>

A cycle containing *k* shirts takes exactly *k* − 1 swaps to repair. More generally, each swap can increase the number of cycles by at most one. The solved arrangement has *n* one-item cycles, so an arrangement starting with *c* cycles requires at least *n* − *c* swaps. The algorithm reaches that lower bound:

<div class="swap-formula"><span>minimum swaps</span><strong>n − number of cycles</strong></div>

With three shirts, the worst case is one three-item cycle, so the answer can never be more than two swaps.

## The algorithm

The algorithm scans the hangers from left to right. Whenever a hanger has the wrong shirt, it finds the correct shirt and swaps it into place. That fixes one position without disturbing any position already fixed.

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
