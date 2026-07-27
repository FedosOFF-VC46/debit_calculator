const currency = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 2,
});

const number = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 2,
});

const dateFormat = new Intl.DateTimeFormat("ru-RU");
const STORAGE_KEY = "debit-calculator-data-v2";
const EMPTY_DATA = {
  settings: {
    dailyPenaltyRate: 0.0001,
    asOfDate: "2026-07-27",
  },
  periods: [],
  records: [],
};

const state = {
  data: null,
  activeTab: "overview",
  selectedCompany: null,
  selectedRecordId: null,
  isAddingNewCompany: false,
  isAddingNewCity: false,
  isAddingNewStreet: false,
  editingPeriodId: null,
  editingPeriodDueDate: "",
  recordFormCompany: "",
  recordFormCity: "",
  recordFormStreet: "",
  recordFormMonth: "",
  recordFormYear: "",
  isOverviewModalOpen: false,
  overviewOpenFilter: null,
  overviewFilters: {
    cities: [],
    streets: [],
    months: [],
    years: [],
    paymentDateStatus: [],
    monthSort: "none",
    yearSort: "none",
  },
  registryOpenFilter: null,
  registryFilters: {
    companies: [],
    cities: [],
    streets: [],
    months: [],
    years: [],
    paymentDateStatus: [],
    monthSort: "none",
    yearSort: "none",
  },
  workspaceOpenFilter: null,
  workspaceFilters: {
    companies: [],
    cities: [],
    streets: [],
    months: [],
    years: [],
    paymentDateStatus: [],
  },
  saving: false,
};

const MONTH_OPTIONS = [
  "Декабрь",
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
];

const YEAR_OPTIONS = [2024, 2025, 2026];
const PAYMENT_DATE_STATUS_OPTIONS = ["Есть неизвестные даты", "Все даты указаны"];

const MONTH_ORDER = Object.fromEntries(MONTH_OPTIONS.map((month, index) => [month, index + 1]));
const MONTH_TO_ISO = {
  Январь: "01",
  Февраль: "02",
  Март: "03",
  Апрель: "04",
  Май: "05",
  Июнь: "06",
  Июль: "07",
  Август: "08",
  Сентябрь: "09",
  Октябрь: "10",
  Ноябрь: "11",
  Декабрь: "12",
};
let toastTimerSeed = 0;

function formatMoney(value) {
  return currency.format(value || 0);
}

function formatDate(value) {
  if (!value) {
    return "Не задан";
  }
  return dateFormat.format(new Date(`${value}T00:00:00Z`));
}

function formatPaymentDate(payment) {
  if (payment?.isDateUnknown || payment?.dateUnknown || !payment?.date) {
    return "Дата неизвестна";
  }
  return formatDate(payment.date);
}

function toNumber(value) {
  return Number.parseFloat(String(value || "").replace(",", "."));
}

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getTodayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function showToast(title, copy) {
  const stack = document.getElementById("toast-stack");
  if (!stack) {
    return;
  }

  const toast = document.createElement("article");
  toast.className = "toast";
  toast.innerHTML = `
    <strong class="toast-title">${title}</strong>
    <p class="toast-copy">${copy}</p>
  `;

  stack.appendChild(toast);
  const timerId = ++toastTimerSeed;
  window.setTimeout(() => {
    if (timerId > 0) {
      toast.remove();
    }
  }, 2800);
}

