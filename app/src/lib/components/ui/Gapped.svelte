<script lang="ts">
  /* A phrase with "___" in it — a gap to fill in by hand (a medicine's name,
     a time) — drawn as a gap, a ruled space a finger can point at, and read
     as "blank". The text is otherwise printed exactly as written. */
  import { S } from '../../i18n/strings';
  let { text }: { text: string } = $props();
</script>

{#each text.split(/_{3,}/) as part, i (i)}{#if i}<span class="gap"><span class="sr-only">{S.driver.blank}</span></span>{/if}{part}{/each}

<style>
  .gap {
    display: inline-block;
    min-width: 3em;
    margin: 0 0.15em;
    border-bottom: 2px solid currentColor;
    vertical-align: baseline;
    opacity: 0.7;
  }
</style>
