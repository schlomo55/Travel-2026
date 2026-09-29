<script lang="ts">
  /* Snow on the Today hero, and nothing else.

     Three sheets of radial-gradient dots translated downwards — compositor-only,
     no JS loop, no per-flake elements. It is hard-gated twice: the caller only
     mounts it when today's forecast is actually a snow code, and this component
     refuses to render at all under prefers-reduced-motion. The global
     reduced-motion kill switch in app.css sits underneath as a third net.
     Scrolled off the screen it stands still (lib/motion/offscreen.ts). */
  import { offscreen } from '../../motion/offscreen';

  let show = $state(false);

  $effect(() => {
    try {
      show = window.matchMedia('(prefers-reduced-motion: no-preference)').matches;
    } catch {
      show = false;
    }
  });
</script>

{#if show}
  <span class="snow" aria-hidden="true" use:offscreen>
    <i class="a"></i>
    <i class="b"></i>
    <i class="c"></i>
  </span>
{/if}

<style>
  .snow {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
  }
  .snow i {
    position: absolute;
    left: 0;
    right: 0;
    top: -100%;
    height: 200%;
    display: block;
    will-change: transform;
    animation: snowfall linear infinite;
  }
  .a {
    background-image:
      radial-gradient(1.6px 1.6px at 18px 22px, rgba(255, 255, 255, 0.9), transparent),
      radial-gradient(1.4px 1.4px at 96px 64px, rgba(255, 255, 255, 0.75), transparent),
      radial-gradient(1.8px 1.8px at 150px 12px, rgba(255, 255, 255, 0.85), transparent);
    background-size: 180px 180px;
    animation-duration: 24s;
  }
  .b {
    background-image:
      radial-gradient(1.2px 1.2px at 52px 44px, rgba(255, 255, 255, 0.6), transparent),
      radial-gradient(1px 1px at 130px 96px, rgba(255, 255, 255, 0.55), transparent),
      radial-gradient(1.3px 1.3px at 8px 130px, rgba(255, 255, 255, 0.6), transparent);
    background-size: 150px 150px;
    animation-duration: 31s;
    animation-delay: -7s;
  }
  .c {
    background-image:
      radial-gradient(2.4px 2.4px at 70px 10px, rgba(255, 255, 255, 0.5), transparent),
      radial-gradient(2.2px 2.2px at 200px 120px, rgba(255, 255, 255, 0.42), transparent);
    background-size: 240px 240px;
    animation-duration: 18s;
    animation-delay: -3s;
  }
  @keyframes snowfall {
    from {
      transform: translateY(-50%);
    }
    to {
      transform: translateY(0);
    }
  }
</style>