function capitalizeMonth(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) {
    return "";
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatPeriod(period) {
  if (!period) {
    return "Без периода";
  }
  return `${period.month} ${period.year}`;
}

function formatLocation(record) {
  const city = String(record?.city || "").trim();
  const street = String(record?.street || "").trim();
  return street ? `${city}, ${street}` : city || "—";
}

function compareNullableDates(left, right, direction = "desc") {
  const leftValue = left ? new Date(`${left}T00:00:00Z`).getTime() : null;
  const rightValue = right ? new Date(`${right}T00:00:00Z`).getTime() : null;

  if (leftValue === null && rightValue === null) return 0;
  if (leftValue === null) return 1;
  if (rightValue === null) return -1;
  return direction === "asc" ? leftValue - rightValue : rightValue - leftValue;
}

function comparePeriods(left, right, direction = "desc") {
  const leftValue = Number(left.periodYear || 0) * 100 + (MONTH_ORDER[left.periodMonth] || 0);
  const rightValue = Number(right.periodYear || 0) * 100 + (MONTH_ORDER[right.periodMonth] || 0);
  return direction === "asc" ? leftValue - rightValue : rightValue - leftValue;
}

function isMultiSelected(values, candidate) {
  return !values.length || values.includes(String(candidate));
}

function compareWithDirection(left, right, direction) {
  if (direction === "none") {
    return 0;
  }
  return direction === "asc" ? left - right : right - left;
}

function toggleOverviewFilter(name) {
  state.overviewOpenFilter = state.overviewOpenFilter === name ? null : name;
}

function formatFilterSummary(label, values) {
  if (!values.length) {
    return label;
  }
  return `${label}: ${values.length}`;
}

function matchesPaymentDateStatus(record, selectedStatuses) {
  if (!selectedStatuses.length) {
    return true;
  }
  const hasUnknown = Boolean(record.hasUnknownPaymentDates);
  return selectedStatuses.some((status) => {
    if (status === "Есть неизвестные даты") {
      return hasUnknown;
    }
    if (status === "Все даты указаны") {
      return !hasUnknown;
    }
    return true;
  });
}

function renderOverviewCheckboxOptions(name, options, selectedValues) {
  return options
    .map(
      (option) => `
        <label class="filter-option">
          <input
            type="checkbox"
            data-overview-filter-check="${name}"
            value="${option}"
            ${selectedValues.includes(String(option)) ? "checked" : ""}
          />
          <span>${option}</span>
        </label>
      `,
    )
    .join("");
}

function renderOverviewSortControls(field, activeDirection) {
  const options = [
    ["asc", "↑"],
    ["desc", "↓"],
    ["none", "×"],
  ];

  return `
    <div class="sort-inline">
      ${options
        .map(
          ([direction, label]) => `
            <button
              class="sort-chip ${activeDirection === direction ? "is-active" : ""}"
              data-overview-sort-field="${field}"
              data-overview-sort-direction="${direction}"
              type="button"
            >
              ${label}
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function getCityOptions(records = state.data?.records || []) {
  return [...new Set(records.map((record) => String(record.city || "").trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ru"),
  );
}

function getCompanyOptions(records = state.data?.records || []) {
  return [...new Set(records.map((record) => String(record.company || "").trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ru"),
  );
}

function getCurrentFormCompany() {
  return String(state.recordFormCompany || "").trim();
}

function getCurrentFormCity() {
  return String(state.recordFormCity || "").trim();
}

function getStreetOptions(records = state.data?.records || [], city = "") {
  const normalizedCity = String(city || "").trim();
  if (!normalizedCity) {
    return [];
  }
  return [
    ...new Set(
      records
        .filter((record) => String(record.city || "").trim() === normalizedCity)
        .map((record) => String(record.street || "").trim())
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, "ru"));
}

function getFilteredStreetOptions(records, selectedCities) {
  const scopedRecords = selectedCities.length
    ? records.filter((record) => selectedCities.includes(String(record.city)))
    : records;
  return [...new Set(scopedRecords.map((record) => String(record.street || "").trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "ru"),
  );
}

function getSelectedRecordPeriod() {
  const year = Number(state.recordFormYear || 0);
  if (!state.recordFormMonth || !year) {
    return null;
  }
  return state.data.periods.find((period) => period.month === state.recordFormMonth && Number(period.year) === year) || null;
}

function getPeriodStartIso(period) {
  if (!period?.month || !period?.year) {
    return "";
  }

  const month = MONTH_TO_ISO[period.month];
  if (!month) {
    return "";
  }

  return `${period.year}-${month}-01`;
}

function toggleRegistryFilter(name) {
  state.registryOpenFilter = state.registryOpenFilter === name ? null : name;
}

function renderRegistryCheckboxOptions(name, options, selectedValues) {
  return options
    .map(
      (option) => `
        <label class="filter-option">
          <input
            type="checkbox"
            data-registry-filter-check="${name}"
            value="${option}"
            ${selectedValues.includes(String(option)) ? "checked" : ""}
          />
          <span>${option}</span>
        </label>
      `,
    )
    .join("");
}

function renderRegistrySortControls(field, activeDirection) {
  const options = [
    ["asc", "↑"],
    ["desc", "↓"],
    ["none", "×"],
  ];

  return `
    <div class="sort-inline">
      ${options
        .map(
          ([direction, label]) => `
            <button
              class="sort-chip ${activeDirection === direction ? "is-active" : ""}"
              data-registry-sort-field="${field}"
              data-registry-sort-direction="${direction}"
              type="button"
            >
              ${label}
            </button>
          `,
        )
        .join("")}
    </div>
  `;
}

function toggleWorkspaceFilter(name) {
  state.workspaceOpenFilter = state.workspaceOpenFilter === name ? null : name;
}

function renderWorkspaceCheckboxOptions(name, options, selectedValues) {
  return options
    .map(
      (option) => `
        <label class="filter-option">
          <input
            type="checkbox"
            data-workspace-filter-check="${name}"
            value="${option}"
            ${selectedValues.includes(String(option)) ? "checked" : ""}
          />
          <span>${option}</span>
        </label>
      `,
    )
    .join("");
}

async function loadData() {
  window.localStorage.removeItem("debit-calculator-data-v1");
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved) {
    state.data = normalizeImportedData(JSON.parse(saved));
    return;
  }

  const response = await fetch("./data/app-data.json");
  if (!response.ok) {
    state.data = structuredClone(EMPTY_DATA);
    return;
  }

  const initialData = normalizeImportedData(await response.json());
  state.data = initialData;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initialData));
}

async function saveData() {
  state.saving = true;
  state.saving = false;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function normalizeImportedPayment(payment, index) {
  if (!payment || typeof payment !== "object") {
    throw new Error(`Некорректный платеж в позиции ${index + 1}.`);
  }

  const amount = Number(payment.amount);
  if (!Number.isFinite(amount)) {
    throw new Error(`У платежа #${index + 1} не указана корректная сумма.`);
  }

  const normalizedPayment = {
    id: String(payment.id || createId("payment")),
    date: payment.date ? String(payment.date) : "",
    amount: Number(amount.toFixed(2)),
  };

  if (payment.dateUnknown === true || !payment.date) {
    normalizedPayment.dateUnknown = true;
  }

  return normalizedPayment;
}

function normalizeImportedRecord(record, index) {
  if (!record || typeof record !== "object") {
    throw new Error(`Некорректная запись в позиции ${index + 1}.`);
  }

  if (!record.company || !record.city || !record.periodId) {
    throw new Error(`У записи #${index + 1} не хватает компании, города или периода.`);
  }

  const invoiceAmount = Number(record.invoiceAmount);
  if (!Number.isFinite(invoiceAmount)) {
    throw new Error(`У записи #${index + 1} не указана корректная общая сумма.`);
  }

  return {
    id: String(record.id || createId("record")),
    company: String(record.company),
    city: String(record.city),
    street: String(record.street || ""),
    note: String(record.note || ""),
    periodId: String(record.periodId),
    invoiceAmount: Number(invoiceAmount.toFixed(2)),
    payments: Array.isArray(record.payments) ? record.payments.map(normalizeImportedPayment) : [],
  };
}

function normalizeImportedPeriod(period, index) {
  if (!period || typeof period !== "object") {
    throw new Error(`Некорректный период в позиции ${index + 1}.`);
  }

  if (!period.month || !period.year) {
    throw new Error(`У периода #${index + 1} не хватает месяца или года.`);
  }

  return {
    id: String(period.id || createId("period")),
    month: String(period.month),
    year: Number(period.year),
    dueDate: String(period.dueDate || ""),
  };
}

function normalizeImportedData(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("JSON должен содержать объект с данными.");
  }

  const dailyPenaltyRate = Number(payload.settings?.dailyPenaltyRate);
  const asOfDate = String(payload.settings?.asOfDate || getTodayIso());
  if (!Number.isFinite(dailyPenaltyRate)) {
    throw new Error("В JSON нет корректного поля settings.dailyPenaltyRate.");
  }

  if (!Array.isArray(payload.periods) || !Array.isArray(payload.records)) {
    throw new Error("В JSON должны быть массивы periods и records.");
  }

  const periods = payload.periods.map(normalizeImportedPeriod);
  const periodIds = new Set(periods.map((period) => period.id));
  const records = payload.records.map(normalizeImportedRecord);

  for (const record of records) {
    if (!periodIds.has(record.periodId)) {
      throw new Error(`Запись ${record.company} • ${record.city} ссылается на отсутствующий период.`);
    }
  }

  return {
    settings: {
      dailyPenaltyRate,
      asOfDate,
    },
    periods,
    records,
  };
}

function downloadJson(filename, rawJson) {
  const blob = new Blob([rawJson], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function handleExportJson() {
  const rawJson = JSON.stringify(state.data, null, 2);
  const filename = `debit-data-${state.data.settings.asOfDate || getTodayIso()}.json`;
  downloadJson(filename, rawJson.endsWith("\n") ? rawJson : `${rawJson}\n`);
  showToast("JSON экспортирован", "Текущая база выгружена в отдельный JSON-файл.");
}

async function applyImportedData(rawText, sourceLabel) {
  const parsed = JSON.parse(rawText);
  const normalized = normalizeImportedData(parsed);
  state.data = normalized;
  state.selectedRecordId = null;
  state.selectedCompany = null;
  state.isAddingNewCity = false;
  state.isAddingNewStreet = false;
  state.recordFormCity = "";
  state.recordFormStreet = "";
  state.recordFormMonth = "";
  state.recordFormYear = "";
  await saveData();
  showToast("JSON импортирован", `${sourceLabel} загружен в программу и сохранен.`);
  rerender();
}

async function handleImportJsonFile(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    await applyImportedData(text, "Файл JSON");
  } catch (error) {
    showToast("Ошибка импорта", error instanceof Error ? error.message : "Не удалось импортировать JSON.");
  } finally {
    event.target.value = "";
  }
}

async function handleImportJsonText() {
  const input = document.getElementById("import-json-text");
  const text = input.value.trim();
  if (!text) {
    showToast("JSON не вставлен", "Сначала вставьте JSON-текст в поле импорта.");
    return;
  }

  try {
    await applyImportedData(text, "Вставленный JSON");
    input.value = "";
  } catch (error) {
    showToast("Ошибка импорта", error instanceof Error ? error.message : "Не удалось импортировать JSON.");
  }
}

function getPeriodMap() {
  return new Map(
    state.data.periods.map((period) => [
      period.id,
      {
        ...period,
        month: period.month || capitalizeMonth(String(period.label || "").split(" ")[0] || ""),
        year: period.year || Number(String(period.label || "").split(" ")[1]) || "",
      },
    ]),
  );
}

function calculateRecord(record, settings, periodMap) {
  const period = periodMap.get(record.periodId) || null;
  const dueDate = period?.dueDate || null;
  const dailyRate = Number(settings.dailyPenaltyRate || 0.0001);
  const asOfDate = new Date(`${settings.asOfDate}T00:00:00Z`);
  const due = dueDate ? new Date(`${dueDate}T00:00:00Z`) : null;

  const payments = (record.payments || [])
    .slice()
    .sort((left, right) => {
      const leftUnknown = left.dateUnknown || !left.date;
      const rightUnknown = right.dateUnknown || !right.date;
      if (leftUnknown && rightUnknown) return 0;
      if (leftUnknown) return 1;
      if (rightUnknown) return -1;
      return left.date.localeCompare(right.date);
    })
    .map((payment) => {
      if (payment.dateUnknown || !payment.date) {
        return { ...payment, isDateUnknown: true, lateDays: 0, penalty: 0 };
      }
      const paymentDate = new Date(`${payment.date}T00:00:00Z`);
      const lateDays = due ? Math.max(Math.floor((paymentDate - due) / 86400000), 0) : 0;
      const penalty = due ? Number((payment.amount * dailyRate * lateDays).toFixed(2)) : 0;
      return { ...payment, isDateUnknown: false, lateDays, penalty };
    });

  const paidAmount = Number(payments.reduce((sum, payment) => sum + payment.amount, 0).toFixed(2));
  const outstandingAmount = Number((record.invoiceAmount - paidAmount).toFixed(2));
  const paidPenalty = Number(payments.reduce((sum, payment) => sum + payment.penalty, 0).toFixed(2));
  const outstandingLateDays = due ? Math.max(Math.floor((asOfDate - due) / 86400000), 0) : 0;
  const outstandingPenalty =
    due && outstandingAmount > 0 ? Number((outstandingAmount * dailyRate * outstandingLateDays).toFixed(2)) : 0;

  return {
    ...record,
    periodMonth: period?.month || "",
    periodYear: period?.year || "",
    periodLabel: formatPeriod(period),
    dueDate,
    payments,
    hasUnknownPaymentDates: payments.some((payment) => payment.isDateUnknown),
    paidAmount,
    outstandingAmount,
    paidPenalty,
    outstandingPenalty,
    totalPenalty: Number((paidPenalty + outstandingPenalty).toFixed(2)),
  };
}

function getDerived() {
  const periodMap = getPeriodMap();
  const records = state.data.records.map((record) => calculateRecord(record, state.data.settings, periodMap));
  const companies = getCompanyOptions(records).map((company) => {
    const rows = records.filter((record) => record.company === company);
    return {
      company,
      count: rows.length,
      invoiceAmount: Number(rows.reduce((sum, row) => sum + row.invoiceAmount, 0).toFixed(2)),
      paidAmount: Number(rows.reduce((sum, row) => sum + row.paidAmount, 0).toFixed(2)),
      outstandingAmount: Number(rows.reduce((sum, row) => sum + row.outstandingAmount, 0).toFixed(2)),
      totalPenalty: Number(rows.reduce((sum, row) => sum + row.totalPenalty, 0).toFixed(2)),
    };
  });

  return {
    records,
    companies,
    periods: state.data.periods.slice().sort((left, right) => compareNullableDates(left.dueDate, right.dueDate, "asc")),
    summary: {
      companies: companies.reduce((sum, company) => sum + (company.count ? 1 : 0), 0),
      periods: state.data.periods.length,
      invoiceAmount: Number(records.reduce((sum, row) => sum + row.invoiceAmount, 0).toFixed(2)),
      outstandingAmount: Number(records.reduce((sum, row) => sum + row.outstandingAmount, 0).toFixed(2)),
      totalPenalty: Number(records.reduce((sum, row) => sum + row.totalPenalty, 0).toFixed(2)),
    },
  };
}

function renderTabs() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === state.activeTab);
  });
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("is-active", view.id === `view-${state.activeTab}`);
  });
}

