// Audio context and master gain node
let audioContext;
let masterGain;

// Sound buffers
const soundBuffers = new Map();

// Initialize audio system
export function initializeAudio() {
  // Create audio context on user interaction
  audioContext = new (window.AudioContext || window.webkitAudioContext)();

  // Create master gain node
  masterGain = audioContext.createGain();
  masterGain.gain.value = 0.5; // Set default volume
  masterGain.connect(audioContext.destination);

  // Load sound effects
  loadSoundEffects();
}

// Load all sound effects
async function loadSoundEffects() {
  const sounds = {
    'pistol': 'sounds/pistol.mp3',
    'gatling': 'sounds/gatling.mp3',
    'sniper': 'sounds/sniper.mp3',
    'bazooka': 'sounds/bazooka.mp3',
    'explosion': 'sounds/explosion.mp3',
    'hit': 'sounds/hit.mp3',
    'jump': 'sounds/jump.mp3',
    'hurt': 'sounds/hurt.mp3'
  };

  for (const [name, url] of Object.entries(sounds)) {
    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      soundBuffers.set(name, audioBuffer);
    } catch (error) {
      console.warn(`Failed to load sound: ${name}`, error);
    }
  }
}

// Play a sound effect
export function playSound(name, options = {}) {
  if (!audioContext || !soundBuffers.has(name)) return;

  const buffer = soundBuffers.get(name);
  const source = audioContext.createBufferSource();
  source.buffer = buffer;

  // Create gain node for this sound
  const gainNode = audioContext.createGain();
  gainNode.gain.value = options.volume || 1;

  // Connect nodes
  source.connect(gainNode);
  gainNode.connect(masterGain);

  // Play sound with options
  source.playbackRate.value = options.playbackRate || 1;
  source.loop = options.loop || false;
  source.start(0);

  return source;
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