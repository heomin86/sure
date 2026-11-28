const STORAGE_KEY = "gagye.entries.v1";
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;
const CYCLES = ["none", "daily", "weekly", "biweekly", "monthly", "yearly"];
const CYCLE_LABEL = {
  daily: "매일",
  weekly: "매주",
  biweekly: "2주마다",
  monthly: "매월",
  yearly: "매년",
};
const CURRENCIES = ["KRW", "AUD"];
const SEEDED = [
  {
    id: "seed-aud-grocery-weekly-20261128",
    type: "expense",
    date: "2026-11-28",
    amount: 200,
    category: "식비",
    memo: "장보기",
    cycle: "weekly",
    currency: "AUD",
    createdAt: "2026-11-28T00:00:00.000Z",
  },
  {
    id: "seed-aud-dining-biweekly-20261128",
    type: "expense",
    date: "2026-11-28",
    amount: 100,
    category: "식비",
    memo: "외식",
    cycle: "biweekly",
    currency: "AUD",
    createdAt: "2026-11-28T00:00:01.000Z",
  },
];

const form = document.querySelector("#entry-form");
const monthLabel = document.querySelector("#month-label");
const prevButton = document.querySelector("#prev-month");
const nextButton = document.querySelector("#next-month");
const incomeEl = document.querySelector("#total-income");
const expenseEl = document.querySelector("#total-expense");
const balanceEl = document.querySelector("#total-balance");
const listEl = document.querySelector("#entry-list");
const dashFacts = document.querySelector("#dash-facts");
const dashExpenseCats = document.querySelector("#dash-expense-cats");
const dashExpenseEmpty = document.querySelector("#dash-expense-empty");
const dashIncomeBlock = document.querySelector("#dash-income-block");
const dashIncomeCats = document.querySelector("#dash-income-cats");
const emptyEl = document.querySelector("#empty");
const countEl = document.querySelector("#entry-count");
const errorEl = document.querySelector("#form-error");
const dateInput = document.querySelector("#entry-date");
const amountInput = document.querySelector("#entry-amount");
const cycleInput = document.querySelector("#entry-cycle");

let entries = loadEntries();

function loadEntries() {
  let list = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed.filter(isValidEntry);
    }
  } catch {
    list = [];
  }
  return mergeSeeded(list);
}

function mergeSeeded(list) {
  const ids = new Set(list.map((entry) => entry.id));
  const missing = SEEDED.filter((entry) => !ids.has(entry.id));
  if (missing.length === 0) return list;
  const next = list.concat(missing);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Keep the merged list on screen even if this browser cannot store it.
  }
  return next;
}

function isValidEntry(item) {
  if (!item || typeof item !== "object") return false;
  if (typeof item.id !== "string" || item.id.length === 0) return false;
  if (item.type !== "income" && item.type !== "expense") return false;
  if (!isDateInRange(item.date)) return false;
  if (!Number.isSafeInteger(item.amount) || item.amount < 1 || item.amount > 999_999_999_999) return false;
  if (typeof item.category !== "string") return false;
  const category = item.category.trim();
  if (category.length < 1 || category.length > 20) return false;
  if (typeof item.memo !== "string" || item.memo.length > 80) return false;
  if (item.cycle != null && !CYCLES.includes(item.cycle)) return false;
  if (item.currency != null && !CURRENCIES.includes(item.currency)) return false;
  return true;
}

function saveEntries() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function monthKey(year, monthIndex) {
  return `${year}-${pad(monthIndex + 1)}`;
}

function isDateInRange(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < MIN_YEAR || year > MAX_YEAR || month < 1 || month > 12) return false;
  const lastDay = new Date(year, month, 0).getDate();
  return day >= 1 && day <= lastDay;
}

function parseHash() {
  const match = /^#(\d{4})-(\d{2})$/.exec(location.hash);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < MIN_YEAR || year > MAX_YEAR || month < 1 || month > 12) return null;
  return { year, monthIndex: month - 1 };
}

