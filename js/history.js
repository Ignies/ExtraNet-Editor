// Undo and redo: snapshots of the package's text (site settings, pages, attributions). Images are not part of
// the history; deleting one is confirmed instead.

export class History {
  constructor(limit = 200) {
    this.limit = limit;
    this.past = [];
    this.future = [];
    this.current = null;
  }

  /** Records a state. Returns false when it is the same as the last one. */
  record(state) {
    const json = JSON.stringify(state);
    if (json === this.current) return false;
    if (this.current !== null) {
      this.past.push(this.current);
      if (this.past.length > this.limit) this.past.shift();
    }
    this.current = json;
    this.future = [];
    return true;
  }

  /** Starts over from a state, e.g. after opening another package. */
  reset(state) {
    this.past = [];
    this.future = [];
    this.current = JSON.stringify(state);
  }

  undo() {
    if (!this.past.length) return null;
    this.future.push(this.current);
    this.current = this.past.pop();
    return JSON.parse(this.current);
  }

  redo() {
    if (!this.future.length) return null;
    this.past.push(this.current);
    this.current = this.future.pop();
    return JSON.parse(this.current);
  }

  get canUndo() {
    return this.past.length > 0;
  }

  get canRedo() {
    return this.future.length > 0;
  }
}
