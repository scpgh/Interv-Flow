class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    // sampleRate is a global variable inside the AudioWorklet scope (e.g. 48000)
    this.fromRate = sampleRate;
    this.toRate = 16000;
    this.ratio = this.fromRate / this.toRate;
    this.lastSample = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0]; // Left channel / Mono
      
      // 1. Resample to 16kHz
      const resampled = this.resample(channelData);
      
      // 2. Convert to 16-bit signed integer PCM
      const pcm = this.floatTo16BitPCM(resampled);
      
      // 3. Post back to main thread
      this.port.postMessage({
        event: 'audio_chunk',
        pcm: pcm
      }, [pcm]);
    }
    return true;
  }

  resample(inputBuffer) {
    const outputLength = Math.round(inputBuffer.length / this.ratio);
    const outputBuffer = new Float32Array(outputLength);
    for (let i = 0; i < outputLength; i++) {
      const position = i * this.ratio;
      const index = Math.floor(position);
      const fraction = position - index;
      const sample1 = inputBuffer[index];
      const sample2 = index + 1 < inputBuffer.length ? inputBuffer[index + 1] : sample1;
      outputBuffer[i] = sample1 + fraction * (sample2 - sample1);
    }
    return outputBuffer;
  }

  floatTo16BitPCM(floatBuffer) {
    const buffer = new ArrayBuffer(floatBuffer.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < floatBuffer.length; i++) {
      const s = Math.max(-1.0, Math.min(1.0, floatBuffer[i]));
      const val = s < 0 ? s * 0x8000 : s * 0x7FFF;
      view.setInt16(i * 2, val, true); // Little endian
    }
    return buffer;
  }
}

registerProcessor('audio-processor', AudioProcessor);