function currentMonth() {
  const now = new Date();
  const year = Math.min(MAX_YEAR, Math.max(MIN_YEAR, now.getFullYear()));
  return { year, monthIndex: now.getMonth() };
}

function viewedMonth() {
  return parseHash() || currentMonth();
}

function currencyOf(entry) {
  return entry.currency === "AUD" ? "AUD" : "KRW";
}

function formatMoney(amount, currency) {
  if (currency === "AUD") return `A$${amount.toLocaleString("en-AU")}`;
  return `${amount.toLocaleString("ko-KR")}원`;
}

function formatSigned(amount, currency) {
  const body = formatMoney(Math.abs(amount), currency);
  return amount < 0 ? `−${body}` : body;
}

function normalizeDigits(raw) {
  return String(raw).replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

function parseAmount(raw) {
  const digits = normalizeDigits(raw).replace(/\D/g, "");
  if (!digits) return null;
  const amount = Number(digits);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 999_999_999_999) return null;
  return amount;
}

function cycleOf(entry) {
  return CYCLES.includes(entry.cycle) ? entry.cycle : "none";
}

function weekdayOf(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).getDay();
}

function daysBetween(start, date) {
  const [startYear, startMonth, startDay] = start.split("-").map(Number);
  const [year, month, day] = date.split("-").map(Number);
  const startUtc = Date.UTC(startYear, startMonth - 1, startDay);
  const dateUtc = Date.UTC(year, month - 1, day);
  return Math.round((dateUtc - startUtc) / 86400000);
}

function occursOn(entry, date) {
  const cycle = cycleOf(entry);
  if (cycle === "none") return date === entry.date;
  if (date < entry.date) return false;
  if (cycle === "daily") return true;
  if (cycle === "weekly") return weekdayOf(date) === weekdayOf(entry.date);
  if (cycle === "biweekly") return daysBetween(entry.date, date) % 14 === 0;
  if (cycle === "monthly") return Number(date.slice(8)) === Number(entry.date.slice(8));
  if (cycle === "yearly") return date.slice(5) === entry.date.slice(5);
  return false;
}

function rowsInMonth(year, monthIndex) {
  const key = monthKey(year, monthIndex);
  const last = new Date(year, monthIndex + 1, 0).getDate();
  const rows = [];
  for (const entry of entries) {
    if (cycleOf(entry) === "none") {
      if (entry.date.startsWith(`${key}-`)) rows.push(entry);
      continue;
    }
    for (let day = 1; day <= last; day += 1) {
      const date = `${key}-${pad(day)}`;
      if (!occursOn(entry, date)) continue;
      rows.push({ ...entry, date });
    }
  }
  return rows.sort(compareEntries);
}

function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = message.length === 0;
}

function defaultDateFor(year, monthIndex) {
  const now = new Date();
  if (now.getFullYear() === year && now.getMonth() === monthIndex) {
    return `${year}-${pad(monthIndex + 1)}-${pad(now.getDate())}`;
  }
  return `${year}-${pad(monthIndex + 1)}-01`;
}

function compareEntries(a, b) {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  const aCreated = a.createdAt || "";
  const bCreated = b.createdAt || "";
  if (aCreated !== bCreated) return aCreated < bCreated ? 1 : -1;
  return a.id < b.id ? 1 : -1;
}