function renderOverviewModal(record) {
  const modal = document.getElementById("overview-modal");
  const content = document.getElementById("overview-modal-content");

  if (!state.isOverviewModalOpen || !record) {
    modal.classList.remove("is-open");
    content.innerHTML = "";
    return;
  }

  content.innerHTML = `
    <div class="detail-list">
      <article class="detail-item"><span>Компания</span><strong>${record.company}</strong></article>
      <article class="detail-item"><span>Город</span><strong>${record.city}</strong></article>
      <article class="detail-item"><span>Улица/Пригород</span><strong>${record.street || "—"}</strong></article>
      <article class="detail-item"><span>Примечание</span><strong>${record.note || "—"}</strong></article>
      <article class="detail-item"><span>Период</span><strong>${record.periodLabel}</strong></article>
      <article class="detail-item"><span>Дедлайн</span><strong>${formatDate(record.dueDate)}</strong></article>
      <article class="detail-item"><span>Даты оплат</span><strong>${record.hasUnknownPaymentDates ? "Есть неизвестные даты" : "Все даты указаны"}</strong></article>
      <article class="detail-item"><span>Общая сумма к оплате</span><strong>${formatMoney(record.invoiceAmount)}</strong></article>
      <article class="detail-item"><span>Оплачено</span><strong>${formatMoney(record.paidAmount)}</strong></article>
      <article class="detail-item"><span>Остаток / штраф</span><strong>${formatMoney(record.outstandingAmount)} / ${formatMoney(record.totalPenalty)}</strong></article>
    </div>
  `;
  modal.classList.add("is-open");
}

function renderSummary(summary) {
  const cards = [
    ["Периодов", number.format(summary.periods)],
    ["Активных компаний", number.format(summary.companies)],
    ["Всего выставлено", formatMoney(summary.invoiceAmount)],
    ["Общий остаток", formatMoney(summary.outstandingAmount)],
  ];

  document.getElementById("summary-cards").innerHTML = cards
    .map(
      ([label, value]) => `
        <article class="stat-card">
          <span>${label}</span>
          <strong>${value}</strong>
        </article>
      `,
    )
    .join("");

  const companies = getCompanyOptions(getDerived().records);
  setText("companies-in-system", companies.length ? companies.join(" / ") : "Пока нет компаний");
}

function renderCompanyTable(companies) {
  const tbody = document.getElementById("company-table");
  if (!companies.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Пока нет данных по компаниям.</td></tr>';
    return;
  }

  tbody.innerHTML = companies
    .map(
      (company) => `
        <tr class="is-clickable ${state.selectedCompany === company.company ? "is-active" : ""}" data-company="${company.company}">
          <td class="company-name">${company.company}</td>
          <td>${number.format(company.count)}</td>
          <td>${formatMoney(company.invoiceAmount)}</td>
          <td>${formatMoney(company.paidAmount)}</td>
          <td class="${company.outstandingAmount > 0 ? "warn" : ""}">${formatMoney(company.outstandingAmount)}</td>
          <td class="${company.totalPenalty > 0 ? "danger" : ""}">${formatMoney(company.totalPenalty)}</td>
        </tr>
      `,
    )
    .join("");
}

function renderOverviewDetail(records) {
  const target = document.getElementById("overview-detail");
  const company = state.selectedCompany || getCompanyOptions(records)[0] || "";
  const companyRecords = records.filter((record) => record.company === company);

  const cityOptions = [...new Set(companyRecords.map((record) => record.city))].sort((a, b) => a.localeCompare(b, "ru"));
  const streetOptions = getFilteredStreetOptions(companyRecords, state.overviewFilters.cities);
  const monthOptions = MONTH_OPTIONS;
  const yearOptions = YEAR_OPTIONS;
  const paymentDateStatusOptions = PAYMENT_DATE_STATUS_OPTIONS;

  const filtered = companyRecords
    .filter((record) => isMultiSelected(state.overviewFilters.cities, record.city))
    .filter((record) => isMultiSelected(state.overviewFilters.streets, record.street || ""))
    .filter((record) => isMultiSelected(state.overviewFilters.months, record.periodMonth))
    .filter((record) => isMultiSelected(state.overviewFilters.years, record.periodYear))
    .filter((record) => matchesPaymentDateStatus(record, state.overviewFilters.paymentDateStatus))
    .map((record, index) => ({ record, index }))
    .sort((left, right) => {
      const yearCompare = compareWithDirection(Number(left.record.periodYear || 0), Number(right.record.periodYear || 0), state.overviewFilters.yearSort);
      if (yearCompare) {
        return yearCompare;
      }
      const monthCompare = compareWithDirection(
        MONTH_ORDER[left.record.periodMonth] || 0,
        MONTH_ORDER[right.record.periodMonth] || 0,
        state.overviewFilters.monthSort,
      );
      if (monthCompare) {
        return monthCompare;
      }
      return left.index - right.index;
    })
    .map(({ record }) => record);

  const hasPaymentDateStatusFilter = state.overviewFilters.paymentDateStatus.length > 0;
  const emptyOverviewMessage = hasPaymentDateStatusFilter
    ? `У компании ${company} нет записей по выбранному фильтру дат оплат. Неизвестные даты сейчас есть только у тех записей, где они были занесены без даты.`
    : "По этим фильтрам записей нет.";

  if (!companyRecords.length) {
    target.innerHTML = '<div class="empty-state">Выберите компанию и добавьте первую запись в панели работы.</div>';
    return;
  }

  const renderFilterToolbar = () => `
    <div class="filter-toolbar">
      <div class="filter-group">
        <button class="filter-trigger ${state.overviewOpenFilter === "cities" ? "is-open" : ""}" data-overview-filter-toggle="cities" type="button">
          ${formatFilterSummary("Города", state.overviewFilters.cities)}
        </button>
        ${
          state.overviewOpenFilter === "cities"
            ? `<div class="filter-popover">${renderOverviewCheckboxOptions("cities", cityOptions, state.overviewFilters.cities)}</div>`
            : ""
        }
      </div>
      <div class="filter-group">
        <button class="filter-trigger ${state.overviewOpenFilter === "streets" ? "is-open" : ""}" data-overview-filter-toggle="streets" type="button">
          ${formatFilterSummary("Улицы/Пригород", state.overviewFilters.streets)}
        </button>
        ${
          state.overviewOpenFilter === "streets"
            ? `<div class="filter-popover">${renderOverviewCheckboxOptions("streets", streetOptions, state.overviewFilters.streets)}</div>`
            : ""
        }
      </div>
      <div class="filter-group">
        <button class="filter-trigger ${state.overviewOpenFilter === "months" ? "is-open" : ""}" data-overview-filter-toggle="months" type="button">
          ${formatFilterSummary("Месяцы", state.overviewFilters.months)}
        </button>
        ${
          state.overviewOpenFilter === "months"
            ? `<div class="filter-popover">${renderOverviewCheckboxOptions("months", monthOptions, state.overviewFilters.months)}</div>`
            : ""
        }
      </div>
      <div class="filter-group">
        <button class="filter-trigger ${state.overviewOpenFilter === "years" ? "is-open" : ""}" data-overview-filter-toggle="years" type="button">
          ${formatFilterSummary("Годы", state.overviewFilters.years)}
        </button>
        ${
          state.overviewOpenFilter === "years"
            ? `<div class="filter-popover">${renderOverviewCheckboxOptions("years", yearOptions, state.overviewFilters.years)}</div>`
            : ""
        }
      </div>
      <div class="filter-group">
        <button class="filter-trigger ${state.overviewOpenFilter === "paymentDateStatus" ? "is-open" : ""}" data-overview-filter-toggle="paymentDateStatus" type="button">
          ${formatFilterSummary("Даты оплат", state.overviewFilters.paymentDateStatus)}
        </button>
        ${
          state.overviewOpenFilter === "paymentDateStatus"
            ? `<div class="filter-popover">${renderOverviewCheckboxOptions("paymentDateStatus", paymentDateStatusOptions, state.overviewFilters.paymentDateStatus)}</div>`
            : ""
        }
      </div>
    </div>
  `;

  target.innerHTML = `
    ${renderFilterToolbar()}
    <div class="table-wrap table-window">
      <table>
        <thead>
          <tr>
            <th>Город</th>
            <th>
              <div class="header-inline">
                <span>Месяц</span>
                ${renderOverviewSortControls("month", state.overviewFilters.monthSort)}
              </div>
            </th>
            <th>
              <div class="header-inline">
                <span>Год</span>
                ${renderOverviewSortControls("year", state.overviewFilters.yearSort)}
              </div>
            </th>
            <th>Дедлайн</th>
            <th>Выставлено</th>
            <th>Остаток</th>
            <th>Штраф</th>
          </tr>
        </thead>
        <tbody>
          ${
            filtered.length
              ? filtered
                  .map(
                    (record) => `
                      <tr class="is-clickable ${state.selectedRecordId === record.id ? "is-active" : ""}" data-record-id="${record.id}">
                        <td class="strong">${record.city}</td>
                        <td>${record.periodMonth}</td>
                        <td>${record.periodYear || "—"}</td>
                        <td>${formatDate(record.dueDate)}</td>
                        <td>${formatMoney(record.invoiceAmount)}</td>
                        <td class="${record.outstandingAmount > 0 ? "warn" : ""}">${formatMoney(record.outstandingAmount)}</td>
                        <td class="${record.totalPenalty > 0 ? "danger" : ""}">${formatMoney(record.totalPenalty)}</td>
                      </tr>
                    `,
                  )
                  .join("")
              : `<tr><td colspan="7" class="empty-state">${emptyOverviewMessage}</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;
}

