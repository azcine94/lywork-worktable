export const WORKTABLE_STATE_KEY = "state";
export const WORKTABLE_STATE_SCHEMA_VERSION = 4;

export function emptyWorktableState() {
  return {
    schemaVersion: WORKTABLE_STATE_SCHEMA_VERSION,
    revision: 0,
    worktables: {},
    orderByProject: {},
    activeByProject: {},
    acknowledgedStatusBySession: {},
    pendingTasks: {},
		artifactErrorsByProject: {},
		projectLayouts: {},
  };
}

export function slugifyWorktableName(value) {
  const ascii = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return /^[a-z]/.test(ascii) ? ascii : `app-${ascii || "worktable"}`;
}

function normalizeTab(input, index) {
	const kind = ["artifact", "web", "file", "explorer", "terminal"].includes(input?.kind)
		? input.kind
		: "artifact";
	const artifactId = typeof input?.artifactId === "string" ? input.artifactId : null;
	const id = typeof input?.id === "string" && input.id
		? input.id
		: artifactId
			? `artifact:${artifactId}`
			: `tab-${index + 1}`;
	return {
		id,
		kind,
		artifactId,
		title: typeof input?.title === "string" && input.title ? input.title : `Tab ${index + 1}`,
		resource: typeof input?.resource === "string" ? input.resource : "",
		scrollX: Number.isFinite(input?.scrollX) ? Math.max(0, input.scrollX) : 0,
		scrollY: Number.isFinite(input?.scrollY) ? Math.max(0, input.scrollY) : 0,
	};
}

function normalizePane(input, index) {
	const requestedTabs = Array.isArray(input?.tabs) ? input.tabs : [];
	const legacyArtifactId = typeof input?.artifactId === "string" ? input.artifactId : null;
	const tabs = requestedTabs.length > 0
		? requestedTabs.map(normalizeTab)
		: legacyArtifactId
			? [normalizeTab({ kind: "artifact", artifactId: legacyArtifactId, title: input?.title }, 0)]
			: [];
	const requestedActiveTabId = typeof input?.activeTabId === "string" ? input.activeTabId : "";
	const activeTabId = tabs.some((tab) => tab.id === requestedActiveTabId)
		? requestedActiveTabId
		: tabs[Number.isInteger(input?.active) ? input.active : 0]?.id || tabs[0]?.id || null;
	const activeTab = tabs.find((tab) => tab.id === activeTabId);
  return {
		type: "window",
    id: typeof input?.id === "string" && input.id ? input.id : `pane-${index + 1}`,
		title: typeof input?.title === "string" && input.title ? input.title : `Window ${index + 1}`,
		tabs,
		activeTabId,
		artifactId: activeTab?.kind === "artifact" ? activeTab.artifactId : null,
    closed: Boolean(input?.closed),
    locked: Boolean(input?.locked),
  };
}

function normalizeLayoutNode(input, sequence) {
	if (input?.type === "split") {
		const ratio = Number(input.ratio);
		return {
			type: "split",
			id: typeof input.id === "string" && input.id ? input.id : `split-${sequence.value++}`,
			direction: input.direction === "vertical" ? "vertical" : "horizontal",
			ratio: Number.isFinite(ratio) ? Math.min(0.8, Math.max(0.2, ratio)) : 0.5,
			first: normalizeLayoutNode(input.first, sequence),
			second: normalizeLayoutNode(input.second, sequence),
		};
	}
	return normalizePane(input, sequence.value++);
}

function collectLayoutWindows(node, result = []) {
	if (node.type === "window") result.push(node);
	else {
		collectLayoutWindows(node.first, result);
		collectLayoutWindows(node.second, result);
	}
	return result;
}

function replaceWindowNode(node, windowId, replacement) {
	if (node.type === "window") return node.id === windowId ? replacement(node) : node;
	node.first = replaceWindowNode(node.first, windowId, replacement);
	node.second = replaceWindowNode(node.second, windowId, replacement);
	return node;
}

function removeWindowNode(node, windowId) {
	if (node.type === "window") return node;
	if (node.first.type === "window" && node.first.id === windowId) return node.second;
	if (node.second.type === "window" && node.second.id === windowId) return node.first;
	node.first = removeWindowNode(node.first, windowId);
	node.second = removeWindowNode(node.second, windowId);
	return node;
}

