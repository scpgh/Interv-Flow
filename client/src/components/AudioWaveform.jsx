import { useEffect, useRef } from 'react';

export default function AudioWaveform({ analyser, isActive, mode = 'listening' }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays
    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Buffer to hold frequency data
    const bufferLength = analyser ? analyser.frequencyBinCount : 64;
    const dataArray = new Uint8Array(bufferLength);

    let phase = 0;

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;

      // Clear with very slight fade for motion blur effect
      ctx.fillStyle = 'rgba(9, 9, 11, 0.2)';
      ctx.fillRect(0, 0, width, height);

      // Retrieve time domain audio data if active
      let amplitude = 0;
      if (analyser && isActive) {
        analyser.getByteTimeDomainData(dataArray);
        
        // Calculate average amplitude
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          const val = (dataArray[i] - 128) / 128;
          sum += val * val;
        }
        amplitude = Math.sqrt(sum / bufferLength);
      } else if (isActive && mode === 'speaking') {
        // Fallback simulation for speaking waves (creates natural speaking movement)
        amplitude = 0.12 + Math.sin(Date.now() / 120) * 0.06 + Math.cos(Date.now() / 200) * 0.03 + Math.random() * 0.02;
      }

      // If inactive, add a slight noise simulation to represent idle state
      if (!isActive) {
        amplitude = 0.01 + Math.sin(Date.now() / 400) * 0.005;
      }

      // Limit and smooth amplitude
      amplitude = Math.min(amplitude, 1.0);
      phase += 0.08;

      // Draw multi-layered sine waves
      const waveCount = 3;
      const colors = [
        'rgba(129, 140, 248, 0.4)', // Outer glowing wave (indigo)
        'rgba(99, 102, 241, 0.6)',  // Mid wave
        'rgba(79, 70, 229, 0.8)'    // Inner sharp wave (deep purple)
      ];

      if (mode === 'speaking') {
        // AI Speaking: Pinkish/Magenta glowing waves
        colors[0] = 'rgba(244, 63, 94, 0.3)';
        colors[1] = 'rgba(236, 72, 153, 0.5)';
        colors[2] = 'rgba(219, 39, 119, 0.8)';
      }

      for (let w = 0; w < waveCount; w++) {
        ctx.beginPath();
        ctx.lineWidth = w === waveCount - 1 ? 2.5 : 1.5;
        ctx.strokeStyle = colors[w];

        const scale = (w + 1) * 0.4;
        const speed = (w + 1) * 0.5;

        for (let x = 0; x < width; x++) {
          // Calculate coordinate
          const normX = x / width;
          // Apply windowing function (smooth ends)
          const windowMultiplier = Math.sin(normX * Math.PI);
          
          // Sine wave formula
          const freq = 4 + w * 2;
          const y = (height / 2) + 
            Math.sin(normX * Math.PI * freq + phase * speed) * 
            (amplitude * 80 * scale) * 
            windowMultiplier;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        
        ctx.shadowBlur = w === waveCount - 1 ? 15 : 0;
        ctx.shadowColor = colors[w];
        ctx.stroke();
      }
      ctx.shadowBlur = 0; // Reset
    };

    draw();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationRef.current);
    };
  }, [analyser, isActive, mode]);

  return (
    <div className="relative w-full h-32 overflow-hidden rounded-xl border border-white/5 bg-black/40">
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
}
