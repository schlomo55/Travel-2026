<script lang="ts">
  import { S } from '../../i18n/strings';

  let { module }: { module: string } = $props();
</script>

<section class="card" style="text-align:center; padding:28px 18px">
  <div class="routeline" aria-hidden="true" style="max-width:160px; margin:0 auto 14px"><i></i><i></i></div>
  <h2 style="margin:0 0 6px; font-size:var(--text-lg)">{S.stub.title(module)}</h2>
  <p class="muted" style="margin:0">{S.stub.body}</p>
</section>