function nextNodeId(layout, prefix) {
	const ids = new Set();
	const visit = (node) => {
		ids.add(node.id);
		if (node.type === "split") { visit(node.first); visit(node.second); }
	};
	visit(layout.root);
	let index = 1;
	while (ids.has(`${prefix}-${index}`)) index += 1;
	return `${prefix}-${index}`;
}

export function normalizeLayout(input) {
  const requestedPanes = Array.isArray(input?.panes) ? input.panes : [];
	const count = Math.min(2, Math.max(1, requestedPanes.length, input?.mode === "dual-app-chat" ? 2 : 1));
  const paneRatio = Number(input?.paneRatio);
	const sequence = { value: 1 };
	let root;
	if (input?.root && typeof input.root === "object") {
		root = normalizeLayoutNode(input.root, sequence);
	} else {
		const panes = Array.from({ length: count }, (_, index) => normalizePane(requestedPanes[index], index));
		root = panes.length > 1
			? {
				type: "split",
				id: "split-1",
				direction: "horizontal",
				ratio: Number.isFinite(paneRatio) ? Math.min(0.8, Math.max(0.2, paneRatio)) : 0.5,
				first: panes[0],
				second: panes[1],
			}
			: panes[0];
	}
	const panes = collectLayoutWindows(root);
  return {
		root,
		mode: panes.length > 1 ? "dual-app-chat" : "app-chat",
    panes,
		paneRatio: root.type === "split" ? root.ratio : 0.5,
    userRevision: Number.isInteger(input?.userRevision) && input.userRevision >= 0 ? input.userRevision : 0,
    autoMountRevision: Number.isInteger(input?.autoMountRevision) && input.autoMountRevision >= 0
      ? input.autoMountRevision
      : 0,
  };
}

function normalizeBinding(input) {
  if (!input || typeof input !== "object" || typeof input.sessionKey !== "string" || !input.sessionKey) return undefined;
  return {
    worktableId: typeof input.worktableId === "string" ? input.worktableId : "",
    projectId: typeof input.projectId === "string" ? input.projectId : "",
    sessionKey: input.sessionKey,
    ...(typeof input.sessionId === "string" ? { sessionId: input.sessionId } : {}),
    ...(typeof input.sessionPath === "string" ? { sessionPath: input.sessionPath } : {}),
    ...(typeof input.lastAgentId === "string" ? { lastAgentId: input.lastAgentId } : {}),
    ...(input.needsRebind ? { needsRebind: true } : {}),
  };
}

function normalizeRecord(input, key, now) {
  const id = typeof input?.id === "string" && input.id ? input.id : key;
  return {
    id,
    projectId: typeof input?.projectId === "string" ? input.projectId : "",
    name: typeof input?.name === "string" && input.name ? input.name : id,
    rootPath: typeof input?.rootPath === "string" ? input.rootPath : "",
    manifestPath: typeof input?.manifestPath === "string" ? input.manifestPath : "",
    ...(normalizeBinding(input?.binding) ? { binding: normalizeBinding(input.binding) } : {}),
    layout: normalizeLayout(input?.layout),
    createdAt: Number.isFinite(input?.createdAt) ? input.createdAt : now,
    updatedAt: Number.isFinite(input?.updatedAt) ? input.updatedAt : now,
    ...(typeof input?.manifestFingerprint === "string" ? { manifestFingerprint: input.manifestFingerprint } : {}),
  };
}

