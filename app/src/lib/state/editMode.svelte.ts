/* Edit mode: reveals the ✎ / ＋ affordances. Off by default so a pass stays
   clean while it is being shown across a counter.

   It is shared state rather than a prop threaded through the shell, because
   the switch lives in more than one place under Horizon: the trip bar on a
   place's home, and the right-hand slot of a Pocket sub-screen's header (the
   slot the pass board leaves empty). Leaving a trip turns it off. */
class EditMode {
  on = $state(false);
  private tripId: string | null = null;

  toggle(): void {
    this.on = !this.on;
  }

  /** Called by the trip shell: a different trip starts out of edit mode. */
  enterTrip(tripId: string): void {
    if (this.tripId !== tripId) this.on = false;
    this.tripId = tripId;
  }
}

export const editMode = new EditMode();
