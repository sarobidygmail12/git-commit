"use strict";
/* Vue /log : historique en graphe, filtres et détail d'un commit. */

const ROW_HEIGHT = 36, LANE_WIDTH = 24, LANE_OFFSET = 16, AVATAR_RADIUS = 11, MERGE_RADIUS = 5, MIN_GRAPH_WIDTH = 0;
const SVG_NS = "http://www.w3.org/2000/svg";
const LANE_COLORS = ["#1f9ce0", "#16a371", "#e0702b", "#a855d8", "#d19a0b", "#e0497f", "#4f6fe8", "#0fa5a5"];
const AUTHOR_COLORS = ["#b5472d", "#2c7a51", "#3b5fc4", "#8b3fb0", "#a86a00", "#b03060", "#00788a", "#5b6472"];
/*
 * Classes Tailwind des éléments créés ici (thème Apple : tokens de web/styles/app.css).
 * Toute cellule d'une ligne reste sur une ligne (`whitespace-nowrap` ou `truncate`) : un nom long est coupé par « … ».
 */
const CLASSES = {
  avatar: "inline-grid size-5 flex-none place-items-center rounded-full text-tiny font-bold text-on-avatar",
  avatarLarge: "inline-grid size-8 flex-none place-items-center rounded-full text-caption font-bold text-on-avatar",
  graph: "block",
  graphLabel: "fill-on-avatar text-tiny font-bold",
  icon: "flex-none",
  pill: "inline-flex h-5.5 min-w-0 items-center gap-1 rounded-chip px-1.75 text-caption font-semibold whitespace-nowrap text-on-avatar data-current:ring-2 data-current:ring-text data-tag:text-text data-tag:inset-ring data-tag:inset-ring-muted",
  pillInMenu: "flex-none max-w-full",
  pillText: "overflow-hidden text-ellipsis",
  refsCell: "flex min-w-0 items-center gap-1 overflow-hidden pl-2.5 whitespace-nowrap",
  ghostBranch: "overflow-hidden text-caption text-ellipsis opacity-72",
  moreRefs: "flex-none text-caption2 text-muted",
  row: "log-grid h-9 cursor-pointer hover:bg-hover data-head:not-data-selected:bg-head data-selected:bg-selected data-dim:not-data-selected:not-hover:*:opacity-48",
  cell: "min-w-0 truncate px-2.5",
  merge: "text-muted",
  authorCell: "flex min-w-0 items-center gap-1.75 overflow-hidden px-2.5 whitespace-nowrap",
  authorName: "overflow-hidden text-ellipsis",
  muted: "text-caption text-muted tabular-nums",
  section: "group px-2",
  sectionTitle: "disclosure px-1 pt-2 pb-1 text-caption2 font-semibold text-muted",
  sectionName: "flex-1",
  groupLabel: "pt-1 pr-1 pb-0.5 pl-3.5 text-caption2 text-muted",
  item: "flex min-h-6.5 w-full items-center gap-1.75 rounded-chip py-0.5 pr-1 pl-3.5 text-left hover:bg-hover data-active:not-data-current:bg-selected data-current:bg-head data-current:font-emphasis",
  staticItem: "flex min-h-6.5 w-full cursor-default items-center gap-1.75 rounded-chip py-0.5 pr-1 pl-3.5",
  tick: "w-3 flex-none font-bold text-add",
  label: "min-w-0 flex-1 truncate",
  count: "text-caption2 whitespace-nowrap text-muted tabular-nums",
  currentHint: "font-medium text-muted",
  currentName: "overflow-hidden text-ellipsis",
  toolbarButton: "button-toolbar",
  link: "pressable font-mono text-accent hover:underline",
  mono: "font-mono",
  detailsHead: "flex items-start gap-2.5",
  detailsTitle: "m-0 flex-1 text-body leading-heading wrap-anywhere",
  close: "pressable rounded-chip px-1.5 py-0.5 text-lg leading-none text-muted hover:bg-hover",
  body: "mt-2 mb-0 whitespace-pre-wrap text-muted wrap-anywhere",
  person: "my-3.5 flex items-center gap-2.25",
  personDetail: "block text-muted",
  heading: "mt-4 mb-1.5 text-caption2 tracking-label text-muted uppercase",
  wrap: "flex flex-wrap gap-1",
  badge: "rounded-chip bg-raised px-1.75 py-px text-caption wrap-anywhere data-current:bg-head data-current:font-emphasis",
  actions: "mt-3 flex flex-wrap gap-1.5",
  file: "pressable flex w-full gap-2 rounded-chip px-1 py-0.75 text-left text-caption hover:bg-hover",
  filePath: "min-w-0 flex-1 font-mono wrap-anywhere",
  added: "flex-none font-mono text-add tabular-nums",
  deleted: "flex-none font-mono text-del tabular-nums",
  addedTotal: "text-add",
  deletedTotal: "text-del",
  diffBody: "diff-split m-0 pb-2 font-mono text-caption leading-dense",
  diffSideTitle: "sticky top-0 z-1 col-span-2 border-b border-line bg-raised px-3 py-1 font-sans text-caption2 font-semibold text-muted not-first:border-l",
  diffHunk: "col-span-4 mt-2 bg-selected px-3 py-0.5 text-muted first:mt-0",
  diffNumber: "border-line px-2 text-right text-muted tabular-nums select-none data-new:border-l data-add:bg-add/20 data-del:bg-del/20 data-empty:bg-raised",
  diffText: "min-w-0 pr-3 pl-1 whitespace-pre-wrap wrap-anywhere data-add:bg-add/12 data-del:bg-del/12 data-empty:bg-raised",
  diffNote: "m-0 px-4.5 py-3 text-caption text-muted",
};

