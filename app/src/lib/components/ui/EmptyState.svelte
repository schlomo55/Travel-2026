<script lang="ts">
  /* The one shape an absence takes (plan §PHASES Phase 2).

     Every screen in the app can be empty — a trip imported shallow, a list not
     started, a vault with nothing in it. An empty screen must never read as a
     bug or as a zero. It borrows the shelf's "Start a New Trip" card verbatim:
     dashed border, a gold-ringed glyph, a Fraunces line, one sentence that says
     what would fill it, and — where the screen can actually do something about
     it — a button that does it.

     The copy lives in strings.ts (§RITUALS); this component only draws it. */
  let {
    glyph = '＋',
    title,
    body,
    actionLabel,
    onaction,
    altLabel,
    onalt,
    compact = false,
  }: {
    /** One character. Content emoji are allowed here — nothing is invented. */
    glyph?: string;
    title: string;
    body: string;
    /** Omitted when the screen has no honest action to offer. */
    actionLabel?: string;
    onaction?: () => void;
    altLabel?: string;
    onalt?: () => void;
    /** Inline inside a section rather than filling a screen. */
    compact?: boolean;
  } = $props();
</script>

<div class="empty u-rise" class:compact>
  <span class="glyph" aria-hidden="true">{glyph}</span>
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
    gap: 9px;
    border: 2px dashed var(--line-2);
    border-radius: var(--radius);
    padding: 26px 20px 22px;
    margin-bottom: 13px;
    background: none;
  }
  .empty.compact {
    padding: 18px 16px 16px;
    gap: 7px;
  }
  .glyph {
    width: 40px;
    height: 40px;
    border: 2px solid var(--gold);
    border-radius: 50%;
    display: grid;
    place-items: center;
    color: var(--gold);
    font-size: var(--text-lg);
    line-height: 1;
    box-shadow: 0 0 16px rgba(232, 176, 75, 0.22);
  }
  .compact .glyph {
    width: 34px;
    height: 34px;
    font-size: var(--text-base);
  }
  .ttl {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: var(--text-lg);
    line-height: 1.25;
  }
  .compact .ttl {
    font-size: var(--text-base);
  }
  .body {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.55;
    color: var(--ink-2);
    max-width: 34ch;
  }
  .act {
    margin-top: 5px;
    min-width: 60%;
  }
</style>
