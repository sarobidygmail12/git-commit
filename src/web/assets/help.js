"use strict";
/* Vue /help : commandes, options et configuration effective. */

function listSection(label, items) {
  const section = document.createDocumentFragment();
  section.append(element("div", label, "label"));
  const list = element("ul");
  items.forEach((item) => { const row = element("li"); row.append(element("code", item)); list.append(row); });
  section.append(list);
  return section;
}

function commandCard(command) {
  const card = element("article", undefined, "card");
  const title = element("h3", command.usage);
  if (command.aliases.length > 0) {
    title.append(element("span", "  " + message("alias") + " " + command.aliases.map((alias) => "/" + alias).join(", "), "alias"));
  }
  card.append(title, element("p", command.description));
  if (command.examples.length > 0) card.append(listSection(message("examples"), command.examples));
  if (command.gitSteps.length > 0) card.append(listSection(message("gitSteps"), command.gitSteps));
  return card;
}

function optionRow(option) {
  const row = element("tr");
  const name = element("td"); name.append(element("code", option.path));
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