export function migrateWorktableState(input, now = Date.now()) {
  const next = emptyWorktableState();
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { state: next, migratedFrom: null, recovered: input != null };
  }
  const sourceVersion = Number.isInteger(input.schemaVersion) ? input.schemaVersion : 0;
  const records = input.worktables && typeof input.worktables === "object" && !Array.isArray(input.worktables)
    ? input.worktables
    : {};
  for (const [key, record] of Object.entries(records)) next.worktables[key] = normalizeRecord(record, key, now);
  for (const [projectId, order] of Object.entries(input.orderByProject || {})) {
    if (Array.isArray(order)) next.orderByProject[projectId] = order.filter((id) => typeof id === "string" && next.worktables[id]);
  }
  for (const [projectId, activeId] of Object.entries(input.activeByProject || {})) {
    next.activeByProject[projectId] = typeof activeId === "string" && next.worktables[activeId] ? activeId : null;
  }
  if (input.acknowledgedStatusBySession && typeof input.acknowledgedStatusBySession === "object") {
    next.acknowledgedStatusBySession = { ...input.acknowledgedStatusBySession };
  }
  if (sourceVersion >= 2 && input.pendingTasks && typeof input.pendingTasks === "object") {
    next.pendingTasks = { ...input.pendingTasks };
  }
	if (sourceVersion >= 2 && input.artifactErrorsByProject && typeof input.artifactErrorsByProject === "object") {
		next.artifactErrorsByProject = { ...input.artifactErrorsByProject };
	}
	if (input.projectLayouts && typeof input.projectLayouts === "object" && !Array.isArray(input.projectLayouts)) {
		for (const [projectId, layout] of Object.entries(input.projectLayouts)) {
			const normalized = normalizeLayout(layout);
			if (sourceVersion === 3 && !layout?.root) {
				const tabs = [];
				for (const pane of normalized.panes) {
					for (const tab of pane.tabs) if (!tabs.some((candidate) => candidate.id === tab.id)) tabs.push(tab);
				}
				next.projectLayouts[projectId] = normalizeLayout({ root: normalizePane({ id: "window-1", tabs, activeTabId: tabs[0]?.id }, 0) });
			} else {
				next.projectLayouts[projectId] = normalized;
			}
		}
	}
	for (const record of Object.values(next.worktables)) {
		if (!record.projectId || next.projectLayouts[record.projectId]) continue;
		next.projectLayouts[record.projectId] = normalizeLayout(record.layout);
	}
  next.revision = Number.isInteger(input.revision) && input.revision >= 0 ? input.revision : 0;
  return {
    state: next,
    migratedFrom: sourceVersion === WORKTABLE_STATE_SCHEMA_VERSION ? null : sourceVersion,
    recovered: false,
  };
}

export function createWorktableRecord(input, now = Date.now()) {
  const layout = normalizeLayout({ mode: input.layoutMode });
  if (input.artifactId) {
    layout.panes[0].artifactId = input.artifactId;
    layout.panes[0].title = input.name;
  }
  return {
    id: input.id,
    projectId: input.projectId,
    name: input.name,
    rootPath: input.rootPath,
    manifestPath: input.manifestPath || "",
    ...(input.binding ? { binding: { ...input.binding, worktableId: input.id, projectId: input.projectId } } : {}),
    layout,
    createdAt: now,
    updatedAt: now,
    ...(input.manifestFingerprint ? { manifestFingerprint: input.manifestFingerprint } : {}),
  };
}

export function reconcileWorktableBinding(binding, sessions) {
  if (!binding) return { binding: undefined, descriptor: undefined, changed: false };
  const exact = sessions.find((session) => session.identity.sessionKey === binding.sessionKey);
  const byPath = !exact && binding.sessionPath
    ? sessions.find((session) => session.identity.sessionPath === binding.sessionPath)
    : undefined;
  const descriptor = exact || byPath;
  if (!descriptor) return { binding: { ...binding, needsRebind: true }, descriptor: undefined, changed: !binding.needsRebind };
  const next = {
    ...binding,
    sessionKey: descriptor.identity.sessionKey,
    ...(descriptor.identity.sessionId ? { sessionId: descriptor.identity.sessionId } : {}),
    ...(descriptor.identity.sessionPath ? { sessionPath: descriptor.identity.sessionPath } : {}),
  };
  delete next.needsRebind;
  return {
    binding: next,
    descriptor,
    changed: JSON.stringify(next) !== JSON.stringify(binding),
  };
}

