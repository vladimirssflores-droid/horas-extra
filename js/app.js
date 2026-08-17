(function () {
  "use strict";

  var STORAGE_CONFIG = "horasExtra.config";
  var STORAGE_RECORDS = "horasExtra.records";

  var DAYS = [
    { key: 1, label: "Lunes" },
    { key: 2, label: "Martes" },
    { key: 3, label: "Miércoles" },
    { key: 4, label: "Jueves" },
    { key: 5, label: "Viernes" },
    { key: 6, label: "Sábado" },
    { key: 0, label: "Domingo" }
  ];

  function defaultConfig() {
    var schedule = {};
    DAYS.forEach(function (d) {
      var isWeekday = d.key >= 1 && d.key <= 5;
      schedule[d.key] = { enabled: isWeekday, start: "09:00", end: "18:00" };
    });
    return { onboarded: false, schedule: schedule };
  }

  function loadConfig() {
    try {
      var raw = localStorage.getItem(STORAGE_CONFIG);
      if (!raw) return defaultConfig();
      var parsed = JSON.parse(raw);
      var base = defaultConfig();
      return Object.assign(base, parsed, { schedule: Object.assign(base.schedule, parsed.schedule || {}) });
    } catch (e) {
      return defaultConfig();
    }
  }

  function saveConfig(cfg) {
    localStorage.setItem(STORAGE_CONFIG, JSON.stringify(cfg));
  }

  function loadRecords() {
    try {
      var raw = localStorage.getItem(STORAGE_RECORDS);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function saveRecords(records) {
    localStorage.setItem(STORAGE_RECORDS, JSON.stringify(records));
  }

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function nowHHMM() {
    var d = new Date();
    return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }

  function timeToMinutes(t) {
    if (!t) return null;
    var parts = t.split(":");
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  function formatSignedDuration(totalMinutes) {
    var minutes = Math.round(totalMinutes || 0);
    var sign = minutes > 0 ? "+" : minutes < 0 ? "-" : "";
    var abs = Math.abs(minutes);
    var h = Math.floor(abs / 60);
    var m = abs % 60;
    return sign + h + "h " + pad2(m) + "m";
  }

  function minutesToHHMM(totalMinutes) {
    var h = Math.floor(totalMinutes / 60);
    var m = totalMinutes % 60;
    return pad2(h) + ":" + pad2(m);
  }

  function weekdayForKey(dateKey) {
    var parts = dateKey.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]).getDay();
  }

  function scheduledEndMinutes(dateKey) {
    var day = state.config.schedule[weekdayForKey(dateKey)];
    if (!day || !day.enabled || !day.end) return null;
    return timeToMinutes(day.end);
  }

  function workedMinutes(record) {
    if (!record || !record.entrada || !record.salida) return 0;
    var start = timeToMinutes(record.entrada);
    var end = timeToMinutes(record.salida);
    var diff = end - start;
    if (diff < 0) diff += 24 * 60;
    return diff;
  }

  function additionalMinutes(record) {
    return (record && record.adicionales ? record.adicionales : 0) * 60;
  }

  // Diferencia entre la salida marcada y la salida programada en el horario.
  // Si el día no tiene horario configurado (día libre), toda la jornada trabajada cuenta como diferencia.
  function diffMinutes(record, dateKey) {
    if (!record || !record.entrada || !record.salida) return null;
    var scheduledEnd = scheduledEndMinutes(dateKey);
    if (scheduledEnd === null) return workedMinutes(record);
    return timeToMinutes(record.salida) - scheduledEnd;
  }

  function totalDeltaMinutes(record, dateKey) {
    var diff = diffMinutes(record, dateKey);
    if (diff === null) return null;
    return diff + additionalMinutes(record);
  }

  function applySignClass(el, minutes) {
    el.classList.remove("is-positive", "is-negative");
    if (minutes > 0) el.classList.add("is-positive");
    else if (minutes < 0) el.classList.add("is-negative");
  }

  function formatDateLabel(dateKey) {
    var parts = dateKey.split("-").map(Number);
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  }

  function formatReportDate(dateKey) {
    var parts = dateKey.split("-").map(Number);
    var d = new Date(parts[0], parts[1] - 1, parts[2]);
    var month = d.toLocaleDateString("es-ES", { month: "long" });
    return pad2(parts[2]) + "/" + month + "/" + parts[0];
  }

  var state = { config: loadConfig(), records: loadRecords() };

  var els = {};
  function cacheEls() {
    [
      "view-onboarding", "view-home", "view-settings",
      "onboarding-schedule", "btn-finish-onboarding",
      "today-date", "status-text", "total-jornada", "total-adicionales", "total-dia",
      "btn-entrada", "btn-salida", "btn-adicional", "btn-menu",
      "history-list", "btn-download-report",
      "btn-back-settings", "settings-schedule", "btn-save-settings", "btn-clear-history",
      "menu-overlay", "toast",
      "modal-overlay", "modal-title", "modal-entrada", "modal-salida", "modal-adicionales", "modal-cancel", "modal-save"
    ].forEach(function (id) {
      els[id] = document.getElementById(id);
    });
  }

  var toastTimer = null;
  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.classList.add("hidden"); }, 2600);
  }

  function buildScheduleEditor(container, schedule) {
    container.innerHTML = "";
    DAYS.forEach(function (d) {
      var entry = schedule[d.key];
      var row = document.createElement("div");
      row.className = "schedule-row";

      var label = document.createElement("span");
      label.className = "schedule-day";
      label.textContent = d.label;

      var switchWrap = document.createElement("label");
      switchWrap.className = "switch";
      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = !!entry.enabled;
      checkbox.dataset.day = d.key;
      checkbox.dataset.role = "enabled";
      var track = document.createElement("span");
      track.className = "switch-track";
      switchWrap.appendChild(checkbox);
      switchWrap.appendChild(track);

      var times = document.createElement("div");
      times.className = "schedule-times";

      var start = document.createElement("input");
      start.type = "time";
      start.value = entry.start || "09:00";
      start.dataset.day = d.key;
      start.dataset.role = "start";
      start.disabled = !entry.enabled;

      var end = document.createElement("input");
      end.type = "time";
      end.value = entry.end || "18:00";
      end.dataset.day = d.key;
      end.dataset.role = "end";
      end.disabled = !entry.enabled;

      checkbox.addEventListener("change", function () {
        start.disabled = !checkbox.checked;
        end.disabled = !checkbox.checked;
      });

      times.appendChild(start);
      times.appendChild(end);

      row.appendChild(label);
      row.appendChild(switchWrap);
      row.appendChild(times);
      container.appendChild(row);
    });
  }

  function readScheduleEditor(container) {
    var schedule = {};
    DAYS.forEach(function (d) { schedule[d.key] = { enabled: false, start: "09:00", end: "18:00" }; });
    container.querySelectorAll("input[data-role='enabled']").forEach(function (cb) {
      schedule[cb.dataset.day].enabled = cb.checked;
    });
    container.querySelectorAll("input[data-role='start']").forEach(function (inp) {
      schedule[inp.dataset.day].start = inp.value || "09:00";
    });
    container.querySelectorAll("input[data-role='end']").forEach(function (inp) {
      schedule[inp.dataset.day].end = inp.value || "18:00";
    });
    return schedule;
  }

  function showView(name) {
    ["view-onboarding", "view-home", "view-settings"].forEach(function (id) {
      els[id].classList.toggle("hidden", id !== "view-" + name);
    });
  }

  function renderHome() {
    var d = new Date();
    els["today-date"].textContent = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });

    var key = todayKey();
    var record = state.records[key] || {};

    var statusText;
    if (record.entrada && record.salida) {
      statusText = "Jornada completada (" + record.entrada + " – " + record.salida + ")";
    } else if (record.entrada) {
      statusText = "Trabajando desde " + record.entrada;
    } else {
      statusText = "Sin marcar entrada";
    }
    els["status-text"].textContent = statusText;

    var diff = diffMinutes(record, key);
    var total = totalDeltaMinutes(record, key);

    els["total-jornada"].textContent = diff === null ? "0h 00m" : formatSignedDuration(diff);
    applySignClass(els["total-jornada"], diff || 0);

    els["total-adicionales"].textContent = formatSignedDuration(additionalMinutes(record));

    els["total-dia"].textContent = total === null ? "0h 00m" : formatSignedDuration(total);
    applySignClass(els["total-dia"], total || 0);

    renderHistory();
  }

  function renderHistory() {
    var keys = Object.keys(state.records).sort().reverse();
    els["history-list"].innerHTML = "";
    if (keys.length === 0) {
      var empty = document.createElement("p");
      empty.className = "history-empty";
      empty.textContent = "Todavía no hay registros.";
      els["history-list"].appendChild(empty);
      return;
    }
    keys.forEach(function (key) {
      var record = state.records[key];
      var item = document.createElement("div");
      item.className = "history-item";
      item.dataset.key = key;

      var left = document.createElement("div");
      var dateEl = document.createElement("div");
      dateEl.className = "history-item-date";
      dateEl.textContent = formatDateLabel(key);
      var detail = document.createElement("div");
      detail.className = "history-item-detail";
      var range = (record.entrada || "--:--") + " - " + (record.salida || "--:--");
      var extra = record.adicionales ? " · +" + record.adicionales + "h adicional" + (record.adicionales > 1 ? "es" : "") : "";
      detail.textContent = range + extra;
      left.appendChild(dateEl);
      left.appendChild(detail);

      var total = totalDeltaMinutes(record, key);
      var right = document.createElement("div");
      right.className = "history-item-total";
      right.textContent = total === null ? "0h 00m" : formatSignedDuration(total);
      applySignClass(right, total || 0);

      item.appendChild(left);
      item.appendChild(right);
      item.addEventListener("click", function () { openEditModal(key); });
      els["history-list"].appendChild(item);
    });
  }

  function getOrCreateTodayRecord() {
    var key = todayKey();
    if (!state.records[key]) state.records[key] = { entrada: null, salida: null, adicionales: 0 };
    return state.records[key];
  }

  function markEntrada() {
    var record = getOrCreateTodayRecord();
    if (record.entrada) {
      var ok = window.confirm("Ya marcaste entrada a las " + record.entrada + ". ¿Actualizar a la hora actual?");
      if (!ok) return;
    }
    record.entrada = nowHHMM();
    saveRecords(state.records);
    renderHome();
    showToast("Entrada registrada: " + record.entrada);
  }

  function markSalida() {
    var record = getOrCreateTodayRecord();
    if (!record.entrada) {
      showToast("Primero marca tu entrada");
      return;
    }
    if (record.salida) {
      var ok = window.confirm("Ya marcaste salida a las " + record.salida + ". ¿Actualizar a la hora actual?");
      if (!ok) return;
    }
    record.salida = nowHHMM();
    saveRecords(state.records);
    renderHome();
    showToast("Salida registrada: " + record.salida);
  }

  function markAdicional() {
    var record = getOrCreateTodayRecord();
    record.adicionales = (record.adicionales || 0) + 1;
    saveRecords(state.records);
    renderHome();
    showToast("Hora adicional agregada (van " + record.adicionales + " hoy)");
  }

  var editingKey = null;
  function openEditModal(key) {
    editingKey = key;
    var record = state.records[key] || {};
    els["modal-title"].textContent = "Editar " + formatDateLabel(key);
    els["modal-entrada"].value = record.entrada || "";
    els["modal-salida"].value = record.salida || "";
    els["modal-adicionales"].value = record.adicionales || 0;
    els["modal-overlay"].classList.remove("hidden");
  }

  function closeEditModal() {
    editingKey = null;
    els["modal-overlay"].classList.add("hidden");
  }

  function saveEditModal() {
    if (!editingKey) return;
    var record = state.records[editingKey] || {};
    record.entrada = els["modal-entrada"].value || null;
    record.salida = els["modal-salida"].value || null;
    record.adicionales = parseInt(els["modal-adicionales"].value, 10) || 0;
    state.records[editingKey] = record;
    saveRecords(state.records);
    closeEditModal();
    renderHome();
    showToast("Registro actualizado");
  }

  function buildReportRows() {
    var keys = Object.keys(state.records).sort();
    var rows = [["Día", "Entrada", "Salida", "Salida programada", "Diferencia", "Horas adicionales", "Total horas"]];
    var sumDiff = 0;
    var sumAdicional = 0;
    keys.forEach(function (key) {
      var record = state.records[key];
      var scheduledEnd = scheduledEndMinutes(key);
      var diff = diffMinutes(record, key);
      var total = totalDeltaMinutes(record, key);
      sumDiff += diff || 0;
      sumAdicional += additionalMinutes(record);
      rows.push([
        formatReportDate(key),
        record.entrada || "",
        record.salida || "",
        scheduledEnd === null ? "" : minutesToHHMM(scheduledEnd),
        diff === null ? "" : formatSignedDuration(diff),
        formatSignedDuration(additionalMinutes(record)),
        total === null ? "" : formatSignedDuration(total)
      ]);
    });
    rows.push([
      "TOTAL A PAGAR", "", "", "",
      formatSignedDuration(sumDiff),
      formatSignedDuration(sumAdicional),
      formatSignedDuration(sumDiff + sumAdicional)
    ]);
    return rows;
  }

  function downloadReport() {
    var keys = Object.keys(state.records);
    if (keys.length === 0) {
      showToast("Todavía no hay registros para descargar");
      return;
    }

    var rows = buildReportRows();
    var ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 20 }, { wch: 9 }, { wch: 9 }, { wch: 16 }, { wch: 12 }, { wch: 16 }, { wch: 12 }];
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Horas extra");

    var filename = "horas-extra-" + todayKey() + ".xlsx";
    XLSX.writeFile(wb, filename);
    showToast("Excel descargado: " + filename);
  }

  function finishOnboarding() {
    state.config.schedule = readScheduleEditor(els["onboarding-schedule"]);
    state.config.onboarded = true;
    saveConfig(state.config);
    showView("home");
    renderHome();
  }

  function openSettings() {
    buildScheduleEditor(els["settings-schedule"], state.config.schedule);
    showView("settings");
  }

  function saveSettings() {
    state.config.schedule = readScheduleEditor(els["settings-schedule"]);
    saveConfig(state.config);
    showToast("Configuración guardada");
    showView("home");
    renderHome();
  }

  function clearHistory() {
    var ok = window.confirm("Esto borrará todos los registros guardados. ¿Continuar?");
    if (!ok) return;
    state.records = {};
    saveRecords(state.records);
    showToast("Historial borrado");
    renderHome();
  }

  function openMenu() { els["menu-overlay"].classList.remove("hidden"); }
  function closeMenu() { els["menu-overlay"].classList.add("hidden"); }

  function bindEvents() {
    els["btn-finish-onboarding"].addEventListener("click", finishOnboarding);

    els["btn-entrada"].addEventListener("click", markEntrada);
    els["btn-salida"].addEventListener("click", markSalida);
    els["btn-adicional"].addEventListener("click", markAdicional);

    els["btn-menu"].addEventListener("click", openMenu);
    els["menu-overlay"].addEventListener("click", function (e) {
      if (e.target === els["menu-overlay"]) closeMenu();
      var action = e.target.dataset ? e.target.dataset.action : null;
      if (action === "close") closeMenu();
      if (action === "settings") { closeMenu(); openSettings(); }
      if (action === "download-report") { closeMenu(); downloadReport(); }
    });

    els["btn-download-report"].addEventListener("click", downloadReport);

    els["btn-back-settings"].addEventListener("click", function () { showView("home"); renderHome(); });
    els["btn-save-settings"].addEventListener("click", saveSettings);
    els["btn-clear-history"].addEventListener("click", clearHistory);

    els["modal-overlay"].addEventListener("click", function (e) {
      if (e.target === els["modal-overlay"]) closeEditModal();
    });
    els["modal-cancel"].addEventListener("click", closeEditModal);
    els["modal-save"].addEventListener("click", saveEditModal);
  }

  function init() {
    cacheEls();
    bindEvents();

    if (!state.config.onboarded) {
      buildScheduleEditor(els["onboarding-schedule"], state.config.schedule);
      showView("onboarding");
    } else {
      showView("home");
      renderHome();
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