const byId = (id) => document.getElementById(id);
const rowsNode = byId("rows"), stateNode = byId("state"), moreButton = byId("more"), detailsNode = byId("details");
const fileDialog = byId("file-dialog"), fileDiffNode = byId("file-diff");
const sidebarNode = byId("sidebar"), searchInput = byId("search"), fieldSelect = byId("field"), refsPopover = byId("refs-popover");

let repo = null, loaded = [], nextPage = 0, hasMore = false, loadToken = 0, detailToken = 0, diffToken = 0;
let selectedBranch = "", selectedHash = null;

function svgNode(tag, attributes) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([name, value]) => node.setAttribute(name, value));
  return node;
}
function hashText(text) {
  return [...text].reduce((hash, character) => (hash * 31 + character.codePointAt(0)) >>> 0, 7);
}
const authorColor = (name) => AUTHOR_COLORS[hashText(name) % AUTHOR_COLORS.length];
const laneColor = (lane) => LANE_COLORS[lane % LANE_COLORS.length];
const branchColor = (name) => LANE_COLORS[hashText(name) % LANE_COLORS.length];

function initials(name) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return letters.map((word) => [...word][0]).join("").toUpperCase() || "?";
}
function avatar(name, className = CLASSES.avatar) {
  const node = element("span", initials(name), className);
  node.style.background = authorColor(name);
  return node;
}

/* ---- Graphe ---- */
const laneX = (lane) => LANE_OFFSET + lane * LANE_WIDTH;

/* Attribue à chaque commit une colonne et les segments à tracer sur sa ligne. */
function computeGraph(commits) {
  const lanes = [];
  const freeLane = () => { const index = lanes.indexOf(null); return index === -1 ? lanes.length : index; };
  return commits.map((commit) => {
    let column = lanes.indexOf(commit.hash);
    const isBranchTip = column === -1;
    if (isBranchTip) { column = freeLane(); lanes[column] = commit.hash; }
    const segments = [];
    lanes.forEach((hash, lane) => {
      if (hash === null || lane === column) return;
      if (hash === commit.hash) { segments.push({ from: lane, to: column, part: "in" }); lanes[lane] = null; }
      else segments.push({ from: lane, to: lane, part: "through" });
    });
    if (!isBranchTip) segments.push({ from: column, to: column, part: "in" });
    const [firstParent, ...otherParents] = commit.parents;
    lanes[column] = firstParent ?? null;
    if (firstParent) segments.push({ from: column, to: column, part: "out" });
    otherParents.forEach((parent) => {
      let lane = lanes.indexOf(parent);
      if (lane === -1) { lane = freeLane(); lanes[lane] = parent; }
      segments.push({ from: column, to: lane, part: "out" });
    });
    const width = Math.max(lanes.length, column + 1, ...segments.map((s) => Math.max(s.from, s.to) + 1));
    while (lanes.length > 0 && lanes[lanes.length - 1] === null) lanes.pop();
    return { column, segments, width };
  });
}

