---
title: "Designing an LRU Cache from Scratch"
date: 2026-08-04
categories: [code, interviews]
excerpt: "A constant-time LRU cache built with a hash map and doubly linked list, including the invariants, edge cases, tests, and production tradeoffs interviewers look for."
---

An LRU cache looks simple: keep a fixed number of values and evict the one used least recently. The difficult part is honoring the performance contract:

> Implement `get(key)` and `put(key, value)` in **O(1)** average time.

A dictionary gives constant-time lookup, but it cannot tell us which entry is oldest. A list maintains an order, but finding an arbitrary key takes linear time. The solution is to make the two structures point at the same entries.

<div class="lru-architecture" aria-label="An LRU cache combines a hash map for constant-time lookup with a doubly linked list for constant-time ordering">
  <div><span>key</span><strong>Hash map</strong><small>Find any node in O(1)</small></div>
  <b aria-hidden="true">↔</b>
  <div><span>recency</span><strong>Doubly linked list</strong><small>Move or evict in O(1)</small></div>
</div>

## The question

Design a cache with a positive fixed capacity and two operations:

- `get(key)` returns the value when the key exists, otherwise `-1`. A successful read makes that key most recently used.
- `put(key, value)` inserts or updates a value and makes it most recently used. If the cache exceeds capacity, it removes the least recently used key.

The phrase that changes everything is “makes it most recently used.” Both reads and writes mutate the ordering.

## Try the cache

The left side is always the most recently used entry. Set a small capacity, add keys, and observe which one disappears.

<div class="lru-demo" id="lru-demo">
  <div class="lru-controls">
    <label>Capacity <input id="lru-capacity" type="number" min="1" max="8" value="3"></label>
    <label>Key <input id="lru-key" type="text" maxlength="8" value="A"></label>
    <label>Value <input id="lru-value" type="text" maxlength="12" value="10"></label>
    <button type="button" id="lru-put">Put</button>
    <button type="button" id="lru-get">Get</button>
    <button type="button" id="lru-reset">Reset</button>
  </div>
  <div class="lru-order-label"><span>Most recent</span><span>Least recent</span></div>
  <div class="lru-list" id="lru-list" aria-live="polite"></div>
  <p class="lru-status" id="lru-status">The cache is empty.</p>
</div>

## The two invariants

I keep two permanent sentinel nodes, `left` and `right`. Real nodes live between them:

```text
left (LRU) ⇄ oldest ⇄ ... ⇄ newest ⇄ right (MRU)
```

Every public operation preserves two invariants:

1. Every dictionary entry points to exactly one node in the linked list, and every real list node appears in the dictionary.
2. Nodes are ordered from least recently used to most recently used.

Sentinels eliminate special cases for an empty list and for removing the first or last real node. That makes the pointer code shorter and safer.

## A complete Python solution

```python
class Node:
    __slots__ = ("key", "value", "prev", "next")

    def __init__(self, key=0, value=0):
        self.key = key
        self.value = value
        self.prev = None
        self.next = None


class LRUCache:
    def __init__(self, capacity: int):
        if capacity <= 0:
            raise ValueError("capacity must be positive")

        self.capacity = capacity
        self.nodes = {}

        # Permanent sentinels: LRU side ⇄ real nodes ⇄ MRU side
        self.left = Node()
        self.right = Node()
        self.left.next = self.right
        self.right.prev = self.left

    def _remove(self, node: Node) -> None:
        """Detach an existing node from the linked list."""
        before, after = node.prev, node.next
        before.next = after
        after.prev = before

    def _insert_mru(self, node: Node) -> None:
        """Insert a detached node immediately before right."""
        previous_mru = self.right.prev
        previous_mru.next = node
        node.prev = previous_mru
        node.next = self.right
        self.right.prev = node

    def _touch(self, node: Node) -> None:
        """Mark an existing node as most recently used."""
        self._remove(node)
        self._insert_mru(node)

    def get(self, key: int) -> int:
        node = self.nodes.get(key)
        if node is None:
            return -1

        self._touch(node)
        return node.value

    def put(self, key: int, value: int) -> None:
        if key in self.nodes:
            node = self.nodes[key]
            node.value = value
            self._touch(node)
            return

        node = Node(key, value)
        self.nodes[key] = node
        self._insert_mru(node)

        if len(self.nodes) > self.capacity:
            lru = self.left.next
            self._remove(lru)
            del self.nodes[lru.key]
```

## Why it is correct

Consider each possible operation:

- A cache miss changes nothing, so both invariants remain true.
- A cache hit removes one known node and reinserts that same node at the MRU end. Membership is unchanged, and the accessed node is now newest.
- Updating a key changes its value and moves its existing node to the MRU end. It never creates a duplicate node.
- Inserting a key adds the same new node to both structures at the MRU end. If capacity is exceeded, `left.next` is the LRU node by invariant 2; removing it from both structures restores invariant 1 and the capacity limit.

Because every branch preserves the invariants, `left.next` is always the correct eviction candidate.

## Complexity

