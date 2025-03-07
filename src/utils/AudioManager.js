// Single shared audio context and master gain node
let audioContext = null;
let masterGain = null;

// Initialize audio context
export function initializeAudio() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Create master gain node
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.5; // Set default volume
    masterGain.connect(audioContext.destination);
  }
  return audioContext;
}

// Get the shared audio context
export function getAudioContext() {
  if (!audioContext) {
    audioContext = initializeAudio();
  }
  return audioContext;
}

// Get the master gain node
export function getMasterGain() {
  if (!masterGain) {
    initializeAudio();
  }
  return masterGain;
}

// Set master volume
export function setVolume(value) {
  if (masterGain) {
    masterGain.gain.value = Math.max(0, Math.min(1, value));
  }
}

// Resume audio context (needed for browsers that suspend it)
export function resumeAudio() {
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume();
  }
} 