function renderRegistry(records) {
  const target = document.getElementById("registry-table-container");
  const companyOptions = getCompanyOptions(records);
  const cityOptions = [...new Set(records.map((record) => record.city))].sort((a, b) => a.localeCompare(b, "ru"));
  const streetOptions = getFilteredStreetOptions(records, state.registryFilters.cities);
  const monthOptions = MONTH_OPTIONS;
  const yearOptions = YEAR_OPTIONS;
  const paymentDateStatusOptions = PAYMENT_DATE_STATUS_OPTIONS;

  const filtered = records
    .filter((record) => isMultiSelected(state.registryFilters.companies, record.company))
    .filter((record) => isMultiSelected(state.registryFilters.cities, record.city))
    .filter((record) => isMultiSelected(state.registryFilters.streets, record.street || ""))
    .filter((record) => isMultiSelected(state.registryFilters.months, record.periodMonth))
    .filter((record) => isMultiSelected(state.registryFilters.years, record.periodYear))
    .filter((record) => matchesPaymentDateStatus(record, state.registryFilters.paymentDateStatus))
    .map((record, index) => ({ record, index }))
    .sort((left, right) => {
      const yearCompare = compareWithDirection(
        Number(left.record.periodYear || 0),
        Number(right.record.periodYear || 0),
        state.registryFilters.yearSort,
      );
      if (yearCompare) {
        return yearCompare;
      }
      const monthCompare = compareWithDirection(
        MONTH_ORDER[left.record.periodMonth] || 0,
        MONTH_ORDER[right.record.periodMonth] || 0,
        state.registryFilters.monthSort,
      );
      if (monthCompare) {
        return monthCompare;
      }
      return left.index - right.index;
    })
    .map(({ record }) => record);

  if (!filtered.some((record) => record.id === state.selectedRecordId)) {
    state.selectedRecordId = filtered[0]?.id || null;
  }

  const renderFilterToolbar = () => `
    <div class="filter-toolbar filter-toolbar-spread">
      <div class="filter-group">
        <button class="filter-trigger ${state.registryOpenFilter === "companies" ? "is-open" : ""}" data-registry-filter-toggle="companies" type="button">
          ${formatFilterSummary("Компании", state.registryFilters.companies)}
        </button>
        ${
          state.registryOpenFilter === "companies"
            ? `<div class="filter-popover">${renderRegistryCheckboxOptions("companies", companyOptions, state.registryFilters.companies)}</div>`
            : ""
        }
      </div>
      <div class="filter-group">
        <button class="filter-trigger ${state.registryOpenFilter === "cities" ? "is-open" : ""}" data-registry-filter-toggle="cities" type="button">
          ${formatFilterSummary("Города", state.registryFilters.cities)}
        </button>
        ${
          state.registryOpenFilter === "cities"
            ? `<div class="filter-popover">${renderRegistryCheckboxOptions("cities", cityOptions, state.registryFilters.cities)}</div>`
            : ""
        }
      </div>
      <div class="filter-group">
        <button class="filter-trigger ${state.registryOpenFilter === "streets" ? "is-open" : ""}" data-registry-filter-toggle="streets" type="button">
          ${formatFilterSummary("Улицы/Пригород", state.registryFilters.streets)}
        </button>
        ${
          state.registryOpenFilter === "streets"
            ? `<div class="filter-popover">${renderRegistryCheckboxOptions("streets", streetOptions, state.registryFilters.streets)}</div>`
            : ""
        }
      </div>
      <div class="filter-group">
        <button class="filter-trigger ${state.registryOpenFilter === "months" ? "is-open" : ""}" data-registry-filter-toggle="months" type="button">
          ${formatFilterSummary("Месяцы", state.registryFilters.months)}
        </button>
        ${
          state.registryOpenFilter === "months"
            ? `<div class="filter-popover">${renderRegistryCheckboxOptions("months", monthOptions, state.registryFilters.months)}</div>`
            : ""
        }
      </div>
      <div class="filter-group">
        <button class="filter-trigger ${state.registryOpenFilter === "years" ? "is-open" : ""}" data-registry-filter-toggle="years" type="button">
          ${formatFilterSummary("Годы", state.registryFilters.years)}
        </button>
        ${
          state.registryOpenFilter === "years"
            ? `<div class="filter-popover">${renderRegistryCheckboxOptions("years", yearOptions, state.registryFilters.years)}</div>`
            : ""
        }
      </div>
      <div class="filter-group">
        <button class="filter-trigger ${state.registryOpenFilter === "paymentDateStatus" ? "is-open" : ""}" data-registry-filter-toggle="paymentDateStatus" type="button">
          ${formatFilterSummary("Даты оплат", state.registryFilters.paymentDateStatus)}
        </button>
        ${
          state.registryOpenFilter === "paymentDateStatus"
            ? `<div class="filter-popover">${renderRegistryCheckboxOptions("paymentDateStatus", paymentDateStatusOptions, state.registryFilters.paymentDateStatus)}</div>`
            : ""
        }
      </div>
    </div>
  `;

  target.innerHTML = `
    ${renderFilterToolbar()}
    <div class="table-wrap table-window">
      <table>
        <thead>
          <tr>
            <th>Компания</th>
            <th>Город</th>
            <th>Улица/Пригород</th>
            <th>Примечание</th>
            <th>
              <div class="header-inline">
                <span>Месяц</span>
                ${renderRegistrySortControls("month", state.registryFilters.monthSort)}
              </div>
            </th>
            <th>
              <div class="header-inline">
                <span>Год</span>
                ${renderRegistrySortControls("year", state.registryFilters.yearSort)}
              </div>
            </th>
            <th>Дедлайн</th>
            <th>Выставлено</th>
            <th>Оплачено</th>
            <th>Остаток</th>
            <th>Штраф</th>
          </tr>
        </thead>
        <tbody>
          ${
            filtered.length
              ? filtered
                  .map(
                    (record) => `
                      <tr class="is-clickable ${state.selectedRecordId === record.id ? "is-active" : ""}" data-record-id="${record.id}">
                        <td class="company-name">${record.company}</td>
                        <td>${record.city}</td>
                        <td>${record.street || '<span class="subtle">—</span>'}</td>
                        <td>${record.note || '<span class="subtle">—</span>'}</td>
                        <td>${record.periodMonth}</td>
                        <td>${record.periodYear || "—"}</td>
                        <td>${formatDate(record.dueDate)}</td>
                        <td>${formatMoney(record.invoiceAmount)}</td>
                        <td>${formatMoney(record.paidAmount)}</td>
                        <td class="${record.outstandingAmount > 0 ? "warn" : ""}">${formatMoney(record.outstandingAmount)}</td>
                        <td class="${record.totalPenalty > 0 ? "danger" : ""}">${formatMoney(record.totalPenalty)}</td>
                      </tr>
                    `,
                  )
                  .join("")
              : '<tr><td colspan="11" class="empty-state">По этим фильтрам записей нет.</td></tr>'
          }
        </tbody>
      </table>
    </div>
  `;

  renderRecordDetail(filtered.find((record) => record.id === state.selectedRecordId));
  renderPayments(filtered.find((record) => record.id === state.selectedRecordId));
}

