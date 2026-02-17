<script lang="ts">
  import { Settings, X, Plus } from "lucide-svelte";
  import { dndzone, type DndEvent } from "svelte-dnd-action";
  import { flip } from "svelte/animate";
  import type { ProjectTab } from "../../types/ui";

  let {
    repositoryName = "GitLite",
    repositoryPath = "",
    activeProjectPath = "",
    projectTabs = $bindable([]),
    onOpenRepository,
    onSwitchProject,
    onCloseProject,
    onReorderProjects,
    onToggleSettings,
  }: {
    repositoryName?: string;
    repositoryPath?: string;
    activeProjectPath?: string;
    projectTabs: ProjectTab[];
    onOpenRepository: () => Promise<void>;
    onSwitchProject: (path: string) => Promise<void>;
    onCloseProject: (path: string) => Promise<void>;
    onReorderProjects: (tabs: ProjectTab[]) => void;
    onToggleSettings: () => void;
  } = $props();

  let opening = $state(false);
  let switching = $state(false);

  let displayRepoName = $derived(
    activeProjectPath.split("/").filter(Boolean).pop() ||
      repositoryName ||
      "GitLite",
  );

  const flipDurationMs = 200;

  function handleDndConsider(e: CustomEvent<DndEvent<ProjectTab>>) {
    projectTabs = e.detail.items;
  }

  function handleDndFinalize(e: CustomEvent<DndEvent<ProjectTab>>) {
    projectTabs = e.detail.items;
    onReorderProjects(projectTabs);
  }

  async function switchProject(path: string) {
    if (!path || path === activeProjectPath) return;
    switching = true;
    try {
      await onSwitchProject(path);
    } finally {
      switching = false;
    }
  }

  async function closeProject(event: MouseEvent, path: string) {
    event.stopPropagation();
    switching = true;
    try {
      await onCloseProject(path);
    } finally {
      switching = false;
    }
  }

  async function openProjectFromTab() {
    opening = true;
    try {
      await onOpenRepository();
    } finally {
      opening = false;
    }
  }

  function closeProjectFor(path: string) {
    return (event: MouseEvent) => {
      void closeProject(event, path);
    };
  }

  function auxCloseProjectFor(path: string) {
    return (event: MouseEvent) => {
      if (event.button !== 1) return;
      event.preventDefault();
      void closeProject(event, path);
    };
  }
</script>

<header class="gl-top-chrome" data-testid="top-chrome">
  <div class="gl-top-main">
    <div class="flex min-w-0 items-center gap-3">
      <strong class="truncate text-sm gl-text-strong" data-testid="repo-name"
        >{displayRepoName}</strong
      >
      {#if activeProjectPath || repositoryPath}
        <span
          class="gl-text-soft gl-code hidden truncate md:block"
          data-testid="repo-path"
        >
          {activeProjectPath || repositoryPath}
        </span>
      {/if}
    </div>

    <div class="flex items-center gap-2">
      <button
        type="button"
        class="gl-icon-button"
        onclick={onToggleSettings}
        data-testid="open-settings"
        aria-label="Open preferences"
        title="Preferences (Cmd/Ctrl+,)"
      >
        <Settings size={16} />
      </button>
    </div>
  </div>

  <div class="gl-project-tabs" data-testid="project-tabs">
    <section
      class="gl-project-tabs-list"
      use:dndzone={{ items: projectTabs, flipDurationMs, type: "project-tab" }}
      onconsider={handleDndConsider}
      onfinalize={handleDndFinalize}
    >
      {#each projectTabs as project, index (project.id)}
        <div
          class="gl-project-tab"
          class:is-active={project.path === activeProjectPath}
          animate:flip={{ duration: flipDurationMs }}
        >
          <button
            type="button"
            class="gl-project-tab-trigger"
            onclick={() => switchProject(project.path)}
            onauxclick={auxCloseProjectFor(project.path)}
            disabled={switching}
            data-testid={`project-tab-${index}`}
            title={project.path}
          >
            <span class="truncate">{project.name}</span>
          </button>
          <button
            type="button"
            class="gl-project-tab-close"
            onclick={closeProjectFor(project.path)}
            disabled={switching}
            data-testid={`project-tab-close-${index}`}
            aria-label={`Close ${project.name}`}
          >
            <X size={12} />
          </button>
        </div>
      {/each}
    </section>

    <button
      type="button"
      class="gl-project-tab-add"
      onclick={openProjectFromTab}
      disabled={opening}
      data-testid="project-tab-add"
      aria-label="Open project"
      title="Open project (Cmd/Ctrl+T)"
    >
      <Plus size={14} />
    </button>
  </div>
</header>

<style>
  .gl-project-tabs-list {
    display: flex;
    align-items: center;
    gap: 6px;
    height: 100%;
    outline: none;
  }
</style>
