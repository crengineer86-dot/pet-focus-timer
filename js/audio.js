/**
 * Web Audio API(OfflineAudioContext) 기반 순수 코드 생성 24초 스테레오 환경음(ASMR) 6종 & 효과음 모듈
 * - 외부 음원 파일 없이 최초 재생 시 1회 24초 고품질 스테레오 WAV 루프를 생성·캐싱해 <audio loop>로 재생
 * - 2초 이퀄파워 크로스페이드(무이음새 루프), 4.5kHz 이상 고주파 감쇠 마스터 웜스 EQ,
 *   체감 음량 균일화(RMS 노멀라이즈), 0.6초 부드러운 페이드인/아웃 적용
 * - 모드: 백색모드(white), 보슬비(rain), 바람(wind), 장작(fire), 새소리(birds), 귀뚜라미(cricket)
 */
(function (global) {
  const PetFocus = (global.PetFocus = global.PetFocus || {});

  const LOOP_DURATION_SEC = 24;
  const CROSSFADE_SEC = 2.0;
  const RENDER_DURATION_SEC = LOOP_DURATION_SEC + CROSSFADE_SEC;
  const SAMPLE_RATE = 44100;
  const FADE_RAMP_MS = 600;
  const DEFAULT_MASTER_VOLUME = 0.68;

  const SOUND_MODES = {
    white: {
      id: "white",
      label: "백색모드",
      desc: "잔잔한 배경 소음",
      toastOn: "🎧 백색모드(잔잔한 배경 소음)를 재생해요",
      targetRms: 0.088,
      playbackVol: 0.62
    },
    rain: {
      id: "rain",
      label: "보슬비",
      toastOn: "🌧️ 보슬비 ASMR을 재생해요",
      targetRms: 0.095,
      playbackVol: 0.68
    },
    wind: {
      id: "wind",
      label: "바람",
      toastOn: "🍃 바람 ASMR을 재생해요",
      targetRms: 0.092,
      playbackVol: 0.66
    },
    fire: {
      id: "fire",
      label: "장작",
      toastOn: "🔥 장작 ASMR을 재생해요",
      targetRms: 0.098,
      playbackVol: 0.7
    },
    birds: {
      id: "birds",
      label: "새소리",
      toastOn: "🐦 숲속 새소리 ASMR을 재생해요",
      targetRms: 0.082,
      playbackVol: 0.66
    },
    cricket: {
      id: "cricket",
      label: "귀뚜라미",
      toastOn: "🦗 고요한 밤 귀뚜라미 소리를 재생해요",
      targetRms: 0.082,
      playbackVol: 0.66
    }
  };

  /* =========================================================================
     [순수 DSP 유틸리티: 스테레오 핑크/브라운 노이즈, 부드러운 잔향 IR, WAV 인코더]
     ========================================================================= */

  function createPinkNoiseBuffer(ctx, durationSec) {
    const length = Math.ceil(ctx.sampleRate * durationSec);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const out = buffer.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    }
    return buffer;
  }

  function createBrownNoiseBuffer(ctx, durationSec) {
    const length = Math.ceil(ctx.sampleRate * durationSec);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const out = buffer.getChannelData(ch);
      let lastOut = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.02 * white) / 1.02;
        out[i] = lastOut * 3.1;
      }
    }
    return buffer;
  }

  function createWhiteNoiseBuffer(ctx, durationSec) {
    const length = Math.ceil(ctx.sampleRate * durationSec);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const out = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        out[i] = Math.random() * 2 - 1;
      }
    }
    return buffer;
  }

  function createSoftReverbIR(ctx, durationSec = 1.5, decay = 2.8) {
    const length = Math.ceil(ctx.sampleRate * durationSec);
    const ir = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const out = ir.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < length; i++) {
        const t = i / length;
        const env = Math.pow(1 - t, decay);
        const raw = (Math.random() * 2 - 1) * env;
        // 1-pole 저역 통과로 따뜻하고 먼 잔향 질감 생성
        lp = lp + 0.22 * (raw - lp);
        out[i] = lp;
      }
    }
    return ir;
  }

  function createStereoPanner(ctx, panVal) {
    if (typeof ctx.createStereoPanner === "function") {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, panVal));
      return p;
    }
    // 구형 WebKit 폴백
    const g = ctx.createGain();
    return g;
  }

  /**
   * 26초 렌더 버퍼의 끝 2초와 시작 2초를 이퀄파워(cos/sin) 크로스페이드해
   * 완벽하게 이음새 없는 24초 스테레오 버퍼로 가공하고 체감 음량(RMS)을 균일화합니다.
   */
  function finalizeSeamlessLoop(renderedBuffer, targetRms = 0.092) {
    const sr = renderedBuffer.sampleRate;
    const loopSamples = Math.floor(LOOP_DURATION_SEC * sr);
    const xfadeSamples = Math.min(
      Math.floor(CROSSFADE_SEC * sr),
      renderedBuffer.length - loopSamples
    );
    const numCh = renderedBuffer.numberOfChannels;
    const channels = [];

    let sumSq = 0;
    let totalCount = 0;

    for (let ch = 0; ch < numCh; ch++) {
      const src = renderedBuffer.getChannelData(ch);
      const dst = new Float32Array(loopSamples);
      dst.set(src.subarray(0, loopSamples));

      if (xfadeSamples > 0) {
        for (let i = 0; i < xfadeSamples; i++) {
          const t = i / xfadeSamples;
          const fadeIn = Math.sin(t * Math.PI * 0.5);
          const fadeOut = Math.cos(t * Math.PI * 0.5);
          dst[i] = src[i] * fadeIn + src[loopSamples + i] * fadeOut;
        }
      }

      for (let i = 0; i < loopSamples; i++) {
        const v = dst[i];
        sumSq += v * v;
      }
      totalCount += loopSamples;
      channels.push(dst);
    }

    // 체감 음량(RMS) 균일화 + 부드러운 tanh 피크 리미팅
    const currentRms = Math.sqrt(sumSq / Math.max(1, totalCount));
    const gainScale = currentRms > 1e-5 ? Math.min(4.2, targetRms / currentRms) : 1.0;

    for (let ch = 0; ch < numCh; ch++) {
      const arr = channels[ch];
      for (let i = 0; i < loopSamples; i++) {
        let v = arr[i] * gainScale;
        if (Math.abs(v) > 0.72) {
          v = Math.tanh(v * 1.15) * 0.84;
        }
        arr[i] = Math.max(-0.95, Math.min(0.95, v));
      }
    }

    return { channels, sampleRate: sr, length: loopSamples };
  }

  function encodeStereoWavBlobUrl(channels, sampleRate) {
    const numChannels = channels.length;
    const numSamples = channels[0].length;
    const bytesPerSample = 2;
    const blockAlign = numChannels * bytesPerSample;
    const dataSize = numSamples * blockAlign;
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    const writeStr = (offset, str) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeStr(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // AudioFormat = PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // BitsPerSample
    writeStr(36, "data");
    view.setUint32(40, dataSize, true);

    let offset = 44;
    const left = channels[0];
    const right = numChannels > 1 ? channels[1] : channels[0];
    for (let i = 0; i < numSamples; i++) {
      const sL = Math.max(-1, Math.min(1, left[i]));
      const sR = Math.max(-1, Math.min(1, right[i]));
      view.setInt16(offset, sL < 0 ? sL * 0x8000 : sL * 0x7fff, true);
      offset += 2;
      view.setInt16(offset, sR < 0 ? sR * 0x8000 : sR * 0x7fff, true);
      offset += 2;
    }

    const blob = new Blob([buffer], { type: "audio/wav" });
    return URL.createObjectURL(blob);
  }

  /**
   * 공통 마스터 웜스 체인:
   * - 32Hz 이하 초저역 럼블 정리 + 4.5kHz 이상 날카로운 치찰음/고주파 부드럽게 감쇠
   */
  function createMasterWarmthChain(ctx) {
    const subCut = ctx.createBiquadFilter();
    subCut.type = "highpass";
    subCut.frequency.value = 32;
    subCut.Q.value = 0.7;

    const highShelf = ctx.createBiquadFilter();
    highShelf.type = "highshelf";
    highShelf.frequency.value = 3600;
    highShelf.gain.value = -5.5;

    const warmthLp = ctx.createBiquadFilter();
    warmthLp.type = "lowpass";
    warmthLp.frequency.value = 4350;
    warmthLp.Q.value = 0.65;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.92;

    subCut.connect(highShelf);
    highShelf.connect(warmthLp);
    warmthLp.connect(masterGain);
    masterGain.connect(ctx.destination);

    return subCut;
  }

  /* =========================================================================
     [트랙별 24초 고품질 스테레오 신스 그래프 (OfflineAudioContext)]
     ========================================================================= */

  function buildWhiteTrack(ctx, masterIn) {
    const pinkSrc = ctx.createBufferSource();
    pinkSrc.buffer = createPinkNoiseBuffer(ctx, RENDER_DURATION_SEC);

    const brownSrc = ctx.createBufferSource();
    brownSrc.buffer = createBrownNoiseBuffer(ctx, RENDER_DURATION_SEC);

    const pinkGain = ctx.createGain();
    pinkGain.gain.value = 0.52;
    const brownGain = ctx.createGain();
    brownGain.gain.value = 0.42;

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 110;
    hp.Q.value = 0.6;

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1280;
    lp.Q.value = 0.65;

    pinkSrc.connect(pinkGain);
    brownSrc.connect(brownGain);
    pinkGain.connect(hp);
    brownGain.connect(hp);
    hp.connect(lp);
    lp.connect(masterIn);

    pinkSrc.start(0);
    brownSrc.start(0);
  }

  // 1) 보슬비: 핑크 노이즈 베이스(HP ~250Hz, LP ~2200Hz) + 좌우 불규칙 빗방울 톡톡 버스트
  function buildRainTrack(ctx, masterIn) {
    const pinkSrc = ctx.createBufferSource();
    pinkSrc.buffer = createPinkNoiseBuffer(ctx, RENDER_DURATION_SEC);

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 250;
    hp.Q.value = 0.7;

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2150;
    lp.Q.value = 0.68;

    // 아주 완만한 자연 호흡(빗줄기 강약 미세 변화)
    const bedGain = ctx.createGain();
    bedGain.gain.setValueAtTime(0.68, 0);
    let t = 0;
    while (t < RENDER_DURATION_SEC) {
      const step = 3.0 + Math.random() * 3.5;
      t += step;
      bedGain.gain.linearRampToValueAtTime(
        0.62 + Math.random() * 0.14,
        Math.min(RENDER_DURATION_SEC, t)
      );
    }

    pinkSrc.connect(hp);
    hp.connect(lp);
    lp.connect(bedGain);
    bedGain.connect(masterIn);
    pinkSrc.start(0);

    // 창문·나뭇잎에 톡톡 떨어지는 입체 보슬비 방울 레이어 (1200~3000Hz 짧은 필터 버스트)
    const dropNoiseBuf = createWhiteNoiseBuffer(ctx, 0.08);
    const dropCount = 115;
    for (let i = 0; i < dropCount; i++) {
      const startTime = Math.random() * (RENDER_DURATION_SEC - 0.12);
      const dur = 0.012 + Math.random() * 0.026;
      const src = ctx.createBufferSource();
      src.buffer = dropNoiseBuf;

      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1250 + Math.random() * 1750;
      bp.Q.value = 2.0 + Math.random() * 2.2;

      const g = ctx.createGain();
      const peak = 0.055 + Math.random() * 0.115;
      g.gain.setValueAtTime(0.0001, startTime);
      g.gain.linearRampToValueAtTime(peak, startTime + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

      const pan = createStereoPanner(ctx, (Math.random() * 2 - 1) * 0.82);

      src.connect(bp);
      bp.connect(g);
      g.connect(pan);
      pan.connect(masterIn);

      src.start(startTime, Math.random() * 0.03, dur + 0.01);
    }
  }

  // 2) 바람: 브라운/핑크 혼합 + 부드러운 밴드패스(Q 1.2~1.6) + 6~10초 비대칭 완만한 산들바람
  function buildWindTrack(ctx, masterIn) {
    const brownSrc = ctx.createBufferSource();
    brownSrc.buffer = createBrownNoiseBuffer(ctx, RENDER_DURATION_SEC);
    const pinkSrc = ctx.createBufferSource();
    pinkSrc.buffer = createPinkNoiseBuffer(ctx, RENDER_DURATION_SEC);

    const bGain = ctx.createGain();
    bGain.gain.value = 0.65;
    const pGain = ctx.createGain();
    pGain.gain.value = 0.38;

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.38;
    bp.frequency.setValueAtTime(340, 0);

    const windGain = ctx.createGain();
    windGain.gain.setValueAtTime(0.45, 0);

    // 6~10초 주기의 비대칭 바람결 곡선 (280Hz <-> 780Hz)
    let cursor = 0;
    while (cursor < RENDER_DURATION_SEC) {
      const riseDur = 2.6 + Math.random() * 2.2;
      const fallDur = 3.4 + Math.random() * 2.8;
      const peakFreq = 540 + Math.random() * 240; // ~540..780Hz
      const troughFreq = 280 + Math.random() * 90; // ~280..370Hz
      const peakAmp = 0.72 + Math.random() * 0.28;
      const troughAmp = 0.34 + Math.random() * 0.14;

      const tPeak = Math.min(RENDER_DURATION_SEC, cursor + riseDur);
      bp.frequency.exponentialRampToValueAtTime(peakFreq, tPeak);
      windGain.gain.linearRampToValueAtTime(peakAmp, tPeak);

      const tFall = Math.min(RENDER_DURATION_SEC, tPeak + fallDur);
      bp.frequency.exponentialRampToValueAtTime(troughFreq, tFall);
      windGain.gain.linearRampToValueAtTime(troughAmp, tFall);

      cursor = tFall;
    }

    brownSrc.connect(bGain);
    pinkSrc.connect(pGain);
    bGain.connect(bp);
    pGain.connect(bp);
    bp.connect(windGain);
    windGain.connect(masterIn);

    // 아주 옅은 나뭇잎 살랑임 보조 레이어 (쉭쉭거림 없이 부드럽게)
    const leafSrc = ctx.createBufferSource();
    leafSrc.buffer = createPinkNoiseBuffer(ctx, RENDER_DURATION_SEC);
    const leafBp = ctx.createBiquadFilter();
    leafBp.type = "bandpass";
    leafBp.frequency.value = 1150;
    leafBp.Q.value = 1.3;
    const leafGain = ctx.createGain();
    leafGain.gain.value = 0.08;

    leafSrc.connect(leafBp);
    leafBp.connect(leafGain);
    leafGain.connect(masterIn);

    brownSrc.start(0);
    pinkSrc.start(0);
    leafSrc.start(0);
  }

  // 3) 장작: ① 화로 울림(브라운 LP ~180Hz) + ② 불꽃 바람(BP ~480Hz) + ③ 불규칙 타닥·탁탁 크래클
  function buildFireTrack(ctx, masterIn) {
    // Layer 1: 낮고 포근한 화로 울림
    const rumbleSrc = ctx.createBufferSource();
    rumbleSrc.buffer = createBrownNoiseBuffer(ctx, RENDER_DURATION_SEC);
    const rumbleLp = ctx.createBiquadFilter();
    rumbleLp.type = "lowpass";
    rumbleLp.frequency.value = 175;
    rumbleLp.Q.value = 0.75;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0.72;

    rumbleSrc.connect(rumbleLp);
    rumbleLp.connect(rumbleGain);
    rumbleGain.connect(masterIn);
    rumbleSrc.start(0);

    // Layer 2: 부드럽게 일렁이는 불꽃 바람 (BP ~480Hz 완만한 변동)
    const flameSrc = ctx.createBufferSource();
    flameSrc.buffer = createPinkNoiseBuffer(ctx, RENDER_DURATION_SEC);
    const flameBp = ctx.createBiquadFilter();
    flameBp.type = "bandpass";
    flameBp.frequency.setValueAtTime(460, 0);
    flameBp.Q.value = 1.25;
    const flameGain = ctx.createGain();
    flameGain.gain.setValueAtTime(0.28, 0);

    let ft = 0;
    while (ft < RENDER_DURATION_SEC) {
      ft += 0.9 + Math.random() * 1.4;
      const tNext = Math.min(RENDER_DURATION_SEC, ft);
      flameBp.frequency.exponentialRampToValueAtTime(380 + Math.random() * 190, tNext);
      flameGain.gain.linearRampToValueAtTime(0.2 + Math.random() * 0.16, tNext);
    }

    flameSrc.connect(flameBp);
    flameBp.connect(flameGain);
    flameGain.connect(masterIn);
    flameSrc.start(0);

    // Layer 3: 불규칙한 장작 타닥·탁탁 소리 (5~22ms 짧은 고역 임펄스 + 빠른 감쇠 + 랜덤 패닝)
    const crackleBuf = createWhiteNoiseBuffer(ctx, 0.06);
    let ct = 0.15;
    while (ct < RENDER_DURATION_SEC - 0.15) {
      // 클러스터형 랜덤 간격으로 일정한 박자감 배제
      const clusterCount = Math.random() < 0.35 ? 2 + Math.floor(Math.random() * 2) : 1;
      for (let k = 0; k < clusterCount; k++) {
        const t0 = ct + k * (0.04 + Math.random() * 0.12);
        if (t0 >= RENDER_DURATION_SEC - 0.08) break;

        const isDeepPop = Math.random() < 0.25;
        const dur = isDeepPop ? 0.014 + Math.random() * 0.01 : 0.005 + Math.random() * 0.014;
        const src = ctx.createBufferSource();
        src.buffer = crackleBuf;

        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = isDeepPop
          ? 700 + Math.random() * 550
          : 1650 + Math.random() * 2150;
        bp.Q.value = isDeepPop ? 1.8 : 1.4 + Math.random() * 1.8;

        const g = ctx.createGain();
        const amp = (isDeepPop ? 0.22 : 0.14) + Math.random() * 0.24;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(amp, t0 + 0.0012);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

        const pan = createStereoPanner(ctx, (Math.random() * 2 - 1) * 0.72);
        src.connect(bp);
        bp.connect(g);
        g.connect(pan);
        pan.connect(masterIn);

        src.start(t0, Math.random() * 0.02, dur + 0.01);
      }

      ct += 0.22 + Math.random() * 0.95;
    }
  }

  // 4) 새소리: 편안한 음역대(1800~3300Hz) 2~3음절 부드러운 지저귐 + 3~6초 여백 + 잔향 + 옅은 숲바람
  function buildBirdsTrack(ctx, masterIn) {
    // 옅은 숲속 바람 배경 (공백이 휑하지 않게)
    const airSrc = ctx.createBufferSource();
    airSrc.buffer = createPinkNoiseBuffer(ctx, RENDER_DURATION_SEC);
    const airBp = ctx.createBiquadFilter();
    airBp.type = "bandpass";
    airBp.frequency.value = 540;
    airBp.Q.value = 0.85;
    const airGain = ctx.createGain();
    airGain.gain.value = 0.11;
    airSrc.connect(airBp);
    airBp.connect(airGain);
    airGain.connect(masterIn);
    airSrc.start(0);

    // 창밖 거리감 + 은은한 잔향 버스
    const birdBus = ctx.createGain();
    birdBus.gain.value = 1.0;

    const birdLp = ctx.createBiquadFilter();
    birdLp.type = "lowpass";
    birdLp.frequency.value = 3350;
    birdLp.Q.value = 0.65;

    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.62;

    const convolver = ctx.createConvolver();
    convolver.buffer = createSoftReverbIR(ctx, 1.7, 2.7);
    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.48;

    birdBus.connect(birdLp);
    birdLp.connect(dryGain);
    birdLp.connect(convolver);
    convolver.connect(wetGain);
    dryGain.connect(masterIn);
    wetGain.connect(masterIn);

    // 3.5~5.8초 충분한 여백을 둔 4~5회의 자연스러운 새 지저귐
    let cursor = 1.4 + Math.random() * 1.4;
    while (cursor < RENDER_DURATION_SEC - 2.6) {
      const baseFreq = 1900 + Math.random() * 1100; // 1900~3000Hz 편안한 음역
      const noteCount = Math.random() < 0.55 ? 2 : 3;
      const panVal = (Math.random() * 2 - 1) * 0.68;
      const panNode = createStereoPanner(ctx, panVal);
      panNode.connect(birdBus);

      let noteTime = cursor;
      for (let n = 0; n < noteCount; n++) {
        const noteDur = 0.11 + Math.random() * 0.06;
        const pitchMult = n === 1 ? 1.08 + Math.random() * 0.1 : n === 2 ? 0.94 + Math.random() * 0.08 : 1.0;
        const f0 = Math.min(3200, baseFreq * pitchMult);
        const fPeak = Math.min(3300, f0 * (1.07 + Math.random() * 0.08));
        const fEnd = Math.max(1750, f0 * (0.91 + Math.random() * 0.06));

        const osc1 = ctx.createOscillator();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(f0, noteTime);
        osc1.frequency.exponentialRampToValueAtTime(fPeak, noteTime + noteDur * 0.42);
        osc1.frequency.exponentialRampToValueAtTime(fEnd, noteTime + noteDur);

        // 아주 미세한 부드러운 2배음(자연스러운 목울림 질감)
        const osc2 = ctx.createOscillator();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(f0 * 1.5, noteTime);
        osc2.frequency.exponentialRampToValueAtTime(fPeak * 1.5, noteTime + noteDur * 0.42);
        osc2.frequency.exponentialRampToValueAtTime(fEnd * 1.5, noteTime + noteDur);

        const g1 = ctx.createGain();
        const peakAmp = 0.12 + Math.random() * 0.06;
        g1.gain.setValueAtTime(0.0001, noteTime);
        g1.gain.linearRampToValueAtTime(peakAmp, noteTime + 0.024);
        g1.gain.exponentialRampToValueAtTime(0.0001, noteTime + noteDur);

        const g2 = ctx.createGain();
        g2.gain.setValueAtTime(0.0001, noteTime);
        g2.gain.linearRampToValueAtTime(peakAmp * 0.12, noteTime + 0.022);
        g2.gain.exponentialRampToValueAtTime(0.0001, noteTime + noteDur * 0.85);

        osc1.connect(g1);
        osc2.connect(g2);
        g1.connect(panNode);
        g2.connect(panNode);

        osc1.start(noteTime);
        osc1.stop(noteTime + noteDur + 0.02);
        osc2.start(noteTime);
        osc2.stop(noteTime + noteDur + 0.02);

        noteTime += noteDur + 0.055 + Math.random() * 0.06;
      }

      // 3.5~6.0초의 여유로운 숲속 여백
      cursor = noteTime + 3.5 + Math.random() * 2.5;
    }
  }

  // 5) 귀뚜라미: 부드러운 사인파(3100~3600Hz) + 20~24Hz 매끄러운 AM 변조 3~4회 울음 + 밤공기 + 잔향
  function buildCricketTrack(ctx, masterIn) {
    // 고요한 밤공기 배경음 (낮고 부드러운 저역)
    const nightSrc = ctx.createBufferSource();
    nightSrc.buffer = createBrownNoiseBuffer(ctx, RENDER_DURATION_SEC);
    const nightLp = ctx.createBiquadFilter();
    nightLp.type = "lowpass";
    nightLp.frequency.value = 340;
    nightLp.Q.value = 0.7;
    const nightGain = ctx.createGain();
    nightGain.gain.value = 0.14;
    nightSrc.connect(nightLp);
    nightLp.connect(nightGain);
    nightGain.connect(masterIn);
    nightSrc.start(0);

    // 먼 풀숲 거리감 + 잔향 버스
    const cricketBus = ctx.createGain();
    cricketBus.gain.value = 1.0;

    const cricketLp = ctx.createBiquadFilter();
    cricketLp.type = "lowpass";
    cricketLp.frequency.value = 3650;
    cricketLp.Q.value = 0.7;

    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.6;

    const convolver = ctx.createConvolver();
    convolver.buffer = createSoftReverbIR(ctx, 1.4, 2.9);
    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.42;

    cricketBus.connect(cricketLp);
    cricketLp.connect(dryGain);
    cricketLp.connect(convolver);
    convolver.connect(wetGain);
    dryGain.connect(masterIn);
    wetGain.connect(masterIn);

    // 1.6~3.4초 자연스러운 휴지기를 두고 2마리가 먼 좌우에서 번갈아 우는 평온한 패턴
    const crickets = [
      { freq: 3240, pan: -0.52, amRate: 21.5 },
      { freq: 3460, pan: 0.56, amRate: 23.0 }
    ];

    let cursor = 1.0 + Math.random() * 0.9;
    let voiceIdx = 0;

    while (cursor < RENDER_DURATION_SEC - 2.2) {
      const voice = crickets[voiceIdx % crickets.length];
      voiceIdx += 1;

      const panNode = createStereoPanner(ctx, voice.pan + (Math.random() - 0.5) * 0.12);
      panNode.connect(cricketBus);

      const chirpsInCall = 3 + (Math.random() < 0.45 ? 1 : 0); // 3~4회 '귀뚤-귀뚤-귀뚤'
      const carrierFreq = voice.freq + (Math.random() - 0.5) * 60;
      const amFreq = voice.amRate + (Math.random() - 0.5) * 1.2;
      const baseAmp = 0.085 + Math.random() * 0.03;

      let ct = cursor;
      for (let c = 0; c < chirpsInCall; c++) {
        const chirpDur = 0.145 + Math.random() * 0.035;

        const carrier = ctx.createOscillator();
        carrier.type = "sine";
        carrier.frequency.setValueAtTime(carrierFreq, ct);

        // 20~24Hz 부드러운 사인 AM 변조
        const amOsc = ctx.createOscillator();
        amOsc.type = "sine";
        amOsc.frequency.setValueAtTime(amFreq, ct);

        const amDepth = ctx.createGain();
        amDepth.gain.value = 0.42;

        const modGain = ctx.createGain();
        modGain.gain.value = 0.58;
        amOsc.connect(amDepth);
        amDepth.connect(modGain.gain);

        const envGain = ctx.createGain();
        envGain.gain.setValueAtTime(0.0001, ct);
        envGain.gain.linearRampToValueAtTime(baseAmp, ct + 0.025);
        envGain.gain.setValueAtTime(baseAmp, ct + chirpDur - 0.03);
        envGain.gain.exponentialRampToValueAtTime(0.0001, ct + chirpDur);

        carrier.connect(modGain);
        modGain.connect(envGain);
        envGain.connect(panNode);

        carrier.start(ct);
        carrier.stop(ct + chirpDur + 0.015);
        amOsc.start(ct);
        amOsc.stop(ct + chirpDur + 0.015);

        ct += chirpDur + 0.055 + Math.random() * 0.025;
      }

      // 1.5~3.5초 휴지기
      cursor = ct + 1.6 + Math.random() * 1.9;
    }
  }

  /* =========================================================================
     [HealingAudioEngine: 24초 WAV 루프 캐싱 + <audio loop> 재생 + 효과음]
     ========================================================================= */

  class HealingAudioEngine {
    constructor() {
      this.ctx = null;
      this.isPlayingAsmr = false;
      this.currentModeId = null; // 'white' | 'rain' | 'wind' | 'fire' | 'birds' | 'cricket' | null
      this.masterVolume = DEFAULT_MASTER_VOLUME;

      // 모드별 24초 WAV Blob URL 캐시 & 진행 중 렌더 프라미스
      this.blobUrlCache = {};
      this.pendingRenders = {};
      this.activeAudioEl = null;
      this.activeFadeRaf = null;
      this.playToken = 0;
    }

    ensureContext() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume();
      }
    }

    async getOrCreateLoopUrl(modeId) {
      if (this.blobUrlCache[modeId]) {
        return this.blobUrlCache[modeId];
      }
      if (this.pendingRenders[modeId]) {
        return this.pendingRenders[modeId];
      }

      const renderPromise = (async () => {
        const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
        if (!OfflineCtx) {
          throw new Error("OfflineAudioContext not supported");
        }

        const totalFrames = Math.ceil(SAMPLE_RATE * RENDER_DURATION_SEC);
        const offlineCtx = new OfflineCtx(2, totalFrames, SAMPLE_RATE);
        const masterIn = createMasterWarmthChain(offlineCtx);

        switch (modeId) {
          case "rain":
            buildRainTrack(offlineCtx, masterIn);
            break;
          case "wind":
            buildWindTrack(offlineCtx, masterIn);
            break;
          case "fire":
            buildFireTrack(offlineCtx, masterIn);
            break;
          case "birds":
            buildBirdsTrack(offlineCtx, masterIn);
            break;
          case "cricket":
            buildCricketTrack(offlineCtx, masterIn);
            break;
          case "white":
          default:
            buildWhiteTrack(offlineCtx, masterIn);
            break;
        }

        const rendered = await offlineCtx.startRendering();
        const mode = SOUND_MODES[modeId] || SOUND_MODES.rain;
        const { channels, sampleRate } = finalizeSeamlessLoop(rendered, mode.targetRms || 0.092);
        const blobUrl = encodeStereoWavBlobUrl(channels, sampleRate);
        this.blobUrlCache[modeId] = blobUrl;
        return blobUrl;
      })();

      this.pendingRenders[modeId] = renderPromise;
      try {
        return await renderPromise;
      } finally {
        delete this.pendingRenders[modeId];
      }
    }

    rampAudioVolume(audioEl, fromVol, toVol, durationMs, onDone) {
      if (!audioEl) {
        if (onDone) onDone();
        return null;
      }
      const startTime = performance.now();
      const clampedFrom = Math.max(0, Math.min(1, fromVol));
      const clampedTo = Math.max(0, Math.min(1, toVol));
      audioEl.volume = clampedFrom;

      const tick = (now) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / Math.max(1, durationMs));
        // 부드러운 smoothstep 커브
        const eased = progress * progress * (3 - 2 * progress);
        const nextVol = clampedFrom + (clampedTo - clampedFrom) * eased;
        try {
          audioEl.volume = Math.max(0, Math.min(1, nextVol));
        } catch (_) {}

        if (progress < 1) {
          audioEl._fadeRaf = requestAnimationFrame(tick);
        } else {
          audioEl._fadeRaf = null;
          if (onDone) onDone();
        }
      };

      if (audioEl._fadeRaf) {
        cancelAnimationFrame(audioEl._fadeRaf);
      }
      audioEl._fadeRaf = requestAnimationFrame(tick);
      return audioEl._fadeRaf;
    }

    fadeOutAndReleaseAudio(audioEl) {
      if (!audioEl) return;
      if (audioEl._fadeRaf) {
        cancelAnimationFrame(audioEl._fadeRaf);
        audioEl._fadeRaf = null;
      }
      const curVol = typeof audioEl.volume === "number" ? audioEl.volume : 0;
      if (audioEl.paused || curVol <= 0.005) {
        try {
          audioEl.pause();
          audioEl.currentTime = 0;
        } catch (_) {}
        return;
      }
      this.rampAudioVolume(audioEl, curVol, 0, FADE_RAMP_MS, () => {
        try {
          audioEl.pause();
          audioEl.currentTime = 0;
        } catch (_) {}
      });
    }

    setVolume(vol) {
      const clamped = Math.max(0, Math.min(1, Number(vol)));
      if (!Number.isFinite(clamped)) return;
      this.masterVolume = clamped;
      if (this.activeAudioEl && this.isPlayingAsmr) {
        const mode = SOUND_MODES[this.currentModeId] || SOUND_MODES.rain;
        const target = Math.max(0, Math.min(1, (mode.playbackVol || 0.68) * this.masterVolume));
        this.activeAudioEl.volume = target;
      }
    }

    /**
     * 특정 소리 모드를 선택했을 때 호출
     * 이미 켜져 있는 동일 모드를 다시 누르면 꺼지고, 다른 모드를 누르면 해당 모드로 즉시 전환됩니다.
     */
    selectMode(modeId) {
      const mode = SOUND_MODES[modeId];
      if (!mode) return { playing: false, modeId: null, message: "ASMR 모드가 해제되었어요" };

      if (this.isPlayingAsmr && this.currentModeId === modeId) {
        this.stopAsmr();
        return {
          playing: false,
          modeId: null,
          message: "ASMR 모드가 해제되었어요"
        };
      }

      this.startAsmr(modeId);
      return {
        playing: true,
        modeId,
        message: mode.toastOn
      };
    }

    startAsmr(modeId = "rain") {
      const mode = SOUND_MODES[modeId] || SOUND_MODES.rain;
      this.ensureContext();

      // 기존 재생 중인 트랙은 0.6초 부드럽게 페이드아웃
      if (this.activeAudioEl) {
        this.fadeOutAndReleaseAudio(this.activeAudioEl);
        this.activeAudioEl = null;
      }

      this.playToken += 1;
      const token = this.playToken;
      this.isPlayingAsmr = true;
      this.currentModeId = mode.id;

      // 사용자 제스처 컨텍스트 안에서 <audio loop> 엘리먼트 즉시 생성
      const audioEl = new Audio();
      audioEl.loop = true;
      audioEl.preload = "auto";
      audioEl.playsInline = true;
      audioEl.volume = 0;
      this.activeAudioEl = audioEl;

      const targetVol = Math.max(
        0,
        Math.min(1, (mode.playbackVol || 0.68) * (this.masterVolume / DEFAULT_MASTER_VOLUME))
      );

      this.getOrCreateLoopUrl(mode.id)
        .then((blobUrl) => {
          if (token !== this.playToken || !this.isPlayingAsmr) return;
          audioEl.src = blobUrl;
          const playPromise = audioEl.play();
          if (playPromise && typeof playPromise.then === "function") {
            playPromise
              .then(() => {
                if (token !== this.playToken || !this.isPlayingAsmr) {
                  this.fadeOutAndReleaseAudio(audioEl);
                  return;
                }
                this.rampAudioVolume(audioEl, 0, targetVol, FADE_RAMP_MS);
              })
              .catch((err) => {
                console.warn("[AudioEngine] 오디오 재생 대기/차단:", err);
              });
          } else {
            this.rampAudioVolume(audioEl, 0, targetVol, FADE_RAMP_MS);
          }
        })
        .catch((err) => {
          console.warn("[AudioEngine] 24초 루프 생성 실패:", err);
        });
    }

    stopAsmr() {
      this.playToken += 1;
      if (this.activeAudioEl) {
        this.fadeOutAndReleaseAudio(this.activeAudioEl);
        this.activeAudioEl = null;
      }
      this.isPlayingAsmr = false;
      this.currentModeId = null;
    }

    playPetReactionSound(type = "bark") {
      this.ensureContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      if (type === "meow") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(520, now);
        osc.frequency.exponentialRampToValueAtTime(680, now + 0.12);
        osc.frequency.exponentialRampToValueAtTime(460, now + 0.32);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
      } else {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(340, now);
        osc.frequency.exponentialRampToValueAtTime(520, now + 0.09);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.16);
      }
    }

    playChime() {
      this.ensureContext();
      if (!this.ctx) return;

      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const now = this.ctx.currentTime + idx * 0.11;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.7);
      });
    }
  }

  PetFocus.SOUND_MODES = SOUND_MODES;
  PetFocus.audioEngine = new HealingAudioEngine();
})(window);
