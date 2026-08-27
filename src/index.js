import {
  WORKTABLE_STATE_KEY,
  createWorktableRecord,
  acknowledgeAgentStates,
	activateLayoutTab,
	closeLayoutPane,
	closeLayoutTab,
  migrateWorktableState,
	moveLayoutTab,
	normalizeLayout,
	openArtifactTab,
	openExplorerTab,
  placeArtifact,
  projectWorktableStatus,
  reconcileWorktableBinding,
	splitLayoutPane,
	updateLayoutTabViewport,
	updateLayoutSplitRatio,
  updateLayoutByUser,
} from "./core.js";

const strings = {
  "zh-CN": {
    controlTitle: "控制室", controlSubtitle: "查看所有工作台项目及其当前状态", addProject: "添加项目", openProject: "打开项目",
    noProjects: "还没有工作台项目", noProjectsHint: "创建第一个项目后，它会显示在这里。",
    projectApps: "个应用", projectAgents: "个 Agent", lastActive: "最近活动", justNow: "刚刚", minutesAgo: "分钟前", hoursAgo: "小时前", daysAgo: "天前",
    needSummary: "有请求等待你处理", errorSummary: "项目遇到错误，需要检查", busySummary: "Agent 正在处理当前任务", doneSummary: "最新任务已完成，可以打开查看", idleSummary: "当前没有运行中的任务",
    empty: "当前项目还没有工作台应用", emptyHint: "可以先创建记录，也可以把带有 lywork-worktable.json 的 HTML App 放入项目。",
    loading: "正在恢复工作台…",
    idle: "空闲", busy: "工作中", need: "待你决定", error: "错误", done: "已完成",
    close: "关闭", reopen: "重新打开", lock: "锁定", unlock: "解锁", swap: "交换", emptyPane: "空窗格", chooseApp: "选择应用",
  },
  "en-US": {
    controlTitle: "Control room", controlSubtitle: "See every Worktable project and its current status", addProject: "Add project", openProject: "Open project",
    noProjects: "No Worktable projects yet", noProjectsHint: "Create the first project and it will appear here.",
    projectApps: "apps", projectAgents: "agents", lastActive: "Last active", justNow: "Just now", minutesAgo: "min ago", hoursAgo: "hr ago", daysAgo: "days ago",
    needSummary: "A request is waiting for your decision", errorSummary: "The project needs attention after an error", busySummary: "An agent is working on the current task", doneSummary: "The latest task is complete and ready to review", idleSummary: "No task is currently running",
    empty: "No Worktable app in this project", emptyHint: "Create a record, or place an HTML app with lywork-worktable.json in the project.",
    loading: "Restoring Worktable…",
    idle: "Idle", busy: "Working", need: "Decision needed", error: "Error", done: "Completed",
    close: "Close", reopen: "Reopen", lock: "Lock", unlock: "Unlock", swap: "Swap", emptyPane: "Empty pane", chooseApp: "Choose app",
  },
};

Object.assign(strings["zh-CN"], {
	controlTitle: "控制室",
	controlSubtitle: "查看所有工作台项目及其当前状态",
	addProject: "添加项目",
	openProject: "打开项目",
	noProjects: "还没有工作台项目",
	noProjectsHint: "创建第一个项目后，它会显示在这里。",
	projectApps: "个应用",
	projectAgents: "个 Agent",
	lastActive: "最近活动",
	justNow: "刚刚",
	minutesAgo: "分钟前",
	hoursAgo: "小时前",
	daysAgo: "天前",
	needSummary: "有请求等待你处理",
	errorSummary: "项目遇到错误，需要检查",
	busySummary: "Agent 正在处理当前任务",
	doneSummary: "最新任务已完成，可以打开查看",
	idleSummary: "当前没有运行中的任务",
	empty: "当前项目还没有工作台应用",
	emptyHint: "可以把带有 lywork-worktable.json 的 HTML App 放入项目。",
	loading: "正在恢复工作台…",
	idle: "空闲",
	busy: "工作中",
	need: "待你决定",
	error: "错误",
	done: "已完成",
	close: "关闭",
	reopen: "重新打开",
	lock: "锁定",
	unlock: "解锁",
	swap: "交换",
	emptyPane: "空窗格",
	chooseApp: "选择应用",
	addTab: "添加标签",
	splitPane: "拆分窗格",
	closePane: "关闭窗格",
	window: "窗口",
	splitRight: "向右拆分窗口",
	splitDown: "向下拆分窗口",
	resourceManager: "资源管理",
	resourceLoading: "正在读取项目文件…",
	resourceEmpty: "当前项目文件夹为空",
	resourceRefresh: "刷新",
});
Object.assign(strings["en-US"], {
	loading: "Restoring Worktable…",
	addTab: "Add tab",
	splitPane: "Split pane",
	closePane: "Close pane",
	window: "Window",
	splitRight: "Split window right",
	splitDown: "Split window down",
	resourceManager: "Resources",
	resourceLoading: "Loading project files…",
	resourceEmpty: "This project folder is empty",
	resourceRefresh: "Refresh",
	switchToLight: "Switch to light theme",
	switchToDark: "Switch to dark theme",
});

Object.assign(strings["zh-CN"], {
	switchToLight: "切换到亮色",
	switchToDark: "切换到暗色",
});

function locale() {
  return document.documentElement.lang.toLowerCase().startsWith("zh") ? strings["zh-CN"] : strings["en-US"];
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function dirname(path) {
  return String(path || "").replace(/[\\/][^\\/]+$/, "");
}

function relativeActivity(timestamp, text, now = Date.now()) {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return "";
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000));
  if (minutes < 1) return text.justNow;
  if (minutes < 60) return `${minutes} ${text.minutesAgo}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${text.hoursAgo}`;
  return `${Math.floor(hours / 24)} ${text.daysAgo}`;
}

