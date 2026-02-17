<script lang="ts">
  import { flip } from "svelte/animate";
  import type { Toast } from "../../types/ui";
  import ToastItem from "./Toast.svelte";

  let {
    toasts,
    onRemoveToast,
  }: { toasts: Toast[]; onRemoveToast: (id: string) => void } = $props();
</script>

<div class="gl-toast-container">
  {#each toasts as toast (toast.id)}
    <div animate:flip={{ duration: 300 }}>
      <ToastItem {toast} onRemove={onRemoveToast} />
    </div>
  {/each}
</div>

<style>
  .gl-toast-container {
    position: fixed;
    top: 24px;
    right: 24px;
    z-index: 9999;
    display: flex;
    flex-direction: column;
    gap: 12px;
    pointer-events: none; /* Allow clicks to pass through gaps */
  }
</style>