function renderRecordDetail(record) {
  const target = document.getElementById("registry-detail");
  if (!record) {
    target.innerHTML = '<div class="empty-state">Выберите запись из реестра.</div>';
    return;
  }

  target.innerHTML = `
    <div class="detail-list">
      <article class="detail-item"><span>Компания</span><strong>${record.company}</strong></article>
      <article class="detail-item"><span>Город</span><strong>${record.city}</strong></article>
      <article class="detail-item"><span>Улица/Пригород</span><strong>${record.street || "—"}</strong></article>
      <article class="detail-item"><span>Примечание</span><strong>${record.note || "—"}</strong></article>
      <article class="detail-item"><span>Месяц</span><strong>${record.periodMonth || "—"}</strong></article>
      <article class="detail-item"><span>Год</span><strong>${record.periodYear || "—"}</strong></article>
      <article class="detail-item"><span>Дедлайн</span><strong>${formatDate(record.dueDate)}</strong></article>
      <article class="detail-item"><span>Даты оплат</span><strong>${record.hasUnknownPaymentDates ? "Есть неизвестные даты" : "Все даты указаны"}</strong></article>
      <article class="detail-item"><span>Общая сумма к оплате</span><strong>${formatMoney(record.invoiceAmount)}</strong></article>
      <article class="detail-item"><span>Оплачено</span><strong>${formatMoney(record.paidAmount)}</strong></article>
      <article class="detail-item"><span>Остаток / штраф</span><strong>${formatMoney(record.outstandingAmount)} / ${formatMoney(record.totalPenalty)}</strong></article>
    </div>
  `;
}

function renderPayments(record) {
  const tbody = document.getElementById("payments-table");
  if (!record || !record.payments.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Платежей по записи пока нет.</td></tr>';
    return;
  }

  tbody.innerHTML = record.payments
    .map(
      (payment) => `
        <tr>
          <td>${formatMoney(payment.amount)}</td>
          <td class="${payment.isDateUnknown ? "warn" : ""}">${formatPaymentDate(payment)}</td>
          <td class="${payment.lateDays > 0 ? "warn" : ""}">${number.format(payment.lateDays)}</td>
          <td class="${payment.penalty > 0 ? "danger" : ""}">${formatMoney(payment.penalty)}</td>
        </tr>
      `,
    )
    .join("");
}

