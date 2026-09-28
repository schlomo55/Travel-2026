<script lang="ts">
  /* A sub-screen's header (f-pass, f-settings): a round ‹ that goes back the
     way you came (or up, if you arrived by a link), the screen's name with
     where it lives under it, and a right-hand slot the pass board leaves
     empty — here it carries the edit switch, so a Pocket sub-screen can be
     edited without the trip bar. */
  import { editMode } from '../../state/editMode.svelte';
  import { router } from '../../state/router.svelte';
  import { S } from '../../i18n/strings';
  import Icon from './Icon.svelte';

  let {
    title,
    subtitle,
    up,
    backLabel,
    editable = false,
  }: {
    title: string;
    subtitle?: string;
    /** Where ‹ goes when there is nothing behind it in this session. */
    up: string;
    backLabel: string;
    /** Show the edit switch in the right-hand slot. */
    editable?: boolean;
  } = $props();
</script>

<header class="subhead">
  <button class="iconbtn back" onclick={() => router.backOr(up)} aria-label={backLabel}>
    <Icon name="chevron-left" size={20} />
  </button>
  <div class="sh-title">
    <h1 class="display sh-name">{title}</h1>
    {#if subtitle}<span class="sh-sub">{subtitle}</span>{/if}
  </div>
  {#if editable}
    <button
      class="iconbtn editmode"
      class:on={editMode.on}
      onclick={() => editMode.toggle()}
      aria-pressed={editMode.on}
      aria-label={editMode.on ? S.edit.turnOff : S.edit.turnOn}
    >
      <Icon name={editMode.on ? 'check' : 'edit'} size={18} />
    </button>
  {:else}
    <span class="sh-spacer" aria-hidden="true"></span>
  {/if}
</header>

<style>
  .subhead {
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 480px;
    margin: 0 auto;
    padding: calc(16px + env(safe-area-inset-top)) var(--gutter) 8px;
  }
  .sh-title {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    text-align: center;
  }
  .sh-name {
    margin: 0;
    font-size: var(--fs-card-title);
    font-weight: 600;
    line-height: 1.2;
    letter-spacing: -0.01em;
    max-width: 100%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sh-sub {
    font-size: var(--fs-chip);
    color: var(--ink-2);
  }
  .sh-spacer {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
  }
  .editmode.on {
    background: var(--sunrise-fill);
    border-color: var(--sunrise-fill);
    color: var(--on-sunrise);
  }
</style>