function renderItem(entry) {
  const li = document.createElement("li");
  li.className = `entry entry-${entry.type}`;

  const main = document.createElement("div");
  main.className = "entry-main";

  const [, month, day] = entry.date.split("-");
  const kind = entry.type === "income" ? "수입" : "지출";
  const cycle = cycleOf(entry);
  const cycleLabel = CYCLE_LABEL[cycle] ? ` · ${CYCLE_LABEL[cycle]}` : "";
  const meta = document.createElement("p");
  meta.className = "entry-meta";
  meta.textContent = `${Number(month)}월 ${Number(day)}일 · ${kind} · ${entry.category}${cycleLabel}`;

  const memo = document.createElement("p");
  memo.className = "entry-memo";
  if (entry.memo) {
    memo.textContent = entry.memo;
  } else {
    memo.textContent = "메모 없음";
    memo.classList.add("muted");
  }

  const money = formatMoney(entry.amount, currencyOf(entry));
  const amount = document.createElement("p");
  amount.className = "entry-amount";
  amount.textContent = entry.type === "expense" ? `−${money}` : money;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "delete";
  button.textContent = "삭제";
  button.setAttribute(
    "aria-label",
    cycle === "none"
      ? `${Number(month)}월 ${Number(day)}일 ${entry.category} ${money} 삭제`
      : `${entry.category} ${CYCLE_LABEL[cycle]} 기록 전체 삭제`
  );
  button.addEventListener("click", () => removeEntry(entry.id));

  const side = document.createElement("div");
  side.className = "entry-side";
  side.append(amount, button);
  main.append(meta, memo);
  li.append(main, side);
  return li;
}

function expenseTotals(rows) {
  const totals = { KRW: 0, AUD: 0 };
  for (const row of rows) {
    if (row.type === "expense") totals[currencyOf(row)] += row.amount;
  }
  return totals;
}

function previousMonth(year, monthIndex) {
  const shifted = new Date(year, monthIndex - 1, 1);
  if (shifted.getFullYear() < MIN_YEAR) return null;
  return { year: shifted.getFullYear(), monthIndex: shifted.getMonth() };
}

function factItem(term, value) {
  const wrap = document.createElement("div");
  const termEl = document.createElement("dt");
  termEl.textContent = term;
  const valueEl = document.createElement("dd");
  valueEl.textContent = value;
  wrap.append(termEl, valueEl);
  return wrap;
}

function comparisonText(year, monthIndex, currentExpense) {
  const previous = previousMonth(year, monthIndex);
  if (!previous) return "비교할 이전 달이 없습니다.";
  const prior = expenseTotals(rowsInMonth(previous.year, previous.monthIndex));
  const lines = [];
  for (const currency of ["KRW", "AUD"]) {
    if (!currentExpense[currency] && !prior[currency]) continue;
    const diff = currentExpense[currency] - prior[currency];
    if (diff === 0) lines.push(`${formatMoney(0, currency)} 같음`);
    else if (diff > 0) lines.push(`${formatMoney(diff, currency)} 더 씀`);
    else lines.push(`${formatMoney(-diff, currency)} 덜 씀`);
  }
  return lines.length ? lines.join(" · ") : "지출 없음";
}

function averageText(expense, days) {
  const lines = [];
  for (const currency of ["KRW", "AUD"]) {
    if (!expense[currency]) continue;
    lines.push(formatMoney(Math.round(expense[currency] / days), currency));
  }
  return lines.length ? lines.join(" · ") : "지출 없음";
}

function largestExpenseText(rows) {
  const largest = { KRW: null, AUD: null };
  for (const row of rows) {
    if (row.type !== "expense") continue;
    const currency = currencyOf(row);
    if (!largest[currency] || row.amount > largest[currency].amount) largest[currency] = row;
  }
  const lines = [];
  for (const currency of ["KRW", "AUD"]) {
    const row = largest[currency];
    if (!row) continue;
    const day = Number(row.date.slice(8));
    const name = row.memo || row.category;
    lines.push(`${day}일 ${name} ${formatMoney(row.amount, currency)}`);
  }
  return lines.length ? lines.join(" · ") : "없음";
}

function mixText(rows) {
  let repeating = 0;
  let once = 0;
  for (const row of rows) {
    if (cycleOf(row) === "none") once += 1;
    else repeating += 1;
  }
  if (repeating === 0 && once === 0) return "기록 없음";
  const parts = [];
  if (repeating) parts.push(`반복 ${repeating}건`);
  if (once) parts.push(`한 번 ${once}건`);
  return parts.join(" · ");
}