export function placeArtifact(layoutInput, artifact, options = {}) {
  const layout = normalizeLayout(layoutInput);
	const existingPane = layout.panes.find((pane) => pane.tabs.some((tab) => tab.kind === "artifact" && tab.artifactId === artifact.worktableId));
	const existingTab = existingPane?.tabs.find((tab) => tab.kind === "artifact" && tab.artifactId === artifact.worktableId);
  if (existingPane && existingTab) {
    existingTab.title = artifact.name;
		if (options.auto) existingPane.closed = false;
		existingPane.artifactId = existingPane.tabs.find((tab) => tab.id === existingPane.activeTabId)?.artifactId || null;
    return layout;
  }
	const target = layout.panes.find((pane) => !pane.locked && pane.tabs.length === 0)
		|| layout.panes.find((pane) => !pane.locked);
  if (!target || (options.auto && layout.userRevision > layout.autoMountRevision)) return layout;
	const tab = normalizeTab({
		id: `artifact:${artifact.worktableId}`,
		kind: "artifact",
		artifactId: artifact.worktableId,
		title: artifact.name,
	}, target.tabs.length);
	target.tabs.push(tab);
	target.activeTabId = tab.id;
	target.artifactId = artifact.worktableId;
	target.title = artifact.name;
  target.closed = false;
  if (options.auto) layout.autoMountRevision = layout.userRevision;
  return layout;
}

export function activateLayoutTab(layoutInput, paneId, tabId) {
	return updateLayoutByUser(layoutInput, (layout) => {
		const pane = layout.panes.find((candidate) => candidate.id === paneId);
		const tab = pane?.tabs.find((candidate) => candidate.id === tabId);
		if (!pane || !tab) return;
		pane.activeTabId = tab.id;
		pane.artifactId = tab.kind === "artifact" ? tab.artifactId : null;
		pane.closed = false;
	});
}

export function openArtifactTab(layoutInput, paneId, artifact) {
	return updateLayoutByUser(layoutInput, (layout) => {
		const existingPane = layout.panes.find((pane) => pane.tabs.some((tab) => tab.kind === "artifact" && tab.artifactId === artifact.worktableId));
		const existingTab = existingPane?.tabs.find((tab) => tab.kind === "artifact" && tab.artifactId === artifact.worktableId);
		if (existingPane && existingTab) {
			existingPane.activeTabId = existingTab.id;
			existingPane.artifactId = existingTab.artifactId;
			existingPane.closed = false;
			return;
		}
		const pane = layout.panes.find((candidate) => candidate.id === paneId) || layout.panes[0];
		if (!pane || pane.locked) return;
		const tab = normalizeTab({ id: `artifact:${artifact.worktableId}`, kind: "artifact", artifactId: artifact.worktableId, title: artifact.name }, pane.tabs.length);
		pane.tabs.push(tab);
		pane.activeTabId = tab.id;
		pane.artifactId = artifact.worktableId;
		pane.closed = false;
	});
}

export function openExplorerTab(layoutInput, paneId, title) {
	return updateLayoutByUser(layoutInput, (layout) => {
		const pane = layout.panes.find((candidate) => candidate.id === paneId) || layout.panes[0];
		if (!pane || pane.locked) return;
		const existing = pane.tabs.find((tab) => tab.kind === "explorer");
		if (existing) {
			pane.activeTabId = existing.id;
			pane.artifactId = null;
			pane.closed = false;
			return;
		}
		const usedIds = new Set(layout.panes.flatMap((candidate) => candidate.tabs.map((tab) => tab.id)));
		const baseId = `explorer:${pane.id}`;
		let id = baseId;
		let suffix = 2;
		while (usedIds.has(id)) id = `${baseId}:${suffix++}`;
		const tab = normalizeTab({ id, kind: "explorer", title, resource: "project-root" }, pane.tabs.length);
		pane.tabs.push(tab);
		pane.activeTabId = tab.id;
		pane.artifactId = null;
		pane.closed = false;
	});
}

export function closeLayoutTab(layoutInput, paneId, tabId) {
	return updateLayoutByUser(layoutInput, (layout) => {
		const pane = layout.panes.find((candidate) => candidate.id === paneId);
		if (!pane || pane.locked) return;
		const index = pane.tabs.findIndex((candidate) => candidate.id === tabId);
		if (index < 0) return;
		pane.tabs.splice(index, 1);
		if (pane.activeTabId === tabId) pane.activeTabId = pane.tabs[Math.min(index, pane.tabs.length - 1)]?.id || null;
		const active = pane.tabs.find((candidate) => candidate.id === pane.activeTabId);
		pane.artifactId = active?.kind === "artifact" ? active.artifactId : null;
	});
}