function segmentPath(segment) {
  const middle = ROW_HEIGHT / 2;
  const fromX = laneX(segment.from), toX = laneX(segment.to);
  if (segment.part === "through") return `M${fromX} 0 L${toX} ${ROW_HEIGHT}`;
  if (segment.part === "in") return `M${fromX} 0 C${fromX} ${middle},${toX} ${middle / 2},${toX} ${middle}`;
  return `M${fromX} ${middle} C${fromX} ${middle * 1.5},${toX} ${middle},${toX} ${ROW_HEIGHT}`;
}

function graphPixelWidth(lanes) {
  return LANE_OFFSET * 2 + (lanes - 1) * LANE_WIDTH;
}

function drawGraph(commit, cell, lanes) {
  const middle = ROW_HEIGHT / 2, x = laneX(cell.column), color = laneColor(cell.column);
  const svg = svgNode("svg", { class: CLASSES.graph, width: graphPixelWidth(lanes), height: ROW_HEIGHT, "aria-hidden": "true" });
  if (groupRefs(commit.refs).length > 0) {
    svg.append(svgNode("path", { d: `M0 ${middle} L${x} ${middle}`, stroke: color, "stroke-width": 2, opacity: 0.7 }));
  }
  cell.segments.forEach((segment) => {
    const lane = segment.part === "out" ? segment.to : segment.from;
    svg.append(svgNode("path", { d: segmentPath(segment), fill: "none", stroke: laneColor(lane), "stroke-width": 2 }));
  });
  if (commit.parents.length > 1) {
    svg.append(svgNode("circle", { cx: x, cy: middle, r: MERGE_RADIUS, fill: color }));
    return svg;
  }
  svg.append(svgNode("circle", { cx: x, cy: middle, r: AVATAR_RADIUS, fill: authorColor(commit.author), stroke: color, "stroke-width": 2 }));
  const label = svgNode("text", { x, y: middle, class: CLASSES.graphLabel, "text-anchor": "middle", "dominant-baseline": "central" });
  label.textContent = initials(commit.author);
  svg.append(label);
  return svg;
}

/* ---- Lignes ---- */
function iconLaptop() {
  const svg = svgNode("svg", { class: CLASSES.icon, width: 12, height: 12, viewBox: "0 0 16 16", "aria-label": "local" });
  svg.append(svgNode("path", { d: "M3 3h10v7H3zM1 12h14v1.5H1z", fill: "currentColor" }));
  return svg;
}
function iconCloud() {
  const svg = svgNode("svg", { class: CLASSES.icon, width: 13, height: 12, viewBox: "0 0 18 14", "aria-label": "distant" });
  svg.append(svgNode("path", { d: "M5 13a4 4 0 0 1-.6-8A5 5 0 0 1 14 5.2 3.9 3.9 0 0 1 14 13z", fill: "currentColor" }));
  return svg;
}

/* Fusionne « main » et « origin/main » en une seule étiquette, comme une seule branche. */
function groupRefs(refs) {
  const groups = new Map();
  refs.forEach((ref) => {
    if (ref.kind === "head" || ref.kind === "stash") return;
    const label = ref.kind === "remote" ? ref.name.slice(ref.name.indexOf("/") + 1) : ref.name;
    const groupKey = (ref.kind === "tag" ? "tag:" : "branch:") + label;
    const group = groups.get(groupKey) ?? { label, isTag: ref.kind === "tag", local: false, remote: false };
    if (ref.kind === "branch") group.local = true;
    if (ref.kind === "remote") group.remote = true;
    groups.set(groupKey, group);
  });
  const isCurrent = (group) => group.local && group.label === repo?.head.branch;
  return [...groups.values()].sort((a, b) => Number(isCurrent(b)) - Number(isCurrent(a)) || Number(a.isTag) - Number(b.isTag));
}