function categoryGroups(rows, type) {
  const groups = new Map();
  for (const row of rows) {
    if (row.type !== type) continue;
    const currency = currencyOf(row);
    const key = `${currency}:${row.category}`;
    const current = groups.get(key) || {
      category: row.category,
      currency,
      amount: 0,
      count: 0,
    };
    current.amount += row.amount;
    current.count += 1;
    groups.set(key, current);
  }
  return [...groups.values()].sort((a, b) => b.amount - a.amount || (a.category < b.category ? -1 : 1));
}

function renderCategoryList(rows, type, listEl) {
  const items = categoryGroups(rows, type);
  const totals = {};
  for (const item of items) totals[item.currency] = (totals[item.currency] || 0) + item.amount;
  const max = items.reduce((highest, item) => Math.max(highest, item.amount), 0);
  listEl.replaceChildren(...items.map((item) => {
    const li = document.createElement("li");
    li.className = "dash-cat";
    const top = document.createElement("div");
    top.className = "dash-cat-top";
    const name = document.createElement("span");
    const share = Math.round((item.amount / totals[item.currency]) * 100);
    name.textContent = `${item.category} · ${item.count}건 · ${share}%`;
    const amount = document.createElement("span");
    amount.textContent = formatMoney(item.amount, item.currency);
    top.append(name, amount);
    const track = document.createElement("div");
    track.className = "dash-track";
    const fill = document.createElement("div");
    fill.className = type === "income" ? "dash-fill dash-fill-income" : "dash-fill";
    fill.style.width = `${Math.max(8, Math.round((item.amount / max) * 100))}%`;
    track.append(fill);
    li.append(top, track);
    return li;
  }));
}

function renderDashboard(rows, year, monthIndex) {
  const expense = expenseTotals(rows);
  const days = new Date(year, monthIndex + 1, 0).getDate();
  const now = new Date();
  const facts = [
    factItem("지난달 지출", comparisonText(year, monthIndex, expense)),
    factItem("하루 평균", averageText(expense, days)),
    factItem("가장 큰 지출", largestExpenseText(rows)),
    factItem("기록 구성", mixText(rows)),
  ];
  if (now.getFullYear() === year && now.getMonth() === monthIndex) {
    const left = days - now.getDate();
    facts.push(factItem("남은 날", left === 0 ? "오늘이 마지막 날" : `${left}일`));
  }
  dashFacts.replaceChildren(...facts);

  const expenseItems = categoryGroups(rows, "expense");
  dashExpenseEmpty.hidden = expenseItems.length > 0;
  renderCategoryList(rows, "expense", dashExpenseCats);

  const incomeItems = categoryGroups(rows, "income");
  dashIncomeBlock.hidden = incomeItems.length === 0;
  renderCategoryList(rows, "income", dashIncomeCats);
}

function render() {
  const { year, monthIndex } = viewedMonth();
  const key = monthKey(year, monthIndex);
  monthLabel.textContent = `${year}년 ${monthIndex + 1}월`;
  prevButton.disabled = year === MIN_YEAR && monthIndex === 0;
  nextButton.disabled = year === MAX_YEAR && monthIndex === 11;

  const rows = rowsInMonth(year, monthIndex);
  const income = { KRW: 0, AUD: 0 };
  const expense = { KRW: 0, AUD: 0 };
  for (const entry of rows) {
    const currency = currencyOf(entry);
    if (entry.type === "income") income[currency] += entry.amount;
    else expense[currency] += entry.amount;
  }
  const currencies = [];
  if (income.KRW || expense.KRW) currencies.push("KRW");
  if (income.AUD || expense.AUD) currencies.push("AUD");
  if (currencies.length === 0) currencies.push("KRW");

  incomeEl.textContent = currencies.map((currency) => formatMoney(income[currency], currency)).join(" · ");
  expenseEl.textContent = currencies.map((currency) => formatMoney(expense[currency], currency)).join(" · ");
  balanceEl.textContent = currencies.map((currency) => formatSigned(income[currency] - expense[currency], currency)).join(" · ");
  balanceEl.classList.toggle("negative", currencies.some((currency) => income[currency] - expense[currency] < 0));
  countEl.textContent = `${rows.length}건`;
  renderDashboard(rows, year, monthIndex);

  listEl.replaceChildren(...rows.map(renderItem));
  emptyEl.hidden = rows.length > 0;

  if (!dateInput.value.startsWith(key)) {
    dateInput.value = defaultDateFor(year, monthIndex);
  }
}

