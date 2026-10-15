// Owns one cancellable calculation, including the asynchronous file-read interval.
// The factory is injectable so stale messages and delayed reads can be tested deterministically.
export class Calculation {
  constructor({ onBusy, onResult, onError, createWorker = () => new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }) }) {
    this.onBusy = onBusy; this.onResult = onResult; this.onError = onError;
    this.createWorker = createWorker; this.generation = 0; this.worker = null;
  }
  release() {
    this.worker?.terminate(); this.worker = null; this.onBusy(false);
  }
  begin() {
    this.worker?.terminate(); this.worker = null;
    const ticket = ++this.generation;
    this.onBusy(true);
    return ticket;
  }
  launch(ticket, payload) {
    if (ticket !== this.generation) return;
    try {
      this.worker = this.createWorker();
      this.worker.onmessage = event => {
        if (ticket !== this.generation) return;
        // Invalidate this ticket before invoking application callbacks.
        this.generation++; this.release();
        if (event.data.error) this.onError(event.data.error);
        else this.onResult(event.data.run, event.data.milliseconds, event.data.comparison);
      };
      this.worker.onerror = event => {
        event.preventDefault();
        this.fail(ticket, event.message || 'Calculation worker failed.');
      };
      this.worker.postMessage(payload);
    } catch (error) { this.fail(ticket, error.message); }
  }
  fail(ticket, message) {
    if (ticket !== this.generation) return;
    this.generation++; this.release(); this.onError(message);
  }
  cancel() {
    this.generation++; this.release();
  }
}
