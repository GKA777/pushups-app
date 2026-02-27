/* Daily Push-Ups Tracker
   - P = 10 push-ups per set
   - Hang: seconds + feet touching (f)
   - Stores everything in localStorage
   - Export/Import JSON for backups
*/

const STORAGE_KEY = "daily_pushups_v1";

function pad2(n){ return String(n).padStart(2,"0"); }
function isoDate(d){
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}
function parseISO(s){
  const [y,m,dd] = s.split("-").map(Number);
  return new Date(y, m-1, dd);
}
function monthKey(d){
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
}

// Data model:
// {
//   days: {
//     "2026-02-01": { off:true, pushSets:0, hangs:[{sec:40, feet:true}], notes:"" }
//   }
// }
function loadData(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return { days:{} };
    const obj = JSON.parse(raw);
    if(!obj.days) obj.days = {};
    return obj;
  }catch{
    return { days:{} };
  }
}
function saveData(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function ensureDay(dateStr){
  if(!data.days[dateStr]){
    data.days[dateStr] = { off:false, pushSets:0, hangs:[], notes:"" };
  } else {
    // backward compatibility
    data.days[dateStr].off ??= false;
    data.days[dateStr].pushSets ??= 0;
    data.days[dateStr].hangs ??= [];
    data.days[dateStr].notes ??= "";
  }
  return data.days[dateStr];
}

function hangToToken(h){
  // H40f or H40
  return `H${h.sec}${h.feet ? "f" : ""}`;
}

function dayToLine(day){
  if(day.off) return "DAY OFF";
  const p = "P".repeat(Math.max(0, day.pushSets || 0));
  const hangs = (day.hangs || []).map(hangToToken).join(" ");
  const parts = [];
  if(p) parts.push(p);
  if(hangs) parts.push(hangs);
  return parts.length ? parts.join(" ") : "—";
}

function daySummary(day){
  const reps = (day.pushSets || 0) * 10;
  const hangs = (day.hangs || []).length;
  return `${reps} push-ups · ${hangs} hang${hangs===1?"":"s"}`;
}

function monthTotals(viewDate){
  const y = viewDate.getFullYear();
  const m = viewDate.getMonth();
  let pushSets = 0;
  let hangCount = 0;
  let offDays = 0;

  for(const [k, v] of Object.entries(data.days)){
    const d = parseISO(k);
    if(d.getFullYear() === y && d.getMonth() === m){
      if(v.off) offDays += 1;
      pushSets += (v.pushSets || 0);
      hangCount += (v.hangs || []).length;
    }
  }
  return { reps: pushSets*10, hangs: hangCount, offDays };
}

// UI elements
const calendarGrid = document.getElementById("calendarGrid");
const monthLabel = document.getElementById("monthLabel");
const monthTotalsEl = document.getElementById("monthTotals");

const selectedDateLabel = document.getElementById("selectedDateLabel");
const selectedSummary = document.getElementById("selectedSummary");
const btnDayOff = document.getElementById("btnDayOff");

const pushSetsInput = document.getElementById("pushSets");
const btnPPlus = document.getElementById("btnPPlus");
const btnPMinus = document.getElementById("btnPMinus");

const hangSeconds = document.getElementById("hangSeconds");
const hangFeet = document.getElementById("hangFeet");
const btnAddHang = document.getElementById("btnAddHang");
const hangList = document.getElementById("hangList");

const notesEl = document.getElementById("notes");
const btnSave = document.getElementById("btnSave");
const btnClearDay = document.getElementById("btnClearDay");

const logLine = document.getElementById("logLine");
const btnCopyLine = document.getElementById("btnCopyLine");

const btnPrev = document.getElementById("btnPrev");
const btnNext = document.getElementById("btnNext");
const btnToday = document.getElementById("btnToday");

const btnExport = document.getElementById("btnExport");
const fileImport = document.getElementById("fileImport");

// App state
let data = loadData();
let viewDate = new Date();
viewDate.setDate(1);

let selectedDateStr = null;

// Calendar rendering
function renderCalendar(){
  const y = viewDate.getFullYear();
  const m = viewDate.getMonth();
  const first = new Date(y, m, 1);
  const last = new Date(y, m+1, 0);
  const startDow = first.getDay(); // 0=Sun
  const daysInMonth = last.getDate();

  monthLabel.textContent = first.toLocaleString(undefined, { month:"long", year:"numeric" });

  const t = monthTotals(viewDate);
  monthTotalsEl.textContent = `${t.reps} push-ups · ${t.hangs} hangs · ${t.offDays} off day${t.offDays===1?"":"s"}`;

  calendarGrid.innerHTML = "";

  // Determine previous month trailing days for grid alignment
  const prevLast = new Date(y, m, 0);
  const prevDays = prevLast.getDate();

  // 6 rows * 7 columns = 42 cells
  for(let i=0; i<42; i++){
    const cell = document.createElement("div");
    cell.className = "day";

    let dayNum, dateObj, inThisMonth = true;

    if(i < startDow){
      // previous month
      dayNum = prevDays - (startDow - 1 - i);
      dateObj = new Date(y, m-1, dayNum);
      inThisMonth = false;
      cell.classList.add("muted");
    } else if(i >= startDow + daysInMonth){
      // next month
      dayNum = i - (startDow + daysInMonth) + 1;
      dateObj = new Date(y, m+1, dayNum);
      inThisMonth = false;
      cell.classList.add("muted");
    } else {
      dayNum = i - startDow + 1;
      dateObj = new Date(y, m, dayNum);
    }

    const ds = isoDate(dateObj);
    const day = data.days[ds];

    const top = document.createElement("div");
    top.className = "n";
    top.innerHTML = `<span>${dayNum}</span>`;

    const badge = document.createElement("span");
    badge.className = "badge";
    if(day?.off){
      badge.textContent = "OFF";
      badge.classList.add("off");
    } else {
      const reps = (day?.pushSets || 0) * 10;
      const hangs = (day?.hangs || []).length;
      badge.textContent = reps || hangs ? `${reps}·${hangs}` : "";
      if(!badge.textContent) badge.style.borderColor="transparent";
    }
    top.appendChild(badge);

    const sum = document.createElement("div");
    sum.className = "sum";
    if(day){
      sum.textContent = dayToLine(day);
    } else {
      sum.textContent = "";
    }

    cell.appendChild(top);
    cell.appendChild(sum);

    if(ds === selectedDateStr){
      cell.classList.add("selected");
    }

    cell.addEventListener("click", () => {
      selectedDateStr = ds;
      ensureDay(ds);
      renderCalendar();
      renderEditor();
    });

    calendarGrid.appendChild(cell);
  }
}

function renderHangList(day){
  hangList.innerHTML = "";
  const hangs = day.hangs || [];
  if(!hangs.length){
    const empty = document.createElement("div");
    empty.className = "mini";
    empty.textContent = "No hangs logged for this day.";
    hangList.appendChild(empty);
    return;
  }
  hangs.forEach((h, idx) => {
    const item = document.createElement("div");
    item.className = "hang-item";
    const left = document.createElement("div");
    left.className = "left";
    left.textContent = hangToToken(h);
    const right = document.createElement("div");
    right.className = "right";
    const del = document.createElement("button");
    del.className = "btn btn-danger small";
    del.textContent = "Remove";
    del.addEventListener("click", () => {
      hangs.splice(idx, 1);
      day.hangs = hangs;
      saveData();
      renderEditor();
      renderCalendar();
    });
    right.appendChild(del);
    item.appendChild(left);
    item.appendChild(right);
    hangList.appendChild(item);
  });
}

function renderEditor(){
  if(!selectedDateStr){
    selectedDateLabel.textContent = "Select a day";
    selectedSummary.textContent = "";
    pushSetsInput.value = 0;
    notesEl.value = "";
    hangList.innerHTML = "";
    logLine.textContent = "—";
    return;
  }

  const d = parseISO(selectedDateStr);
  const day = ensureDay(selectedDateStr);

  selectedDateLabel.textContent = d.toLocaleDateString(undefined, { weekday:"long", month:"long", day:"numeric", year:"numeric" });
  selectedSummary.textContent = day.off ? "DAY OFF" : daySummary(day);

  pushSetsInput.value = day.pushSets || 0;
  notesEl.value = day.notes || "";

  btnDayOff.textContent = day.off ? "Unmark Day Off" : "Toggle Day Off";

  renderHangList(day);

  logLine.textContent = dayToLine(day);
}

function commitEditorToDay(){
  if(!selectedDateStr) return;
  const day = ensureDay(selectedDateStr);

  const sets = Number(pushSetsInput.value || 0);
  day.pushSets = Math.max(0, Math.floor(sets));

  day.notes = notesEl.value || "";

  // if day off, keep data but you can choose to clear it:
  // (we'll keep it, so you can flip off/on without losing work)

  data.days[selectedDateStr] = day;
  saveData();
}

// Controls
btnPrev.addEventListener("click", () => {
  viewDate.setMonth(viewDate.getMonth() - 1);
  renderCalendar();
});

btnNext.addEventListener("click", () => {
  viewDate.setMonth(viewDate.getMonth() + 1);
  renderCalendar();
});

btnToday.addEventListener("click", () => {
  const now = new Date();
  viewDate = new Date(now.getFullYear(), now.getMonth(), 1);
  selectedDateStr = isoDate(now);
  ensureDay(selectedDateStr);
  renderCalendar();
  renderEditor();
});

btnPPlus.addEventListener("click", () => {
  pushSetsInput.value = String(Number(pushSetsInput.value || 0) + 1);
  renderEditorPreview();
});

btnPMinus.addEventListener("click", () => {
  pushSetsInput.value = String(Math.max(0, Number(pushSetsInput.value || 0) - 1));
  renderEditorPreview();
});

pushSetsInput.addEventListener("input", renderEditorPreview);
notesEl.addEventListener("input", () => { /* no need to live preview notes */ });

btnDayOff.addEventListener("click", () => {
  if(!selectedDateStr) return;
  const day = ensureDay(selectedDateStr);
  day.off = !day.off;
  saveData();
  renderEditor();
  renderCalendar();
});

btnAddHang.addEventListener("click", () => {
  if(!selectedDateStr) return;
  const sec = Number(hangSeconds.value || 0);
  if(!sec || sec <= 0) return;

  const day = ensureDay(selectedDateStr);
  day.hangs = day.hangs || [];
  day.hangs.push({ sec: Math.floor(sec), feet: !!hangFeet.checked });

  hangSeconds.value = "";
  saveData();
  renderEditor();
  renderCalendar();
});

btnSave.addEventListener("click", () => {
  commitEditorToDay();
  renderEditor();
  renderCalendar();
});

btnClearDay.addEventListener("click", () => {
  if(!selectedDateStr) return;
  if(!confirm("Clear this day? (Push-ups, hangs, notes, and off flag)")) return;
  delete data.days[selectedDateStr];
  saveData();
  renderEditor();
  renderCalendar();
});

btnCopyLine.addEventListener("click", async () => {
  const text = logLine.textContent || "";
  try{
    await navigator.clipboard.writeText(text);
    btnCopyLine.textContent = "Copied!";
    setTimeout(()=> btnCopyLine.textContent = "Copy line", 800);
  }catch{
    alert("Clipboard copy failed. You can manually select and copy the line.");
  }
});

function renderEditorPreview(){
  if(!selectedDateStr) return;
  const day = ensureDay(selectedDateStr);

  const sets = Number(pushSetsInput.value || 0);
  const temp = {
    off: day.off,
    pushSets: Math.max(0, Math.floor(sets)),
    hangs: day.hangs || [],
    notes: day.notes || ""
  };

  selectedSummary.textContent = temp.off ? "DAY OFF" : daySummary(temp);
  logLine.textContent = dayToLine(temp);
}

// Export / Import
btnExport.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:"application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `daily-pushups-backup-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

fileImport.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if(!file) return;
  try{
    const text = await file.text();
    const obj = JSON.parse(text);
    if(!obj || typeof obj !== "object" || !obj.days) throw new Error("Invalid format");
    data = obj;
    saveData();
    // Re-render
    renderCalendar();
    renderEditor();
    alert("Import complete.");
  }catch(err){
    alert("Import failed: " + (err?.message || "Unknown error"));
  } finally {
    fileImport.value = "";
  }
});

// Init
(function init(){
  // Default select today on load
  const now = new Date();
  selectedDateStr = isoDate(now);
  ensureDay(selectedDateStr);

  // Set view to current month
  viewDate = new Date(now.getFullYear(), now.getMonth(), 1);

  renderCalendar();
  renderEditor();
})();