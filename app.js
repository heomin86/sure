const STORAGE_KEY = "gagye.entries.v1";
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

const form = document.querySelector("#entry-form");
const monthLabel = document.querySelector("#month-label");
const prevButton = document.querySelector("#prev-month");
const nextButton = document.querySelector("#next-month");
const incomeEl = document.querySelector("#total-income");
const expenseEl = document.querySelector("#total-expense");
const balanceEl = document.querySelector("#total-balance");
const listEl = document.querySelector("#entry-list");
const emptyEl = document.querySelector("#empty");
const countEl = document.querySelector("#entry-count");
const errorEl = document.querySelector("#form-error");
const dateInput = document.querySelector("#entry-date");
const amountInput = document.querySelector("#entry-amount");

let entries = loadEntries();

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEntry);
  } catch {
    return [];
  }
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

function formatKRW(amount) {
  return `${amount.toLocaleString("ko-KR")}원`;
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
  const meta = document.createElement("p");
  meta.className = "entry-meta";
  meta.textContent = `${Number(month)}월 ${Number(day)}일 · ${kind} · ${entry.category}`;

  const memo = document.createElement("p");
  memo.className = "entry-memo";
  if (entry.memo) {
    memo.textContent = entry.memo;
  } else {
    memo.textContent = "메모 없음";
    memo.classList.add("muted");
  }

  const amount = document.createElement("p");
  amount.className = "entry-amount";
  amount.textContent = entry.type === "expense" ? `−${formatKRW(entry.amount)}` : formatKRW(entry.amount);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "delete";
  button.textContent = "삭제";
  button.setAttribute(
    "aria-label",
    `${Number(month)}월 ${Number(day)}일 ${entry.category} ${formatKRW(entry.amount)} 삭제`
  );
  button.addEventListener("click", () => removeEntry(entry.id));

  const side = document.createElement("div");
  side.className = "entry-side";
  side.append(amount, button);
  main.append(meta, memo);
  li.append(main, side);
  return li;
}

function render() {
  const { year, monthIndex } = viewedMonth();
  const key = monthKey(year, monthIndex);
  monthLabel.textContent = `${year}년 ${monthIndex + 1}월`;
  prevButton.disabled = year === MIN_YEAR && monthIndex === 0;
  nextButton.disabled = year === MAX_YEAR && monthIndex === 11;

  const monthEntries = entries.filter((entry) => entry.date.startsWith(`${key}-`)).sort(compareEntries);

  let income = 0;
  let expense = 0;
  for (const entry of monthEntries) {
    if (entry.type === "income") income += entry.amount;
    else expense += entry.amount;
  }
  const balance = income - expense;

  incomeEl.textContent = formatKRW(income);
  expenseEl.textContent = formatKRW(expense);
  balanceEl.textContent = `${balance < 0 ? "−" : ""}${formatKRW(Math.abs(balance))}`;
  balanceEl.classList.toggle("negative", balance < 0);
  countEl.textContent = `${monthEntries.length}건`;

  listEl.replaceChildren(...monthEntries.map(renderItem));
  emptyEl.hidden = monthEntries.length > 0;

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
  if (!window.confirm("이 기록을 삭제할까요?")) return;
  const next = entries.filter((entry) => entry.id !== id);
  if (next.length === entries.length) return;
  const previous = entries;
  entries = next;
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

  if (!isDateInRange(date)) {
    showError("2000년부터 2100년 사이의 날짜를 선택해 주세요.");
    return;
  }
  if (amount == null) {
    showError("금액은 1원 이상으로 입력해 주세요.");
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
