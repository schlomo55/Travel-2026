<script lang="ts">
  /* BUILD MAP FOR THIS TRIP (7 Nov 2026) — Settings' Map pack group and the
     Map tab's empty state share this one control, as they share the import
     (PackImport.svelte). In the Android app: the button, then the confirm
     sheet (BuildConfirm.svelte), then the build's progress and Cancel — or a
     paused build's Carry on / Discard — and why one stopped, in words true of
     what is left on the phone. In a browser it cannot work (build.protomaps.com
     refuses a web page's request; the app asks Android's own HTTP): one line
     says so instead of a button.

     The build is the app's one job (lib/map/build/builder.svelte.ts): leave
     mid-build and come back, and this shows it still under way; whichever
     screen is open when it lands takes the new pack up (`onbuilt`). */
  import { untrack } from 'svelte';
  import type { PackInfo } from '../../map/pack';
  import { mapBuilder } from '../../map/build/builder.svelte';
  import { packImporter } from '../../map/packImport.svelte';
  import { isNative } from '../../platform/files';
  import { SB } from '../../i18n/mapbuild';
  import Icon from '../horizon/Icon.svelte';
  import Sheet from '../ui/Sheet.svelte';
  import BuildConfirm from './BuildConfirm.svelte';

  let {
    trip,
    onbuilt,
  }: {
    /** the trip whose map to build — the one open, or Settings' "this trip" */
    trip: { id: string; title: string } | null;
    onbuilt?: (info: PackInfo) => void;
  } = $props();

  const native = isNative();
  const b = mapBuilder;
  /* a pack that landed before this control was drawn is not news to it */
  let seen = untrack(() => b.landed?.n ?? 0);
  $effect(() => {
    const l = b.landed;
    if (!l || l.n <= seen) return;
    seen = l.n;
    untrack(() => onbuilt?.(l.info));
  });
  $effect(() => {
    if (native) void b.look();
  });
  const words = $derived(b.step === 'check' ? SB.checking : b.step === 'index' && b.phase === 'running' && b.pct === 0 ? SB.planningIndex : SB.building(b.pct));
</script>

{#if !native}
  <p class="bm-web">{SB.webOnly}</p>
{:else}
  <div class="bm">
    {#if b.phase === 'running'}
      <div class="bm-progress" role="status">
        <span class="bm-bar" aria-hidden="true"><span style="width:{b.pct}%"></span></span>
        <span class="num">{words}</span>
      </div>
      {#if b.step !== 'check'}<button class="btn ghost bm-act" onclick={() => b.cancel()}>{SB.cancel}</button>{/if}
    {:else if b.phase === 'paused'}
      <p class="bm-line num">{SB.paused(b.pct)}</p>
      <div class="bm-row">
        <button class="btn primary bm-act" onclick={() => void b.resume()}>{SB.resume}</button>
        <button class="btn ghost bm-act" onclick={() => void b.discard()}>{SB.discard}</button>
      </div>
    {:else}
      <button
        class="bm-go"
        disabled={!trip || b.phase === 'planning' || packImporter.busy}
        aria-busy={b.phase === 'planning'}
        aria-label={trip ? SB.buildAria(trip.title) : SB.build}
        onclick={() => trip && void b.start(trip)}
      >
        <Icon name="map" size={18} stroke={2} />
        <span class="bm-label">{b.phase === 'planning' ? SB.planning : SB.build}</span>
      </button>
      {#if b.phase === 'planning'}<button class="btn ghost bm-act" onclick={() => b.cancel()}>{SB.cancel}</button>{/if}
    {/if}
    {#if b.problem}<p class="bm-problem" role="alert"><Icon name="alert" size={16} /> {b.problem}</p>{/if}
  </div>
  {#if b.phase === 'confirm' && b.view}
    <Sheet title={SB.confirmTitle(b.view.title)} onclose={() => b.dismiss()}>
      <BuildConfirm view={b.view} onconfirm={() => void b.confirm()} oncancel={() => b.dismiss()} />
    </Sheet>
  {/if}
{/if}

<style>
  .bm {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .bm-web,
  .bm-line {
    margin: 0;
    font-size: var(--fs-caption);
    line-height: 1.45;
    color: var(--ink-2);
  }
  .bm-go {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    width: 100%;
    min-height: 44px;
    padding: 10px 18px;
    border-radius: var(--radius-pill);
    background: var(--card-2);
    border: 1px solid var(--edge);
    color: var(--ink);
    font-size: var(--fs-label);
    font-weight: 600;
    white-space: nowrap;
  }
  .bm-go:disabled {
    opacity: 0.55;
  }
  .bm-go:focus-visible {
    outline: 2px solid var(--sunrise);
    outline-offset: 3px;
  }
  .bm-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .bm-row {
    display: flex;
    gap: 10px;
  }
  .bm-act {
    min-height: 44px;
    padding: 0 16px;
    font-size: var(--fs-label);
  }
  .bm-progress {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: var(--fs-caption);
    color: var(--ink-2);
  }
  .bm-bar {
    display: block;
    height: 4px;
    border-radius: 2px;
    background: var(--card-2);
    overflow: hidden;
  }
  .bm-bar span {
    display: block;
    height: 100%;
    background: var(--sunrise-fill);
  }
  .bm-problem {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin: 0;
    font-size: var(--fs-caption);
    line-height: 1.45;
    color: var(--warn-ink);
  }
</style>
