<script lang="ts">
  import { Keyboard, RotateCcw, Save, X, CircleDot } from "lucide-svelte";
  import { tick } from "svelte";
  import type { ShortcutCommandId, ShortcutMap } from "../../types/ui";

  interface CommandItem {
    id: ShortcutCommandId;
    label: string;
    description: string;
  }

  const COMMAND_ITEMS: CommandItem[] = [
    {
      id: "open_project",
      label: "Open project",
      description: "Open repository picker in current window",
    },
    {
      id: "close_project",
      label: "Close current tab",
      description: "Close active project tab",
    },
    {
      id: "next_project",
      label: "Next tab",
      description: "Switch to next project tab",
    },
    {
      id: "prev_project",
      label: "Previous tab",
      description: "Switch to previous project tab",
    },
    {
      id: "open_settings",
      label: "Open settings",
      description: "Open settings panel",
    },
    {
      id: "switch_branches",
      label: "Branches pane",
      description: "Switch sidebar to Branches",
    },
    {
      id: "switch_changes",
      label: "Changes pane",
      description: "Switch sidebar to Changes",
    },
    {
      id: "switch_stash",
      label: "Stash pane",
      description: "Switch sidebar to Stash",
    },
  ];

  let {
    open = false,
    shortcuts,
    onSave,
    onReset,
    onClose,
  }: {
    open: boolean;
    shortcuts: ShortcutMap;
    onSave: (shortcuts: ShortcutMap) => Promise<void>;
    onReset: () => Promise<void>;
    onClose: () => void;
  } = $props();

  let draft = $state<ShortcutMap>({
    open_project: "",
    close_project: "",
    next_project: "",
    prev_project: "",
    open_settings: "",
    switch_branches: "",
    switch_changes: "",
    switch_stash: "",
  });
  let saving = $state(false);
  let errorMessage = $state("");
  let recordingCommand = $state<ShortcutCommandId | null>(null);

  $effect(() => {
    if (open) {
      draft = { ...shortcuts };
      errorMessage = "";
      recordingCommand = null;
    }
  });

  function startRecording(command: ShortcutCommandId) {
    recordingCommand = command;
    errorMessage = "";
  }

  function stopRecording() {
    recordingCommand = null;
  }

  function isModifierKey(key: string): boolean {
    const normalized = key.toLowerCase();
    return (
      normalized === "shift" ||
      normalized === "control" ||
      normalized === "meta" ||
      normalized === "alt"
    );
  }

  function toShortcut(event: KeyboardEvent): string | null {
    if (isModifierKey(event.key)) return null;

    const parts: string[] = [];
    const hasPrimary = event.ctrlKey || event.metaKey;
    if (event.ctrlKey !== event.metaKey && hasPrimary) {
      parts.push("CmdOrCtrl");
    } else {
      if (event.ctrlKey) parts.push("Ctrl");
      if (event.metaKey) parts.push("Cmd");
    }
    if (event.altKey) parts.push("Alt");
    if (event.shiftKey) parts.push("Shift");
    if (parts.length === 0) return null;

    const key = normalizeKey(event.key);
    if (!key) return null;
    parts.push(key);
    return parts.join("+");
  }

  function normalizeKey(key: string): string {
    if (key === " ") return "Space";
    if (key.length === 1) {
      return key === "," ? "," : key.toUpperCase();
    }
    if (key === "Escape") return "Esc";
    return key;
  }

  function onShortcutKeydown(event: KeyboardEvent, command: ShortcutCommandId) {
    startRecording(command);

    if (event.key === "Escape" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      stopRecording();
      return;
    }

    if (event.key === "Tab" && !event.ctrlKey && !event.metaKey && !event.altKey) {
      stopRecording();
      return;
    }

    const shortcut = toShortcut(event);
    if (!shortcut) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    draft = {
      ...draft,
      [command]: shortcut,
    };
    stopRecording();
    errorMessage = "";
  }

  function validateDraft(): string | null {
    const seen = new Map<string, ShortcutCommandId>();
    for (const item of COMMAND_ITEMS) {
      const shortcut = draft[item.id]?.trim();
      if (!shortcut) {
        return `Shortcut is required: ${item.label}`;
      }
      const normalized = shortcut.toLowerCase();
      const exists = seen.get(normalized);
      if (exists) {
        return `Duplicate shortcut: ${shortcut}`;
      }
      seen.set(normalized, item.id);
    }
    return null;
  }

  async function save() {
    const validationError = validateDraft();
    if (validationError) {
      errorMessage = validationError;
      return;
    }
    saving = true;
    errorMessage = "";
    try {
      await onSave(draft);
      onClose();
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : "Failed to save command settings.";
    } finally {
      saving = false;
    }
  }

  async function resetToDefaults() {
    saving = true;
    errorMessage = "";
    try {
      await onReset();
      await tick();
      draft = { ...shortcuts };
      stopRecording();
    } catch (error) {
      errorMessage =
        error instanceof Error ? error.message : "Failed to reset command settings.";
    } finally {
      saving = false;
    }
  }
</script>

