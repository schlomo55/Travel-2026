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
  .toast {
    background: var(--ink);
    color: var(--paper);
    border-radius: 12px;
    padding: 11px 17px;
    font-size: 13.5px;
    font-weight: 600;
    box-shadow: 0 6px 22px rgba(0, 0, 0, 0.35);
    display: flex;
    gap: 14px;
    align-items: center;
    max-width: 92vw;
  }
  .toast-action {
    background: none;
    border: none;
    color: var(--paper);
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
    font-size: 12px;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
</style>
