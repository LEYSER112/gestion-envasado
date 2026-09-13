/**
 * Genera un aviso sonoro simple con la Web Audio API — no depende de ningún
 * archivo de audio externo. Los navegadores exigen una interacción del
 * usuario (un toque/clic) antes de permitir sonido, así que este componente
 * expone `activar()` para llamarlo desde un botón, y `reproducirAviso()`
 * para usarlo después, incluso dentro de un setInterval automático.
 */
const Sonido = (() => {
  let contexto = null;
  let activado = false;

  function activar() {
    if (!contexto) {
      const AudioContextRef = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextRef) return false;
      contexto = new AudioContextRef();
    }
    if (contexto.state === 'suspended') contexto.resume();
    activado = true;
    return true;
  }

  function estaActivado() {
    return activado && contexto && contexto.state === 'running';
  }

  function reproducirAviso() {
    if (!estaActivado()) return;

    const ahora = contexto.currentTime;
    [880, 1180].forEach((frecuencia, i) => {
      const osc = contexto.createOscillator();
      const ganancia = contexto.createGain();
      osc.type = 'sine';
      osc.frequency.value = frecuencia;
      const inicio = ahora + i * 0.16;
      ganancia.gain.setValueAtTime(0.0001, inicio);
      ganancia.gain.exponentialRampToValueAtTime(0.22, inicio + 0.02);
      ganancia.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.28);
      osc.connect(ganancia);
      ganancia.connect(contexto.destination);
      osc.start(inicio);
      osc.stop(inicio + 0.3);
    });
  }

  return { activar, estaActivado, reproducirAviso };
})();