{#if open}
  <button
    type="button"
    class="gl-settings-backdrop"
    onclick={onClose}
    data-testid="command-settings-backdrop"
    aria-label="Close command settings"
  ></button>
  <div
    class="gl-command-settings-panel"
    data-testid="command-settings-panel"
    role="dialog"
    aria-modal="true"
    aria-labelledby="command-settings-title"
  >
    <div class="gl-settings-head">
      <div class="flex items-center gap-2">
        <Keyboard size={17} class="text-[var(--accent)]" />
        <h2 id="command-settings-title" class="gl-text-strong">Command Settings</h2>
      </div>
      <button
        type="button"
        class="gl-icon-button p-1"
        onclick={onClose}
        aria-label="Close command settings"
      >
        <X size={18} />
      </button>
    </div>

    <div class="gl-command-scroll">
      {#each COMMAND_ITEMS as command}
        <div class="gl-command-row">
          <div class="min-w-0">
            <p class="gl-command-label">{command.label}</p>
            <p class="gl-command-desc">{command.description}</p>
          </div>
          <div class="gl-command-input-wrap">
            <input
              class="gl-input gl-command-input"
              class:is-recording={recordingCommand === command.id}
              value={draft[command.id]}
              readonly
              onfocus={() => startRecording(command.id)}
              onblur={stopRecording}
              onkeydown={(event) => onShortcutKeydown(event, command.id)}
              placeholder="Press shortcut"
              data-testid={`command-shortcut-${command.id}`}
              aria-label={`${command.label} shortcut`}
            />
            <button
              type="button"
              class="gl-command-record"
              class:is-recording={recordingCommand === command.id}
              onclick={() => startRecording(command.id)}
              data-testid={`command-record-${command.id}`}
              title="Click, then press keys"
            >
              <CircleDot size={12} />
              <span>{recordingCommand === command.id ? "Recording" : "Record"}</span>
            </button>
          </div>
        </div>
      {/each}

      {#if errorMessage}
        <p class="gl-command-error" data-testid="command-settings-error">
          {errorMessage}
        </p>
      {/if}
    </div>

    <div class="gl-command-actions">
      <button
        type="button"
        class="gl-button"
        onclick={resetToDefaults}
        disabled={saving}
        data-testid="command-settings-reset"
      >
        <RotateCcw size={14} />
        <span>Reset</span>
      </button>
      <button
        type="button"
        class="gl-button is-primary"
        onclick={save}
        disabled={saving}
        data-testid="command-settings-save"
      >
        <Save size={14} />
        <span>Save</span>
      </button>
    </div>
  </div>
{/if}

<style>
  .gl-settings-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.2);
    z-index: 90;
    border: none;
    backdrop-filter: blur(4px);
    cursor: default;
  }

  .gl-command-settings-panel {
    position: fixed;
    top: 72px;
    left: 50%;
    transform: translateX(-50%);
    width: min(760px, calc(100vw - 40px));
    max-height: calc(100vh - 130px);
    background: var(--bg-surface);
    border: 1px solid var(--line-medium);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-xl);
    z-index: 110;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .gl-settings-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px;
    background: color-mix(in oklab, var(--bg-surface), transparent 50%);
    border-bottom: 1px solid var(--line-soft);
  }

  .gl-command-scroll {
    overflow-y: auto;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .gl-command-row {
    border: 1px solid var(--line-soft);
    background: var(--bg-canvas);
    border-radius: var(--radius-md);
    padding: 10px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 220px;
    gap: 12px;
    align-items: center;
  }

  .gl-command-label {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-strong);
    margin: 0;
  }

  .gl-command-desc {
    font-size: 11px;
    color: var(--text-soft);
    margin: 3px 0 0;
    line-height: 1.35;
  }

  .gl-command-input {
    width: auto;
    flex: 1 1 auto;
    min-width: 0;
    height: 32px;
    border: 1px solid var(--line-soft);
    border-radius: var(--radius-sm);
    background: var(--bg-canvas);
    color: var(--text-strong);
    padding: 0 10px;
    font-family: var(--font-mono);
    font-size: 11px;
    cursor: default;
    outline: none;
    transition: all var(--transition-fast);
  }

  .gl-command-input::placeholder {
    color: var(--text-soft);
  }

  .gl-command-input:focus {
    border-color: color-mix(in oklab, var(--accent), transparent 45%);
    background: var(--bg-surface);
  }

  .gl-command-input.is-recording {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px color-mix(in oklab, var(--accent), transparent 88%);
  }

  .gl-command-input-wrap {
    display: flex;
    gap: 8px;
    align-items: center;
    min-width: 0;
  }

  .gl-command-record {
    flex: 0 0 auto;
    min-width: 92px;
    height: 32px;
    border: 1px solid var(--line-soft);
    background: var(--bg-hover);
    color: var(--text-soft);
    border-radius: var(--radius-sm);
    font-size: 10px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 0 8px;
    white-space: nowrap;
    transition: all var(--transition-fast);
  }

  .gl-command-record:hover {
    border-color: var(--line-medium);
    color: var(--text-strong);
  }

  .gl-command-record.is-recording {
    color: var(--accent);
    border-color: color-mix(in oklab, var(--accent), transparent 55%);
    background: color-mix(in oklab, var(--accent), transparent 92%);
  }

  .gl-command-actions {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 12px 16px;
    border-top: 1px solid var(--line-soft);
    background: color-mix(in oklab, var(--bg-surface), transparent 35%);
  }

  .gl-command-error {
    margin: 2px 2px 0;
    color: var(--error);
    font-size: 11px;
  }

  @media (max-width: 880px) {
    .gl-command-row {
      grid-template-columns: 1fr;
    }

    .gl-command-input-wrap {
      width: 100%;
    }
  }
</style>