/* Une étiquette prend la couleur de sa voie ; un tag reste transparent, simplement cerclé. */
function refPill(group, color, extraClasses = "") {
  const isCurrent = group.local && group.label === repo?.head.branch;
  const pill = element("span", undefined, (CLASSES.pill + " " + extraClasses).trim());
  pill.toggleAttribute("data-tag", group.isTag);
  pill.toggleAttribute("data-current", isCurrent);
  if (!group.isTag) pill.style.background = color;
  if (isCurrent) pill.append(element("span", "✓"));
  pill.append(element("span", group.label, CLASSES.pillText));
  if (group.local) pill.append(iconLaptop());
  if (group.remote) pill.append(iconCloud());
  return pill;
}

/* Posé sur la cellule, pour que la première étiquette reste à sa place et que la liste semble s'y déplier. */
function showRefsPopover(cell, groups, color) {
  refsPopover.replaceChildren(...groups.map((group) => refPill(group, color, CLASSES.pillInMenu)));
  refsPopover.hidden = false;
  const anchor = cell.getBoundingClientRect();
  const margin = 8;
  refsPopover.style.top = Math.max(margin, Math.min(anchor.top, innerHeight - refsPopover.offsetHeight - margin)) + "px";
  refsPopover.style.left = Math.max(margin, Math.min(anchor.left + 3, innerWidth - refsPopover.offsetWidth - margin)) + "px";
}
function hideRefsPopover() {
  refsPopover.hidden = true;
}

