<script lang="ts">
  import { onMount, type Snippet } from "svelte";
  import { ChevronDown } from "lucide-svelte";

  let {
    label,
    value,
    options = [],
    onSelect,
    align = "left",
    disabled = false,
    width,
    testId,
    class: className = "",
    full = false,
    icon,
  }: {
    label?: string;
    value?: any;
    options: { label: string; value: any; icon?: any }[];
    onSelect: (value: any) => void;
    align?: "left" | "right";
    disabled?: boolean;
    width?: string;
    testId?: string;
    class?: string;
    full?: boolean;
    icon?: any;
  } = $props();

  let isOpen = $state(false);
  let container = $state<HTMLDivElement | null>(null);

  function toggle() {
    if (disabled) return;
    isOpen = !isOpen;
  }

  function selectOption(val: any) {
    onSelect(val);
    isOpen = false;
  }

  function handleClickOutside(event: MouseEvent) {
    if (container && !container.contains(event.target as Node)) {
      isOpen = false;
    }
  }

  onMount(() => {
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  });

  let selectedLabel = $derived(
    options.find((o) => o.value === value)?.label || label || "Select...",
  );
</script>

<div
  class="gl-dropdown-container {className ?? ''}"
  class:is-full={full}
  bind:this={container}
  style={width ? `width: ${width};` : ""}
>
  <button
    type="button"
    class="gl-dropdown-trigger"
    class:is-open={isOpen}
    class:is-disabled={disabled}
    onclick={toggle}
    {disabled}
    style={full ? "width: 100%;" : ""}
    data-testid={testId}
  >
    <div class="flex items-center gap-2 min-w-0">
      {#if icon}
        {@const DropdownIcon = icon}
        <DropdownIcon size={12} class="opacity-40 flex-shrink-0" />
      {/if}
      <span class="truncate">{selectedLabel}</span>
    </div>
    <ChevronDown
      size={12}
      class="opacity-40 transition-transform flex-shrink-0"
      style={isOpen ? "transform: rotate(180deg);" : ""}
    />
  </button>

  {#if isOpen}
    <div
      class="gl-dropdown-menu animate-fade-in"
      class:align-right={align === "right"}
    >
      {#each options as option}
        <button
          type="button"
          class="gl-dropdown-item"
          class:is-selected={option.value === value}
          onclick={() => selectOption(option.value)}
        >
          {#if option.icon}
            {@const OptionIcon = option.icon}
            <OptionIcon size={12} />
          {/if}
          <span>{option.label}</span>
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .gl-dropdown-container {
    position: relative;
    display: inline-block;
  }

  .gl-dropdown-container.is-full {
    display: block;
    width: 100%;
  }

  .gl-dropdown-trigger {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px;
    height: 30px;
    background: var(--bg-surface);
    border: 1px solid var(--line-soft);
    border-radius: var(--radius-sm);
    font-size: 11px;
    font-weight: 500;
    color: var(--text-soft);
    cursor: pointer;
    transition: all var(--transition-fast);
    min-width: 60px;
    justify-content: space-between;
    box-sizing: border-box;
  }

  .gl-dropdown-trigger:hover:not(:disabled) {
    border-color: var(--line-medium);
    color: var(--text-strong);
    background: var(--bg-hover);
  }

  .gl-dropdown-trigger.is-open {
    border-color: var(--accent);
    background: var(--bg-surface);
    color: var(--text-strong);
    box-shadow: 0 0 0 1px color-mix(in oklab, var(--accent), transparent 85%);
  }

  .gl-dropdown-trigger.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .gl-dropdown-menu {
    position: absolute;
    top: 100%;
    margin-top: 4px;
    min-width: 100%;
    width: max-content;
    max-width: 300px;
    background: var(--bg-panel);
    border: 1px solid var(--line-medium);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    z-index: 1000;
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    backdrop-filter: blur(8px);
  }

  .gl-dropdown-menu.align-right {
    right: 0;
  }

  .gl-dropdown-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 10px;
    border: none;
    background: transparent;
    color: var(--text-soft);
    font-size: 12px;
    font-weight: 500;
    text-align: left;
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: all var(--transition-fast);
  }

  .gl-dropdown-item:hover {
    background: var(--bg-hover);
    color: var(--text-strong);
  }

  .gl-dropdown-item.is-selected {
    background: color-mix(in oklab, var(--accent), transparent 90%);
    color: var(--accent);
  }

  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fade-in {
    animation: fade-in 0.15s ease-out;
  }
</style>
