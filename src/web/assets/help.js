"use strict";
/* Vue /help : commandes, options et configuration effective. */

/* Classes Tailwind des éléments créés ici (thème Apple : tokens de web/styles/app.css). */
const CLASSES = {
  card: "mb-2.5 rounded-card border border-line bg-panel px-4 py-3.5",
  cardTitle: "m-0 font-mono text-body font-semibold leading-auto",
  alias: "font-normal text-muted",
  description: "mt-1.5 mb-2.5",
  listLabel: "mt-2 text-footnote text-muted",
  list: "mt-1 mb-0 pl-4.5",
  code: "code-chip",
  tableRow: "table-cells",
};

function listSection(label, items) {
  const section = document.createDocumentFragment();
  section.append(element("div", label, CLASSES.listLabel));
  const list = element("ul", undefined, CLASSES.list);
  items.forEach((item) => { const row = element("li"); row.append(element("code", item, CLASSES.code)); list.append(row); });
  section.append(list);
  return section;
}

function commandCard(command) {
  const card = element("article", undefined, CLASSES.card);
  const title = element("h3", command.usage, CLASSES.cardTitle);
  if (command.aliases.length > 0) {
    title.append(element("span", "  " + message("alias") + " " + command.aliases.map((alias) => "/" + alias).join(", "), CLASSES.alias));
  }
  card.append(title, element("p", command.description, CLASSES.description));
  if (command.examples.length > 0) card.append(listSection(message("examples"), command.examples));
  if (command.gitSteps.length > 0) card.append(listSection(message("gitSteps"), command.gitSteps));
  return card;
}

function optionRow(option) {
  const row = element("tr", undefined, CLASSES.tableRow);
  const name = element("td"); name.append(element("code", option.path, CLASSES.code));
  row.append(name, element("td", option.type), element("td", option.description));
  return row;
}

async function load() {
  try {
    const response = await fetch("/api/help");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    document.getElementById("commands").append(...data.commands.map(commandCard));
    document.getElementById("options").append(...data.configOptions.map(optionRow));
    document.getElementById("effective").textContent =
      data.effectiveConfig ? JSON.stringify(data.effectiveConfig, null, 2) : message("configInvalid");
  } catch (error) {
    const box = document.getElementById("error");
    box.hidden = false;
    box.textContent = message("error") + " " + error.message;
  }
}
load();
