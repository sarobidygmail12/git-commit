"use strict";
/* Vue /config : édite .git-push.json du dépôt courant. */

const form = document.getElementById("form");
const saveButton = document.getElementById("save");
const resetButton = document.getElementById("reset");
const statusLine = document.getElementById("status");
const errorBox = document.getElementById("error");

const state = { page: null, fields: new Map(), isSaving: false };

const sameValue = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const changedFields = () => [...state.fields.values()].filter((field) => !sameValue(field.read(), field.option.value));

function buildControl(option) {
  if (option.kind === "boolean") {
    const input = element("input");
    input.type = "checkbox";
    input.checked = option.value === true;
    return { input, read: () => input.checked };
  }
  if (option.kind === "choice") {
    const input = element("select");
    option.choices.forEach((choice) => {
      const entry = element("option", choice);
      entry.value = choice;
      input.append(entry);
    });
    input.value = String(option.value);
    return { input, read: () => input.value };
  }
  if (option.kind === "list") {
    const input = element("textarea");
    const items = Array.isArray(option.value) ? option.value : [];
    input.value = items.join("\n");
    input.rows = Math.max(2, items.length + 1);
    input.spellcheck = false;
    return { input, read: () => input.value.split("\n").map((line) => line.trim()).filter((line) => line !== "") };
  }
  const input = element("input");
  input.type = option.kind === "number" ? "number" : "text";
  input.value = option.value === undefined ? "" : String(option.value);
  input.spellcheck = false;
  if (option.kind === "number") {
    input.step = "1";
    return { input, read: () => (input.value.trim() === "" ? input.value : Number(input.value)) };
  }
  return { input, read: () => input.value };
}

function buildOption(option) {
  const id = "option-" + option.path.replaceAll(".", "-");
  const row = element("div", undefined, "option");
  const info = element("div");
  const name = element("label", option.path, "name");
  name.htmlFor = id;
  info.append(name);
  if (option.description) info.append(element("p", option.description, "description"));
  if (option.isGlobalOnly) info.append(element("span", message("globalOnly"), "badge"));

  const control = element("div", undefined, "control");
  const { input, read } = buildControl(option);
  input.id = id;
  input.name = option.path;
  input.disabled = option.isGlobalOnly;
  input.addEventListener("input", refreshStatus);
  input.addEventListener("change", refreshStatus);
  control.append(input);
  if (option.kind === "list") {
    const allowed = option.choices.length > 0 ? " · " + option.choices.join(", ") : "";
    control.append(element("div", message("listHint") + allowed, "hint"));
  }
  const fieldError = element("div", undefined, "field-error");
  fieldError.hidden = true;
  fieldError.id = id + "-error";
  input.setAttribute("aria-describedby", fieldError.id);
  row.append(info, control, fieldError);
  state.fields.set(option.path, { option, read, row, fieldError, input });
}

function groupBySection(options) {
  const sections = new Map();
  options.forEach((option) => {
    const section = option.path.split(".")[0];
    if (!sections.has(section)) sections.set(section, []);
    sections.get(section).push(option);
  });
  return sections;
}

function render(page) {
  state.page = page;
  state.fields = new Map();
  document.getElementById("file").textContent = page.file;
  const nodes = [];
  groupBySection(page.options).forEach((options, section) => {
    nodes.push(element("h2", section));
    const box = element("div", undefined, "section");
    options.forEach((option) => {
      buildOption(option);
      box.append(state.fields.get(option.path).row);
    });
    nodes.push(box);
  });
  form.replaceChildren(...nodes);
  form.setAttribute("aria-busy", "false");
  refreshStatus();
}

function refreshStatus() {
  const changed = new Set(changedFields().map((field) => field.option.path));
  state.fields.forEach((field, path) => field.row.classList.toggle("changed", changed.has(path)));
  const hasChanges = changed.size > 0;
  saveButton.disabled = !hasChanges || state.isSaving;
  resetButton.disabled = !hasChanges || state.isSaving;
  saveButton.textContent = state.isSaving ? message("saving") : message("save");
  if (state.isSaving) return;
  statusLine.className = "bar-status";
  statusLine.textContent = hasChanges ? message("unsavedChanges", { count: changed.size }) : message("noChanges");
}

function clearErrors() {
  errorBox.hidden = true;
  errorBox.replaceChildren();
  state.fields.forEach((field) => {
    field.fieldError.hidden = true;
    field.input.removeAttribute("aria-invalid");
  });
}

const ISSUE_PATH_ENDINGS = [" ", ".", ":"];
const isIssueAbout = (issue, path) => ISSUE_PATH_ENDINGS.some((ending) => issue.startsWith(path + ending));

/** Les problèmes de validation commencent par le chemin de l'option : on les affiche sous le bon champ. */
function showErrors(message, issues) {
  errorBox.hidden = false;
  errorBox.replaceChildren(element("strong", message));
  if (issues.length === 0) return;
  const list = element("ul");
  issues.forEach((issue) => {
    list.append(element("li", issue));
    const field = [...state.fields.values()].find((candidate) => isIssueAbout(issue, candidate.option.path));
    if (!field) return;
    field.fieldError.hidden = false;
    field.fieldError.textContent = issue;
    field.input.setAttribute("aria-invalid", "true");
  });
  errorBox.append(list);
}

async function load() {
  clearErrors();
  form.setAttribute("aria-busy", "true");
  try {
    render(await requestJson("/api/config"));
  } catch (error) {
    form.setAttribute("aria-busy", "false");
    showErrors(message("error") + " " + error.message, error.issues ?? []);
  }
}

async function save(event) {
  event.preventDefault();
  const changes = changedFields().map((field) => ({ path: field.option.path, value: field.read() }));
  if (changes.length === 0 || state.isSaving) return;
  clearErrors();
  state.isSaving = true;
  refreshStatus();
  try {
    const result = await requestJson("/api/config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ changes }),
    });
    if (changes.some((change) => change.path === "language")) {
      location.reload();
      return;
    }
    state.isSaving = false;
    render(result.page);
    statusLine.className = "bar-status success";
    statusLine.textContent = message("saved", { file: result.savedTo });
  } catch (error) {
    state.isSaving = false;
    refreshStatus();
    showErrors(message("saveFailed") + " " + error.message, error.issues ?? []);
  }
}

form.addEventListener("submit", save);
resetButton.addEventListener("click", () => {
  clearErrors();
  render(state.page);
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    form.requestSubmit();
  }
});
window.addEventListener("beforeunload", (event) => {
  if (changedFields().length > 0) event.preventDefault();
});

load();
