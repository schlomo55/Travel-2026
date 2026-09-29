<script lang="ts">
  /* A DRIVER-CARD CHIP — "white = for other eyes", as a tile on the sky
     (f-pocket, Show the driver). The Chinese a stranger reads, large, and the
     English line under it. */
  let {
    native,
    english,
    label,
    onopen,
    disabled = false,
  }: {
    native: string;
    english: string;
    label: string;
    onopen: () => void;
    disabled?: boolean;
  } = $props();
</script>

<button class="paperchip" onclick={onopen} aria-label={label} {disabled}>
  <span class="pc-zh" lang="zh">{native}</span>
  <span class="pc-en">{english}</span>
</button>

<style>
  .paperchip {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 6px;
    min-width: 0;
    min-height: 96px;
    padding: 12px;
    border-radius: var(--radius-inner);
    text-align: left;
    color: var(--paper-chip-ink);
    background: var(--paper-chip);
    border: none;
    box-shadow:
      var(--paper-chip-lift),
      var(--paper-chip-edge);
  }
  .paperchip:disabled {
    opacity: 0.6;
  }
  .pc-zh {
    font-family: var(--font-zh);
    font-size: var(--fs-card-title);
    font-weight: 700;
    line-height: 1.22;
    letter-spacing: 0.02em;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    word-break: break-all;
  }
  .pc-en {
    font-size: var(--fs-chip);
    line-height: 1.25;
    color: var(--paper-chip-ink-2);
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }
</style>