function refsCell(commit, color) {
  const cell = element("div", undefined, CLASSES.refsCell);
  const groups = groupRefs(commit.refs);
  if (groups.length > 1) {
    cell.onmouseenter = () => showRefsPopover(cell, groups, color);
    cell.onmouseleave = hideRefsPopover;
  } else {
    cell.title = groups[0]?.label ?? commit.branch;
  }
  if (groups.length === 0) {
    if (commit.branch !== "") {
      const ghost = element("span", commit.branch, CLASSES.ghostBranch);
      ghost.style.color = color;
      cell.append(ghost);
    }
    return cell;
  }
  cell.append(refPill(groups[0], color));
  if (groups.length > 1) cell.append(element("span", "+" + (groups.length - 1), CLASSES.moreRefs));
  return cell;
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(message("dateLocale"), { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function commitRow(commit, cell, lanes, dimOtherBranches) {
  const color = cell ? laneColor(cell.column) : branchColor(commit.branch);
  const row = element("div", undefined, CLASSES.row);
  row.tabIndex = 0;
  row.setAttribute("role", "button");
  row.dataset.hash = commit.hash;
  row.toggleAttribute("data-head", commit.hash === repo?.head.hash);
  row.toggleAttribute("data-selected", commit.hash === selectedHash);
  row.toggleAttribute("data-dim", dimOtherBranches && !commit.onCurrentBranch);
  row.onclick = () => selectCommit(commit);
  row.onkeydown = (event) => { if (event.key === "Enter") selectCommit(commit); };

  const graph = element("div");
  if (cell) graph.append(drawGraph(commit, cell, lanes));

  const subject = element("div", undefined, CLASSES.cell);
  subject.title = commit.subject;
  subject.append(element("span", commit.subject, commit.parents.length > 1 ? CLASSES.merge : undefined));

  const author = element("div", undefined, CLASSES.authorCell);
  author.title = commit.author;
  author.append(avatar(commit.author), element("span", commit.author, CLASSES.authorName));

  row.append(refsCell(commit, color), graph, subject, author, element("div", formatDate(commit.date), CLASSES.cell + " " + CLASSES.muted), element("div", commit.shortHash.slice(0, 7), CLASSES.cell + " " + CLASSES.muted + " " + CLASSES.mono));
  return row;
}

/* Un graphe n'a de sens que sur un historique continu : pas sur des résultats de recherche. */
function render() {
  hideRefsPopover();
  const isSearching = searchInput.value.trim() !== "";
  const cells = isSearching ? [] : computeGraph(loaded);
  const lanes = Math.max(1, ...cells.map((cell) => cell.width));
  document.documentElement.style.setProperty("--graph-width", (isSearching ? MIN_GRAPH_WIDTH : graphPixelWidth(lanes)) + "px");
  byId("graph-title").textContent = isSearching ? "" : message("graph");
  const dim = !isSearching && selectedBranch === "" && loaded.some((commit) => commit.onCurrentBranch);
  rowsNode.replaceChildren(...loaded.map((commit, index) => commitRow(commit, cells[index], lanes, dim)));
}

function showState(text) {
  stateNode.hidden = text === "";
  stateNode.textContent = text;
}

/* ---- Barre latérale ---- */
function section(title, count, isOpen) {
  const node = element("details", undefined, CLASSES.section);
  node.open = isOpen;
  const summary = element("summary", undefined, CLASSES.sectionTitle);
  summary.append(element("span", title, CLASSES.sectionName), element("span", String(count)));
  node.append(summary);
  return node;
}

function aheadBehind(branch) {
  const parts = [];
  if (branch.ahead > 0) parts.push("↑" + branch.ahead);
  if (branch.behind > 0) parts.push("↓" + branch.behind);
  return parts.join(" ");
}

function branchItem(name, displayName, count) {
  const button = element("button", undefined, CLASSES.item);
  button.type = "button";
  button.dataset.branch = name;
  button.title = name;
  const isCurrent = name === repo.head.branch;
  button.toggleAttribute("data-current", isCurrent);
  button.append(element("span", isCurrent ? "✓" : "", CLASSES.tick), element("span", displayName, CLASSES.label));
  if (count) button.append(element("span", count, CLASSES.count));
  button.onclick = () => filterByBranch(selectedBranch === name ? "" : name);
  return button;
}

function authorItem(author) {
  const button = element("button", undefined, CLASSES.item);
  button.type = "button";
  button.dataset.author = author.name;
  button.title = author.name;
  button.append(avatar(author.name), element("span", author.name, CLASSES.label), element("span", String(author.commits), CLASSES.count));
  button.onclick = () => filterByAuthor(activeAuthor() === author.name ? "" : author.name);
  return button;
}

function renderSidebar() {
  const local = section(message("local"), repo.local.length, true);
  repo.local.forEach((branch) => local.append(branchItem(branch.name, branch.name, aheadBehind(branch))));

  const remote = section(message("remote"), repo.remote.length, true);
  const remotes = Map.groupBy(repo.remote, (name) => name.split("/")[0]);
  remotes.forEach((names, remoteName) => {
    remote.append(element("div", remoteName, CLASSES.groupLabel));
    names.forEach((name) => remote.append(branchItem(name, name.slice(remoteName.length + 1))));
  });

  const authors = section(message("authors"), repo.authors.length, true);
  repo.authors.forEach((author) => authors.append(authorItem(author)));

  const tags = section(message("tags"), repo.tags.length, false);
  repo.tags.forEach((tag) => {
    const item = element("div", undefined, CLASSES.staticItem);
    item.append(element("span", tag, CLASSES.label));
    tags.append(item);
  });

  sidebarNode.replaceChildren(local, remote, authors, tags);
  markActiveFilters();
}

function activeAuthor() {
  return fieldSelect.value === "author" ? searchInput.value.trim() : "";
}

function markActiveFilters() {
  const author = activeAuthor();
  sidebarNode.querySelectorAll("[data-branch]").forEach((node) => node.toggleAttribute("data-active", node.dataset.branch === selectedBranch));
  sidebarNode.querySelectorAll("[data-author]").forEach((node) => node.toggleAttribute("data-active", node.dataset.author === author));
  byId("filter-chip").hidden = selectedBranch === "";
  byId("filter-text").textContent = selectedBranch;
}

function filterByBranch(branch) {
  selectedBranch = branch;
  sidebarNode.removeAttribute("data-open");
  loadPage(0);
}

function filterByAuthor(author) {
  fieldSelect.value = "author";
  searchInput.value = author;
  sidebarNode.removeAttribute("data-open");
  loadPage(0);
}

function renderCurrentBranch() {
  const node = byId("current");
  const local = repo.local.find((branch) => branch.name === repo.head.branch);
  const counts = local ? aheadBehind(local) : "";
  const label = repo.head.branch ?? (repo.head.hash ? message("detachedHead") + " · " + repo.head.hash.slice(0, 7) : message("noCommit"));
  node.replaceChildren(element("small", message("youAreOn"), CLASSES.currentHint), element("span", label, CLASSES.currentName));
  if (counts) node.append(element("small", counts, CLASSES.currentHint));
  node.hidden = false;
}

async function goToHead() {
  const hash = repo?.head.hash;
  if (!hash) return;
  const commit = loaded.find((item) => item.hash === hash);
  if (commit) {
    selectCommit(commit);
    rowsNode.querySelector(`[data-hash="${hash}"]`)?.scrollIntoView({ block: "center" });
    return;
  }
  if (hasMore && await loadPage(nextPage)) goToHead();
}

/* ---- Détail ---- */
function copyButton(label, text) {
  const button = element("button", label, CLASSES.toolbarButton);
  button.type = "button";
  button.onclick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = message("copied");
    } catch {
      button.textContent = message("failed");
    }
    setTimeout(() => { button.textContent = label; }, 1200);
  };
  return button;
}

function closeDetails() {
  selectedHash = null;
  detailToken++;
  detailsNode.hidden = true;
  rowsNode.querySelectorAll("[data-selected]").forEach((node) => node.removeAttribute("data-selected"));
}

function selectCommit(commit) {
  selectedHash = commit.hash;
  rowsNode.querySelectorAll("[data-hash]").forEach((node) => node.toggleAttribute("data-selected", node.dataset.hash === commit.hash));
  renderDetails(commit);
}

function parentLink(hash) {
  const parent = loaded.find((item) => item.hash === hash);
  if (!parent) return element("span", hash.slice(0, 7), CLASSES.mono);
  const link = element("button", hash.slice(0, 7), CLASSES.link);
  link.type = "button";
  link.onclick = () => {
    selectCommit(parent);
    rowsNode.querySelector(`[data-hash="${hash}"]`)?.scrollIntoView({ block: "center" });
  };
  return link;
}

function fileStats(file) {
  if (file.added === null) return [element("span", message("binary"), CLASSES.muted)];
  return [element("span", "+" + file.added, CLASSES.added), element("span", "−" + file.deleted, CLASSES.deleted)];
}

function fileRow(commit, file) {
  const row = element("button", undefined, CLASSES.file);
  row.type = "button";
  row.title = message("showFileDiff", { path: file.path });
  row.onclick = () => openFileDiff(commit, file);
  row.append(element("span", file.path, CLASSES.filePath), ...fileStats(file));
  return row;
}

/* L'en-tête git (diff --git, index, ---, +++) répète le chemin déjà affiché en titre : on part du premier bloc @@. */
function diffNodes(diff) {
  const lines = diff.patch.split("\n");
  const firstHunk = lines.findIndex((line) => line.startsWith("@@"));
  if (firstHunk === -1) {
    const isBinary = lines.some((line) => line.startsWith("Binary files"));
    return [element("p", isBinary ? message("binary") : message("noDiff"), CLASSES.diffNote)];
  }
  const body = element("div", undefined, CLASSES.diffBody);
  body.append(element("div", message("diffBefore"), CLASSES.diffSideTitle), element("div", message("diffAfter"), CLASSES.diffSideTitle));
  splitDiffRows(lines.slice(firstHunk)).forEach((row) => {
    if (row.hunk !== undefined) body.append(element("div", row.hunk, CLASSES.diffHunk));
    else body.append(...diffSide(row.left, "old"), ...diffSide(row.right, "new"));
  });
  const nodes = [body];
  if (diff.truncated) nodes.push(element("p", message("diffTruncated", { count: lines.length }), CLASSES.diffNote));
  return nodes;
}

/* En-tête de bloc : `@@ -ancien,nombre +nouveau,nombre @@`. https://regex101.com/?regex=%5E%40%40%20-(%5Cd%2B)(%3F%3A%2C%5Cd%2B)%3F%20%5C%2B(%5Cd%2B) */
const HUNK_START = /^@@ -(\d+)(?:,\d+)? \+(\d+)/;

/*
 * Deux colonnes : une ligne de contexte apparaît des deux côtés ; une suite de suppressions et l'ajout qui la suit
 * sont mis en face ligne à ligne, le côté le plus court complété par des cases vides.
 */
function splitDiffRows(lines) {
  const rows = [];
  let oldNumber = 0, newNumber = 0, removed = [], added = [];
  const flush = () => {
    for (let index = 0; index < Math.max(removed.length, added.length); index++) rows.push({ left: removed[index], right: added[index] });
    removed = [];
    added = [];
  };
  lines.forEach((line) => {
    const hunk = HUNK_START.exec(line);
    if (hunk) {
      flush();
      oldNumber = Number(hunk[1]);
      newNumber = Number(hunk[2]);
      rows.push({ hunk: line });
    } else if (line.startsWith("-")) removed.push({ number: oldNumber++, text: line.slice(1), change: "del" });
    else if (line.startsWith("+")) added.push({ number: newNumber++, text: line.slice(1), change: "add" });
    else if (!line.startsWith("\\")) {
      flush();
      rows.push({ left: { number: oldNumber++, text: line.slice(1) }, right: { number: newNumber++, text: line.slice(1) } });
    }
  });
  flush();
  return rows;
}

function diffSide(line, side) {
  const number = element("div", line ? String(line.number) : "", CLASSES.diffNumber);
  const text = element("div", line?.text || " ", CLASSES.diffText);
  number.dataset[side] = "";
  [number, text].forEach((node) => {
    if (!line) node.dataset.empty = "";
    else if (line.change) node.dataset[line.change] = "";
  });
  return [number, text];
}

async function openFileDiff(commit, file) {
  const token = ++diffToken;
  byId("file-dialog-title").textContent = file.path;
  byId("file-dialog-stats").replaceChildren(...fileStats(file));
  fileDiffNode.replaceChildren(element("p", message("loading"), CLASSES.diffNote));
  if (!fileDialog.open) fileDialog.showModal();

  try {
    const response = await fetch("/api/commit/file?" + new URLSearchParams({ hash: commit.hash, path: file.path }));
    const data = await response.json();
    if (token !== diffToken) return;
    if (!response.ok) throw new Error(data.error);
    fileDiffNode.replaceChildren(...diffNodes(data));
    fileDiffNode.scrollTop = 0;
  } catch (error) {
    if (token === diffToken) fileDiffNode.replaceChildren(element("p", message("error") + " " + error.message, CLASSES.diffNote));
  }
}

async function renderDetails(commit) {
  const token = ++detailToken;
  detailsNode.hidden = false;

  const head = element("div", undefined, CLASSES.detailsHead);
  const close = element("button", "×", CLASSES.close);
  close.id = "close";
  close.type = "button";
  close.setAttribute("aria-label", message("closeDetails"));
  close.onclick = closeDetails;
  head.append(element("h2", commit.subject, CLASSES.detailsTitle), close);

  const person = element("div", undefined, CLASSES.person);
  const who = element("div");
  who.append(element("strong", commit.author), element("small", formatDate(commit.date), CLASSES.personDetail));
  person.append(avatar(commit.author, CLASSES.avatarLarge), who);

  const actions = element("div", undefined, CLASSES.actions);
  actions.append(copyButton(message("copyHash"), commit.hash), copyButton(message("copyCherryPick"), "/cherry-pick " + commit.hash));

  const parents = element("div", undefined, CLASSES.wrap);
  commit.parents.forEach((hash) => parents.append(parentLink(hash)));

  const body = element("div");
  detailsNode.replaceChildren(head, body, person, element("h3", message("branch"), CLASSES.heading), element("div", commit.branch || message("unknown")), element("h3", "SHA", CLASSES.heading), element("div", commit.hash, CLASSES.muted + " " + CLASSES.mono));
  if (commit.parents.length > 0) detailsNode.append(element("h3", commit.parents.length > 1 ? message("parentsMerge") : message("parent"), CLASSES.heading), parents);
  detailsNode.append(actions);
  const loadingNote = element("p", message("loading"), CLASSES.muted);
  detailsNode.append(loadingNote);

  try {
    const response = await fetch("/api/commit?" + new URLSearchParams({ hash: commit.hash }));
    const data = await response.json();
    if (token !== detailToken) return;
    if (!response.ok) throw new Error(data.error);
    loadingNote.remove();
    if (data.body !== "") body.append(element("p", data.body, CLASSES.body));
    if (data.committer !== commit.author) who.append(element("small", message("committedBy") + " " + data.committer, CLASSES.personDetail));
    detailsNode.append(containedInSection(data.containedIn), ...filesSection(commit, data));
  } catch (error) {
    if (token === detailToken) loadingNote.textContent = message("error") + " " + error.message;
  }
}

function containedInSection(refs) {
  const container = element("div");
  const list = element("div", undefined, CLASSES.wrap);
  refs.forEach((ref) => {
    const badge = element("span", ref.name, CLASSES.badge);
    badge.toggleAttribute("data-current", ref.kind === "branch" && ref.name === repo?.head.branch);
    list.append(badge);
  });
  container.append(element("h3", message("containedIn") + " " + refs.length, CLASSES.heading), list);
  return container;
}

function filesSection(commit, data) {
  const added = data.files.reduce((sum, file) => sum + (file.added ?? 0), 0);
  const deleted = data.files.reduce((sum, file) => sum + (file.deleted ?? 0), 0);
  const title = element("h3", undefined, CLASSES.heading);
  title.append(message("files") + " " + data.fileCount + " · ", element("span", "+" + added, CLASSES.addedTotal), " ", element("span", "−" + deleted, CLASSES.deletedTotal));
  const nodes = [title, ...data.files.map((file) => fileRow(commit, file))];
  if (data.fileCount > data.files.length) nodes.push(element("p", message("moreFiles", { count: data.fileCount - data.files.length }), CLASSES.muted));
  return nodes;
}

/* ---- Chargement ---- */
async function loadPage(page) {
  const token = ++loadToken;
  const params = new URLSearchParams({ page, search: searchInput.value, field: fieldSelect.value, branch: selectedBranch });
  moreButton.disabled = true;
  markActiveFilters();
  try {
    const response = await fetch("/api/log?" + params);
    const data = await response.json();
    if (token !== loadToken) return false;
    if (!response.ok) throw new Error(data.error);
    loaded = page === 0 ? data.commits : loaded.concat(data.commits);
    nextPage = page + 1;
    hasMore = data.hasMore;
    render();
    showState(loaded.length === 0 ? message("noCommitFound") : "");
    moreButton.hidden = !hasMore;
    return true;
  } catch (error) {
    if (token === loadToken) showState(message("error") + " " + error.message);
    return false;
  } finally {
    moreButton.disabled = false;
  }
}

async function loadRepo() {
  const response = await fetch("/api/repo");
  const data = await response.json();
  if (!response.ok) throw new Error(data.error);
  repo = data;
  byId("repo").textContent = repo.name;
  document.title = "🚀 " + repo.name + " · git-commit.dev";
  renderCurrentBranch();
  renderSidebar();
}

byId("filters").onsubmit = (event) => { event.preventDefault(); loadPage(0); };
fieldSelect.onchange = () => { if (searchInput.value.trim() !== "") loadPage(0); };
searchInput.onsearch = () => loadPage(0);
byId("filter-clear").onclick = () => filterByBranch("");
byId("current").onclick = goToHead;
byId("menu").onclick = () => sidebarNode.toggleAttribute("data-open");
moreButton.onclick = () => loadPage(nextPage);
byId("center").onscroll = hideRefsPopover;
/* Échap ferme d'abord la modale (nativement), le panneau de détail seulement ensuite. */
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && !fileDialog.open) closeDetails(); });
byId("file-dialog-close").onclick = () => fileDialog.close();
fileDialog.onclose = () => { diffToken++; };
/* Un clic sur le fond (hors du contenu) touche le <dialog> lui-même. */
fileDialog.onclick = (event) => { if (event.target === fileDialog) fileDialog.close(); };

loadRepo().then(() => loadPage(0)).catch((error) => showState(message("error") + " " + error.message));
