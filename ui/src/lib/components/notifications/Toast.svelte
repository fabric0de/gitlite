<script lang="ts">
  import {
    X,
    Info,
    CheckCircle,
    AlertTriangle,
    AlertCircle,
  } from "lucide-svelte";
  import type { Toast } from "../../types/ui";

  let { toast, onRemove }: { toast: Toast; onRemove: (id: string) => void } =
    $props();

  function icon(type: Toast["type"]) {
    switch (type) {
      case "success":
        return CheckCircle;
      case "error":
        return AlertCircle;
      case "warning":
        return AlertTriangle;
      default:
        return Info;
    }
  }

  function colorClass(type: Toast["type"]) {
    switch (type) {
      case "success":
        return "is-success";
      case "error":
        return "is-error";
      case "warning":
        return "is-warning";
      default:
        return "is-info";
    }
  }

  const ToastIcon = $derived(icon(toast.type));
</script>

<div class="gl-toast {colorClass(toast.type)}" role="alert" aria-live="polite">
  <div class="gl-toast-icon">
    <ToastIcon size={18} />
  </div>
  <div class="gl-toast-content">
    {toast.message}
  </div>
  <button
    type="button"
    class="gl-toast-close"
    onclick={() => onRemove(toast.id)}
    aria-label="Close notification"
  >
    <X size={14} />
  </button>
</div>

<style>
  .gl-toast {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 16px;
    border-radius: var(--radius-md);
    background: var(--bg-surface);
    border: 1px solid var(--line-soft);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    min-width: 300px;
    max-width: 400px;
    animation: slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    pointer-events: auto;
  }

  .gl-toast.is-info {
    border-left: 3px solid var(--accent);
  }

  .gl-toast.is-success {
    border-left: 3px solid var(--success);
  }

  .gl-toast.is-error {
    border-left: 3px solid var(--error);
  }

  .gl-toast.is-warning {
    border-left: 3px solid var(--warning);
  }

  .gl-toast-icon {
    flex-shrink: 0;
    display: flex;
    padding-top: 2px;
  }

  .gl-toast.is-info .gl-toast-icon {
    color: var(--accent);
  }
  .gl-toast.is-success .gl-toast-icon {
    color: var(--success);
  }
  .gl-toast.is-error .gl-toast-icon {
    color: var(--error);
  }
  .gl-toast.is-warning .gl-toast-icon {
    color: var(--warning);
  }

  .gl-toast-content {
    flex: 1;
    font-size: 13px;
    line-height: 1.5;
    color: var(--text-strong);
    word-break: break-word;
  }

  .gl-toast-close {
    flex-shrink: 0;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0;
    display: flex;
    opacity: 0.6;
    transition: opacity 0.2s;
  }

  .gl-toast-close:hover {
    opacity: 1;
  }

  @keyframes slide-in {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
</style>
