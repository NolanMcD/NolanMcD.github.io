(() => {
  "use strict";
  const root = document.getElementById("crossword-creator");
  if (!root) return;

  const SCHEMA = 1, STORAGE_KEY = "nolandCrosswordCreator.draft.v1", MAX_HISTORY = 150;
  const $ = selector => root.querySelector(selector);
  const els = {
    grid: $("#cw-grid"), previewGrid: $("#cw-preview-grid"), across: $("#cw-across"), down: $("#cw-down"),
    title: $("#cw-title"), author: $("#cw-author"), notes: $("#cw-notes"), current: $("#cw-current"),
    stats: $("#cw-stats"), warnings: $("#cw-warnings"), health: $("#cw-health-summary"), save: $("#cw-save-status"),
    live: $("#cw-live"), newDialog: $("#cw-new-dialog"), preview: $("#cw-preview"), importer: $("#cw-import"),
    previewClues: $("#cw-preview-clues"), width: $("#cw-width"), height: $("#cw-height")
  };
  let puzzle, entries = [], numbering = new Map(), selection = 0, direction = "across", mode = "letter";
  let history = [], future = [], testLetters = [], previewSelection = 0, previewDirection = "across", saveTimer, clueTimer;

  function blankPuzzle(width = 15, height = 15) {
    return { schema: SCHEMA, title: "Untitled Crossword", author: "", notes: "", width, height,
      cells: Array.from({ length: width * height }, () => ({ block: false, letter: "" })), clues: {}, settings: { symmetry: true } };
  }
  const clone = value => JSON.parse(JSON.stringify(value));
  const key = (row, col, dir) => `${row}:${col}:${dir}`;
  const rc = index => [Math.floor(index / puzzle.width), index % puzzle.width];
  const indexOf = (row, col) => row * puzzle.width + col;
  const isOpen = (row, col) => row >= 0 && col >= 0 && row < puzzle.height && col < puzzle.width && !puzzle.cells[indexOf(row, col)].block;
  const activeTextInput = () => /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "");
  function announce(message) { els.live.textContent = ""; requestAnimationFrame(() => { els.live.textContent = message; }); }

  function validate(raw) {
    if (!raw || typeof raw !== "object") throw new Error("The file does not contain a puzzle object.");
    if (raw.schema !== SCHEMA) throw new Error(raw.schema > SCHEMA ? "This puzzle uses a newer, unsupported format." : "Unsupported puzzle format version.");
    const width = Number(raw.width), height = Number(raw.height);
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 5 || width > 25 || height < 5 || height > 25) throw new Error("Puzzle dimensions must be whole numbers from 5 through 25.");
    if (!Array.isArray(raw.cells) || raw.cells.length !== width * height) throw new Error("The grid size does not match its dimensions.");
    const cells = raw.cells.map((cell, i) => {
      if (!cell || typeof cell !== "object" || typeof cell.block !== "boolean") throw new Error(`Cell ${i + 1} is invalid.`);
      const letter = typeof cell.letter === "string" ? cell.letter.toUpperCase() : "";
      if (letter && !/^[A-Z]$/.test(letter)) throw new Error(`Cell ${i + 1} has an invalid letter.`);
      return { block: cell.block, letter: cell.block ? "" : letter };
    });
    const clean = (value, max) => typeof value === "string" ? value.slice(0, max) : "";
    const clues = {};
    if (raw.clues && typeof raw.clues === "object" && !Array.isArray(raw.clues)) Object.entries(raw.clues).forEach(([k, value]) => {
      if (/^\d+:\d+:(across|down)$/.test(k) && typeof value === "string") clues[k] = value.slice(0, 1000);
    });
    return { schema: SCHEMA, title: clean(raw.title, 120) || "Untitled Crossword", author: clean(raw.author, 100), notes: clean(raw.notes, 1000), width, height, cells, clues, settings: { symmetry: raw.settings?.symmetry !== false } };
  }

  function deriveEntries() {
    const next = [], numbers = new Map(); let number = 0;
    for (let r = 0; r < puzzle.height; r++) for (let c = 0; c < puzzle.width; c++) {
      if (!isOpen(r, c)) continue;
      const acrossStart = !isOpen(r, c - 1) && isOpen(r, c + 1);
      const downStart = !isOpen(r - 1, c) && isOpen(r + 1, c);
      if (acrossStart || downStart) { number++; numbers.set(indexOf(r, c), number); }
      if (acrossStart) {
        const cells = []; for (let x = c; isOpen(r, x); x++) cells.push(indexOf(r, x));
        next.push({ key: key(r, c, "across"), row: r, col: c, direction: "across", number, cells });
      }
      if (downStart) {
        const cells = []; for (let y = r; isOpen(y, c); y++) cells.push(indexOf(y, c));
        next.push({ key: key(r, c, "down"), row: r, col: c, direction: "down", number, cells });
      }
    }
    entries = next; numbering = numbers;
    const alive = new Set(entries.map(entry => entry.key));
    Object.keys(puzzle.clues).forEach(k => { if (!alive.has(k)) delete puzzle.clues[k]; });
  }
  function entryAt(index, preferred = direction) {
    return entries.find(e => e.direction === preferred && e.cells.includes(index)) || entries.find(e => e.cells.includes(index)) || null;
  }
  function answer(entry, source = puzzle.cells.map(c => c.letter)) { return entry.cells.map(i => source[i] || "").join(""); }

  function snapshot() { return clone(puzzle); }
  function commit(before, message = "") {
    history.push(before); if (history.length > MAX_HISTORY) history.shift(); future = []; deriveEntries(); render(); scheduleSave(); if (message) announce(message);
  }
  function restore(next) { puzzle = validate(next); selection = Math.min(selection, puzzle.cells.length - 1); deriveEntries(); syncMetadata(); render(); scheduleSave(); }
  function undo() { if (!history.length) return; future.push(snapshot()); restore(history.pop()); announce("Undid last change."); }
  function redo() { if (!future.length) return; history.push(snapshot()); restore(future.pop()); announce("Redid change."); }

  function selectCell(index, preferred, toggle = false, preview = false) {
    if (index < 0 || index >= puzzle.cells.length || puzzle.cells[index].block) return;
    if (preview) {
      if (previewSelection === index && toggle && entryAt(index, previewDirection) && entryAt(index, previewDirection === "across" ? "down" : "across")) previewDirection = previewDirection === "across" ? "down" : "across";
      else if (preferred) previewDirection = preferred;
      previewSelection = index; renderGrid(true); return;
    }
    if (selection === index && toggle && entryAt(index, direction === "across" ? "down" : "across")) direction = direction === "across" ? "down" : "across";
    else if (preferred) direction = preferred;
    selection = index; renderGrid(); updateCurrent(); highlightClue();
  }
  function move(deltaRow, deltaCol, preview = false) {
    let index = preview ? previewSelection : selection; let [r, c] = rc(index);
    for (;;) { r += deltaRow; c += deltaCol; if (r < 0 || c < 0 || r >= puzzle.height || c >= puzzle.width) return; index = indexOf(r, c); if (!puzzle.cells[index].block) break; }
    selectCell(index, deltaCol ? "across" : "down", false, preview);
  }
  function advance(step = 1, preview = false) {
    const index = preview ? previewSelection : selection, dir = preview ? previewDirection : direction, entry = entryAt(index, dir);
    if (!entry) return;
    const pos = entry.cells.indexOf(index), target = entry.cells[pos + step]; if (target !== undefined) selectCell(target, dir, false, preview);
  }

  function editLetter(letter, preview = false) {
    const index = preview ? previewSelection : selection;
    if (puzzle.cells[index]?.block) return;
    if (preview) { testLetters[index] = letter; renderGrid(true); advance(1, true); return; }
    const before = snapshot(); puzzle.cells[index].letter = letter; commit(before); advance(1);
  }
  function erase(backward, preview = false) {
    const index = preview ? previewSelection : selection, source = preview ? testLetters : null;
    if (preview) { if (source[index]) { source[index] = ""; renderGrid(true); } else if (backward) { advance(-1, true); source[previewSelection] = ""; renderGrid(true); } return; }
    const before = snapshot();
    if (puzzle.cells[index].letter) puzzle.cells[index].letter = "";
    else if (backward) { advance(-1); puzzle.cells[selection].letter = ""; }
    commit(before);
  }
  function toggleBlock(index = selection) {
    const before = snapshot(), makeBlock = !puzzle.cells[index].block, indexes = new Set([index]);
    if (puzzle.settings.symmetry) indexes.add(puzzle.cells.length - 1 - index);
    let removed = false; indexes.forEach(i => { removed ||= Boolean(puzzle.cells[i].letter); puzzle.cells[i] = { block: makeBlock, letter: "" }; });
    if (makeBlock && puzzle.cells[selection].block) selection = puzzle.cells.findIndex(cell => !cell.block);
    commit(before, removed ? "Block placed; filled letters removed. Undo is available." : `Block${indexes.size > 1 ? "s" : ""} ${makeBlock ? "placed" : "removed"}.`);
  }

  function renderGrid(preview = false) {
    const grid = preview ? els.previewGrid : els.grid, selected = preview ? previewSelection : selection, dir = preview ? previewDirection : direction;
    const active = entryAt(selected, dir), activeCells = new Set(active?.cells || []), crossing = new Set(entries.filter(e => e.direction !== dir && e.cells.includes(selected)).flatMap(e => e.cells));
    grid.style.setProperty("--cw-cols", puzzle.width); grid.style.setProperty("--cw-rows", puzzle.height); grid.style.setProperty("--cw-min-cell", puzzle.width > 21 ? "25px" : "28px");
    grid.replaceChildren();
    puzzle.cells.forEach((cell, index) => {
      const [r, c] = rc(index), button = document.createElement("button");
      button.type = "button"; button.className = "cw-cell"; button.dataset.index = index; button.setAttribute("role", "gridcell"); button.tabIndex = index === selected ? 0 : -1;
      if (cell.block) button.classList.add("is-block");
      if (activeCells.has(index)) button.classList.add("is-word");
      if (crossing.has(index)) button.classList.add("is-crossing");
      if (index === selected) button.classList.add("is-selected");
      const num = numbering.get(index); if (num) { const small = document.createElement("span"); small.className = "cw-number"; small.textContent = num; button.append(small); }
      if (!cell.block) { const letter = document.createElement("b"); letter.className = "cw-letter"; letter.textContent = preview ? (testLetters[index] || "") : cell.letter; button.append(letter); }
      const state = cell.block ? "block" : `${num ? `number ${num}, ` : ""}${preview ? testLetters[index] || "empty" : cell.letter || "empty"}`;
      button.setAttribute("aria-label", `Row ${r + 1}, column ${c + 1}, ${state}${index === selected ? `, ${dir} selected` : ""}`);
      grid.append(button);
    });
  }

  function renderClues() {
    const make = (entry, container) => {
      const row = document.createElement("label"); row.className = "cw-clue"; row.dataset.key = entry.key;
      const meta = document.createElement("span"); meta.className = "cw-clue-meta"; meta.textContent = `${entry.number} ${entry.direction === "across" ? "Across" : "Down"} · ${entry.cells.length} letters`;
      const preview = document.createElement("code"); preview.textContent = answer(entry).padEnd(entry.cells.length, "·"); meta.append(preview);
      const input = document.createElement("input"); input.type = "text"; input.maxLength = 1000; input.value = puzzle.clues[entry.key] || ""; input.placeholder = "Write a clue…"; input.setAttribute("aria-label", `Clue for ${entry.number} ${entry.direction}`);
      const printText = document.createElement("span"); printText.className = "cw-print-clue"; printText.textContent = input.value || "(No clue)";
      if (!input.value.trim()) row.classList.add("is-missing"); row.append(meta, input, printText); container.append(row);
    };
    els.across.replaceChildren(); els.down.replaceChildren(); entries.forEach(entry => make(entry, entry.direction === "across" ? els.across : els.down)); highlightClue();
  }
  function highlightClue() {
    root.querySelectorAll(".cw-clue.is-active").forEach(el => el.classList.remove("is-active"));
    const entry = entryAt(selection); if (!entry) return; const row = root.querySelector(`.cw-clue[data-key="${entry.key}"]`); if (row) row.classList.add("is-active");
  }
  function updateCurrent() {
    const entry = entryAt(selection); els.current.textContent = entry ? `${entry.number} ${entry.direction === "across" ? "Across" : "Down"} · ${entry.cells.length} letters · ${answer(entry).padEnd(entry.cells.length, "·").replace(/ /g, "·")}` : "This cell is not part of a two-letter-or-longer entry.";
  }

  function analyze() {
    const open = puzzle.cells.filter(c => !c.block).length, blocks = puzzle.cells.length - open, filled = puzzle.cells.filter(c => !c.block && c.letter).length;
    const memberships = Array(puzzle.cells.length).fill(0); entries.forEach(e => e.cells.forEach(i => memberships[i]++));
    const unchecked = memberships.filter((count, i) => !puzzle.cells[i].block && count < 2).length;
    const two = entries.filter(e => e.cells.length === 2).length;
    let regions = 0; const seen = new Set();
    puzzle.cells.forEach((cell, start) => { if (cell.block || seen.has(start)) return; regions++; const queue = [start]; seen.add(start); while (queue.length) { const i = queue.shift(), [r, c] = rc(i); [[r-1,c],[r+1,c],[r,c-1],[r,c+1]].forEach(([y,x]) => { if (isOpen(y,x)) { const n=indexOf(y,x); if (!seen.has(n)) { seen.add(n); queue.push(n); } } }); } });
    const incomplete = puzzle.cells.filter(c => !c.block && !c.letter).length, missing = entries.filter(e => !(puzzle.clues[e.key] || "").trim()).length;
    const completed = new Map(), duplicates = new Set(); entries.forEach(e => { const a=answer(e); if (a.length === e.cells.length && !a.includes("")) { if (completed.has(a)) duplicates.add(a); else completed.set(a,e.key); } });
    let symmetry = 0; if (puzzle.settings.symmetry) puzzle.cells.forEach((cell,i) => { if (cell.block !== puzzle.cells[puzzle.cells.length-1-i].block) symmetry++; }); symmetry = Math.ceil(symmetry/2);
    const oneLetter = puzzle.cells.filter((cell,i) => !cell.block && memberships[i] === 0).length;
    const issues = [];
    if (oneLetter) issues.push(`${oneLetter} open ${oneLetter === 1 ? "cell does" : "cells do"} not form a two-letter-or-longer entry.`);
    if (regions > 1) issues.push(`Grid contains ${regions} disconnected white-cell regions.`);
    if (unchecked) issues.push(`${unchecked} unchecked ${unchecked === 1 ? "cell belongs" : "cells belong"} to fewer than two answers.`);
    if (two) issues.push(`${two} two-letter ${two === 1 ? "answer" : "answers"} found.`);
    if (duplicates.size) issues.push(`Duplicate completed ${duplicates.size === 1 ? "answer" : "answers"}: ${[...duplicates].join(", ")}.`);
    if (incomplete) issues.push(`${incomplete} solution ${incomplete === 1 ? "cell is" : "cells are"} incomplete.`);
    if (missing) issues.push(`${missing} ${missing === 1 ? "clue is" : "clues are"} missing.`);
    if (symmetry) issues.push(`${symmetry} rotational symmetry ${symmetry === 1 ? "violation" : "violations"} found.`);
    return { open, blocks, filled, unchecked, two, incomplete, missing, regions, symmetry, issues };
  }
  function renderHealth() {
    const a = analyze(), across = entries.filter(e => e.direction === "across").length, down = entries.length - across, completion = a.open ? Math.round(a.filled/a.open*100) : 0;
    els.health.textContent = a.issues.length ? `${a.issues.length} construction ${a.issues.length === 1 ? "warning" : "warnings"}` : `No automatic construction issues found — ${entries.length} answers, all clues filled.`;
    const stats = [[`${puzzle.width}×${puzzle.height}`,"Grid"],[a.open,"Open"],[`${a.blocks} (${Math.round(a.blocks/puzzle.cells.length*100)}%)`,"Blocks"],[`${across} / ${down}`,"Across / Down"],[entries.length,"Answers"],[`${a.filled} (${completion}%)`,"Filled"],[a.unchecked,"Unchecked"]];
    els.stats.replaceChildren(...stats.map(([value,label]) => { const d=document.createElement("div"),b=document.createElement("b"),s=document.createElement("span"); b.textContent=value;s.textContent=label;d.append(b,s);return d; }));
    els.warnings.replaceChildren(...a.issues.map(text => { const li=document.createElement("li"); li.textContent=text; return li; }));
    if (!a.issues.length) { const li=document.createElement("li"); li.className="is-good"; li.textContent="Automated checks passed. A human editorial review is still worthwhile."; els.warnings.append(li); }
  }
  function render() { renderGrid(); renderClues(); renderHealth(); updateCurrent(); updateControls(); }
  function updateControls() {
    root.querySelector('[data-action="undo"]').disabled = !history.length; root.querySelector('[data-action="redo"]').disabled = !future.length;
    root.querySelectorAll("[data-mode]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
    const sym = root.querySelector('[data-action="symmetry"]'); sym.setAttribute("aria-pressed", String(puzzle.settings.symmetry)); sym.textContent = `Symmetry: ${puzzle.settings.symmetry ? "On" : "Off"}`;
  }
  function syncMetadata() { els.title.value=puzzle.title; els.author.value=puzzle.author; els.notes.value=puzzle.notes; $("#cw-print-title").textContent=puzzle.title; $("#cw-print-author").textContent=puzzle.author ? `By ${puzzle.author}` : ""; }

  function scheduleSave() { clearTimeout(saveTimer); els.save.textContent="Saving draft…"; saveTimer=setTimeout(save, 450); }
  function save() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(puzzle)); els.save.textContent="Draft saved in this browser."; } catch { els.save.textContent="Local saving is unavailable. Export JSON to keep your work."; } }
  function load() { try { const raw=localStorage.getItem(STORAGE_KEY); if (!raw) return null; return validate(JSON.parse(raw)); } catch { try { localStorage.removeItem(STORAGE_KEY); } catch {} els.save.textContent="A damaged saved draft was ignored."; return null; } }
  function safeName() { return (puzzle.title || "crossword").normalize("NFKD").replace(/[^a-zA-Z0-9 -]/g,"").trim().replace(/\s+/g,"-").toLowerCase().slice(0,60) || "crossword"; }
  function exportJSON() { try { const blob=new Blob([JSON.stringify(puzzle,null,2)],{type:"application/json"}), a=document.createElement("a"); a.href=URL.createObjectURL(blob);a.download=`${safeName()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),0);announce("Puzzle exported as JSON."); } catch { announce("The puzzle could not be exported."); } }
  async function importJSON(file) { try { const imported=validate(JSON.parse(await file.text())); if ((history.length || puzzle.cells.some(c=>c.block||c.letter) || Object.values(puzzle.clues).some(Boolean)) && !confirm("Importing will replace the current puzzle. Continue?")) return; history.push(snapshot()); future=[]; puzzle=imported; selection=puzzle.cells.findIndex(c=>!c.block); testLetters=Array(puzzle.cells.length).fill(""); deriveEntries();syncMetadata();render();scheduleSave();announce("Puzzle imported successfully."); } catch(error) { alert(`Could not import puzzle: ${error.message}`); } finally { els.importer.value=""; } }

  function renderPreviewClues() {
    els.previewClues.replaceChildren(); ["across","down"].forEach(dir => { const section=document.createElement("section"),h=document.createElement("h3"),ol=document.createElement("ol"); h.textContent=dir === "across" ? "Across" : "Down"; entries.filter(e=>e.direction===dir).forEach(e=>{const li=document.createElement("li"),b=document.createElement("b"),span=document.createElement("span");b.textContent=e.number;span.textContent=puzzle.clues[e.key]||"(No clue)";li.append(b,span);li.addEventListener("click",()=>selectCell(e.cells[0],dir,false,true));ol.append(li);});section.append(h,ol);els.previewClues.append(section); });
  }
  function openPreview() { if (testLetters.length !== puzzle.cells.length) testLetters=Array(puzzle.cells.length).fill(""); previewSelection=puzzle.cells.findIndex(c=>!c.block);previewDirection="across";renderGrid(true);renderPreviewClues();els.preview.hidden=false;document.body.classList.add("cw-modal-open");els.preview.querySelector("button").focus(); }
  function closePreview() { els.preview.hidden=true;document.body.classList.remove("cw-modal-open");root.querySelector('[data-action="preview"]').focus(); }

  els.grid.addEventListener("click", e => { const cell=e.target.closest(".cw-cell");if(!cell)return;const i=Number(cell.dataset.index);if(mode==="block")toggleBlock(i);else selectCell(i,null,true); });
  els.previewGrid.addEventListener("click", e=>{const cell=e.target.closest(".cw-cell");if(cell&&!puzzle.cells[Number(cell.dataset.index)].block)selectCell(Number(cell.dataset.index),null,true,true);});
  root.addEventListener("click", e => {
    const modeButton=e.target.closest("[data-mode]"); if(modeButton){mode=modeButton.dataset.mode;updateControls();announce(`${mode === "letter" ? "Letter" : "Block"} mode.`);return;}
    const clue=e.target.closest(".cw-clue");if(clue){const entry=entries.find(x=>x.key===clue.dataset.key);if(entry)selectCell(entry.cells[0],entry.direction);}
    const size=e.target.closest("[data-size]");if(size){els.width.value=size.dataset.size;els.height.value=size.dataset.size;}
    if(e.target.closest("[data-close]")){els.newDialog.hidden=true;document.body.classList.remove("cw-modal-open");return;}
    const action=e.target.closest("[data-action]")?.dataset.action;if(!action)return;
    ({new:()=>{els.newDialog.hidden=false;document.body.classList.add("cw-modal-open");els.width.focus();},undo,redo,
      symmetry:()=>{const before=snapshot();puzzle.settings.symmetry=!puzzle.settings.symmetry;commit(before,`Rotational symmetry ${puzzle.settings.symmetry?"enabled":"disabled"}.`);},
      preview:openPreview,check:()=>{renderHealth();$("#cw-health-heading").scrollIntoView({behavior:matchMedia("(prefers-reduced-motion: reduce)").matches?"auto":"smooth"});announce(els.health.textContent);},
      import:()=>els.importer.click(),export:exportJSON,print:()=>{document.body.classList.toggle("cw-print-answer",$("#cw-answer-key").checked);window.print();},"close-preview":closePreview,
      "clear-test":()=>{if(confirm("Clear all test-solve letters?")){testLetters=Array(puzzle.cells.length).fill("");renderGrid(true);}},
      "check-cell":()=>{const entered=testLetters[previewSelection]||"",solution=puzzle.cells[previewSelection].letter;if(!entered)announce("This test cell is empty.");else announce(!solution?"No solution letter has been set for this cell.":entered===solution?"That letter is correct.":"That letter does not match the solution.");},
      "reveal-cell":()=>{testLetters[previewSelection]=puzzle.cells[previewSelection].letter||"";renderGrid(true);announce("Cell revealed.");}
    }[action]||(()=>{}))();
  });
  root.addEventListener("input", e => {
    if (e.target.matches(".cw-clue input")) { const row=e.target.closest(".cw-clue"),before=snapshot();puzzle.clues[row.dataset.key]=e.target.value;row.querySelector(".cw-print-clue").textContent=e.target.value||"(No clue)";row.classList.toggle("is-missing",!e.target.value.trim());clearTimeout(clueTimer);clueTimer=setTimeout(()=>{history.push(before);if(history.length>MAX_HISTORY)history.shift();future=[];renderHealth();updateControls();scheduleSave();},500); }
    if ([els.title,els.author,els.notes].includes(e.target)) { const before=snapshot(),field=e.target===els.title?"title":e.target===els.author?"author":"notes";puzzle[field]=e.target.value;if(field==="title")$("#cw-print-title").textContent=e.target.value||"Untitled Crossword";if(field==="author")$("#cw-print-author").textContent=e.target.value?`By ${e.target.value}`:"";clearTimeout(clueTimer);clueTimer=setTimeout(()=>{history.push(before);if(history.length>MAX_HISTORY)history.shift();future=[];updateControls();scheduleSave();},500); }
  });
  els.newDialog.querySelector("form").addEventListener("submit",e=>{e.preventDefault();const w=Number(els.width.value),h=Number(els.height.value);if(!Number.isInteger(w)||!Number.isInteger(h)||w<5||w>25||h<5||h>25){alert("Width and height must be whole numbers from 5 through 25.");return;}if(!confirm("Create a new puzzle and replace the current browser draft?"))return;history.push(snapshot());future=[];puzzle=blankPuzzle(w,h);selection=0;direction="across";testLetters=Array(w*h).fill("");deriveEntries();syncMetadata();render();scheduleSave();els.newDialog.hidden=true;document.body.classList.remove("cw-modal-open");announce(`Created a ${w} by ${h} puzzle.`);});
  els.importer.addEventListener("change",()=>{if(els.importer.files[0])importJSON(els.importer.files[0]);});

  document.addEventListener("keydown",e=>{
    const preview=!els.preview.hidden;
    if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="z" && !activeTextInput()) {e.preventDefault();e.shiftKey?redo():undo();return;}
    if ((e.ctrlKey||e.metaKey) && e.key.toLowerCase()==="y" && !activeTextInput()) {e.preventDefault();redo();return;}
    if(activeTextInput()||(!preview&&!els.grid.contains(document.activeElement)&&!root.contains(document.activeElement)))return;
    if(/^[a-zA-Z]$/.test(e.key)){e.preventDefault();if(preview||mode==="letter")editLetter(e.key.toUpperCase(),preview);return;}
    const movements={ArrowLeft:[0,-1],ArrowRight:[0,1],ArrowUp:[-1,0],ArrowDown:[1,0]};if(movements[e.key]){e.preventDefault();move(...movements[e.key],preview);return;}
    if(e.key==="Enter"){e.preventDefault();selectCell(preview?previewSelection:selection,null,true,preview);return;}
    if(e.key==="Backspace"||e.key==="Delete"){e.preventDefault();erase(e.key==="Backspace",preview);return;}
    if(e.key===" "){e.preventDefault();advance(1,preview);return;}
    if(e.key==="."&&!preview&&mode==="block"){e.preventDefault();toggleBlock();}
    if(e.key==="Escape"&&preview)closePreview();
  });

  puzzle=load()||blankPuzzle();selection=puzzle.cells.findIndex(c=>!c.block);if(selection<0)selection=0;testLetters=Array(puzzle.cells.length).fill("");deriveEntries();syncMetadata();render();
  try { if (localStorage.getItem(STORAGE_KEY)) announce("Your browser draft was restored."); } catch {}
  addEventListener("afterprint",()=>document.body.classList.remove("cw-print-answer"));
})();