export function moveLayoutTab(layoutInput, fromPaneId, tabId, toPaneId) {
	return updateLayoutByUser(layoutInput, (layout) => {
		const source = layout.panes.find((candidate) => candidate.id === fromPaneId);
		const target = layout.panes.find((candidate) => candidate.id === toPaneId);
		if (!source || !target || source === target || target.locked) return;
		const index = source.tabs.findIndex((candidate) => candidate.id === tabId);
		if (index < 0) return;
		const [tab] = source.tabs.splice(index, 1);
		if (!target.tabs.some((candidate) => candidate.id === tab.id)) target.tabs.push(tab);
		target.activeTabId = tab.id;
		target.artifactId = tab.kind === "artifact" ? tab.artifactId : null;
		target.closed = false;
		if (source.activeTabId === tabId) source.activeTabId = source.tabs[Math.min(index, source.tabs.length - 1)]?.id || null;
		const sourceActive = source.tabs.find((candidate) => candidate.id === source.activeTabId);
		source.artifactId = sourceActive?.kind === "artifact" ? sourceActive.artifactId : null;
	});
}

export function splitLayoutPane(layoutInput, sourcePaneId, direction = "horizontal") {
	return updateLayoutByUser(layoutInput, (layout) => {
		const source = layout.panes.find((candidate) => candidate.id === sourcePaneId) || layout.panes[0];
		if (!source) return;
		const activeIndex = source.tabs.findIndex((tab) => tab.id === source.activeTabId);
		const movable = source.tabs.length > 1 ? source.tabs.splice(activeIndex >= 0 ? activeIndex : source.tabs.length - 1, 1)[0] : undefined;
		const pane = normalizePane({ id: nextNodeId(layout, "window"), tabs: movable ? [movable] : [], activeTabId: movable?.id }, layout.panes.length);
		const split = {
			type: "split",
			id: nextNodeId(layout, "split"),
			direction: direction === "vertical" ? "vertical" : "horizontal",
			ratio: 0.5,
			first: source,
			second: pane,
		};
		layout.root = replaceWindowNode(layout.root, source.id, () => split);
		if (movable) {
			const nextActive = source.tabs[Math.min(activeIndex, source.tabs.length - 1)] || source.tabs[0];
			source.activeTabId = nextActive?.id || null;
			source.artifactId = nextActive?.kind === "artifact" ? nextActive.artifactId : null;
		}
	});
}

export function closeLayoutPane(layoutInput, paneId) {
	return updateLayoutByUser(layoutInput, (layout) => {
		if (layout.panes.length < 2) return;
		const removed = layout.panes.find((candidate) => candidate.id === paneId);
		if (!removed || removed.locked) return;
		const target = layout.panes.find((candidate) => candidate.id !== paneId);
		for (const tab of removed.tabs) if (!target.tabs.some((candidate) => candidate.id === tab.id)) target.tabs.push(tab);
		if (!target.activeTabId) target.activeTabId = target.tabs[0]?.id || null;
		const active = target.tabs.find((candidate) => candidate.id === target.activeTabId);
		target.artifactId = active?.kind === "artifact" ? active.artifactId : null;
		layout.root = removeWindowNode(layout.root, paneId);
	});
}

export function updateLayoutSplitRatio(layoutInput, splitId, ratio) {
	const layout = normalizeLayout(layoutInput);
	const visit = (node) => {
		if (node.type !== "split") return;
		if (node.id === splitId) node.ratio = Math.min(0.8, Math.max(0.2, ratio));
		else { visit(node.first); visit(node.second); }
	};
	visit(layout.root);
	layout.userRevision += 1;
	return normalizeLayout(layout);
}

