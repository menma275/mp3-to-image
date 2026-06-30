/**
 * mp3-to-image // Glitch Format Converter Logic
 * Sakamura Design Aesthetic Implementation
 */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  lucide.createIcons();

  // Mode Selection / Tabs
  const tabMp3 = document.getElementById('tabMp3ToImage');
  const tabImg = document.getElementById('tabImageToMp3');
  const panelMp3 = document.getElementById('mp3ToImagePanel');
  const panelImg = document.getElementById('imageToMp3Panel');

  let activeTab = 'mp3'; // 'mp3' or 'image'

  tabMp3.addEventListener('click', () => {
    activeTab = 'mp3';
    tabMp3.classList.add('btn-primary');
    tabImg.classList.remove('btn-primary');
    panelMp3.classList.remove('hidden');
    panelImg.classList.add('hidden');
    resetImageState();
    if (mp3State.originalBuffer) {
      renderCanvasFromMp3();
    } else {
      clearCanvas();
    }
  });

  tabImg.addEventListener('click', () => {
    activeTab = 'image';
    tabImg.classList.add('btn-primary');
    tabMp3.classList.remove('btn-primary');
    panelImg.classList.remove('hidden');
    panelMp3.classList.add('hidden');
    resetMp3State();
    if (imageState.imageElement) {
      renderCanvasFromImage();
    } else {
      clearCanvas();
    }
  });

  // Color Palette Generators
  function makeGlitchGoldPalette() {
    const palette = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
      if (i < 128) {
        const t = i / 128;
        palette[i * 3] = Math.floor(245 * t);     // R
        palette[i * 3 + 1] = Math.floor(177 * t); // G
        palette[i * 3 + 2] = Math.floor(17 * t);  // B
      } else {
        const t = (i - 128) / 128;
        palette[i * 3] = 245 + Math.floor((255 - 245) * t);
        palette[i * 3 + 1] = 177 + Math.floor((255 - 177) * t);
        palette[i * 3 + 2] = 17 + Math.floor((255 - 17) * t);
      }
    }
    return palette;
  }

  function makeCyberpunkPalette() {
    const palette = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
      if (i < 85) {
        const t = i / 85;
        palette[i * 3] = 26 + Math.floor((255 - 26) * t);
        palette[i * 3 + 1] = 0;
        palette[i * 3 + 2] = 51 + Math.floor((127 - 51) * t);
      } else if (i < 170) {
        const t = (i - 85) / 85;
        palette[i * 3] = 255 - Math.floor(255 * t);
        palette[i * 3 + 1] = Math.floor(240 * t);
        palette[i * 3 + 2] = 127 + Math.floor((255 - 127) * t);
      } else {
        const t = (i - 170) / 85;
        palette[i * 3] = Math.floor(255 * t);
        palette[i * 3 + 1] = 240;
        palette[i * 3 + 2] = 255 - Math.floor(255 * t);
      }
    }
    return palette;
  }

  function makeMonoPalette() {
    const palette = new Uint8Array(256 * 3);
    for (let i = 0; i < 256; i++) {
      const val = i < 64 ? 0 : i < 128 ? 85 : i < 192 ? 170 : 255;
      palette[i * 3] = val;
      palette[i * 3 + 1] = val;
      palette[i * 3 + 2] = val;
    }
    return palette;
  }

  function makeHazePalette() {
    const palette = new Uint8Array(256 * 3);
    const colors = [
      [191, 189, 184], // Muted Grey
      [191, 167, 122], // Tan
      [217, 172, 89],  // Muted Gold
      [217, 154, 37],  // Golden
      [242, 156, 107]  // Orange-Salmon
    ];
    for (let i = 0; i < 256; i++) {
      const segment = i / 64;
      const idx = Math.floor(segment);
      const t = segment - idx;
      if (idx >= 4) {
        palette[i * 3] = colors[4][0];
        palette[i * 3 + 1] = colors[4][1];
        palette[i * 3 + 2] = colors[4][2];
      } else {
        const c1 = colors[idx];
        const c2 = colors[idx + 1];
        palette[i * 3] = Math.floor(c1[0] + (c2[0] - c1[0]) * t);
        palette[i * 3 + 1] = Math.floor(c1[1] + (c2[1] - c1[1]) * t);
        palette[i * 3 + 2] = Math.floor(c1[2] + (c2[2] - c1[2]) * t);
      }
    }
    return palette;
  }

  const PALETTES = {
    glitch: makeGlitchGoldPalette(),
    cyber: makeCyberpunkPalette(),
    mono: makeMonoPalette(),
    haze: makeHazePalette()
  };

  // State Management Objects
  const mp3State = {
    fileName: '',
    originalBuffer: null, // ArrayBuffer
    glitchedBuffer: null, // ArrayBuffer
    id3Size: 0,
    estimatedFrames: 0,
    entropy: 0.0,
    glitchRatio: 0.0,
    duration: 0.0,
    startOffset: 0,
    endOffset: 0
  };

  const imageState = {
    fileName: '',
    imageElement: null, // Image
    width: 0,
    height: 0,
    fileSize: 0,
    pixelData: null // Uint8ClampedArray (RGBA)
  };

  let zoomLevel = 1.0;
  let audioCtx = null;
  let activeAudioNode = null;
  let isPlayingRaw = false;
  let isPlayingDecoded = false;

  // Playback seek engine state
  let isSeekPlaying = false;
  let seekDurationVal = 0.0;
  let seekStartTime = 0.0;
  let seekOffset = 0.0;
  let activeAudioBuffer = null;
  let playbackTimer = null;
  let currentPlayMode = 'mp3'; // 'mp3' or 'raw'

  // Setup Web Audio API Context lazily
  function initAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function stopAllAudioSourceOnly() {
    if (activeAudioNode) {
      try {
        activeAudioNode.stop();
      } catch (e) {}
      activeAudioNode = null;
    }
  }

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds === Infinity) return '00:00';
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function stopAllAudio() {
    stopAllAudioSourceOnly();
    isSeekPlaying = false;
    isPlayingRaw = false;
    isPlayingDecoded = false;
    seekOffset = 0;
    cancelAnimationFrame(playbackTimer);

    // Reset seek bar display
    const seekBar = document.getElementById('audioSeekBar');
    if (seekBar) {
      seekBar.value = 0;
    }
    const currentText = document.getElementById('seekCurrentTime');
    if (currentText) currentText.textContent = '00:00';

    // Reset timeline playhead
    const playhead = document.getElementById('timelinePlayhead');
    if (playhead) {
      playhead.style.display = 'none';
    }

    document.getElementById('playAudioBtn').innerHTML = '<i data-lucide="play"></i> <span>RAW 再生</span>';
    document.getElementById('playMp3Btn').innerHTML = '<i data-lucide="speaker"></i> <span>MP3 再生</span>';
    document.getElementById('audioStatus').textContent = 'STOPPED';

    const seekPlayBtn = document.getElementById('seekPlayBtn');
    if (seekPlayBtn) seekPlayBtn.innerHTML = '<i data-lucide="play"></i> <span>再生</span>';

    document.getElementById('playImgAudioBtn').innerHTML = '<i data-lucide="play"></i> <span>グリッチ音響を再生</span>';
    document.getElementById('imgAudioStatus').textContent = 'STOPPED';
    lucide.createIcons();
  }

  // File parsing tools
  function getID3Size(buffer) {
    const view = new DataView(buffer);
    if (buffer.byteLength > 10 &&
        view.getUint8(0) === 0x49 && // 'I'
        view.getUint8(1) === 0x44 && // 'D'
        view.getUint8(2) === 0x33) { // '3'
      const b1 = view.getUint8(6);
      const b2 = view.getUint8(7);
      const b3 = view.getUint8(8);
      const b4 = view.getUint8(9);
      const size = (b1 << 21) | (b2 << 14) | (b3 << 7) | b4;
      return size + 10; // 10 bytes header
    }
    return 0;
  }

  function estimateFrames(buffer, offset = 0) {
    const view = new DataView(buffer);
    let count = 0;
    for (let i = offset; i < buffer.byteLength - 1; i++) {
      if (view.getUint8(i) === 0xFF && (view.getUint8(i + 1) & 0xE0) === 0xE0) {
        count++;
        i += 400; // Skip approximate frame size to scan faster
      }
    }
    return count;
  }

  function calculateEntropy(buffer) {
    const u8 = new Uint8Array(buffer);
    const counts = new Uint32Array(256);
    const len = u8.length;
    for (let i = 0; i < len; i++) {
      counts[u8[i]]++;
    }
    let entropy = 0.0;
    for (let i = 0; i < 256; i++) {
      if (counts[i] > 0) {
        const p = counts[i] / len;
        entropy -= p * Math.log2(p);
      }
    }
    return entropy;
  }

  function drawWaveform(audioBuffer) {
    const canvas = document.getElementById('waveformCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    canvas.width = canvas.clientWidth || 600;
    canvas.height = canvas.clientHeight || 24;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    ctx.fillStyle = 'rgba(37, 37, 37, 0.2)';

    for (let i = 0; i < width; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const idx = i * step + j;
        if (idx >= data.length) break;
        const val = data[idx];
        if (val < min) min = val;
        if (val > max) max = val;
      }
      const y1 = (1 + min) * amp;
      const y2 = (1 + max) * amp;
      ctx.fillRect(i, y1, 1, Math.max(1, y2 - y1));
    }
  }

  function drawNoiseWaveform() {
    const canvas = document.getElementById('waveformCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    canvas.width = canvas.clientWidth || 600;
    canvas.height = canvas.clientHeight || 24;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(37, 37, 37, 0.15)';
    const amp = height / 2;

    for (let i = 0; i < width; i += 2) {
      const h = Math.random() * height * 0.7;
      ctx.fillRect(i, amp - h / 2, 2, Math.max(1, h));
    }
  }

  // ==========================================
  // MP3 ➔ IMAGE LOGIC
  // ==========================================

  // Select File Setup
  const mp3FileInput = document.getElementById('mp3FileInput');
  const selectMp3Btn = document.getElementById('selectMp3Btn');
  const mp3Dropzone = document.getElementById('mp3Dropzone');

  selectMp3Btn.addEventListener('click', () => mp3FileInput.click());
  mp3Dropzone.addEventListener('click', (e) => {
    if (e.target !== selectMp3Btn && e.target !== mp3FileInput) {
      mp3FileInput.click();
    }
  });

  // Drag and Drop
  mp3Dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    mp3Dropzone.classList.add('dragover');
  });

  mp3Dropzone.addEventListener('dragleave', () => {
    mp3Dropzone.classList.remove('dragover');
  });

  mp3Dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    mp3Dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleMp3File(e.dataTransfer.files[0]);
    }
  });

  mp3FileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleMp3File(e.target.files[0]);
    }
  });

  function handleMp3File(file) {
    if (!file || !file.name.toLowerCase().endsWith('.mp3')) {
      alert('有効なMP3ファイルを選択してください。');
      return;
    }
    stopAllAudio();
    mp3State.fileName = file.name;
    const reader = new FileReader();
    reader.onload = function(evt) {
      const buffer = evt.target.result;
      mp3State.originalBuffer = buffer;
      mp3State.glitchedBuffer = buffer.slice(0); // Clone
      mp3State.id3Size = getID3Size(buffer);
      mp3State.estimatedFrames = estimateFrames(buffer, mp3State.id3Size);
      mp3State.entropy = calculateEntropy(buffer);
      mp3State.glitchRatio = 0.0;
      mp3State.duration = buffer.byteLength / 16000; // default fallback (128kbps)

      // Background decode to get accurate duration
      const tempCtx = initAudioContext();
      tempCtx.decodeAudioData(buffer.slice(0))
        .then((decoded) => {
          mp3State.duration = decoded.duration;
          updateSeekLabelsWithRealTime();
          drawWaveform(decoded);
        })
        .catch(() => {
          updateSeekLabelsWithRealTime();
          drawNoiseWaveform();
        });

      // Initialize start and end offsets in state
      const maxOffset = buffer.byteLength;
      mp3State.startOffset = Math.min(mp3State.id3Size, maxOffset);
      mp3State.endOffset = maxOffset;

      // Show panels
      showMp3Panels();
      updateMp3HUD();
      updateSeekLabelsWithRealTime();
      applyGlitchPipeline();
    };
    reader.readAsArrayBuffer(file);
  }

  function showMp3Panels() {
    document.getElementById('mp3Dropzone').classList.add('hidden');
    document.getElementById('mp3FileStatus').classList.remove('hidden');
    document.getElementById('vizSettingsSec').classList.remove('hidden');
    document.getElementById('glitchSettingsSec').classList.remove('hidden');
    document.getElementById('audioSettingsSec').classList.remove('hidden');
    document.getElementById('exportSec').classList.remove('hidden');
    document.getElementById('audioSeekPanel').classList.remove('hidden');
  }

  function resetMp3State() {
    stopAllAudio();
    mp3State.originalBuffer = null;
    mp3State.glitchedBuffer = null;
    mp3State.fileName = '';
    mp3State.id3Size = 0;
    mp3State.estimatedFrames = 0;
    mp3State.entropy = 0;
    mp3State.glitchRatio = 0;
    mp3State.duration = 0;

    document.getElementById('mp3Dropzone').classList.remove('hidden');
    document.getElementById('mp3FileStatus').classList.add('hidden');
    document.getElementById('vizSettingsSec').classList.add('hidden');
    document.getElementById('glitchSettingsSec').classList.add('hidden');
    document.getElementById('audioSettingsSec').classList.add('hidden');
    document.getElementById('exportSec').classList.add('hidden');
    document.getElementById('audioSeekPanel').classList.add('hidden');

    // Reset glitch modifiers
    document.getElementById('glitchCorrupt').value = 0;
    document.getElementById('glitchCorruptVal').textContent = '0%';
    document.getElementById('glitchSort').value = 0;
    document.getElementById('glitchSortVal').textContent = '0%';
    document.getElementById('glitchXor').value = 0;
    document.getElementById('glitchXorVal').textContent = '0x00';

    // Reset aspect ratio
    const vizAspect = document.getElementById('vizAspect');
    if (vizAspect) vizAspect.value = 'free';
    const vizWidth = document.getElementById('vizWidth');
    const vizWidthNum = document.getElementById('vizWidthNum');
    if (vizWidth) vizWidth.disabled = false;
    if (vizWidthNum) vizWidthNum.disabled = false;

    // Clear waveform canvas
    const waveCanvas = document.getElementById('waveformCanvas');
    if (waveCanvas) {
      const ctx = waveCanvas.getContext('2d');
      ctx.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
    }
  }

  document.getElementById('resetMp3Btn').addEventListener('click', () => {
    resetMp3State();
    clearCanvas();
  });

  // Glitch Modifiers Pipeline
  function applyGlitchPipeline() {
    if (!mp3State.originalBuffer) return;

    // Read settings
    const corruptRate = parseFloat(document.getElementById('glitchCorrupt').value) / 100; // convert % to fraction
    const sortIntensity = parseInt(document.getElementById('glitchSort').value, 10);
    const xorMask = parseInt(document.getElementById('glitchXor').value, 10);

    const originalU8 = new Uint8Array(mp3State.originalBuffer);
    const glitchedU8 = new Uint8Array(originalU8.length);
    glitchedU8.set(originalU8); // Copy original

    // Skip ID3 tag to prevent header parsing crash in MP3 mode,
    // unless user specifies otherwise, let's keep metadata intact or let them glitch everything.
    // Generally, preserving the ID3 tags is nice, but glitching them makes beautiful cover glitches.
    // Let's preserve the first 10 bytes of ID3 always, then allow glitching the rest.
    const startIdx = mp3State.id3Size > 0 ? 10 : 0;
    let corruptedBytesCount = 0;

    // 1. Bitwise XOR
    if (xorMask > 0) {
      for (let i = startIdx; i < glitchedU8.length; i++) {
        glitchedU8[i] ^= xorMask;
        corruptedBytesCount++;
      }
    }

    // 2. Random Corruption
    if (corruptRate > 0) {
      const corruptCount = Math.floor(corruptRate * (glitchedU8.length - startIdx));
      for (let i = 0; i < corruptCount; i++) {
        const target = startIdx + Math.floor(Math.random() * (glitchedU8.length - startIdx));
        glitchedU8[target] = Math.floor(Math.random() * 256);
        corruptedBytesCount++;
      }
    }

    // 3. Byte Sorting
    if (sortIntensity > 0) {
      const len = glitchedU8.length - startIdx;
      // Sort blocks of random sizes
      const numBlocks = Math.floor((sortIntensity / 100) * (len / 1024));
      for (let i = 0; i < numBlocks; i++) {
        const blockSize = 256 + Math.floor(Math.random() * 2048);
        const start = startIdx + Math.floor(Math.random() * (len - blockSize));
        const sub = glitchedU8.subarray(start, start + blockSize);
        sub.sort();
        corruptedBytesCount += blockSize;
      }
    }

    mp3State.glitchedBuffer = glitchedU8.buffer;
    mp3State.glitchRatio = (corruptedBytesCount / originalU8.length) * 100;
    if (mp3State.glitchRatio > 100) mp3State.glitchRatio = 100.0;

    // Flash canvas wrapper for visual feedback
    const canvasWrap = document.querySelector('.canvas-wrapper');
    canvasWrap.classList.remove('glitch-flash');
    void canvasWrap.offsetWidth; // Trigger reflow
    canvasWrap.classList.add('glitch-flash');

    updateMp3HUD();
    renderCanvasFromMp3();
  }

  // Trigger buttons
  document.getElementById('applyGlitchBtn').addEventListener('click', applyGlitchPipeline);
  document.getElementById('clearGlitchBtn').addEventListener('click', () => {
    document.getElementById('glitchCorrupt').value = 0;
    document.getElementById('glitchCorruptVal').textContent = '0%';
    document.getElementById('glitchSort').value = 0;
    document.getElementById('glitchSortVal').textContent = '0%';
    document.getElementById('glitchXor').value = 0;
    document.getElementById('glitchXorVal').textContent = '0x00';
    applyGlitchPipeline();
  });

  // UI bindings for Sliders & Input Sync
  const vizWidth = document.getElementById('vizWidth');
  const vizWidthNum = document.getElementById('vizWidthNum');
  const vizWidthVal = document.getElementById('vizWidthVal');

  const vizStartOffsetVal = document.getElementById('vizStartOffsetVal');
  const vizEndOffsetVal = document.getElementById('vizEndOffsetVal');
  const timelineVisual = document.getElementById('timelineVisual');
  const timelineHandleLeft = document.getElementById('timelineHandleLeft');
  const timelineHandleRight = document.getElementById('timelineHandleRight');

  const glitchCorrupt = document.getElementById('glitchCorrupt');
  const glitchCorruptVal = document.getElementById('glitchCorruptVal');

  const glitchSort = document.getElementById('glitchSort');
  const glitchSortVal = document.getElementById('glitchSortVal');

  const glitchXor = document.getElementById('glitchXor');
  const glitchXorVal = document.getElementById('glitchXorVal');

  const vizAspect = document.getElementById('vizAspect');

  vizWidth.addEventListener('input', (e) => {
    vizWidthNum.value = e.target.value;
    vizWidthVal.textContent = e.target.value;
    renderCanvasFromMp3();
  });
  vizWidthNum.addEventListener('change', (e) => {
    vizWidth.value = e.target.value;
    vizWidthVal.textContent = e.target.value;
    renderCanvasFromMp3();
  });

  vizAspect.addEventListener('change', (e) => {
    const isFree = e.target.value === 'free';
    vizWidth.disabled = !isFree;
    vizWidthNum.disabled = !isFree;
    renderCanvasFromMp3();
  });

  function updateSeekLabelsWithRealTime() {
    if (!mp3State.originalBuffer) return;
    const len = mp3State.originalBuffer.byteLength;
    const start = mp3State.startOffset;
    const end = mp3State.endOffset;

    const d = mp3State.duration || (len / 16000);
    const startTime = (start / len) * d;
    const endTime = (end / len) * d;

    vizStartOffsetVal.textContent = `${start.toLocaleString()} bytes (${formatTime(startTime)})`;
    vizEndOffsetVal.textContent = `${end.toLocaleString()} bytes (${formatTime(endTime)})`;

    const pStart = ((start / len) * 100).toFixed(1);
    const pEnd = ((end / len) * 100).toFixed(1);
    const statusText = document.getElementById('seekStatusText');
    if (statusText) {
      statusText.textContent = `範囲: ${pStart}% - ${pEnd}% (${formatTime(endTime - startTime)})`;
    }

    // Update visual timeline highlight range
    const rangeHighlight = document.getElementById('timelineRangeHighlight');
    if (rangeHighlight) {
      rangeHighlight.style.left = `${(start / len) * 100}%`;
      rangeHighlight.style.right = `${100 - (end / len) * 100}%`;
    }

    // Also set seek duration label
    const seekDurationText = document.getElementById('seekDuration');
    if (seekDurationText) {
      seekDurationText.textContent = formatTime(endTime - startTime);
    }
  }

  // Unified Interactive Timeline dragging logic
  let dragMode = null; // 'left', 'right', 'playhead'

  if (timelineHandleLeft) {
    timelineHandleLeft.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      dragMode = 'left';
    });
    timelineHandleLeft.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      dragMode = 'left';
    }, { passive: true });
  }

  if (timelineHandleRight) {
    timelineHandleRight.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      dragMode = 'right';
    });
    timelineHandleRight.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      dragMode = 'right';
    }, { passive: true });
  }

  if (timelineVisual) {
    timelineVisual.addEventListener('mousedown', (e) => {
      dragMode = 'playhead';
      handleTimelineDrag(e);
    });
    timelineVisual.addEventListener('touchstart', (e) => {
      dragMode = 'playhead';
      handleTimelineDrag(e.touches[0]);
    }, { passive: true });
  }

  function handleTimelineDrag(clientXOrEvent) {
    if (!mp3State.originalBuffer) return;
    const clientX = typeof clientXOrEvent === 'object' && 'clientX' in clientXOrEvent ? clientXOrEvent.clientX : clientXOrEvent;

    const rect = timelineVisual.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const pct = x / rect.width;
    const len = mp3State.originalBuffer.byteLength;

    if (dragMode === 'left') {
      let val = Math.floor(pct * len);
      if (val > mp3State.endOffset) val = mp3State.endOffset;
      mp3State.startOffset = val;
      updateSeekLabelsWithRealTime();
      renderCanvasFromMp3();
    } else if (dragMode === 'right') {
      let val = Math.floor(pct * len);
      if (val < mp3State.startOffset) val = mp3State.startOffset;
      mp3State.endOffset = val;
      updateSeekLabelsWithRealTime();
      renderCanvasFromMp3();
    } else if (dragMode === 'playhead') {
      const start = mp3State.startOffset;
      const end = mp3State.endOffset;
      const currentByte = pct * len;

      if (currentByte >= start && currentByte <= end) {
        const rangeLen = end - start;
        const rangePct = rangeLen > 0 ? (currentByte - start) / rangeLen : 0;
        const targetTime = rangePct * seekDurationVal;

        if (isSeekPlaying) {
          startPlayback(targetTime);
        } else {
          seekOffset = targetTime;
          const seekCurText = document.getElementById('seekCurrentTime');
          if (seekCurText) seekCurText.textContent = formatTime(targetTime);
          const seekBar = document.getElementById('audioSeekBar');
          if (seekBar) seekBar.value = targetTime;

          const playhead = document.getElementById('timelinePlayhead');
          if (playhead) {
            playhead.style.left = `${pct * 100}%`;
            playhead.style.display = 'block';
          }
        }
      }
    }
  }

  document.addEventListener('mousemove', (e) => {
    if (!dragMode) return;
    handleTimelineDrag(e);
  });

  document.addEventListener('touchmove', (e) => {
    if (!dragMode) return;
    handleTimelineDrag(e.touches[0]);
  }, { passive: false });

  document.addEventListener('mouseup', () => {
    dragMode = null;
  });

  document.addEventListener('touchend', () => {
    dragMode = null;
  });

  glitchCorrupt.addEventListener('input', (e) => {
    glitchCorruptVal.textContent = e.target.value + '%';
  });
  glitchCorrupt.addEventListener('change', applyGlitchPipeline);

  glitchSort.addEventListener('input', (e) => {
    glitchSortVal.textContent = e.target.value + '%';
  });
  glitchSort.addEventListener('change', applyGlitchPipeline);

  glitchXor.addEventListener('input', (e) => {
    glitchXorVal.textContent = '0x' + parseInt(e.target.value, 10).toString(16).toUpperCase().padStart(2, '0');
  });
  glitchXor.addEventListener('change', applyGlitchPipeline);

  document.getElementById('vizFormat').addEventListener('change', renderCanvasFromMp3);
  document.getElementById('vizPalette').addEventListener('change', renderCanvasFromMp3);
  document.getElementById('vizSkip').addEventListener('change', renderCanvasFromMp3);
  document.getElementById('vizChannels').addEventListener('change', renderCanvasFromMp3);

  // Render MP3 function
  function renderCanvasFromMp3() {
    if (!mp3State.glitchedBuffer) return;

    const dataBytes = new Uint8Array(mp3State.glitchedBuffer);
    const canvas = document.getElementById('glitchCanvas');
    const ctx = canvas.getContext('2d');

    const aspect = vizAspect.value;
    const startOffset = mp3State.startOffset;
    const endOffset = mp3State.endOffset;
    const format = document.getElementById('vizFormat').value;
    const paletteName = document.getElementById('vizPalette').value;
    const skip = parseInt(document.getElementById('vizSkip').value, 10) || 0;
    const channelOrder = document.getElementById('vizChannels').value;

    let bytesPerPixel = 1;
    if (format === 'rgb') bytesPerPixel = 3;
    if (format === 'rgba') bytesPerPixel = 4;
    if (format === 'rgb16') bytesPerPixel = 2;

    const stride = bytesPerPixel + skip;
    const availableBytes = Math.max(0, endOffset - startOffset);
    const numPixels = Math.floor(availableBytes / stride);

    // Limit canvas size to avoid crashing browser (max 1.5 million pixels)
    const maxPixels = 1500000;
    const limitedPixels = Math.min(numPixels, maxPixels);

    let width = parseInt(vizWidth.value, 10);
    let height = Math.max(1, Math.ceil(limitedPixels / width));

    if (aspect !== 'free') {
      let r = 1.0;
      if (aspect === '1:1') r = 1.0;
      else if (aspect === '16:9') r = 16 / 9;
      else if (aspect === '4:3') r = 4 / 3;
      else if (aspect === '3:2') r = 3 / 2;
      else if (aspect === '21:9') r = 21 / 9;

      // W = round(sqrt(N * r))
      width = Math.round(Math.sqrt(limitedPixels * r));
      width = Math.max(16, Math.min(4096, width));
      height = Math.max(1, Math.round(width / r));

      // Sync inputs visually
      vizWidth.value = width;
      vizWidthNum.value = width;
      vizWidthVal.textContent = width;
    }

    canvas.width = width;
    canvas.height = height;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    // Fill alpha to 255 by default
    for (let i = 3; i < data.length; i += 4) {
      data[i] = 255;
    }

    const lut = PALETTES[paletteName]; // color mapping table
    let byteIdx = startOffset;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (byteIdx + bytesPerPixel > endOffset) break;

        const outIdx = (y * width + x) * 4;
        let r = 0, g = 0, b = 0, a = 255;

        if (format === 'grayscale') {
          const val = dataBytes[byteIdx];
          if (lut) {
            r = lut[val * 3];
            g = lut[val * 3 + 1];
            b = lut[val * 3 + 2];
          } else {
            r = g = b = val;
          }
        } else if (format === 'rgb') {
          const b0 = dataBytes[byteIdx];
          const b1 = dataBytes[byteIdx + 1];
          const b2 = dataBytes[byteIdx + 2];

          if (lut) {
            const lum = Math.floor(0.299 * b0 + 0.587 * b1 + 0.114 * b2);
            r = lut[lum * 3];
            g = lut[lum * 3 + 1];
            b = lut[lum * 3 + 2];
          } else {
            if (channelOrder === 'rgb') { r = b0; g = b1; b = b2; }
            else if (channelOrder === 'rbg') { r = b0; g = b2; b = b1; }
            else if (channelOrder === 'grb') { r = b1; g = b0; b = b2; }
            else if (channelOrder === 'brg') { r = b2; g = b0; b = b1; }
            else if (channelOrder === 'bgr') { r = b2; g = b1; b = b0; }
          }
        } else if (format === 'rgba') {
          const b0 = dataBytes[byteIdx];
          const b1 = dataBytes[byteIdx + 1];
          const b2 = dataBytes[byteIdx + 2];
          const b3 = dataBytes[byteIdx + 3];

          if (lut) {
            const lum = Math.floor(0.299 * b0 + 0.587 * b1 + 0.114 * b2);
            r = lut[lum * 3];
            g = lut[lum * 3 + 1];
            b = lut[lum * 3 + 2];
            a = b3;
          } else {
            if (channelOrder === 'rgb') { r = b0; g = b1; b = b2; }
            else if (channelOrder === 'rbg') { r = b0; g = b2; b = b1; }
            else if (channelOrder === 'grb') { r = b1; g = b0; b = b2; }
            else if (channelOrder === 'brg') { r = b2; g = b0; b = b1; }
            else if (channelOrder === 'bgr') { r = b2; g = b1; b = b0; }
            a = b3;
          }
        } else if (format === 'rgb16') {
          const word = dataBytes[byteIdx] | (dataBytes[byteIdx + 1] << 8);
          // RGB 565 decoding
          const r5 = (word >> 11) & 0x1F;
          const g6 = (word >> 5) & 0x3F;
          const b5 = word & 0x1F;

          const rawR = Math.floor(r5 * 255 / 31);
          const rawG = Math.floor(g6 * 255 / 63);
          const rawB = Math.floor(b5 * 255 / 31);

          if (lut) {
            const lum = Math.floor(0.299 * rawR + 0.587 * rawG + 0.114 * rawB);
            r = lut[lum * 3];
            g = lut[lum * 3 + 1];
            b = lut[lum * 3 + 2];
          } else {
            r = rawR; g = rawG; b = rawB;
          }
        }

        data[outIdx] = r;
        data[outIdx + 1] = g;
        data[outIdx + 2] = b;
        data[outIdx + 3] = a;

        byteIdx += stride;
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Update Zoom and Status
    updateCanvasZoom();
    document.getElementById('canvasStatus').textContent = `MP3ビジュアル // ${width}x${height}`;
    updateMp3HUD();
  }

  function updateMp3HUD() {
    const canvas = document.getElementById('glitchCanvas');
    document.getElementById('hudResolution').textContent = `${canvas.width} x ${canvas.height}`;
    document.getElementById('hudBytes').textContent = `${mp3State.originalBuffer ? mp3State.originalBuffer.byteLength.toLocaleString() : 0} bytes`;
    document.getElementById('hudEntropy').textContent = mp3State.entropy.toFixed(4);
    document.getElementById('hudGlitchRatio').textContent = `${mp3State.glitchRatio.toFixed(2)}%`;
    document.getElementById('hudFrames').textContent = mp3State.estimatedFrames ? mp3State.estimatedFrames.toLocaleString() : '0';
    document.getElementById('hudId3Size').textContent = mp3State.id3Size ? `${mp3State.id3Size.toLocaleString()} bytes` : '0 bytes (None)';

    // Update loaded file labels
    document.getElementById('mp3FileName').textContent = mp3State.fileName;
    document.getElementById('mp3FileSize').textContent = `${(mp3State.originalBuffer.byteLength / 1024 / 1024).toFixed(2)} MB (${mp3State.originalBuffer.byteLength.toLocaleString()} bytes)`;
    document.getElementById('mp3FileEntropy').textContent = `Entropy: ${mp3State.entropy.toFixed(3)}`;
  }

  // ==========================================
  // IMAGE ➔ MP3 LOGIC
  // ==========================================
  const imgFileInput = document.getElementById('imgFileInput');
  const selectImgBtn = document.getElementById('selectImgBtn');
  const imgDropzone = document.getElementById('imgDropzone');

  selectImgBtn.addEventListener('click', () => imgFileInput.click());
  imgDropzone.addEventListener('click', (e) => {
    if (e.target !== selectImgBtn && e.target !== imgFileInput) {
      imgFileInput.click();
    }
  });

  imgDropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    imgDropzone.classList.add('dragover');
  });

  imgDropzone.addEventListener('dragleave', () => {
    imgDropzone.classList.remove('dragover');
  });

  imgDropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    imgDropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      handleImgFile(e.dataTransfer.files[0]);
    }
  });

  imgFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleImgFile(e.target.files[0]);
    }
  });

  function handleImgFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      alert('有効な画像ファイルを選択してください。');
      return;
    }
    stopAllAudio();
    imageState.fileName = file.name;
    imageState.fileSize = file.size;

    const reader = new FileReader();
    reader.onload = function(evt) {
      const img = new Image();
      img.onload = function() {
        imageState.imageElement = img;
        imageState.width = img.width;
        imageState.height = img.height;

        showImgPanels();
        renderCanvasFromImage();
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  }

  function showImgPanels() {
    document.getElementById('imgDropzone').classList.add('hidden');
    document.getElementById('imgFileStatus').classList.remove('hidden');
    document.getElementById('imgAudioSettingsSec').classList.remove('hidden');
    document.getElementById('imgExportSec').classList.remove('hidden');
  }

  function resetImageState() {
    stopAllAudio();
    imageState.fileName = '';
    imageState.imageElement = null;
    imageState.width = 0;
    imageState.height = 0;
    imageState.fileSize = 0;
    imageState.pixelData = null;

    document.getElementById('imgDropzone').classList.remove('hidden');
    document.getElementById('imgFileStatus').classList.add('hidden');
    document.getElementById('imgAudioSettingsSec').classList.add('hidden');
    document.getElementById('imgExportSec').classList.add('hidden');
  }

  document.getElementById('resetImgBtn').addEventListener('click', () => {
    resetImageState();
    clearCanvas();
  });

  function renderCanvasFromImage() {
    if (!imageState.imageElement) return;

    const canvas = document.getElementById('glitchCanvas');
    const ctx = canvas.getContext('2d');

    canvas.width = imageState.width;
    canvas.height = imageState.height;

    // Draw original image onto canvas
    ctx.drawImage(imageState.imageElement, 0, 0);

    // Get pixel values
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    imageState.pixelData = imgData.data;

    updateCanvasZoom();
    document.getElementById('canvasStatus').textContent = `IMAGEビジュアル // ${canvas.width}x${canvas.height}`;
    updateImgHUD();
  }

  function updateImgHUD() {
    const canvas = document.getElementById('glitchCanvas');
    // Calculate simple entropy of pixels (grayscale luminance)
    let entropy = 0.0;
    if (imageState.pixelData) {
      const counts = new Uint32Array(256);
      const totalPixels = imageState.pixelData.length / 4;
      for (let i = 0; i < imageState.pixelData.length; i += 4) {
        const r = imageState.pixelData[i];
        const g = imageState.pixelData[i+1];
        const b = imageState.pixelData[i+2];
        const lum = Math.floor(0.299 * r + 0.587 * g + 0.114 * b);
        counts[lum]++;
      }
      for (let i = 0; i < 256; i++) {
        if (counts[i] > 0) {
          const p = counts[i] / totalPixels;
          entropy -= p * Math.log2(p);
        }
      }
    }

    document.getElementById('hudResolution').textContent = `${canvas.width} x ${canvas.height}`;
    document.getElementById('hudBytes').textContent = `${imageState.fileSize.toLocaleString()} bytes`;
    document.getElementById('hudEntropy').textContent = entropy.toFixed(4);
    document.getElementById('hudGlitchRatio').textContent = 'N/A';
    document.getElementById('hudFrames').textContent = 'N/A';
    document.getElementById('hudId3Size').textContent = 'N/A';

    // Info header
    document.getElementById('imgFileName').textContent = imageState.fileName;
    document.getElementById('imgDimensions').textContent = `${imageState.width} x ${imageState.height} px`;
    document.getElementById('imgFileSize').textContent = `${(imageState.fileSize / 1024).toFixed(1)} KB (${imageState.fileSize.toLocaleString()} bytes)`;
  }

  // ==========================================
  // SONIFICATION PLAYBACK LOGIC
  // ==========================================

  function startPlayback(offsetSeconds = 0) {
    if (!activeAudioBuffer) return;
    initAudioContext();
    stopAllAudioSourceOnly();

    const source = audioCtx.createBufferSource();
    source.buffer = activeAudioBuffer;
    source.connect(audioCtx.destination);
    source.onended = () => {
      const elapsed = audioCtx.currentTime - seekStartTime + seekOffset;
      if (elapsed >= seekDurationVal - 0.05) {
        stopAllAudio();
      }
    };

    seekOffset = offsetSeconds;
    seekStartTime = audioCtx.currentTime;
    isSeekPlaying = true;
    activeAudioNode = source;

    source.start(0, offsetSeconds);

    // Update play button display in seek panel
    const seekPlayBtn = document.getElementById('seekPlayBtn');
    if (seekPlayBtn) {
      seekPlayBtn.innerHTML = '<i data-lucide="pause"></i> <span>一時停止</span>';
    }

    // Update left panel buttons based on mode
    if (currentPlayMode === 'raw') {
      isPlayingRaw = true;
      document.getElementById('playAudioBtn').innerHTML = '<i data-lucide="square"></i> <span>STOP</span>';
      document.getElementById('audioStatus').textContent = 'PLAYING RAW PCM';
    } else {
      isPlayingDecoded = true;
      document.getElementById('playMp3Btn').innerHTML = '<i data-lucide="square"></i> <span>STOP</span>';
      document.getElementById('audioStatus').textContent = 'PLAYING MP3';
    }
    try { lucide.createIcons(); } catch(e){}

    // Start progress loop
    cancelAnimationFrame(playbackTimer);
    const tick = () => {
      if (!isSeekPlaying) return;
      const elapsed = audioCtx.currentTime - seekStartTime + seekOffset;
      const seekBar = document.getElementById('audioSeekBar');
      if (seekBar) {
        seekBar.value = elapsed;
      }
      const currentText = document.getElementById('seekCurrentTime');
      if (currentText) {
        currentText.textContent = formatTime(elapsed);
      }

      // Update visual timeline playhead
      if (mp3State.originalBuffer) {
        const len = mp3State.originalBuffer.byteLength;
        const start = mp3State.startOffset;
        const end = mp3State.endOffset;
        const progressRatio = seekDurationVal > 0 ? (elapsed / seekDurationVal) : 0;
        const playheadBytes = start + progressRatio * (end - start);
        const pct = (playheadBytes / len) * 100;

        const playhead = document.getElementById('timelinePlayhead');
        if (playhead) {
          playhead.style.left = `${pct}%`;
          playhead.style.display = 'block';
        }
      }

      playbackTimer = requestAnimationFrame(tick);
    };
    playbackTimer = requestAnimationFrame(tick);
  }

  function pausePlayback() {
    if (!isSeekPlaying) return;
    cancelAnimationFrame(playbackTimer);
    isSeekPlaying = false;
    isPlayingRaw = false;
    isPlayingDecoded = false;
    seekOffset = audioCtx.currentTime - seekStartTime + seekOffset;
    stopAllAudioSourceOnly();

    const seekPlayBtn = document.getElementById('seekPlayBtn');
    if (seekPlayBtn) seekPlayBtn.innerHTML = '<i data-lucide="play"></i> <span>再生</span>';

    document.getElementById('playAudioBtn').innerHTML = '<i data-lucide="play"></i> <span>RAW 再生</span>';
    document.getElementById('playMp3Btn').innerHTML = '<i data-lucide="speaker"></i> <span>MP3 再生</span>';
    document.getElementById('audioStatus').textContent = 'PAUSED';
    try { lucide.createIcons(); } catch(e){}
  }

  // Play Raw PCM Sonification (Sliced Range)
  document.getElementById('playAudioBtn').addEventListener('click', () => {
    if (isPlayingRaw) {
      stopAllAudio();
      return;
    }
    stopAllAudio();

    const bufferToPlay = mp3State.glitchedBuffer;
    if (!bufferToPlay) return;

    const startOffset = mp3State.startOffset;
    const endOffset = mp3State.endOffset;
    if (startOffset >= endOffset) return;

    const samplingRate = parseInt(document.getElementById('sonifyRate').value, 10);
    const audioType = document.getElementById('sonifyType').value;

    const ctx = initAudioContext();
    const slicedBuffer = bufferToPlay.slice(startOffset, endOffset);
    const bytes = new Uint8Array(slicedBuffer);

    // Convert raw bytes to PCM samples (-1.0 to 1.0)
    let samples;
    if (audioType === 'uint8') {
      samples = new Float32Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) {
        samples[i] = (bytes[i] - 128) / 128;
      }
    } else if (audioType === 'int8') {
      samples = new Float32Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) {
        const val = bytes[i];
        const sval = val >= 128 ? val - 256 : val;
        samples[i] = sval / 128;
      }
    } else if (audioType === 'mulaw') {
      samples = new Float32Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) {
        samples[i] = decodeMuLaw(bytes[i]);
      }
    }

    // Create AudioBuffer
    const rawBuffer = ctx.createBuffer(1, samples.length, Math.max(8000, samplingRate));
    rawBuffer.getChannelData(0).set(samples);

    activeAudioBuffer = rawBuffer;
    seekDurationVal = samples.length / Math.max(8000, samplingRate);
    currentPlayMode = 'raw';

    // Setup seek bar limits
    const seekBar = document.getElementById('audioSeekBar');
    if (seekBar) {
      seekBar.max = seekDurationVal;
      seekBar.value = 0;
    }
    const seekDurationText = document.getElementById('seekDuration');
    if (seekDurationText) {
      seekDurationText.textContent = formatTime(seekDurationVal);
    }

    startPlayback(0);
  });

  // Play Decoded MP3 (Sliced Range)
  document.getElementById('playMp3Btn').addEventListener('click', () => {
    if (isPlayingDecoded) {
      stopAllAudio();
      return;
    }
    stopAllAudio();

    const bufferToPlay = mp3State.glitchedBuffer;
    if (!bufferToPlay) return;

    const startOffset = mp3State.startOffset;
    const endOffset = mp3State.endOffset;
    if (startOffset >= endOffset) return;

    document.getElementById('audioStatus').textContent = 'DECODING RANGE...';
    const ctx = initAudioContext();

    const slicedBuffer = bufferToPlay.slice(startOffset, endOffset);

    ctx.decodeAudioData(slicedBuffer)
      .then((decodedBuffer) => {
        activeAudioBuffer = decodedBuffer;
        seekDurationVal = decodedBuffer.duration;
        currentPlayMode = 'mp3';

        // Setup seek bar limits
        const seekBar = document.getElementById('audioSeekBar');
        if (seekBar) {
          seekBar.max = seekDurationVal;
          seekBar.value = 0;
        }
        const seekDurationText = document.getElementById('seekDuration');
        if (seekDurationText) {
          seekDurationText.textContent = formatTime(seekDurationVal);
        }

        startPlayback(0);
      })
      .catch((err) => {
        console.error(err);
        document.getElementById('audioStatus').textContent = 'DECODE ERROR';
        alert('指定範囲のデコードに失敗しました。バイナリデータが破損しているか、MP3フレームが足りない可能性があります。RAW再生をお試しください。');
      });
  });

  // Play/Pause button in Right Panel Seek HUD
  const seekPlayBtn = document.getElementById('seekPlayBtn');
  if (seekPlayBtn) {
    seekPlayBtn.addEventListener('click', () => {
      if (isSeekPlaying) {
        pausePlayback();
      } else {
        if (activeAudioBuffer) {
          startPlayback(seekOffset);
        } else {
          // Play current mode (defaults to MP3)
          document.getElementById('playMp3Btn').click();
        }
      }
    });
  }

  const seekStopBtn = document.getElementById('seekStopBtn');
  if (seekStopBtn) {
    seekStopBtn.addEventListener('click', () => {
      stopAllAudio();
    });
  }

  // Seek bar slider events
  const audioSeekBar = document.getElementById('audioSeekBar');
  if (audioSeekBar) {
    audioSeekBar.addEventListener('input', (e) => {
      const targetTime = parseFloat(e.target.value);
      const currentText = document.getElementById('seekCurrentTime');
      if (currentText) currentText.textContent = formatTime(targetTime);
    });

    audioSeekBar.addEventListener('change', (e) => {
      const targetTime = parseFloat(e.target.value);
      if (isSeekPlaying) {
        startPlayback(targetTime);
      } else {
        seekOffset = targetTime;
      }
    });
  }

  // Decode µ-law compressed bytes to 16-bit PCM float
  function decodeMuLaw(uLawByte) {
    uLawByte = ~uLawByte;
    const sign = (uLawByte & 0x80);
    let exponent = (uLawByte & 0x70) >> 4;
    let mantissa = uLawByte & 0x0F;
    let sample = (mantissa << 3) + 132;
    sample <<= exponent;
    sample -= 132;
    const linearVal = sign ? -sample : sample;
    return linearVal / 32768.0; // scale to -1.0 to 1.0
  }

  // Play image as audio (Tab 2)
  document.getElementById('playImgAudioBtn').addEventListener('click', () => {
    if (activeAudioNode) {
      stopAllAudio();
      return;
    }
    stopAllAudio();

    if (!imageState.pixelData) return;

    const sampleRate = parseInt(document.getElementById('imgSampleRate').value, 10);
    const audioBytes = convertImageToAudioBytes();

    const ctx = initAudioContext();
    const samples = new Float32Array(audioBytes.length);
    for (let i = 0; i < audioBytes.length; i++) {
      samples[i] = (audioBytes[i] - 128) / 128;
    }

    const audioBuffer = ctx.createBuffer(1, samples.length, sampleRate);
    audioBuffer.getChannelData(0).set(samples);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.onended = () => {
      stopAllAudio();
    };

    activeAudioNode = source;
    source.start(0);

    document.getElementById('playImgAudioBtn').innerHTML = '<i data-lucide="square"></i> <span>STOP</span>';
    document.getElementById('imgAudioStatus').textContent = 'PLAYING GLITCH NOISE';
    lucide.createIcons();
  });

  // Converts pixel array to audio bytes based on mapping mode
  function convertImageToAudioBytes() {
    const data = imageState.pixelData;
    const mapping = document.getElementById('imgColorMap').value;

    let bytes;
    if (mapping === 'rgba_stream') {
      // Just copy RGBA directly
      bytes = new Uint8Array(data.length);
      bytes.set(data);
    } else if (mapping === 'rgb_stream') {
      // Strip alpha channels
      const pixelCount = data.length / 4;
      bytes = new Uint8Array(pixelCount * 3);
      let byteIdx = 0;
      for (let i = 0; i < data.length; i += 4) {
        bytes[byteIdx++] = data[i];   // R
        bytes[byteIdx++] = data[i+1]; // G
        bytes[byteIdx++] = data[i+2]; // B
      }
    } else if (mapping === 'brightness') {
      // Compute pixel luminance
      const pixelCount = data.length / 4;
      bytes = new Uint8Array(pixelCount);
      let byteIdx = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];
        bytes[byteIdx++] = Math.floor(0.299 * r + 0.587 * g + 0.114 * b);
      }
    }
    return bytes;
  }

  // ==========================================
  // EXPORT / DOWNLOAD FUNCTIONS
  // ==========================================

  // Export Canvas image as standard PNG
  document.getElementById('exportPngBtn').addEventListener('click', () => {
    const canvas = document.getElementById('glitchCanvas');
    if (!mp3State.originalBuffer) return;

    const baseName = mp3State.fileName.substring(0, mp3State.fileName.lastIndexOf('.'));
    const link = document.createElement('a');
    link.download = `${baseName}_glitched_viz.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });

  // Helper to create BMP file containing MP3 glitched bytes
  function createBmpFile(dataBuffer, width, format) {
    const dataBytes = new Uint8Array(dataBuffer);
    // Determine bits per pixel (BPP)
    const bpp = format === 'rgba' ? 32 : 24;
    const bytesPerPixel = bpp / 8;

    // BMP rows must be aligned to 4 bytes
    const rowSize = Math.floor((width * bpp + 31) / 32) * 4;
    const numRows = Math.ceil(dataBytes.length / (width * bytesPerPixel));
    const pixelDataSize = rowSize * numRows;
    const fileSize = 54 + pixelDataSize;

    const bmpHeader = new ArrayBuffer(54);
    const view = new DataView(bmpHeader);

    // 1. File Header (14 bytes)
    view.setUint8(0, 0x42); // 'B'
    view.setUint8(1, 0x4D); // 'M'
    view.setUint32(2, fileSize, true); // File size
    view.setUint32(6, 0, true); // Reserved
    view.setUint32(10, 54, true); // Pixel offset

    // 2. Info Header (BITMAPINFOHEADER - 40 bytes)
    view.setUint32(14, 40, true); // Info header size
    view.setInt32(18, width, true); // Width
    view.setInt32(22, -numRows, true); // Height (Negative for top-down)
    view.setUint16(26, 1, true); // Planes (1)
    view.setUint16(28, bpp, true); // BPP
    view.setUint32(30, 0, true); // Compression (0 = BI_RGB)
    view.setUint32(34, pixelDataSize, true); // Image data size
    view.setInt32(38, 2835, true); // Horizontal resolution (72 DPI)
    view.setInt32(42, 2835, true); // Vertical resolution (72 DPI)
    view.setUint32(46, 0, true); // Palette colors
    view.setUint32(50, 0, true); // Important colors

    // Combine Header and pixel data
    const merged = new Uint8Array(fileSize);
    merged.set(new Uint8Array(bmpHeader), 0);

    // Copy MP3 bytes directly into pixel data payload
    // Row layout padding is technically filled with 0s because of Uint8Array init
    merged.set(dataBytes, 54);

    return new Blob([merged], { type: 'image/bmp' });
  }

  // Export glitched BMP
  document.getElementById('exportBmpBtn').addEventListener('click', () => {
    if (!mp3State.glitchedBuffer) return;

    const width = parseInt(vizWidth.value, 10);
    const format = document.getElementById('vizFormat').value;

    const bmpBlob = createBmpFile(mp3State.glitchedBuffer, width, format);
    const baseName = mp3State.fileName.substring(0, mp3State.fileName.lastIndexOf('.'));

    const link = document.createElement('a');
    link.download = `${baseName}_glitched.bmp`;
    link.href = URL.createObjectURL(bmpBlob);
    link.click();
  });

  // Export modified glitched MP3
  document.getElementById('exportMp3Btn').addEventListener('click', () => {
    if (!mp3State.glitchedBuffer) return;

    const mp3Blob = new Blob([mp3State.glitchedBuffer], { type: 'audio/mp3' });
    const baseName = mp3State.fileName.substring(0, mp3State.fileName.lastIndexOf('.'));

    const link = document.createElement('a');
    link.download = `${baseName}_glitched.mp3`;
    link.href = URL.createObjectURL(mp3Blob);
    link.click();
  });

  // Helper to generate WAV format around raw bytes (Image ➔ WAV)
  function createWavFile(audioDataBytes, sampleRate) {
    const buffer = new ArrayBuffer(44 + audioDataBytes.length);
    const view = new DataView(buffer);
    const u8 = new Uint8Array(buffer);

    // RIFF Chunk
    view.setUint32(0, 0x52494646); // "RIFF"
    view.setUint32(4, 36 + audioDataBytes.length, true);
    view.setUint32(8, 0x57415645); // "WAVE"

    // fmt Chunk
    view.setUint32(12, 0x666d7420); // "fmt "
    view.setUint32(16, 16, true); // size of chunk (16)
    view.setUint16(20, 1, true); // audio format (1 = PCM)
    view.setUint16(22, 1, true); // channels (1 = mono)
    view.setUint32(24, sampleRate, true); // sample rate
    view.setUint32(28, sampleRate, true); // byte rate (sampleRate * 1 channel * 1 byte)
    view.setUint16(32, 1, true); // block align (1)
    view.setUint16(34, 8, true); // bits per sample (8bit)

    // data Chunk
    view.setUint32(36, 0x64617461); // "data"
    view.setUint32(40, audioDataBytes.length, true);

    // Append audio sample bytes
    u8.set(audioDataBytes, 44);

    return new Blob([buffer], { type: 'audio/wav' });
  }

  // Helper to generate MP3-like stream with pseudo sync frames (Image ➔ MP3 frame)
  function createPseudoMp3File(audioDataBytes) {
    // Insert 4 bytes header [0xFF, 0xFB, 0x90, 0x64] every 417 bytes
    const frameSize = 417;
    const header = [0xFF, 0xFB, 0x90, 0x64];
    const totalInputLen = audioDataBytes.length;
    const numFrames = Math.ceil(totalInputLen / (frameSize - 4));
    const outputBuffer = new Uint8Array(totalInputLen + numFrames * 4);

    let srcIdx = 0;
    let destIdx = 0;

    while (srcIdx < totalInputLen) {
      // Write frame header
      outputBuffer[destIdx++] = header[0];
      outputBuffer[destIdx++] = header[1];
      outputBuffer[destIdx++] = header[2];
      outputBuffer[destIdx++] = header[3];

      // Write frame payload
      const chunkLen = Math.min(frameSize - 4, totalInputLen - srcIdx);
      outputBuffer.set(audioDataBytes.subarray(srcIdx, srcIdx + chunkLen), destIdx);
      srcIdx += chunkLen;
      destIdx += chunkLen;
    }

    return new Blob([outputBuffer], { type: 'audio/mp3' });
  }

  // Image ➔ Audio export
  document.getElementById('downloadImgAudioBtn').addEventListener('click', () => {
    if (!imageState.pixelData) return;

    const sampleRate = parseInt(document.getElementById('imgSampleRate').value, 10);
    const headerType = document.getElementById('imgHeaderType').value;
    const audioBytes = convertImageToAudioBytes();

    let blob;
    let extension = 'bin';

    if (headerType === 'wav') {
      blob = createWavFile(audioBytes, sampleRate);
      extension = 'wav';
    } else if (headerType === 'mp3_frame') {
      blob = createPseudoMp3File(audioBytes);
      extension = 'mp3';
    } else {
      // Raw bin
      blob = new Blob([audioBytes], { type: 'application/octet-stream' });
      extension = 'mp3'; // Export raw binary as MP3 since player import raw supports it
    }

    const baseName = imageState.fileName.substring(0, imageState.fileName.lastIndexOf('.'));
    const link = document.createElement('a');
    link.download = `${baseName}_sonified.${extension}`;
    link.href = URL.createObjectURL(blob);
    link.click();
  });

  // ==========================================
  // CANVAS ZOOM & FIT MECHANICS
  // ==========================================
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const zoomFitBtn = document.getElementById('zoomFitBtn');
  const zoomLevelDisplay = document.getElementById('zoomLevel');

  zoomInBtn.addEventListener('click', () => {
    zoomLevel = Math.min(8.0, zoomLevel * 1.25);
    updateCanvasZoom();
  });

  zoomOutBtn.addEventListener('click', () => {
    zoomLevel = Math.max(0.125, zoomLevel / 1.25);
    updateCanvasZoom();
  });

  zoomFitBtn.addEventListener('click', () => {
    const canvas = document.getElementById('glitchCanvas');
    if (!canvas.width || !canvas.height) return;
    const wrapper = document.querySelector('.canvas-wrapper');
    const widthRatio = (wrapper.clientWidth - 30) / canvas.width;
    const heightRatio = 400 / canvas.height; // approximate container height
    zoomLevel = Math.min(1.0, Math.min(widthRatio, heightRatio));
    if (zoomLevel < 0.125) zoomLevel = 0.125;
    updateCanvasZoom();
  });

  function updateCanvasZoom() {
    const canvas = document.getElementById('glitchCanvas');
    if (!canvas.width || !canvas.height) return;
    canvas.style.width = `${canvas.width * zoomLevel}px`;
    canvas.style.height = `${canvas.height * zoomLevel}px`;
    zoomLevelDisplay.textContent = `${Math.round(zoomLevel * 100)}%`;
  }

  function clearCanvas() {
    const canvas = document.getElementById('glitchCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 512;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 512, 512);

    // Reset status
    document.getElementById('canvasStatus').textContent = 'ファイル未ロード';
    document.getElementById('hudResolution').textContent = '0 x 0';
    document.getElementById('hudBytes').textContent = '0 bytes';
    document.getElementById('hudEntropy').textContent = '0.000';
    document.getElementById('hudGlitchRatio').textContent = '0.00%';
    document.getElementById('hudFrames').textContent = 'N/A';
    document.getElementById('hudId3Size').textContent = 'N/A';
    zoomLevel = 1.0;
    updateCanvasZoom();
  }

  // Run on start
  clearCanvas();
});
