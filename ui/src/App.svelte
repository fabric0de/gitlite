<script lang="ts">
  import { onMount } from 'svelte';
  import AppShell from './lib/components/layout/AppShell.svelte';
  import { uiState } from './lib/stores/ui';

  onMount(() => {
    void uiState.init();
  });
</script>

<AppShell />
