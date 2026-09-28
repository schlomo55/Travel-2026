<script lang="ts">
  import { toast } from '../../state/toast.svelte';
</script>

<!-- Above every layer — a "Copied ✓" must be seen from inside Counter mode
     too — and above the nav, one line, the sunrise slip with its dark ink. -->
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
    z-index: 120;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    width: max-content;
    max-width: 92vw;
    pointer-events: none;
  }
  .toast {
    display: flex;
    align-items: center;
    gap: 14px;
    max-width: 92vw;
    padding: 12px 18px;
    border-radius: 999px;
    font-size: var(--fs-caption);
    font-weight: 600;
    color: var(--on-sunrise);
    background: var(--sunrise-fill);
    box-shadow: var(--glow-sunrise);
    pointer-events: auto;
    animation: h-rise var(--motion) var(--ease-out) both;
  }
  .toast-action {
    min-height: 44px;
    margin: -12px -8px -12px 0;
    padding: 0 8px;
    background: none;
    border: none;
    color: var(--on-sunrise);
    font-size: var(--fs-caption);
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
</style>