function goToMonth(year, monthIndex, replace) {
  const next = `#${monthKey(year, monthIndex)}`;
  if (location.hash !== next) {
    if (replace) history.replaceState(null, "", next);
    else location.hash = next;
  }
  render();
}

function shiftMonth(delta) {
  const { year, monthIndex } = viewedMonth();
  const shifted = new Date(year, monthIndex + delta, 1);
  const nextYear = shifted.getFullYear();
  if (nextYear < MIN_YEAR || nextYear > MAX_YEAR) return;
  goToMonth(nextYear, shifted.getMonth(), false);
}

function removeEntry(id) {
  const current = entries.find((entry) => entry.id === id);
  if (!current) return;
  const message = cycleOf(current) === "none"
    ? "이 기록을 삭제할까요?"
    : "이 반복 기록을 삭제할까요? 다른 달에서도 빠집니다.";
  if (!window.confirm(message)) return;
  const previous = entries;
  entries = entries.filter((entry) => entry.id !== id);
  if (!saveEntries()) {
    entries = previous;
    showError("이 브라우저에 저장하지 못했습니다.");
    return;
  }
  showError("");
  render();
}

amountInput.addEventListener("blur", () => {
  const amount = parseAmount(amountInput.value);
  if (amount != null) amountInput.value = amount.toLocaleString("ko-KR");
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  showError("");

  const data = new FormData(form);
  const type = data.get("type") === "income" ? "income" : "expense";
  const date = String(data.get("date") || "");
  const amount = parseAmount(data.get("amount"));
  const picked = String(data.get("category") || "").trim();
  const custom = String(data.get("customCategory") || "").trim();
  const category = custom || picked;
  const memo = String(data.get("memo") || "").trim();
  const cycle = String(data.get("cycle") || "");

  if (!isDateInRange(date)) {
    showError("2000년부터 2100년 사이의 날짜를 선택해 주세요.");
    return;
  }
  if (!CYCLES.includes(cycle)) {
    showError("반복을 선택해 주세요.");
    return;
  }
  const currency = String(data.get("currency") || "");
  if (amount == null) {
    showError("금액은 1 이상으로 입력해 주세요.");
    return;
  }
  if (!CURRENCIES.includes(currency)) {
    showError("통화를 선택해 주세요.");
    return;
  }
  if (category.length < 1 || category.length > 20) {
    showError("분류는 20자 이내로 입력해 주세요.");
    return;
  }
  if (memo.length > 80) {
    showError("메모는 80자 이내로 입력해 주세요.");
    return;
  }

  const entry = {
    id: newId(),
    type,
    date,
    amount,
    category,
    memo,
    cycle,
    currency,
    createdAt: new Date().toISOString(),
  };
  entries = entries.concat(entry);
  if (!saveEntries()) {
    entries = entries.filter((item) => item.id !== entry.id);
    showError("이 브라우저에 저장하지 못했습니다.");
    return;
  }

  amountInput.value = "";
  form.elements.memo.value = "";
  form.elements.customCategory.value = "";
  cycleInput.value = "none";
  const [year, month] = date.split("-").map(Number);
  goToMonth(year, month - 1, false);
});

prevButton.addEventListener("click", () => shiftMonth(-1));
nextButton.addEventListener("click", () => shiftMonth(1));
window.addEventListener("hashchange", () => {
  if (!parseHash()) {
    const now = currentMonth();
    goToMonth(now.year, now.monthIndex, true);
    return;
  }
  render();
});

const initial = parseHash() || currentMonth();
goToMonth(initial.year, initial.monthIndex, true);