| Operation | Time | Extra space |
|---|---:|---:|
| `get` | O(1) average | O(1) |
| `put` | O(1) average | O(1) per new key |
| Complete cache | — | O(capacity) |

Dictionary access is O(1) on average. Every list mutation changes a fixed number of pointers; nothing scans the cache.

## Tests that catch the common bugs

The first test verifies eviction. The second is more revealing: reading key `1` must protect it from eviction. The third checks that updating a key does not create a duplicate or evict unnecessarily.

```python
cache = LRUCache(2)
cache.put(1, 10)
cache.put(2, 20)
cache.put(3, 30)       # evicts 1
assert cache.get(1) == -1
assert cache.get(2) == 20

cache = LRUCache(2)
cache.put(1, 10)
cache.put(2, 20)
assert cache.get(1) == 10  # 1 becomes MRU
cache.put(3, 30)            # therefore evicts 2
assert cache.get(2) == -1
assert cache.get(1) == 10
assert cache.get(3) == 30

cache = LRUCache(2)
cache.put(1, 10)
cache.put(1, 99)
assert cache.get(1) == 99
assert len(cache.nodes) == 1
```

## The production follow-ups

The from-scratch solution demonstrates the data structure. In production, I would make several choices explicit before writing more code:

- **Use the standard library when appropriate.** Python’s `OrderedDict` already provides the ordering primitives needed for an LRU cache. Reimplementing them is useful in an interview, not automatically useful in a codebase.
- **Define thread safety.** `get` changes recency, so it is a write. A shared in-process cache needs synchronization around both the map and the list; locking only `put` is incorrect.
- **Measure by cost when entries vary.** A count-based capacity treats a one-byte flag and a 50 MB response equally. Real caches may evict against an estimated byte budget.
- **Treat TTL as another policy.** Expiration and recency answer different questions. Adding a min-heap of expiration times typically makes expiry maintenance O(log n), while lazy expiration changes when stale entries are reclaimed.
- **Do not confuse local and distributed caches.** Multiple application processes do not share this memory. Cross-host consistency, sharding, replication, and failure recovery require a system such as Redis—not a more elaborate linked list.

The strongest interview answer is not just the code. It is recognizing the exact contract, selecting structures that make the contract possible, stating the invariants before touching pointers, and knowing where the toy problem stops resembling a production cache.

<script>
(() => {
  const root = document.getElementById("lru-demo");
  if (!root) return;

  const capacityInput = document.getElementById("lru-capacity");
  const keyInput = document.getElementById("lru-key");
  const valueInput = document.getElementById("lru-value");
  const list = document.getElementById("lru-list");
  const status = document.getElementById("lru-status");
  let entries = new Map();

  function capacity() {
    const value = Math.max(1, Math.min(8, Number(capacityInput.value) || 1));
    capacityInput.value = String(value);
    return value;
  }

  function render(highlight = "") {
    if (!entries.size) {
      list.innerHTML = '<span class="lru-empty">Empty cache</span>';
      return;
    }
    list.innerHTML = [...entries].reverse().map(([key, value]) =>
      `<div class="lru-node${key === highlight ? " is-active" : "}"><strong>${escapeText(key)}</strong><span>${escapeText(value)}</span></div>`
    ).join('<b aria-hidden="true">⇄</b>');
  }

  function escapeText(value) {
    const element = document.createElement("span");
    element.textContent = value;
    return element.innerHTML;
  }

  function touch(key, value) {
    entries.delete(key);
    entries.set(key, value);
  }

  document.getElementById("lru-put").addEventListener("click", () => {
    const key = keyInput.value.trim();
    if (!key) { status.textContent = "Enter a key first."; return; }
    const existed = entries.has(key);
    touch(key, valueInput.value);
    let evicted = "";
    if (entries.size > capacity()) {
      evicted = entries.keys().next().value;
      entries.delete(evicted);
    }
    status.textContent = evicted ? `Put ${key}; evicted least-recent key ${evicted}.` : `${existed ? "Updated" : "Added"} ${key}; it is now most recent.`;
    render(key);
  });

  document.getElementById("lru-get").addEventListener("click", () => {
    const key = keyInput.value.trim();
    if (!entries.has(key)) {
      status.textContent = `Miss: ${key || "that key"} is not cached.`;
      render();
      return;
    }
    const value = entries.get(key);
    touch(key, value);
    status.textContent = `Hit: ${key} returned ${value} and moved to most recent.`;
    render(key);
  });

  document.getElementById("lru-reset").addEventListener("click", () => {
    entries = new Map();
    status.textContent = "The cache is empty.";
    render();
  });

  capacityInput.addEventListener("change", () => {
    const limit = capacity();
    const evicted = [];
    while (entries.size > limit) {
      const key = entries.keys().next().value;
      entries.delete(key);
      evicted.push(key);
    }
    status.textContent = evicted.length ? `Capacity changed; evicted ${evicted.join(", ")}.` : `Capacity set to ${limit}.`;
    render();
  });

  render();
})();
</script>
