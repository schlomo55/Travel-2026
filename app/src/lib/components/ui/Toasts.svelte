<script lang="ts">
  import { toast } from '../../state/toast.svelte';
</script>

<div class="toasts" role="status" aria-live="polite">
  {#each toast.list as t (t.id)}
    <div class="toast">
      <span>{t.msg}</span>
      {#if t.action}
        <button
          class="toast-action"
          onclick={() => {
            t.action?.fn();
            toast.dismiss(t.id);
          }}>{t.action.label}</button
        >
      {/if}
    </div>
  {/each}
</div>

<style>
  .toasts {
    position: fixed;
    left: 50%;
    transform: translateX(-50%);
    bottom: calc(var(--nav-h) + env(safe-area-inset-bottom) + 14px);
    z-index: 90;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    width: max-content;
    max-width: 92vw;
  }
  /* Lantern: the toast is a lit gold slip, dark ink on it (9.36:1). */
  .toast {
    background: var(--gold);
    color: var(--on-accent);
    border-radius: 12px;
    padding: 11px 17px;
    font-size: var(--text-sm);
    font-weight: 600;
    box-shadow: var(--glow-2);
    display: flex;
    gap: 14px;
    align-items: center;
    max-width: 92vw;
  }
  .toast-action {
    background: none;
    border: none;
    color: var(--on-accent);
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
    font-size: var(--text-sm);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
</style>
