<script lang="ts">
  /* The one shape an absence takes. An empty screen must never read as a
     bug or as a zero: a dashed edge, a sunrise-ringed icon, one line that
     names what is missing, one sentence that says what would fill it, and —
     where the screen can actually do something about it — the button that
     does it. The copy lives in strings.ts; `glyph` is an icon name (Horizon:
     no emoji in the interface). */
  import Icon, { hasIcon } from '../horizon/Icon.svelte';

  let {
    glyph = 'plus',
    title,
    body,
    actionLabel,
    onaction,
    altLabel,
    onalt,
    compact = false,
  }: {
    glyph?: string;
    title: string;
    body: string;
    actionLabel?: string;
    onaction?: () => void;
    altLabel?: string;
    onalt?: () => void;
    compact?: boolean;
  } = $props();
</script>

<div class="empty u-rise" class:compact>
  <span class="glyph" aria-hidden="true"><Icon name={hasIcon(glyph) ? glyph : 'plus'} size={compact ? 18 : 22} /></span>
  <b class="ttl">{title}</b>
  <p class="body">{body}</p>
  {#if actionLabel && onaction}
    <button class="btn primary act" onclick={onaction}>{actionLabel}</button>
  {/if}
  {#if altLabel && onalt}
    <button class="btn ghost act" onclick={onalt}>{altLabel}</button>
  {/if}
</div>

<style>
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 10px;
    margin-bottom: 13px;
    padding: 26px 20px 22px;
    border: 1.5px dashed var(--edge);
    border-radius: var(--radius-tile);
    background: color-mix(in srgb, var(--card) 60%, transparent);
  }
  .empty.compact {
    gap: 8px;
    padding: 18px 16px 16px;
  }
  .glyph {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    color: var(--sunrise);
    background: var(--sunrise-soft);
    border: 1px solid color-mix(in srgb, var(--sunrise) 45%, transparent);
  }
  .compact .glyph {
    width: 36px;
    height: 36px;
  }
  .ttl {
    font-family: var(--font-display);
    font-size: var(--fs-card-title);
    font-weight: 600;
    letter-spacing: -0.01em;
    line-height: 1.25;
  }
  .body {
    margin: 0;
    max-width: 36ch;
    font-size: var(--fs-caption);
    line-height: 1.55;
    color: var(--ink-2);
  }
  .act {
    min-width: 60%;
    margin-top: 4px;
  }
</style>