export function activate(context) {
  return context.workspace.registerSurface({
    id: "worktable.main",
    title: "LYWork Worktable",
    async mount(root, mountContext) {
      const text = locale();
      const project = mountContext.project;
      let state;
      let artifacts = [];
      let worktableProjects = context.projects.list().filter((candidate) => candidate.kind === "worktable");
      let agentStates = context.agents.getStates();
		let controlRoomTheme = localStorage.getItem("lywork.worktable.control-room-theme") === "light" ? "light" : "dark";
      let saveChain = Promise.resolve();
      let disposed = false;
      const frames = new Map();
		const framesByTabId = new Map();
		const frameSlotsByTabId = new Map();
		let draggedTab = null;
		let viewportSaveTimer = 0;
		let layoutResizeObserver = null;
		let framePositionRequest = 0;
		let settledFramePositionRequest = 0;
		const artifactRefreshTimers = new Map();
		let projectFiles = [];
		let projectFilesLoaded = false;
		let projectFilesLoading = false;
		let projectFilesError = "";

      root.innerHTML = `<div class="ly-worktable-shell"><div class="ly-worktable-loading">${escapeHtml(text.loading)}</div></div>`;
      const rawState = await context.storage.get(WORKTABLE_STATE_KEY);
      const migration = migrateWorktableState(rawState);
      state = migration.state;
      if (migration.migratedFrom !== null || migration.recovered) {
        await context.storage.set(`state-backup-v${migration.migratedFrom ?? "invalid"}`, rawState ?? null);
        await context.storage.set(WORKTABLE_STATE_KEY, state);
      }

      function persist(mutator) {
        mutator(state);
        state.revision += 1;
        saveChain = saveChain.then(() => context.storage.set(WORKTABLE_STATE_KEY, state));
        return saveChain;
      }

      function projectSessions() {
        return project ? context.sessions.list(project.id) : [];
      }

      function recordsForProject(projectId) {
		const ordered = state.orderByProject[projectId] || [];
		const records = Object.values(state.worktables).filter((record) => record.projectId === projectId);
        return records.sort((left, right) => {
          const leftIndex = ordered.indexOf(left.id);
          const rightIndex = ordered.indexOf(right.id);
          return (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex)
            || left.createdAt - right.createdAt;
        });
      }

      function projectRecords() {
		return project ? recordsForProject(project.id) : [];
	  }

	  function tasksForProject(projectId) {
		return Object.values(state.pendingTasks).filter((task) => task.projectId === projectId);
	  }

      function activeRecord() {
        if (!project) return undefined;
        const records = projectRecords();
        return state.worktables[state.activeByProject[project.id]] || records[0];
      }

      async function openBoundSession() {
        const binding = activeRecord()?.binding;
        if (binding && context.sessions.getCurrent()?.sessionKey !== binding.sessionKey) {
          await context.sessions.open(binding.sessionKey);
        }
      }

      async function ensureArtifactRecords() {
        if (!project) return false;
        let changed = false;
        const sessions = projectSessions();
		const savedProjectLayout = state.projectLayouts[project.id];
		let nextProjectLayout = normalizeLayout(savedProjectLayout || {
			mode: "app-chat",
		});
				const createdRecordIds = new Set();
        for (const artifact of artifacts) {
          const appId = artifact.appId || artifact.worktableId;
          const id = `${project.id}:${appId}`;
          const pendingTask = state.pendingTasks[id];
          let created = false;
          if (!state.worktables[id]) {
            const current = context.sessions.getCurrent();
            state.worktables[id] = createWorktableRecord({
              id, projectId: project.id, name: artifact.name,
              rootPath: dirname(artifact.manifestPath), manifestPath: artifact.manifestPath,
              artifactId: artifact.worktableId,
              binding: current?.projectId === project.id ? current : undefined,
              layoutMode: artifacts.filter((candidate) => (candidate.appId || candidate.worktableId) === appId).length > 1 ? "dual-app-chat" : "app-chat",
              manifestFingerprint: artifact.fingerprint,
            });
            state.orderByProject[project.id] = [...(state.orderByProject[project.id] || []), id];
            created = true;
						createdRecordIds.add(id);
            changed = true;
          }
          const record = state.worktables[id];
          const reconciled = reconcileWorktableBinding(record.binding, sessions);
          if (reconciled.changed) {
            record.binding = reconciled.binding;
            if (pendingTask && reconciled.binding?.sessionKey) pendingTask.sessionKey = reconciled.binding.sessionKey;
            changed = true;
          }
          const agentState = pendingTask
            ? agentStates.find((agent) => agent.sessionKey === pendingTask.sessionKey)
            : undefined;
          const taskSucceeded = pendingTask && (
            pendingTask.status === "awaiting-artifact"
            || pendingTask.status === "mounted"
            || agentState?.lastOutcome === "succeeded"
          );
						if (created || createdRecordIds.has(id) || taskSucceeded) {
            const fingerprintChanged = artifact.fingerprint && artifact.fingerprint !== record.manifestFingerprint;
            record.layout = placeArtifact(record.layout, artifact, { auto: Boolean(pendingTask && fingerprintChanged) });
            if (artifact.fingerprint) record.manifestFingerprint = artifact.fingerprint;
            if (pendingTask && taskSucceeded) {
              pendingTask.status = "mounted";
              pendingTask.fingerprint = artifact.fingerprint;
              pendingTask.updatedAt = Date.now();
            }
          }
        }
		for (const artifact of artifacts) nextProjectLayout = placeArtifact(nextProjectLayout, artifact);
		if (!savedProjectLayout || JSON.stringify(savedProjectLayout) !== JSON.stringify(nextProjectLayout)) {
			state.projectLayouts[project.id] = nextProjectLayout;
			changed = true;
		}
        if (!state.activeByProject[project.id] && projectRecords()[0]) {
          state.activeByProject[project.id] = projectRecords()[0].id;
          changed = true;
        }
        if (changed) await persist(() => {});
		return changed;
      }

      async function refreshArtifacts(changedWorktableId) {
        if (!project) { artifacts = []; render(); return; }
        try {
          const inspection = await context.artifacts.inspect(project.id);
          artifacts = inspection.artifacts;
          const errorsChanged = JSON.stringify(state.artifactErrorsByProject[project.id] || []) !== JSON.stringify(inspection.errors);
          if (errorsChanged) await persist((draft) => { draft.artifactErrorsByProject[project.id] = inspection.errors; });
          await ensureArtifactRecords();
		  const layout = normalizeLayout(state.projectLayouts[project.id]);
		  if (layout.panes.some((pane) => pane.tabs.some((tab) => tab.kind === "explorer"))) await loadProjectFiles();
          render();
		  if (changedWorktableId) reloadArtifactFrames(changedWorktableId);
        } catch (error) {
          render(error instanceof Error ? error.message : String(error));
        }
      }

	  async function refreshControlRoom() {
		const snapshots = await Promise.allSettled(worktableProjects.map(async (candidate) => ({
		  projectId: candidate.id,
		  snapshot: await context.artifacts.inspect(candidate.id),
		})));
		let errorsChanged = false;
		for (const result of snapshots) {
		  if (result.status !== "fulfilled") continue;
		  const { projectId, snapshot } = result.value;
		  if (JSON.stringify(state.artifactErrorsByProject[projectId] || []) !== JSON.stringify(snapshot.errors)) {
			state.artifactErrorsByProject[projectId] = snapshot.errors;
			errorsChanged = true;
		  }
		}
		if (errorsChanged) await persist(() => {});
		render();
	  }

      async function applyAgentStates(states) {
		const previousControlStatus = !project ? controlStatusSignature() : "";
        agentStates = states;
        let changed = false;
        let shouldScan = false;
        for (const task of Object.values(state.pendingTasks)) {
          const agent = states.find((candidate) => candidate.sessionKey === task.sessionKey);
          if (!agent || (agent.turn || 0) <= (task.baselineTurn || 0)) continue;
          let nextStatus = task.status;
          if (agent.lastOutcome === "aborted") nextStatus = "cancelled";
          else if (agent.lastOutcome === "failed" || agent.status === "error") nextStatus = "error";
          else if (agent.lastOutcome === "succeeded" && agent.status === "idle" && task.status !== "mounted") {
            nextStatus = "awaiting-artifact";
            if (task.projectId === project?.id) shouldScan = true;
          } else if (agent.status === "running" && task.status === "queued") nextStatus = "running";
          if (nextStatus !== task.status) {
            task.status = nextStatus;
            task.updatedAt = Date.now();
            changed = true;
          }
        }
        if (changed) await persist(() => {});
        if (shouldScan) await refreshArtifacts();
		else if (!project && previousControlStatus !== controlStatusSignature()) render();
      }

	  function controlStatusSignature() {
		return worktableProjects.map((candidate) => {
		  const scopedAgents = agentStates.filter((agent) => agent.projectId === candidate.id);
		  const needCount = scopedAgents.reduce((count, agent) => count + agent.pendingApprovals + agent.pendingUiRequests + agent.subagents.blocked, 0);
		  return `${candidate.id}:${statusForProject(candidate.id)}:${scopedAgents.length}:${needCount}`;
		}).join("|");
	  }

      function artifactForTab(tab) {
        return tab?.kind === "artifact"
			? artifacts.find((artifact) => artifact.worktableId === tab.artifactId)
			: undefined;
      }

	  async function loadProjectFiles(force = false) {
		if (!project || (projectFilesLoaded && !force) || projectFilesLoading) return;
		projectFilesLoading = true;
		projectFilesError = "";
		try {
			projectFiles = await context.files.list(project.id);
			projectFilesLoaded = true;
		} catch (error) {
			projectFiles = [];
			projectFilesLoaded = false;
			projectFilesError = error instanceof Error ? error.message : String(error);
		} finally {
			projectFilesLoading = false;
		}
	  }

	  function fileTreeMarkup(nodes, depth = 0) {
		return `<ul class="ly-worktable-resource-tree${depth ? " is-nested" : ""}">${nodes.map((node) => node.type === "directory"
			? `<li><details${depth === 0 ? " open" : ""}><summary><span aria-hidden="true">▸</span>${escapeHtml(node.name)}</summary>${fileTreeMarkup(node.children || [], depth + 1)}</details></li>`
			: `<li class="is-file"><span aria-hidden="true">·</span><span title="${escapeHtml(node.relativePath)}">${escapeHtml(node.name)}</span></li>`).join("")}</ul>`;
	  }

	  function resourceManagerMarkup() {
		const body = projectFilesLoading
			? `<div class="ly-worktable-resource-state">${escapeHtml(text.resourceLoading)}</div>`
			: projectFilesError
				? `<div class="ly-worktable-resource-state is-error">${escapeHtml(projectFilesError)}</div>`
				: projectFiles.length
					? fileTreeMarkup(projectFiles)
					: `<div class="ly-worktable-resource-state">${escapeHtml(text.resourceEmpty)}</div>`;
		return `<section class="ly-worktable-resource-manager"><header><div><strong>${escapeHtml(text.resourceManager)}</strong><span title="${escapeHtml(project.path)}">${escapeHtml(project.path)}</span></div><button type="button" data-resource-refresh>${escapeHtml(text.resourceRefresh)}</button></header><div class="ly-worktable-resource-body">${body}</div></section>`;
	  }

	  function tabMarkup(tab, pane) {
		const active = tab.id === pane.activeTabId;
		const initial = Array.from(tab.title.trim())[0]?.toUpperCase() || "W";
		return `<div class="ly-worktable-tab${active ? " is-active" : ""}" role="presentation" draggable="true" data-tab-drag="${escapeHtml(tab.id)}" data-pane-id="${escapeHtml(pane.id)}">
		  <button type="button" class="ly-worktable-tab-label" role="tab" aria-selected="${active}" data-tab-activate="${escapeHtml(tab.id)}" data-pane-id="${escapeHtml(pane.id)}" title="${escapeHtml(tab.title)}"><span class="ly-worktable-tab-icon" aria-hidden="true">${escapeHtml(initial)}</span><span>${escapeHtml(tab.title)}</span></button>
		  ${pane.locked ? "" : `<button type="button" class="ly-worktable-tab-close" data-tab-close="${escapeHtml(tab.id)}" data-pane-id="${escapeHtml(pane.id)}" aria-label="${escapeHtml(`${text.close}: ${tab.title}`)}">&times;</button>`}
		</div>`;
	  }

	  function tabContentMarkup(tab, pane) {
		const active = tab.id === pane.activeTabId;
		const artifact = artifactForTab(tab);
		if (artifact) {
		  return `<div class="ly-worktable-frame-slot${active ? " is-active" : ""}" data-artifact="${escapeHtml(artifact.worktableId)}" data-pane-id="${escapeHtml(pane.id)}" data-tab-id="${escapeHtml(tab.id)}" aria-hidden="${!active}"></div>`;
		}
		if (tab.kind === "explorer") {
		  return `<div class="ly-worktable-tab-content ly-worktable-resource-tab${active ? " is-active" : ""}" data-tab-id="${escapeHtml(tab.id)}" aria-hidden="${!active}">${resourceManagerMarkup()}</div>`;
		}
		return `<div class="ly-worktable-tab-content${active ? " is-active" : ""}" data-tab-id="${escapeHtml(tab.id)}" aria-hidden="${!active}">${escapeHtml(tab.title)}</div>`;
	  }

      function paneMarkup(pane, index, layout) {
        return `<section class="ly-worktable-window" data-pane-index="${index}" data-pane-id="${escapeHtml(pane.id)}">
		  <header class="ly-worktable-window-bar">
			<strong>${escapeHtml(text.window)} ${index + 1}</strong>
			<div class="ly-worktable-window-actions">
			  <button type="button" data-pane-lock="${escapeHtml(pane.id)}" title="${escapeHtml(pane.locked ? text.unlock : text.lock)}">${pane.locked ? "&#128274;" : "&#128275;"}</button>
			  <button type="button" data-pane-split="${escapeHtml(pane.id)}" data-split-direction="horizontal" title="${escapeHtml(text.splitRight)}">&#8596;</button>
			  <button type="button" data-pane-split="${escapeHtml(pane.id)}" data-split-direction="vertical" title="${escapeHtml(text.splitDown)}">&#8597;</button>
			  ${layout.panes.length > 1 ? `<button type="button" data-pane-close="${escapeHtml(pane.id)}" title="${escapeHtml(text.closePane)}">&times;</button>` : ""}
			</div>
		  </header>
		  <div class="ly-worktable-browser-tabs" data-pane-drop="${escapeHtml(pane.id)}">
			<div class="ly-worktable-tab-strip" role="tablist" aria-label="${escapeHtml(`${text.window} ${index + 1}`)}">${pane.tabs.map((tab) => tabMarkup(tab, pane)).join("")}</div>
			<button type="button" class="ly-worktable-new-tab" data-tab-menu-toggle="${escapeHtml(pane.id)}" aria-label="${escapeHtml(text.addTab)}" title="${escapeHtml(text.addTab)}">+</button>
			<div class="ly-worktable-tab-menu" data-tab-menu="${escapeHtml(pane.id)}" hidden>${artifacts.map((item) => `<button type="button" data-pane-artifact="${escapeHtml(pane.id)}" data-artifact-id="${escapeHtml(item.worktableId)}">${escapeHtml(item.name)}</button>`).join("")}<button type="button" class="ly-worktable-resource-menu-item" data-pane-resource="${escapeHtml(pane.id)}">${escapeHtml(text.resourceManager)}</button></div>
		  </div>
          <div class="ly-worktable-pane-body" data-pane-drop="${escapeHtml(pane.id)}">${pane.tabs.length
			? pane.tabs.map((tab) => tabContentMarkup(tab, pane)).join("")
			: `<div class="ly-worktable-empty-pane">${escapeHtml(text.emptyPane)}</div>`}</div>
		</section>`;
      }

	  function layoutNodeMarkup(node, layout) {
		if (node.type === "window") return paneMarkup(node, layout.panes.findIndex((pane) => pane.id === node.id), layout);
		return `<div class="ly-worktable-layout-split is-${node.direction}" data-split-id="${escapeHtml(node.id)}" style="--ly-split-ratio:${node.ratio}">
		  <div class="ly-worktable-layout-branch is-first">${layoutNodeMarkup(node.first, layout)}</div>
		  <div class="ly-worktable-pane-divider" data-split-divider="${escapeHtml(node.id)}" data-split-direction="${node.direction}" role="separator" aria-orientation="${node.direction === "horizontal" ? "vertical" : "horizontal"}" aria-valuemin="20" aria-valuemax="80" aria-valuenow="${Math.round(node.ratio * 100)}" tabindex="0"></div>
		  <div class="ly-worktable-layout-branch is-second">${layoutNodeMarkup(node.second, layout)}</div>
		</div>`;
	  }

      function layoutMarkup(layout) {
        return `<div class="ly-worktable-layout-tree">${layoutNodeMarkup(layout.root, layout)}</div>`;
      }

      function statusForProject(projectId) {
		return projectWorktableStatus(
		  agentStates.filter((agent) => agent.projectId === projectId),
		  state.acknowledgedStatusBySession,
		  tasksForProject(projectId),
		  state.artifactErrorsByProject[projectId] || [],
		);
	  }

	  function projectCardMarkup(candidate) {
		const projectIndex = worktableProjects.findIndex((item) => item.id === candidate.id);
		const palettes = [[123, 108], [283, 268], [43, 28], [3, 348], [253, 238], [223, 208], [193, 178], [211, 196]];
		const [hueStart, hueEnd] = palettes[(projectIndex < 0 ? 0 : projectIndex) % palettes.length];
		const status = statusForProject(candidate.id);
		const scopedAgents = agentStates.filter((agent) => agent.projectId === candidate.id);
		return `<button type="button" class="ly-worktable-project-card status-${status}" style="--ly-project-index:${Math.max(0, projectIndex)};--ly-project-back:linear-gradient(hsl(${hueStart} 90% 48%),hsl(${hueEnd} 90% 45%))" data-project-card="${escapeHtml(candidate.id)}" aria-label="${escapeHtml(`${text.openProject}：${candidate.name}，${text[status]}，${scopedAgents.length} ${text.projectAgents}`)}">
		  <span class="ly-worktable-project-card-back" aria-hidden="true"></span>
		  <span class="ly-worktable-project-card-front"><span class="ly-worktable-project-card-status"><strong>${escapeHtml(text[status])}</strong><span>${scopedAgents.length} ${escapeHtml(text.projectAgents)}</span></span></span>
		  <span class="ly-worktable-project-card-label">${escapeHtml(candidate.name)}</span>
		</button>`;
	  }

	  function controlRoomMarkup() {
		const switchThemeLabel = controlRoomTheme === "dark" ? text.switchToLight : text.switchToDark;
		const themeIcon = controlRoomTheme === "dark"
			? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3.5"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42"></path></svg>`
			: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 14.2A8.3 8.3 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z"></path></svg>`;
		return `<section class="ly-worktable-control-room is-${controlRoomTheme}" aria-label="${escapeHtml(text.controlTitle)}">
		  <div class="ly-worktable-control-actions">
			<button type="button" class="ly-worktable-control-theme" data-control-theme aria-label="${escapeHtml(switchThemeLabel)}" title="${escapeHtml(switchThemeLabel)}">${themeIcon}</button>
			<button type="button" class="ly-worktable-control-refresh" data-control-refresh aria-label="${escapeHtml(text.resourceRefresh)}" title="${escapeHtml(text.resourceRefresh)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.34 6.06"></path><path d="M20 5v6h-6"></path></svg></button>
		  </div>
		  <h2 class="ly-worktable-sr-only">${escapeHtml(text.controlTitle)}</h2>
		  <div class="ly-worktable-project-grid">
			${worktableProjects.map(projectCardMarkup).join("")}
			<button type="button" class="ly-worktable-project-card ly-worktable-add-project-card" style="--ly-project-index:${worktableProjects.length};--ly-project-back:linear-gradient(hsl(220 12% 78%),hsl(220 10% 68%))" data-add-project aria-label="${escapeHtml(text.addProject)}"><span class="ly-worktable-project-card-back" aria-hidden="true"></span><span class="ly-worktable-project-card-front"><span class="ly-worktable-project-add-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"></path></svg></span></span><span class="ly-worktable-project-card-label">${escapeHtml(text.addProject)}</span></button>
		  </div>
		</section>`;
	  }

	  function positionFrames() {
		const frameLayer = root.querySelector("[data-frame-layer]");
		if (!frameLayer) return;
		const layerRect = frameLayer.getBoundingClientRect();
		for (const [tabId, mounted] of framesByTabId) {
			const slot = frameSlotsByTabId.get(tabId);
			const active = Boolean(slot?.classList.contains("is-active"));
			mounted.frame.setAttribute("aria-hidden", String(!active));
			mounted.host.style.visibility = active ? "visible" : "hidden";
			mounted.host.style.pointerEvents = active ? "auto" : "none";
			if (!slot || !active) continue;
			const slotRect = slot.getBoundingClientRect();
			const left = Math.max(0, Math.round(slotRect.left - layerRect.left));
			const top = Math.max(0, Math.round(slotRect.top - layerRect.top));
			const right = Math.max(0, Math.round(layerRect.right - slotRect.right));
			const bottom = Math.max(0, Math.round(layerRect.bottom - slotRect.bottom));
			// 四边锚定让保活 iframe 随挂载层同步伸缩；外层抽屉改变宽度时不再等待下一次 JS 测量。
			mounted.host.style.inset = `${top}px ${right}px ${bottom}px ${left}px`;
		}
	  }

	  function schedulePositionFrames() {
		if (framePositionRequest) return;
		framePositionRequest = requestAnimationFrame(() => {
			framePositionRequest = 0;
			positionFrames();
		});
	  }

	  function scheduleSettledPositionFrames() {
		if (settledFramePositionRequest) cancelAnimationFrame(settledFramePositionRequest);
		settledFramePositionRequest = requestAnimationFrame(() => {
			settledFramePositionRequest = requestAnimationFrame(() => {
				settledFramePositionRequest = 0;
				positionFrames();
			});
		});
	  }

	  const onWorkbenchLayoutResize = () => {
		schedulePositionFrames();
		scheduleSettledPositionFrames();
	  };

	  function syncFrames(layout) {
		if (!project) return;
		const frameLayer = root.querySelector("[data-frame-layer]");
		if (!frameLayer) return;
		frameSlotsByTabId.clear();
		root.querySelectorAll(".ly-worktable-frame-slot[data-tab-id]").forEach((slot) => frameSlotsByTabId.set(slot.dataset.tabId, slot));
		layoutResizeObserver?.disconnect();
		const stage = root.querySelector(".ly-worktable-stage");
		layoutResizeObserver?.observe(root);
		if (stage) layoutResizeObserver?.observe(stage);
		for (const slot of frameSlotsByTabId.values()) layoutResizeObserver?.observe(slot);
		const liveTabs = new Set();
		for (const pane of layout.panes) {
			for (const tab of pane.tabs) {
				const artifact = artifactForTab(tab);
				if (!artifact) continue;
				liveTabs.add(tab.id);
				let mounted = framesByTabId.get(tab.id);
				if (!mounted) {
					const slot = frameSlotsByTabId.get(tab.id);
					if (!slot) continue;
					const host = document.createElement("div");
					host.className = "ly-worktable-frame-host";
					host.dataset.tabId = tab.id;
					host.dataset.paneId = pane.id;
					const frame = document.createElement("iframe");
					frame.className = "ly-worktable-frame";
					frame.title = artifact.name;
					frame.setAttribute("referrerpolicy", "no-referrer");
					frame.dataset.artifact = artifact.worktableId;
					frame.dataset.tabId = tab.id;
					frame.dataset.paneId = pane.id;
					host.append(frame);
					frameLayer.append(host);
					mounted = { host, frame, artifact, paneId: pane.id, tabId: tab.id };
					framesByTabId.set(tab.id, mounted);
					frames.set(frame.contentWindow, mounted);
					frame.addEventListener("load", () => {
						const current = framesByTabId.get(tab.id);
						const savedTab = state.projectLayouts[project.id]?.panes
							?.find((candidate) => candidate.id === current?.paneId)?.tabs
							?.find((candidate) => candidate.id === tab.id);
						if (current && savedTab) frame.contentWindow?.postMessage({ channel: "lywork-worktable", worktableId: current.artifact.worktableId, nonce: current.artifact.nonce, event: "restoreViewport", x: savedTab.scrollX, y: savedTab.scrollY }, "*");
					});
					frame.src = `${artifact.url}?revision=${state.revision}`;
				} else {
					mounted.paneId = pane.id;
					mounted.tabId = tab.id;
					mounted.frame.dataset.paneId = pane.id;
					mounted.host.dataset.paneId = pane.id;
					if (mounted.host.parentElement !== frameLayer) frameLayer.append(mounted.host);
				}
			}
		}
		for (const [tabId, mounted] of framesByTabId) {
			if (liveTabs.has(tabId)) continue;
			frames.delete(mounted.frame.contentWindow);
			mounted.host.remove();
			framesByTabId.delete(tabId);
		}
		positionFrames();
		schedulePositionFrames();
	  }

	  function reloadArtifactFrames(worktableId) {
		const artifact = artifacts.find((candidate) => candidate.worktableId === worktableId);
		if (!artifact) return;
		for (const mounted of framesByTabId.values()) {
			if (mounted.artifact.worktableId !== worktableId) continue;
			frames.delete(mounted.frame.contentWindow);
			mounted.artifact = artifact;
			frames.set(mounted.frame.contentWindow, mounted);
			mounted.frame.src = `${artifact.url}?revision=${Date.now()}`;
		}
	  }

	  function ensureProjectShell() {
		let layoutRoot = root.querySelector("[data-layout-root]");
		if (layoutRoot) return layoutRoot;
		root.innerHTML = `<div class="ly-worktable-shell"><main class="ly-worktable-stage"><div class="ly-worktable-layout-root" data-layout-root></div><div class="ly-worktable-frame-layer" data-frame-layer></div></main></div>`;
		layoutRoot = root.querySelector("[data-layout-root]");
		layoutResizeObserver?.disconnect();
		layoutResizeObserver = new ResizeObserver(schedulePositionFrames);
		layoutResizeObserver.observe(root);
		layoutResizeObserver.observe(root.querySelector(".ly-worktable-stage"));
		window.addEventListener("lywork:workbench-layout-resize", onWorkbenchLayoutResize);
		window.addEventListener("resize", onWorkbenchLayoutResize);
		return layoutRoot;
	  }

      function render(errorMessage) {
        if (disposed) return;
        const isControlRoom = !project;
		const layout = project ? normalizeLayout(state.projectLayouts[project.id]) : undefined;
		if (isControlRoom) {
			const stage = errorMessage ? `<div class="ly-worktable-error">${escapeHtml(errorMessage)}</div>` : controlRoomMarkup();
			root.innerHTML = `<div class="ly-worktable-shell is-control-room is-${controlRoomTheme}"><main class="ly-worktable-stage">${stage}</main></div>`;
			bindUi(undefined);
			return;
		}
		const layoutRoot = ensureProjectShell();
		layoutRoot.innerHTML = errorMessage ? `<div class="ly-worktable-error">${escapeHtml(errorMessage)}</div>` : layoutMarkup(layout);
		bindUi(layout);
		syncFrames(layout);
      }

      function bindUi(initialLayout) {
		let layout = initialLayout;
		const saveLayout = (nextLayout, rerender = true) => {
			layout = nextLayout;
			state.projectLayouts[project.id] = nextLayout;
			return persist(() => {}).then(() => { if (rerender) render(); });
		};
		const activateTabInDom = (paneId, tabId) => {
			const paneRoot = root.querySelector(`[data-pane-id="${CSS.escape(paneId)}"]`);
			if (!paneRoot) return;
			paneRoot.querySelectorAll(".ly-worktable-tab").forEach((tab) => {
				const active = tab.dataset.tabDrag === tabId;
				tab.classList.toggle("is-active", active);
				tab.querySelector("[role=tab]")?.setAttribute("aria-selected", String(active));
			});
			paneRoot.querySelectorAll(".ly-worktable-frame-slot, .ly-worktable-tab-content").forEach((content) => {
				const active = content.dataset.tabId === tabId;
				content.classList.toggle("is-active", active);
				content.setAttribute("aria-hidden", String(!active));
			});
			const mounted = framesByTabId.get(tabId);
			const tab = layout.panes.find((pane) => pane.id === paneId)?.tabs.find((candidate) => candidate.id === tabId);
			if (mounted && tab) {
				mounted.frame.contentWindow?.postMessage({ channel: "lywork-worktable", worktableId: mounted.artifact.worktableId, nonce: mounted.artifact.nonce, event: "restoreViewport", x: tab.scrollX, y: tab.scrollY }, "*");
			}
			schedulePositionFrames();
		};
        root.querySelectorAll("[data-project-card]").forEach((button) => button.addEventListener("click", async () => {
          const projectId = button.dataset.projectCard;
          if (statusForProject(projectId) === "done") {
            await persist((draft) => {
              draft.acknowledgedStatusBySession = acknowledgeAgentStates(
                draft.acknowledgedStatusBySession,
                agentStates.filter((agent) => agent.projectId === projectId),
              );
            });
          }
          await context.projects.open(projectId);
        }));
        root.querySelector("[data-add-project]")?.addEventListener("click", () => context.projects.requestCreate());
		root.querySelector("[data-control-theme]")?.addEventListener("click", () => {
			controlRoomTheme = controlRoomTheme === "dark" ? "light" : "dark";
			localStorage.setItem("lywork.worktable.control-room-theme", controlRoomTheme);
			render();
		});
		root.querySelector("[data-control-refresh]")?.addEventListener("click", async (event) => {
			const button = event.currentTarget;
			button.disabled = true;
			root.querySelector(".ly-worktable-control-room")?.classList.add("is-refreshing");
			await refreshControlRoom();
		});
		if (!layout || !project) return;
		root.querySelectorAll("[data-tab-menu-toggle]").forEach((button) => button.addEventListener("click", () => {
			const menu = root.querySelector(`[data-tab-menu="${CSS.escape(button.dataset.tabMenuToggle)}"]`);
			if (menu) menu.hidden = !menu.hidden;
		}));
		root.querySelectorAll("[data-pane-artifact]").forEach((button) => button.addEventListener("click", () => {
			const artifact = artifacts.find((item) => item.worktableId === button.dataset.artifactId);
			if (artifact) void saveLayout(openArtifactTab(layout, button.dataset.paneArtifact, artifact));
		}));
		root.querySelectorAll("[data-pane-resource]").forEach((button) => button.addEventListener("click", async () => {
			const filesPromise = loadProjectFiles();
			await saveLayout(openExplorerTab(layout, button.dataset.paneResource, text.resourceManager));
			await filesPromise;
			render();
		}));
		root.querySelectorAll("[data-resource-refresh]").forEach((button) => button.addEventListener("click", async () => {
			const filesPromise = loadProjectFiles(true);
			render();
			await filesPromise;
			render();
		}));
		root.querySelectorAll("[data-tab-activate]").forEach((button) => button.addEventListener("click", () => {
			layout = activateLayoutTab(layout, button.dataset.paneId, button.dataset.tabActivate);
			state.projectLayouts[project.id] = layout;
			activateTabInDom(button.dataset.paneId, button.dataset.tabActivate);
			void persist(() => {});
		}));
		root.querySelectorAll("[data-tab-close]").forEach((button) => button.addEventListener("click", (event) => {
			event.stopPropagation();
			void saveLayout(closeLayoutTab(layout, button.dataset.paneId, button.dataset.tabClose));
		}));
		root.querySelectorAll("[data-tab-drag]").forEach((tab) => {
			tab.addEventListener("dragstart", (event) => {
				draggedTab = { paneId: tab.dataset.paneId, tabId: tab.dataset.tabDrag };
				event.dataTransfer.effectAllowed = "move";
				event.dataTransfer.setData("text/plain", tab.dataset.tabDrag);
			});
			tab.addEventListener("dragend", () => {
				draggedTab = null;
				root.querySelectorAll(".is-tab-drop-target").forEach((target) => target.classList.remove("is-tab-drop-target"));
			});
		});
		root.querySelectorAll("[data-pane-drop]").forEach((target) => {
			target.addEventListener("dragover", (event) => {
				if (!draggedTab || draggedTab.paneId === target.dataset.paneDrop) return;
				event.preventDefault();
				event.dataTransfer.dropEffect = "move";
				target.classList.add("is-tab-drop-target");
			});
			target.addEventListener("dragleave", () => target.classList.remove("is-tab-drop-target"));
			target.addEventListener("drop", (event) => {
				event.preventDefault();
				target.classList.remove("is-tab-drop-target");
				if (!draggedTab || draggedTab.paneId === target.dataset.paneDrop) return;
				void saveLayout(moveLayoutTab(layout, draggedTab.paneId, draggedTab.tabId, target.dataset.paneDrop));
				draggedTab = null;
			});
		});
		root.querySelectorAll("[data-pane-split]").forEach((button) => button.addEventListener("click", () => void saveLayout(splitLayoutPane(layout, button.dataset.paneSplit, button.dataset.splitDirection))));
		root.querySelectorAll("[data-pane-close]").forEach((button) => button.addEventListener("click", () => void saveLayout(closeLayoutPane(layout, button.dataset.paneClose))));
		root.querySelectorAll("[data-pane-lock]").forEach((button) => button.addEventListener("click", () => void saveLayout(updateLayoutByUser(layout, (draft) => {
			const pane = draft.panes.find((candidate) => candidate.id === button.dataset.paneLock);
			if (pane) pane.locked = !pane.locked;
		}))));
		root.querySelectorAll("[data-split-divider]").forEach((divider) => {
			const splitId = divider.dataset.splitDivider;
			const splitDirection = divider.dataset.splitDirection;
			const clampRatio = (raw, rect = divider.parentElement.getBoundingClientRect()) => {
				const axisLength = splitDirection === "vertical" ? rect.height : rect.width;
				const availableLength = Math.max(1, axisLength - 5);
				const minimumPaneSize = Math.min(splitDirection === "vertical" ? 180 : 240, availableLength / 2);
				const minimumRatio = minimumPaneSize / availableLength;
				return Math.min(0.8, 1 - minimumRatio, Math.max(0.2, minimumRatio, raw));
			};
			const ratioFromPoint = (pointEvent, rect = divider.parentElement.getBoundingClientRect()) => {
				const raw = splitDirection === "vertical"
					? (pointEvent.clientY - rect.top) / rect.height
					: (pointEvent.clientX - rect.left) / rect.width;
				return clampRatio(raw, rect);
			};
			divider.addEventListener("pointerdown", (event) => {
				event.preventDefault();
				const split = divider.parentElement;
				const shell = root.querySelector(".ly-worktable-shell");
				const bounds = split.getBoundingClientRect();
				const pointerId = event.pointerId;
				let active = true;
				let latestRatio = ratioFromPoint(event, bounds);
				let animationFrame = 0;
				const paint = () => {
					animationFrame = 0;
					split.style.setProperty("--ly-split-ratio", String(latestRatio));
					schedulePositionFrames();
				};
				const onMove = (moveEvent) => {
					if (!active || moveEvent.pointerId !== pointerId) return;
					latestRatio = ratioFromPoint(moveEvent, bounds);
					if (!animationFrame) animationFrame = requestAnimationFrame(paint);
				};
				const finish = (finishEvent) => {
					if (!active || finishEvent.pointerId !== pointerId) return;
					active = false;
					latestRatio = ratioFromPoint(finishEvent, bounds);
					if (animationFrame) cancelAnimationFrame(animationFrame);
					paint();
					scheduleSettledPositionFrames();
					divider.removeEventListener("pointermove", onMove);
					divider.removeEventListener("pointerup", finish);
					divider.removeEventListener("pointercancel", finish);
					divider.removeEventListener("lostpointercapture", finish);
					if (divider.hasPointerCapture(pointerId)) divider.releasePointerCapture(pointerId);
					shell?.removeAttribute("data-layout-resize");
					layout = updateLayoutSplitRatio(layout, splitId, latestRatio);
					state.projectLayouts[project.id] = layout;
					void persist(() => {});
				};
				shell?.setAttribute("data-layout-resize", splitDirection);
				divider.setPointerCapture(pointerId);
				divider.addEventListener("pointermove", onMove);
				divider.addEventListener("pointerup", finish);
				divider.addEventListener("pointercancel", finish);
				divider.addEventListener("lostpointercapture", finish);
			});
			divider.addEventListener("keydown", (event) => {
				const negativeKey = splitDirection === "vertical" ? "ArrowUp" : "ArrowLeft";
				const positiveKey = splitDirection === "vertical" ? "ArrowDown" : "ArrowRight";
				const delta = event.key === negativeKey ? -0.05 : event.key === positiveKey ? 0.05 : 0;
				if (!delta) return;
				event.preventDefault();
				const current = Number(divider.parentElement.style.getPropertyValue("--ly-split-ratio")) || 0.5;
				const nextRatio = clampRatio(current + delta);
				layout = updateLayoutSplitRatio(layout, splitId, nextRatio);
				state.projectLayouts[project.id] = layout;
				divider.parentElement.style.setProperty("--ly-split-ratio", String(nextRatio));
				positionFrames();
				void persist(() => {});
			});
		});
      }

      const respond = (frame, request, ok, result, error) => frame.contentWindow?.postMessage({ channel: "lywork-worktable", worktableId: request.worktableId, nonce: request.nonce, requestId: request.requestId, ok, result, error }, "*");
      const onRuntimeMessage = async (event) => {
        const mounted = frames.get(event.source);
        if (!mounted) return;
        const request = event.data;
        const artifact = mounted.artifact;
        if (!request || request.channel !== "lywork-worktable" || request.worktableId !== artifact.worktableId || request.nonce !== artifact.nonce) return;
        try {
          const params = request.params || {};
          if (request.method.startsWith("storage.") && (typeof params.key !== "string" || !/^[A-Za-z0-9._:-]{1,128}$/.test(params.key))) throw new Error("Invalid storage key.");
          if (request.method === "storage.set" && JSON.stringify(params.value).length > 1048576) throw new Error("Storage value exceeds 1 MB.");
          let result;
          if (request.method === "storage.get") result = await context.artifacts.storage.get(artifact.projectId, artifact.worktableId, params.key);
          else if (request.method === "storage.set") result = await context.artifacts.storage.set(artifact.projectId, artifact.worktableId, params.key, params.value);
          else if (request.method === "storage.delete") result = await context.artifacts.storage.delete(artifact.projectId, artifact.worktableId, params.key);
          else if (request.method === "host.getTheme") result = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
		  else if (request.method === "host.viewport") {
			if (project && mounted.paneId && mounted.tabId) {
				state.projectLayouts[project.id] = updateLayoutTabViewport(state.projectLayouts[project.id], mounted.paneId, mounted.tabId, params);
				window.clearTimeout(viewportSaveTimer);
				viewportSaveTimer = window.setTimeout(() => { void persist(() => {}); }, 180);
			}
			result = true;
		  }
          else if (request.method !== "host.ready" && request.method !== "host.error") throw new Error(`Unknown runtime method: ${request.method}`);
          respond(mounted.frame, request, true, result);
        } catch (error) { respond(mounted.frame, request, false, undefined, error instanceof Error ? error.message : String(error)); }
      };

      window.addEventListener("message", onRuntimeMessage);
      const projectSubscription = context.projects.subscribe((nextProjects) => {
        worktableProjects = nextProjects.filter((candidate) => candidate.kind === "worktable");
        if (!project) void refreshControlRoom();
      });
      const artifactSubscription = context.artifacts.subscribe((event) => {
        if (!project) void refreshControlRoom();
		else if (event.projectId === project.id) {
			window.clearTimeout(artifactRefreshTimers.get(event.worktableId));
			artifactRefreshTimers.set(event.worktableId, window.setTimeout(() => {
				artifactRefreshTimers.delete(event.worktableId);
				void refreshArtifacts(event.worktableId);
			}, 300));
		}
      });
      const sessionSubscription = context.sessions.subscribe(() => void ensureArtifactRecords());
      const agentSubscription = context.agents.subscribeState((states) => { void applyAgentStates(states); });
      await refreshArtifacts();
      if (project) await openBoundSession();
      else await refreshControlRoom();
      return { dispose() { disposed = true; window.clearTimeout(viewportSaveTimer); if (framePositionRequest) cancelAnimationFrame(framePositionRequest); if (settledFramePositionRequest) cancelAnimationFrame(settledFramePositionRequest); for (const timer of artifactRefreshTimers.values()) window.clearTimeout(timer); artifactRefreshTimers.clear(); layoutResizeObserver?.disconnect(); for (const mounted of framesByTabId.values()) mounted.host.remove(); frames.clear(); framesByTabId.clear(); frameSlotsByTabId.clear(); projectSubscription.dispose(); artifactSubscription.dispose(); sessionSubscription.dispose(); agentSubscription.dispose(); window.removeEventListener("message", onRuntimeMessage); window.removeEventListener("lywork:workbench-layout-resize", onWorkbenchLayoutResize); window.removeEventListener("resize", onWorkbenchLayoutResize); root.replaceChildren(); } };
    },
  });
}
