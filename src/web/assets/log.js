"use strict";
/* Vue /log : historique en graphe, filtres et détail d'un commit. */

const ROW_HEIGHT = 36, LANE_WIDTH = 24, LANE_OFFSET = 16, AVATAR_RADIUS = 11, MERGE_RADIUS = 5, MIN_GRAPH_WIDTH = 0;
const SVG_NS = "http://www.w3.org/2000/svg";
const LANE_COLORS = ["#1f9ce0", "#16a371", "#e0702b", "#a855d8", "#d19a0b", "#e0497f", "#4f6fe8", "#0fa5a5"];
const AUTHOR_COLORS = ["#b5472d", "#2c7a51", "#3b5fc4", "#8b3fb0", "#a86a00", "#b03060", "#00788a", "#5b6472"];
const byId = (id) => document.getElementById(id);
const rowsNode = byId("rows"), stateNode = byId("state"), moreButton = byId("more"), detailsNode = byId("details"), detailsDialog = byId("details-dialog");
const sidebarNode = byId("sidebar"), searchInput = byId("search"), fieldSelect = byId("field"), refsPopover = byId("refs-popover");

let repo = null, loaded = [], nextPage = 0, hasMore = false, loadToken = 0, detailToken = 0;
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
function avatar(name) {
  const node = element("span", initials(name), "avatar");
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
  const svg = svgNode("svg", { class: "graph", width: graphPixelWidth(lanes), height: ROW_HEIGHT, "aria-hidden": "true" });
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
  const label = svgNode("text", { x, y: middle });
  label.textContent = initials(commit.author);
  svg.append(label);
  return svg;
}