function renderPeriods(periods, records) {
  const tbody = document.getElementById("periods-table");

  if (!periods.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Пока нет ни одного периода.</td></tr>';
    return;
  }

  tbody.innerHTML = periods
    .map((period) => {
      const count = records.filter((record) => record.periodId === period.id).length;
      const isEditing = state.editingPeriodId === period.id;
      return `
        <tr>
          <td>${period.month}</td>
          <td>${period.year}</td>
          <td>
            ${
              isEditing
                ? `<input class="search search-table" data-period-due-date-input="${period.id}" type="date" value="${state.editingPeriodDueDate || period.dueDate || ""}" />`
                : formatDate(period.dueDate)
            }
          </td>
          <td>${number.format(count)}</td>
          <td>
            ${
              isEditing
                ? `
                  <div class="table-actions">
                    <button class="button" data-save-period="${period.id}" type="button">Сохранить</button>
                    <button class="button button-ghost" data-cancel-period-edit type="button">Отмена</button>
                  </div>
                `
                : `
                  <div class="table-actions">
                    <button class="button button-ghost" data-edit-period="${period.id}" type="button">Изменить</button>
                    <button class="button button-ghost" data-delete-period="${period.id}" type="button">Удалить</button>
                  </div>
                `
            }
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderWorkspaceRecords(records) {
  const workspaceFiltersTarget = document.getElementById("workspace-record-filters");
  const companySelect = document.getElementById("record-company-select");
  const companyInput = document.getElementById("record-company-new");
  const citySelect = document.getElementById("record-city-select");
  const cityInput = document.getElementById("record-city-new");
  const cityToggle = document.getElementById("toggle-new-city");
  const streetSelect = document.getElementById("record-street-select");
  const streetInput = document.getElementById("record-street-new");
  const streetToggle = document.getElementById("toggle-new-street");
  const periodMonthSelect = document.getElementById("record-period-month");
  const periodYearSelect = document.getElementById("record-period-year");
  const periodDeadlineInput = document.getElementById("record-period-deadline");
  const periodHelp = document.getElementById("record-period-help");
  const paymentDateInput = document.getElementById("payment-date");
  const companyOptions = getCompanyOptions(state.data.records);
  const cityOptions = getCityOptions(records);
  const currentCity = getCurrentFormCity();
  const streetOptions = getStreetOptions(records, currentCity);
  const selectedPeriod = getSelectedRecordPeriod();
  const workspaceCompanyOptions = getCompanyOptions(records);
  const workspaceCityOptions = [...new Set(records.map((record) => record.city))].sort((a, b) => a.localeCompare(b, "ru"));
  const workspaceStreetOptions = getFilteredStreetOptions(records, state.workspaceFilters.cities);
  const workspaceMonthOptions = MONTH_OPTIONS;
  const workspaceYearOptions = YEAR_OPTIONS;
  const workspacePaymentDateStatusOptions = PAYMENT_DATE_STATUS_OPTIONS;

  companySelect.innerHTML = state.isAddingNewCompany
    ? '<option value="">Новая компания</option>'
    : [
        '<option value="">Выберите компанию</option>',
        ...companyOptions.map((company) => `<option value="${company}">${company}</option>`),
      ].join("");
  companySelect.value = state.isAddingNewCompany ? "" : state.recordFormCompany || "";
  companySelect.disabled = state.isAddingNewCompany;
  companyInput.classList.toggle("is-hidden", !state.isAddingNewCompany);
  companyInput.disabled = !state.isAddingNewCompany;
  companyInput.value = state.isAddingNewCompany ? state.recordFormCompany : "";

  citySelect.innerHTML = cityOptions.length
    ? `<option value="">Выберите город</option>${cityOptions.map((city) => `<option value="${city}">${city}</option>`).join("")}`
    : '<option value="">Пока нет городов</option>';
  citySelect.value = state.recordFormCity || "";

  citySelect.disabled = state.isAddingNewCity;
  cityInput.classList.toggle("is-hidden", !state.isAddingNewCity);
  cityInput.disabled = !state.isAddingNewCity;
  cityToggle.textContent = state.isAddingNewCity ? "Из списка" : "Новый город";
  cityInput.value = state.isAddingNewCity ? state.recordFormCity : "";

  if (state.isAddingNewCity && !state.isAddingNewStreet) {
    state.isAddingNewStreet = true;
  }

  streetSelect.innerHTML = currentCity
    ? `<option value="">Без улицы/пригорода</option>${streetOptions.map((street) => `<option value="${street}">${street}</option>`).join("")}`
    : '<option value="">Сначала выберите город</option>';
  streetSelect.value = state.recordFormStreet || "";
  streetSelect.disabled = !currentCity || state.isAddingNewStreet;
  streetInput.classList.toggle("is-hidden", !state.isAddingNewStreet);
  streetInput.disabled = !state.isAddingNewStreet;
  streetToggle.textContent = state.isAddingNewStreet ? "Из списка" : "Новая улица/пригород";
  streetToggle.disabled = !currentCity;
  streetInput.value = state.isAddingNewStreet ? state.recordFormStreet : "";

  periodMonthSelect.innerHTML = `<option value="">Выберите месяц</option>${MONTH_OPTIONS.map((month) => `<option value="${month}">${month}</option>`).join("")}`;
  periodYearSelect.innerHTML = `<option value="">Выберите год</option>${YEAR_OPTIONS.map((year) => `<option value="${year}">${year}</option>`).join("")}`;
  periodMonthSelect.value = state.recordFormMonth;
  periodYearSelect.value = state.recordFormYear ? String(state.recordFormYear) : "";

  if (!state.recordFormMonth || !state.recordFormYear) {
    periodDeadlineInput.value = "";
    periodHelp.textContent = "Сначала выберите месяц и год периода.";
    periodHelp.classList.remove("is-warning");
  } else if (!selectedPeriod?.dueDate) {
    periodDeadlineInput.value = "";
    periodHelp.textContent = "Для этого периода дедлайн не найден. Сначала добавьте его в форме «Добавить период и дедлайн».";
    periodHelp.classList.add("is-warning");
  } else {
    periodDeadlineInput.value = formatDate(selectedPeriod.dueDate);
    periodHelp.textContent = "Дедлайн подставлен автоматически по выбранному месяцу и году.";
    periodHelp.classList.remove("is-warning");
  }

  if (!records.length) {
    workspaceFiltersTarget.innerHTML = `
      <div class="filter-toolbar filter-toolbar-spread">
        <select id="payment-record-select" class="search">
          <option value="">Сначала добавьте запись</option>
        </select>
      </div>
    `;
    document.getElementById("workspace-payments-table").innerHTML =
      '<tr><td colspan="5" class="empty-state">Записей пока нет.</td></tr>';
    return;
  }

  const filteredRecords = records
    .filter((record) => isMultiSelected(state.workspaceFilters.companies, record.company))
    .filter((record) => isMultiSelected(state.workspaceFilters.cities, record.city))
    .filter((record) => isMultiSelected(state.workspaceFilters.streets, record.street || ""))
    .filter((record) => isMultiSelected(state.workspaceFilters.months, record.periodMonth))
    .filter((record) => isMultiSelected(state.workspaceFilters.years, record.periodYear))
    .filter((record) => matchesPaymentDateStatus(record, state.workspaceFilters.paymentDateStatus));

  workspaceFiltersTarget.innerHTML = `
    <div class="filter-toolbar filter-toolbar-spread">
      <div class="filter-group">
        <button class="filter-trigger ${state.workspaceOpenFilter === "companies" ? "is-open" : ""}" data-workspace-filter-toggle="companies" type="button">
          ${formatFilterSummary("Компании", state.workspaceFilters.companies)}
        </button>
        ${
          state.workspaceOpenFilter === "companies"
            ? `<div class="filter-popover">${renderWorkspaceCheckboxOptions("companies", workspaceCompanyOptions, state.workspaceFilters.companies)}</div>`
            : ""
        }
      </div>
      <div class="filter-group">
        <button class="filter-trigger ${state.workspaceOpenFilter === "cities" ? "is-open" : ""}" data-workspace-filter-toggle="cities" type="button">
          ${formatFilterSummary("Города", state.workspaceFilters.cities)}
        </button>
        ${
          state.workspaceOpenFilter === "cities"
            ? `<div class="filter-popover">${renderWorkspaceCheckboxOptions("cities", workspaceCityOptions, state.workspaceFilters.cities)}</div>`
            : ""
        }
      </div>
      <div class="filter-group">
        <button class="filter-trigger ${state.workspaceOpenFilter === "streets" ? "is-open" : ""}" data-workspace-filter-toggle="streets" type="button">
          ${formatFilterSummary("Улицы/Пригород", state.workspaceFilters.streets)}
        </button>
        ${
          state.workspaceOpenFilter === "streets"
            ? `<div class="filter-popover">${renderWorkspaceCheckboxOptions("streets", workspaceStreetOptions, state.workspaceFilters.streets)}</div>`
            : ""
        }
      </div>
      <div class="filter-group">
        <button class="filter-trigger ${state.workspaceOpenFilter === "months" ? "is-open" : ""}" data-workspace-filter-toggle="months" type="button">
          ${formatFilterSummary("Месяцы", state.workspaceFilters.months)}
        </button>
        ${
          state.workspaceOpenFilter === "months"
            ? `<div class="filter-popover">${renderWorkspaceCheckboxOptions("months", workspaceMonthOptions, state.workspaceFilters.months)}</div>`
            : ""
        }
      </div>
      <div class="filter-group">
        <button class="filter-trigger ${state.workspaceOpenFilter === "years" ? "is-open" : ""}" data-workspace-filter-toggle="years" type="button">
          ${formatFilterSummary("Годы", state.workspaceFilters.years)}
        </button>
        ${
          state.workspaceOpenFilter === "years"
            ? `<div class="filter-popover">${renderWorkspaceCheckboxOptions("years", workspaceYearOptions, state.workspaceFilters.years)}</div>`
            : ""
        }
      </div>
      <div class="filter-group">
        <button class="filter-trigger ${state.workspaceOpenFilter === "paymentDateStatus" ? "is-open" : ""}" data-workspace-filter-toggle="paymentDateStatus" type="button">
          ${formatFilterSummary("Даты оплат", state.workspaceFilters.paymentDateStatus)}
        </button>
        ${
          state.workspaceOpenFilter === "paymentDateStatus"
            ? `<div class="filter-popover">${renderWorkspaceCheckboxOptions("paymentDateStatus", workspacePaymentDateStatusOptions, state.workspaceFilters.paymentDateStatus)}</div>`
            : ""
        }
      </div>
      <select id="payment-record-select" class="search">
        ${
          filteredRecords.length
            ? filteredRecords
                .map((record) => `<option value="${record.id}">${record.company} • ${formatLocation(record)} • ${record.periodLabel}</option>`)
                .join("")
            : '<option value="">По этим фильтрам записей нет</option>'
        }
      </select>
    </div>
  `;

  if (!filteredRecords.some((record) => record.id === state.selectedRecordId)) {
    state.selectedRecordId = filteredRecords[0]?.id || null;
  }

  const paymentSelect = document.getElementById("payment-record-select");
  if (filteredRecords.length) {
    paymentSelect.value = state.selectedRecordId || filteredRecords[0].id;
  }

  const selected = filteredRecords.find((record) => record.id === state.selectedRecordId);
  const selectedPaymentPeriod = state.data.periods.find((period) => period.id === selected?.periodId) || null;
  const minPaymentDate = getPeriodStartIso(selectedPaymentPeriod);
  const maxPaymentDate = getTodayIso();
  paymentDateInput.min = minPaymentDate || "";
  paymentDateInput.max = maxPaymentDate;
  if (paymentDateInput.value && ((minPaymentDate && paymentDateInput.value < minPaymentDate) || paymentDateInput.value > maxPaymentDate)) {
    paymentDateInput.value = "";
  }

  const tbody = document.getElementById("workspace-payments-table");
  if (!selected?.payments.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Платежей у выбранной записи пока нет.</td></tr>';
    return;
  }

  tbody.innerHTML = selected.payments
    .map(
      (payment) => `
        <tr>
          <td>${selected.company} • ${formatLocation(selected)}</td>
          <td>${formatMoney(payment.amount)}</td>
          <td class="${payment.isDateUnknown ? "warn" : ""}">${formatPaymentDate(payment)}</td>
          <td class="${payment.penalty > 0 ? "danger" : ""}">${formatMoney(payment.penalty)}</td>
          <td><button class="button button-ghost" data-delete-payment="${payment.id}" type="button">Удалить</button></td>
        </tr>
      `,
    )
    .join("");
}

function renderWorkspaceSettings() {
  document.getElementById("settings-as-of-date").value = state.data.settings.asOfDate;
  document.getElementById("settings-daily-rate").value = String(state.data.settings.dailyPenaltyRate);
}

function rerender() {
  const derived = getDerived();

  setText("as-of-date", formatDate(state.data.settings.asOfDate));
  renderTabs();
  renderSummary(derived.summary);
  renderCompanyTable(derived.companies);

  if (!state.selectedCompany || !derived.companies.some((company) => company.company === state.selectedCompany)) {
    state.selectedCompany = derived.companies[0]?.company || null;
  }
  renderOverviewDetail(derived.records);
  renderOverviewModal(derived.records.find((record) => record.id === state.selectedRecordId));
  renderRegistry(derived.records);
  renderPeriods(derived.periods, state.data.records);
  renderWorkspaceRecords(derived.records);
  renderWorkspaceSettings();
}

function getSelectedRecord() {
  return state.data.records.find((record) => record.id === state.selectedRecordId) || null;
}

async function handleAddPeriod() {
  const month = document.getElementById("period-month").value;
  const year = Number(document.getElementById("period-year").value);
  const dueDate = document.getElementById("period-due-date").value;
  if (!month || !year || !dueDate) {
    return;
  }

  const exists = state.data.periods.some((period) => period.month === month && Number(period.year) === year);
  if (exists) {
    return;
  }

  state.data.periods.push({
    id: createId("period"),
    month,
    year,
    dueDate,
  });

  await saveData();
  document.getElementById("period-month").value = "";
  document.getElementById("period-year").value = "";
  document.getElementById("period-due-date").value = "";
  showToast("Период добавлен", `Период ${month} ${year} сохранен с дедлайном ${formatDate(dueDate)}.`);
  rerender();
}

async function handleAddRecord() {
  const selectedPeriod = getSelectedRecordPeriod();
  const company = getCurrentFormCompany();
  const rawCity = String(state.recordFormCity || "").trim();
  const city = rawCity;
  const street = String(state.recordFormStreet || "").trim();
  const invoiceAmount = toNumber(document.getElementById("record-invoice-amount").value);
  if (!selectedPeriod?.id || !selectedPeriod?.dueDate || !company || !city || !Number.isFinite(invoiceAmount)) {
    return;
  }

  const record = {
    id: createId("record"),
    company,
    city,
    street,
    note: document.getElementById("record-note").value.trim(),
    periodId: selectedPeriod.id,
    invoiceAmount: Number(invoiceAmount.toFixed(2)),
    payments: [],
  };

  state.data.records.push(record);
  state.selectedCompany = record.company;
  state.selectedRecordId = record.id;
  state.isAddingNewCompany = false;
  state.isAddingNewCity = false;
  state.isAddingNewStreet = false;
  state.recordFormCompany = "";
  state.recordFormCity = "";
  state.recordFormStreet = "";
  state.recordFormMonth = "";
  state.recordFormYear = "";
  await saveData();
  document.getElementById("record-company-select").value = "";
  document.getElementById("record-company-new").value = "";
  document.getElementById("record-city-select").value = "";
  document.getElementById("record-city-new").value = "";
  document.getElementById("record-street-select").value = "";
  document.getElementById("record-street-new").value = "";
  document.getElementById("record-note").value = "";
  document.getElementById("record-invoice-amount").value = "";
  showToast("Запись добавлена", `${record.company} • ${formatLocation(record)} • ${record.periodLabel}`);
  rerender();
}

async function handleAddPayment() {
  const record = getSelectedRecord();
  const date = document.getElementById("payment-date").value;
  const amount = toNumber(document.getElementById("payment-amount").value);
  if (!record || !date || !Number.isFinite(amount)) {
    return;
  }

  const period = state.data.periods.find((item) => item.id === record.periodId) || null;
  const minPaymentDate = getPeriodStartIso(period);
  const maxPaymentDate = getTodayIso();

  if (minPaymentDate && date < minPaymentDate) {
    showToast(
      "Некорректная дата оплаты",
      `Для периода ${period.month} ${period.year} дата оплаты не может быть раньше ${formatDate(minPaymentDate)}.`,
    );
    return;
  }

  if (date > maxPaymentDate) {
    showToast("Некорректная дата оплаты", `Дата оплаты не может быть позже ${formatDate(maxPaymentDate)}.`);
    return;
  }

  record.payments.push({
    id: createId("payment"),
    date,
    amount: Number(amount.toFixed(2)),
  });

  await saveData();
  document.getElementById("payment-date").value = "";
  document.getElementById("payment-amount").value = "";
  showToast("Оплата добавлена", `${formatMoney(amount)} от ${formatDate(date)} сохранены.`);
  rerender();
}

async function handleSaveSettings() {
  state.data.settings.asOfDate = document.getElementById("settings-as-of-date").value || state.data.settings.asOfDate;
  state.data.settings.dailyPenaltyRate = Number(
    toNumber(document.getElementById("settings-daily-rate").value) || state.data.settings.dailyPenaltyRate,
  );
  await saveData();
  showToast("Настройки сохранены", `Дата расчета: ${formatDate(state.data.settings.asOfDate)}.`);
  rerender();
}

async function handleDeleteRecord() {
  if (!state.selectedRecordId) {
    return;
  }
  state.data.records = state.data.records.filter((record) => record.id !== state.selectedRecordId);
  state.selectedRecordId = null;
  await saveData();
  rerender();
}

async function handleDeletePeriod(periodId) {
  state.data.periods = state.data.periods.filter((period) => period.id !== periodId);
  state.data.records = state.data.records.filter((record) => record.periodId !== periodId);
  if (state.data.records.every((record) => record.id !== state.selectedRecordId)) {
    state.selectedRecordId = null;
  }
  await saveData();
  rerender();
}

async function handleSavePeriodDueDate(periodId) {
  const period = state.data.periods.find((item) => item.id === periodId);
  if (!period || !state.editingPeriodDueDate) {
    return;
  }

  period.dueDate = state.editingPeriodDueDate;
  await saveData();
  showToast("Дедлайн обновлен", `Для периода ${period.month} ${period.year} сохранена дата ${formatDate(period.dueDate)}.`);
  state.editingPeriodId = null;
  state.editingPeriodDueDate = "";
  rerender();
}

async function handleDeletePayment(paymentId) {
  const record = getSelectedRecord();
  if (!record) {
    return;
  }
  record.payments = record.payments.filter((payment) => payment.id !== paymentId);
  await saveData();
  rerender();
}

async function main() {
  await loadData();

  document.getElementById("tabbar").addEventListener("click", (event) => {
    const button = event.target.closest("[data-tab]");
    if (!button) return;
    state.activeTab = button.dataset.tab;
    renderTabs();
  });

  document.getElementById("company-table").addEventListener("click", (event) => {
    const row = event.target.closest("[data-company]");
    if (!row) return;
    state.selectedCompany = row.dataset.company;
    rerender();
  });

  document.getElementById("overview-detail").addEventListener("click", (event) => {
    const toggleButton = event.target.closest("[data-overview-filter-toggle]");
    if (toggleButton) {
      toggleOverviewFilter(toggleButton.dataset.overviewFilterToggle);
      rerender();
      return;
    }
    const sortButton = event.target.closest("[data-overview-sort-field]");
    if (sortButton) {
      const field = sortButton.dataset.overviewSortField;
      const direction = sortButton.dataset.overviewSortDirection;
      if (field === "month") {
        state.overviewFilters.monthSort = direction;
      }
      if (field === "year") {
        state.overviewFilters.yearSort = direction;
      }
      state.overviewOpenFilter = null;
      rerender();
      return;
    }
    const row = event.target.closest("[data-record-id]");
    if (!row) return;
    state.selectedRecordId = row.dataset.recordId;
    state.isOverviewModalOpen = true;
    rerender();
  });

  document.getElementById("overview-detail").addEventListener("change", (event) => {
    if (event.target.dataset.overviewFilterCheck === "cities") {
      const values = new Set(state.overviewFilters.cities);
      if (event.target.checked) {
        values.add(event.target.value);
      } else {
        values.delete(event.target.value);
      }
      state.overviewFilters.cities = [...values];
      const company = state.selectedCompany || getCompanyOptions(getDerived().records)[0] || "";
      const companyRecords = getDerived().records.filter((record) => record.company === company);
      const allowedStreets = new Set(getFilteredStreetOptions(companyRecords, state.overviewFilters.cities));
      state.overviewFilters.streets = state.overviewFilters.streets.filter((street) => allowedStreets.has(street));
      rerender();
      return;
    }
    if (event.target.dataset.overviewFilterCheck === "streets") {
      const values = new Set(state.overviewFilters.streets);
      if (event.target.checked) {
        values.add(event.target.value);
      } else {
        values.delete(event.target.value);
      }
      state.overviewFilters.streets = [...values];
      rerender();
      return;
    }
    if (event.target.dataset.overviewFilterCheck === "months") {
      const values = new Set(state.overviewFilters.months);
      if (event.target.checked) {
        values.add(event.target.value);
      } else {
        values.delete(event.target.value);
      }
      state.overviewFilters.months = [...values];
      rerender();
      return;
    }
    if (event.target.dataset.overviewFilterCheck === "years") {
      const values = new Set(state.overviewFilters.years);
      if (event.target.checked) {
        values.add(event.target.value);
      } else {
        values.delete(event.target.value);
      }
      state.overviewFilters.years = [...values];
      rerender();
      return;
    }
    if (event.target.dataset.overviewFilterCheck === "paymentDateStatus") {
      const values = new Set(state.overviewFilters.paymentDateStatus);
      if (event.target.checked) {
        values.add(event.target.value);
      } else {
        values.delete(event.target.value);
      }
      state.overviewFilters.paymentDateStatus = [...values];
      rerender();
    }
  });

  document.getElementById("reset-overview-filters").addEventListener("click", () => {
    state.overviewFilters = {
      cities: [],
      streets: [],
      months: [],
      years: [],
      paymentDateStatus: [],
      monthSort: "none",
      yearSort: "none",
    };
    state.overviewOpenFilter = null;
    rerender();
  });

  document.addEventListener("click", (event) => {
    const insideOverviewFilters = event.target.closest(".filter-group") || event.target.closest("#reset-overview-filters");
    if (insideOverviewFilters) {
      return;
    }
    if (state.overviewOpenFilter) {
      state.overviewOpenFilter = null;
      rerender();
    }
  });

  document.getElementById("registry-table-container").addEventListener("click", (event) => {
    const toggleButton = event.target.closest("[data-registry-filter-toggle]");
    if (toggleButton) {
      toggleRegistryFilter(toggleButton.dataset.registryFilterToggle);
      rerender();
      return;
    }

    const sortButton = event.target.closest("[data-registry-sort-field]");
    if (sortButton) {
      const field = sortButton.dataset.registrySortField;
      const direction = sortButton.dataset.registrySortDirection;
      if (field === "month") {
        state.registryFilters.monthSort = direction;
      }
      if (field === "year") {
        state.registryFilters.yearSort = direction;
      }
      state.registryOpenFilter = null;
      rerender();
      return;
    }

    const row = event.target.closest("[data-record-id]");
    if (!row) return;
    state.selectedRecordId = row.dataset.recordId;
    state.isOverviewModalOpen = false;
    rerender();
  });

  document.getElementById("registry-table-container").addEventListener("change", (event) => {
    const filterName = event.target.dataset.registryFilterCheck;
    if (!filterName) {
      return;
    }

    const values = new Set(state.registryFilters[filterName]);
    if (event.target.checked) {
      values.add(event.target.value);
    } else {
      values.delete(event.target.value);
    }
    state.registryFilters[filterName] = [...values];
    if (filterName === "cities") {
      const allowedStreets = new Set(getFilteredStreetOptions(getDerived().records, state.registryFilters.cities));
      state.registryFilters.streets = state.registryFilters.streets.filter((street) => allowedStreets.has(street));
    }
    rerender();
  });

  document.getElementById("reset-registry-filters").addEventListener("click", () => {
    state.registryFilters = {
      companies: [],
      cities: [],
      streets: [],
      months: [],
      years: [],
      paymentDateStatus: [],
      monthSort: "none",
      yearSort: "none",
    };
    state.registryOpenFilter = null;
    rerender();
  });

  document.addEventListener("click", (event) => {
    const insideRegistryFilters = event.target.closest(".filter-group") || event.target.closest("#reset-registry-filters");
    if (insideRegistryFilters) {
      return;
    }
    if (state.registryOpenFilter) {
      state.registryOpenFilter = null;
      rerender();
    }
  });

  document.getElementById("close-overview-modal").addEventListener("click", () => {
    state.isOverviewModalOpen = false;
    rerender();
  });

  document.getElementById("overview-modal").addEventListener("click", (event) => {
    if (event.target.id !== "overview-modal") {
      return;
    }
    state.isOverviewModalOpen = false;
    rerender();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.isOverviewModalOpen) {
      state.isOverviewModalOpen = false;
      rerender();
    }
  });

  document.getElementById("add-period").addEventListener("click", handleAddPeriod);
  document.getElementById("add-record").addEventListener("click", handleAddRecord);
  document.getElementById("add-payment").addEventListener("click", handleAddPayment);
  document.getElementById("save-settings").addEventListener("click", handleSaveSettings);
  document.getElementById("export-json").addEventListener("click", handleExportJson);
  document.getElementById("import-json-trigger").addEventListener("click", () => {
    document.getElementById("import-json-file").click();
  });
  document.getElementById("import-json-file").addEventListener("change", handleImportJsonFile);
  document.getElementById("import-json-text-button").addEventListener("click", handleImportJsonText);
  document.getElementById("set-as-of-today").addEventListener("click", () => {
    document.getElementById("settings-as-of-date").value = getTodayIso();
  });
  document.getElementById("delete-record").addEventListener("click", handleDeleteRecord);
  document.getElementById("toggle-new-company").addEventListener("click", () => {
    state.isAddingNewCompany = !state.isAddingNewCompany;
    if (!state.isAddingNewCompany) {
      state.recordFormCompany = document.getElementById("record-company-select").value || "";
    }
    rerender();
  });
  document.getElementById("toggle-new-city").addEventListener("click", () => {
    state.isAddingNewCity = !state.isAddingNewCity;
    if (!state.isAddingNewCity) {
      state.isAddingNewStreet = false;
    }
    rerender();
  });

  document.getElementById("record-company-select").addEventListener("change", (event) => {
    state.recordFormCompany = event.target.value;
    rerender();
  });

  document.getElementById("record-company-new").addEventListener("input", (event) => {
    if (!state.isAddingNewCompany) {
      return;
    }
    state.recordFormCompany = event.target.value.trim();
    rerender();
  });

  document.getElementById("toggle-new-street").addEventListener("click", () => {
    if (!getCurrentFormCity()) {
      return;
    }
    state.isAddingNewStreet = !state.isAddingNewStreet;
    rerender();
  });

  document.getElementById("record-city-select").addEventListener("change", (event) => {
    state.recordFormCity = event.target.value;
    state.recordFormStreet = "";
    state.isAddingNewStreet = false;
    rerender();
  });

  document.getElementById("record-city-new").addEventListener("input", (event) => {
    if (!state.isAddingNewCity) {
      return;
    }
    state.recordFormCity = event.target.value.trim();
    state.recordFormStreet = "";
    state.isAddingNewStreet = true;
    rerender();
  });

  document.getElementById("record-street-select").addEventListener("change", (event) => {
    state.recordFormStreet = event.target.value;
    rerender();
  });

  document.getElementById("record-street-new").addEventListener("input", (event) => {
    if (!state.isAddingNewStreet) {
      return;
    }
    state.recordFormStreet = event.target.value.trim();
    rerender();
  });

  document.getElementById("record-period-month").addEventListener("change", (event) => {
    state.recordFormMonth = event.target.value;
    rerender();
  });

  document.getElementById("record-period-year").addEventListener("change", (event) => {
    state.recordFormYear = event.target.value;
    rerender();
  });

  document.getElementById("periods-table").addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-edit-period]");
    if (editButton) {
      const period = state.data.periods.find((item) => item.id === editButton.dataset.editPeriod);
      if (!period) {
        return;
      }
      state.editingPeriodId = period.id;
      state.editingPeriodDueDate = period.dueDate || "";
      rerender();
      return;
    }

    const saveButton = event.target.closest("[data-save-period]");
    if (saveButton) {
      await handleSavePeriodDueDate(saveButton.dataset.savePeriod);
      return;
    }

    const cancelButton = event.target.closest("[data-cancel-period-edit]");
    if (cancelButton) {
      state.editingPeriodId = null;
      state.editingPeriodDueDate = "";
      rerender();
      return;
    }

    const button = event.target.closest("[data-delete-period]");
    if (!button) return;
    await handleDeletePeriod(button.dataset.deletePeriod);
  });

  document.getElementById("periods-table").addEventListener("input", (event) => {
    const input = event.target.closest("[data-period-due-date-input]");
    if (!input) {
      return;
    }
    state.editingPeriodDueDate = input.value;
  });

  document.getElementById("workspace-record-filters").addEventListener("click", (event) => {
    const toggleButton = event.target.closest("[data-workspace-filter-toggle]");
    if (!toggleButton) {
      return;
    }
    toggleWorkspaceFilter(toggleButton.dataset.workspaceFilterToggle);
    rerender();
  });

  document.getElementById("workspace-record-filters").addEventListener("change", (event) => {
    if (event.target.id === "payment-record-select") {
      state.selectedRecordId = event.target.value || null;
      rerender();
      return;
    }

    const filterName = event.target.dataset.workspaceFilterCheck;
    if (!filterName) {
      return;
    }

    const values = new Set(state.workspaceFilters[filterName]);
    if (event.target.checked) {
      values.add(event.target.value);
    } else {
      values.delete(event.target.value);
    }
    state.workspaceFilters[filterName] = [...values];
    if (filterName === "cities") {
      const allowedStreets = new Set(getFilteredStreetOptions(getDerived().records, state.workspaceFilters.cities));
      state.workspaceFilters.streets = state.workspaceFilters.streets.filter((street) => allowedStreets.has(street));
    }
    rerender();
  });

  document.getElementById("reset-workspace-filters").addEventListener("click", () => {
    state.workspaceFilters = {
      companies: [],
      cities: [],
      streets: [],
      months: [],
      years: [],
      paymentDateStatus: [],
    };
    state.workspaceOpenFilter = null;
    rerender();
  });

  document.addEventListener("click", (event) => {
    const insideWorkspaceFilters =
      event.target.closest(".filter-group") ||
      event.target.closest("#reset-workspace-filters") ||
      event.target.closest("#payment-record-select");
    if (insideWorkspaceFilters) {
      return;
    }
    if (state.workspaceOpenFilter) {
      state.workspaceOpenFilter = null;
      rerender();
    }
  });

  document.getElementById("workspace-payments-table").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-delete-payment]");
    if (!button) return;
    await handleDeletePayment(button.dataset.deletePayment);
  });

  rerender();
}

main().catch((error) => {
  console.error(error);
  document.body.innerHTML = `<main class="layout"><section class="panel"><h2>Не удалось загрузить данные</h2><p>${error.message}</p></section></main>`;
});