export function updateLayoutTabViewport(layoutInput, paneId, tabId, viewport) {
	const layout = normalizeLayout(layoutInput);
	const pane = layout.panes.find((candidate) => candidate.id === paneId);
	const tab = pane?.tabs.find((candidate) => candidate.id === tabId);
	if (!tab) return layout;
	tab.scrollX = Number.isFinite(viewport?.x) ? Math.max(0, viewport.x) : tab.scrollX;
	tab.scrollY = Number.isFinite(viewport?.y) ? Math.max(0, viewport.y) : tab.scrollY;
	return layout;
}

export function updateLayoutByUser(layoutInput, updater) {
  const layout = normalizeLayout(layoutInput);
	const previousPaneRatio = layout.paneRatio;
  updater(layout);
	if (layout.root.type === "split" && layout.paneRatio !== previousPaneRatio) layout.root.ratio = layout.paneRatio;
  layout.userRevision += 1;
  return normalizeLayout(layout);
}

export function buildWorktableTaskPrompt(input) {
	const windows = input.layoutMode === "dual-app-chat"
		? [
			{ id: "main", title: input.name, kind: "html", path: "index.html", preferredPane: "main" },
			{ id: "secondary", title: `${input.name} - Secondary`, kind: "html", path: "secondary.html", preferredPane: "secondary" },
		]
		: [{ id: "main", title: input.name, kind: "html", path: "index.html", preferredPane: "main" }];
	return [
		"Create or update a LYWork Worktable HTML app in the current project.",
		`Target directory (must stay inside the current project): worktables/${input.slug}/`,
		`App name: ${input.name}`,
		`User requirement: ${input.requirement}`,
		"Use only static HTML/CSS/JavaScript or already-built bundle files. Do not start a development server.",
		"Write lywork-worktable.json exactly as a JSON object compatible with this shape:",
		JSON.stringify({ schemaVersion: 1, id: input.slug, name: input.name, entry: "index.html", type: "static", permissions: ["storage"], display: { preferredPane: "main", minWidth: 480, minHeight: 320 } }, null, 2),
		"Write lywork-artifacts.json exactly as a JSON object compatible with this shape:",
		JSON.stringify({ schemaVersion: 1, worktableId: input.slug, windows }, null, 2),
		"Every window path must exist before you finish. Keep all assets under the target directory and use relative URLs.",
		"The app may use window.lywork.storage for local state. It must not access Node.js, Electron, host DOM, external network, secrets, or files outside the target directory.",
		"Verify the page is interactive and report completion in this same conversation.",
	].join("\n\n");
}

export function createPendingTask(input, now = Date.now()) {
	return {
		id: input.recordId,
		recordId: input.recordId,
		projectId: input.projectId,
		worktableId: input.worktableId,
		sessionKey: input.sessionKey,
		status: "queued",
		createdAt: now,
		updatedAt: now,
		baselineFingerprint: input.baselineFingerprint || null,
		baselineTurn: Number.isInteger(input.baselineTurn) ? input.baselineTurn : 0,
	};
}

export function projectWorktableStatus(agentStates, acknowledgedBySession = {}, taskStates = [], artifactErrors = []) {
	if (agentStates.some((agent) => agent.pendingApprovals > 0 || agent.pendingUiRequests > 0 || agent.subagents.blocked > 0)) return "need";
	if (artifactErrors.length > 0 || taskStates.some((task) => task.status === "error") || agentStates.some((agent) => agent.status === "error" || agent.lastOutcome === "failed" || agent.subagents.failed > 0)) return "error";
	if (taskStates.some((task) => ["queued", "running", "awaiting-artifact"].includes(task.status)) || agentStates.some((agent) => agent.status === "running" || agent.phase === "compacting" || agent.subagents.running > 0)) return "busy";
	if (agentStates.some((agent) => agent.lastOutcome === "succeeded" && (agent.turn || 0) > (acknowledgedBySession[agent.sessionKey]?.turn || 0))) return "done";
	return "idle";
}

export function acknowledgeAgentStates(acknowledgedBySession, agentStates, now = Date.now()) {
	const next = { ...acknowledgedBySession };
	for (const agent of agentStates) {
		next[agent.sessionKey] = {
			turn: agent.turn || 0,
			revision: agent.revision || 0,
			acknowledgedAt: now,
		};
	}
	return next;
}