/* ---- Lignes ---- */
function iconLaptop() {
  const svg = svgNode("svg", { width: 12, height: 12, viewBox: "0 0 16 16", "aria-label": "local" });
  svg.append(svgNode("path", { d: "M3 3h10v7H3zM1 12h14v1.5H1z", fill: "currentColor" }));
  return svg;
}
function iconCloud() {
  const svg = svgNode("svg", { width: 13, height: 12, viewBox: "0 0 18 14", "aria-label": "distant" });
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

function refPill(group, color) {
  const isCurrent = group.local && group.label === repo?.head.branch;
  const pill = element("span", undefined, "pill" + (group.isTag ? " tag" : "") + (isCurrent ? " is-current" : ""));
  pill.style.background = color;
  if (isCurrent) pill.append(element("span", "✓"));
  pill.append(element("span", group.label, "text"));
  if (group.local) pill.append(iconLaptop());
  if (group.remote) pill.append(iconCloud());
  return pill;
}

/* Posé sur la cellule, pour que la première étiquette reste à sa place et que la liste semble s'y déplier. */
function showRefsPopover(cell, groups, color) {
  refsPopover.replaceChildren(...groups.map((group) => refPill(group, color)));
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
  const cell = element("div", undefined, "cell refs");
  const groups = groupRefs(commit.refs);
  if (groups.length > 1) {
    cell.onmouseenter = () => showRefsPopover(cell, groups, color);
    cell.onmouseleave = hideRefsPopover;
  } else {
    cell.title = groups[0]?.label ?? commit.branch;
  }
  if (groups.length === 0) {
    if (commit.branch !== "") {
      const ghost = element("span", commit.branch, "ghost-branch");
      ghost.style.color = color;
      cell.append(ghost);
    }
    return cell;
  }
  cell.append(refPill(groups[0], color));
  if (groups.length > 1) cell.append(element("span", "+" + (groups.length - 1), "more-refs"));
  return cell;
}

function formatDate(iso) {
  return new Date(iso).toLocaleString(message("dateLocale"), { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function commitRow(commit, cell, lanes, dimOtherBranches) {
  const color = cell ? laneColor(cell.column) : branchColor(commit.branch);
  const row = element("div", undefined, "row");
  row.tabIndex = 0;
  row.setAttribute("role", "button");
  row.dataset.hash = commit.hash;
  row.classList.toggle("is-head", commit.hash === repo?.head.hash);
  row.classList.toggle("selected", commit.hash === selectedHash);
  row.classList.toggle("off-branch", dimOtherBranches && !commit.onCurrentBranch);
  row.onclick = () => selectCommit(commit);
  row.onkeydown = (event) => { if (event.key === "Enter") selectCommit(commit); };

  const graph = element("div");
  if (cell) graph.append(drawGraph(commit, cell, lanes));

  const subject = element("div", undefined, "cell subject");
  subject.title = commit.subject;
  subject.append(element("span", commit.subject, commit.parents.length > 1 ? "merge" : undefined));

  const author = element("div", undefined, "cell author");
  author.title = commit.author;
  author.append(avatar(commit.author), element("span", commit.author, "label"));

  row.append(refsCell(commit, color), graph, subject, author, element("div", formatDate(commit.date), "cell date"), element("div", commit.shortHash.slice(0, 7), "cell sha mono"));
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
  const node = element("details");
  node.open = isOpen;
  const summary = element("summary");
  summary.append(element("span", title), element("span", String(count)));
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
  const button = element("button", undefined, "item");
  button.type = "button";
  button.dataset.branch = name;
  button.title = name;
  const isCurrent = name === repo.head.branch;
  button.classList.toggle("current-branch", isCurrent);
  button.append(element("span", isCurrent ? "✓" : "", "tick"), element("span", displayName, "label"));
  if (count) button.append(element("span", count, "count"));
  button.onclick = () => filterByBranch(selectedBranch === name ? "" : name);
  return button;
}

function authorItem(author) {
  const button = element("button", undefined, "item");
  button.type = "button";
  button.dataset.author = author.name;
  button.title = author.name;
  button.append(avatar(author.name), element("span", author.name, "label"), element("span", String(author.commits), "count"));
  button.onclick = () => filterByAuthor(activeAuthor() === author.name ? "" : author.name);
  return button;
}

function renderSidebar() {
  const local = section(message("local"), repo.local.length, true);
  repo.local.forEach((branch) => local.append(branchItem(branch.name, branch.name, aheadBehind(branch))));

  const remote = section(message("remote"), repo.remote.length, true);
  const remotes = Map.groupBy(repo.remote, (name) => name.split("/")[0]);
  remotes.forEach((names, remoteName) => {
    remote.append(element("div", remoteName, "group-label"));
    names.forEach((name) => remote.append(branchItem(name, name.slice(remoteName.length + 1))));
  });

  const authors = section(message("authors"), repo.authors.length, true);
  repo.authors.forEach((author) => authors.append(authorItem(author)));

  const tags = section(message("tags"), repo.tags.length, false);
  repo.tags.forEach((tag) => {
    const item = element("div", undefined, "item static");
    item.append(element("span", tag, "label"));
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
  sidebarNode.querySelectorAll("[data-branch]").forEach((node) => node.classList.toggle("active", node.dataset.branch === selectedBranch));
  sidebarNode.querySelectorAll("[data-author]").forEach((node) => node.classList.toggle("active", node.dataset.author === author));
  byId("filter-chip").hidden = selectedBranch === "";
  byId("filter-text").textContent = selectedBranch;
}

function filterByBranch(branch) {
  selectedBranch = branch;
  sidebarNode.classList.remove("open");
  loadPage(0);
}

function filterByAuthor(author) {
  fieldSelect.value = "author";
  searchInput.value = author;
  sidebarNode.classList.remove("open");
  loadPage(0);
}

function renderCurrentBranch() {
  const node = byId("current");
  const local = repo.local.find((branch) => branch.name === repo.head.branch);
  const counts = local ? aheadBehind(local) : "";
  const label = repo.head.branch ?? (repo.head.hash ? message("detachedHead") + " · " + repo.head.hash.slice(0, 7) : message("noCommit"));
  node.replaceChildren(element("small", message("youAreOn")), element("span", label, "name"));
  if (counts) node.append(element("small", counts));
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
  const button = element("button", label, "toolbar-button");
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
  if (detailsDialog.open) detailsDialog.close();
}

/* Échap ferme aussi la modale nativement : la sélection se nettoie donc sur l'événement `close`, pas dans le bouton. */
function clearSelection() {
  selectedHash = null;
  detailToken++;
  rowsNode.querySelectorAll(".selected").forEach((node) => node.classList.remove("selected"));
}

function selectCommit(commit) {
  selectedHash = commit.hash;
  rowsNode.querySelectorAll(".row").forEach((node) => node.classList.toggle("selected", node.dataset.hash === commit.hash));
  renderDetails(commit);
}

function parentLink(hash) {
  const parent = loaded.find((item) => item.hash === hash);
  if (!parent) return element("span", hash.slice(0, 7), "mono");
  const link = element("button", hash.slice(0, 7), "link mono");
  link.type = "button";
  link.onclick = () => {
    selectCommit(parent);
    rowsNode.querySelector(`[data-hash="${hash}"]`)?.scrollIntoView({ block: "center" });
  };
  return link;
}

function fileRow(file) {
  const row = element("div", undefined, "file");
  row.append(element("span", file.path, "path mono"));
  if (file.added === null) row.append(element("span", message("binary"), "date"));
  else row.append(element("span", "+" + file.added, "add mono"), element("span", "−" + file.deleted, "del mono"));
  return row;
}

async function renderDetails(commit) {
  const token = ++detailToken;

  const head = element("div", undefined, "details-head");
  const close = element("button", "×");
  close.id = "close";
  close.type = "button";
  close.setAttribute("aria-label", message("closeDetails"));
  close.autofocus = true;
  close.onclick = closeDetails;
  head.append(element("h2", commit.subject), close);

  const person = element("div", undefined, "person");
  const who = element("div");
  who.append(element("strong", commit.author), element("small", formatDate(commit.date)));
  person.append(avatar(commit.author), who);

  const actions = element("div", undefined, "actions");
  actions.append(copyButton(message("copyHash"), commit.hash), copyButton(message("copyCherryPick"), "/cherry-pick " + commit.hash));

  const parents = element("div", undefined, "wrap");
  commit.parents.forEach((hash) => parents.append(parentLink(hash)));

  const body = element("div");
  detailsNode.replaceChildren(head, body, person, element("h3", message("branch")), element("div", commit.branch || message("unknown")), element("h3", "SHA"), element("div", commit.hash, "mono date"));
  if (commit.parents.length > 0) detailsNode.append(element("h3", commit.parents.length > 1 ? message("parentsMerge") : message("parent")), parents);
  detailsNode.append(actions);
  const loadingNote = element("p", message("loading"), "date");
  detailsNode.append(loadingNote);
  if (!detailsDialog.open) detailsDialog.showModal();
  detailsNode.scrollTop = 0;

  try {
    const response = await fetch("/api/commit?" + new URLSearchParams({ hash: commit.hash }));
    const data = await response.json();
    if (token !== detailToken) return;
    if (!response.ok) throw new Error(data.error);
    loadingNote.remove();
    if (data.body !== "") body.append(element("p", data.body, "body"));
    if (data.committer !== commit.author) who.append(element("small", message("committedBy") + " " + data.committer));
    detailsNode.append(containedInSection(data.containedIn), ...filesSection(data));
  } catch (error) {
    if (token === detailToken) loadingNote.textContent = message("error") + " " + error.message;
  }
}

function containedInSection(refs) {
  const container = element("div");
  const list = element("div", undefined, "wrap");
  refs.forEach((ref) => {
    const isCurrent = ref.kind === "branch" && ref.name === repo?.head.branch;
    list.append(element("span", ref.name, "badge" + (isCurrent ? " is-current" : "")));
  });
  container.append(element("h3", message("containedIn") + " " + refs.length), list);
  return container;
}

function filesSection(data) {
  const added = data.files.reduce((sum, file) => sum + (file.added ?? 0), 0);
  const deleted = data.files.reduce((sum, file) => sum + (file.deleted ?? 0), 0);
  const title = element("h3");
  title.append(message("files") + " " + data.fileCount + " · ", element("span", "+" + added, "add"), " ", element("span", "−" + deleted, "del"));
  const nodes = [title, ...data.files.map(fileRow)];
  if (data.fileCount > data.files.length) nodes.push(element("p", message("moreFiles", { count: data.fileCount - data.files.length }), "date"));
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
byId("menu").onclick = () => sidebarNode.classList.toggle("open");
moreButton.onclick = () => loadPage(nextPage);
byId("center").onscroll = hideRefsPopover;
detailsDialog.onclose = clearSelection;
/* Un clic sur le fond (hors du contenu) touche le <dialog> lui-même. */
detailsDialog.onclick = (event) => { if (event.target === detailsDialog) closeDetails(); };

loadRepo().then(() => loadPage(0)).catch((error) => showState(message("error") + " " + error.message));
