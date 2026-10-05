
class MBRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.on = false; this.size = 2048; this.buf = new Float32Array(this.size); this.n = 0; this.first = 0;
    this.port.onmessage = (e) => {
      if (e.data === 'start') { this.on = true; this.n = 0; }
      else if (e.data === 'stop') { this.flush(); this.on = false; this.port.postMessage({ done: true }); }
    };
  }
  flush() {
    if (this.n === 0) return;
    const data = this.buf.slice(0, this.n);
    this.port.postMessage({ frame: this.first, data }, [data.buffer]);
    this.n = 0;
  }
  process(inputs) {
    const input = inputs[0];
    if (this.on && input && input.length > 0) {
      const a = input[0], b = input.length > 1 ? input[1] : null;
      for (let i = 0; i < a.length; i++) {
        if (this.n === 0) this.first = currentFrame + i;
        this.buf[this.n++] = b ? (a[i] + b[i]) * 0.5 : a[i];
        if (this.n === this.size) this.flush();
      }
    }
    return true;
  }
}
registerProcessor('mb-recorder', MBRecorder);
