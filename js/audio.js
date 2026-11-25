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
  const DEFAULT_MASTER_VOLUME = 0.58;

  const SOUND_MODES = {
    white: {
      id: "white",
      label: "백색모드",
      desc: "부드러운 저음 위주 배경 소음",
      toastOn: "🎧 백색모드(잔잔한 배경 소음)를 재생해요",
      targetRms: 0.072,
      playbackVol: 0.58
    },
    rain: {
      id: "rain",
      label: "빗소리",
      toastOn: "🌧️ 빗소리 ASMR을 재생해요",
      targetRms: 0.076,
      playbackVol: 0.62
    },
    wind: {
      id: "wind",
      label: "바람",
      toastOn: "🍃 바람 ASMR을 재생해요",
      targetRms: 0.072,
      playbackVol: 0.6
    },
    fire: {
      id: "fire",
      label: "장작",
      toastOn: "🔥 장작 ASMR을 재생해요",
      targetRms: 0.078,
      playbackVol: 0.64
    },
    birds: {
      id: "birds",
      label: "새소리",
      toastOn: "🐦 숲속 새소리 ASMR을 재생해요",
      targetRms: 0.068,
      playbackVol: 0.6
    },
    cricket: {
      id: "cricket",
      label: "귀뚜라미",
      toastOn: "🦗 고요한 밤 귀뚜라미 ASMR을 재생해요",
      targetRms: 0.066,
      playbackVol: 0.6
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
   * - 36Hz 이하 초저역 정리 + 180Hz 따뜻한 저음 보강 + 2.8kHz 2단 로우패스로
   *   디지털 지지직거림·치찰음·귀 아픈 고주파를 부드럽게 감쇠
   */
  function createMasterWarmthChain(ctx) {
    const subCut = ctx.createBiquadFilter();
    subCut.type = "highpass";
    subCut.frequency.value = 36;
    subCut.Q.value = 0.7;

    const warmLowShelf = ctx.createBiquadFilter();
    warmLowShelf.type = "lowshelf";
    warmLowShelf.frequency.value = 180;
    warmLowShelf.gain.value = 2.0;

    const highShelf = ctx.createBiquadFilter();
    highShelf.type = "highshelf";
    highShelf.frequency.value = 2200;
    highShelf.gain.value = -7.5;

    const warmthLp1 = ctx.createBiquadFilter();
    warmthLp1.type = "lowpass";
    warmthLp1.frequency.value = 2850;
    warmthLp1.Q.value = 0.6;

    const warmthLp2 = ctx.createBiquadFilter();
    warmthLp2.type = "lowpass";
    warmthLp2.frequency.value = 3100;
    warmthLp2.Q.value = 0.6;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.88;

    subCut.connect(warmLowShelf);
    warmLowShelf.connect(highShelf);
    highShelf.connect(warmthLp1);
    warmthLp1.connect(warmthLp2);
    warmthLp2.connect(masterGain);
    masterGain.connect(ctx.destination);

    return subCut;
  }

  /* =========================================================================
     [트랙별 24초 고품질 스테레오 신스 그래프 (OfflineAudioContext)]
     ========================================================================= */

  // 0) 백색모드: 날카로운 화이트 노이즈 배제, 브라운(72%) + 핑크(28%) 저음 위주 포근한 잔잔함
  function buildWhiteTrack(ctx, masterIn) {
    const brownSrc = ctx.createBufferSource();
    brownSrc.buffer = createBrownNoiseBuffer(ctx, RENDER_DURATION_SEC);

    const pinkSrc = ctx.createBufferSource();
    pinkSrc.buffer = createPinkNoiseBuffer(ctx, RENDER_DURATION_SEC);

    const brownGain = ctx.createGain();
    brownGain.gain.value = 0.72;
    const pinkGain = ctx.createGain();
    pinkGain.gain.value = 0.28;

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 55;
    hp.Q.value = 0.65;

    const lp1 = ctx.createBiquadFilter();
    lp1.type = "lowpass";
    lp1.frequency.value = 680;
    lp1.Q.value = 0.62;

    const lp2 = ctx.createBiquadFilter();
    lp2.type = "lowpass";
    lp2.frequency.value = 820;
    lp2.Q.value = 0.6;

    brownSrc.connect(brownGain);
    pinkSrc.connect(pinkGain);
    brownGain.connect(hp);
    pinkGain.connect(hp);
    hp.connect(lp1);
    lp1.connect(lp2);
    lp2.connect(masterIn);

    brownSrc.start(0);
    pinkSrc.start(0);
  }

  // 1) 빗소리: 폭우·바람 노이즈 최소화 + 창문에 톡톡 떨어지는 잔잔하고 따뜻한 빗방울
  function buildRainTrack(ctx, masterIn) {
    // 얕고 포근한 원거리 빗줄기 배경 (브라운+핑크 혼합, LP 1100Hz로 치찰음 제거)
    const brownSrc = ctx.createBufferSource();
    brownSrc.buffer = createBrownNoiseBuffer(ctx, RENDER_DURATION_SEC);
    const pinkSrc = ctx.createBufferSource();
    pinkSrc.buffer = createPinkNoiseBuffer(ctx, RENDER_DURATION_SEC);

    const bGain = ctx.createGain();
    bGain.gain.value = 0.55;
    const pGain = ctx.createGain();
    pGain.gain.value = 0.36;

    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 210;
    hp.Q.value = 0.68;

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1120;
    lp.Q.value = 0.62;

    const bedGain = ctx.createGain();
    bedGain.gain.setValueAtTime(0.42, 0);
    let t = 0;
    while (t < RENDER_DURATION_SEC) {
      const step = 3.6 + Math.random() * 3.8;
      t += step;
      bedGain.gain.linearRampToValueAtTime(
        0.38 + Math.random() * 0.09,
        Math.min(RENDER_DURATION_SEC, t)
      );
    }

    brownSrc.connect(bGain);
    pinkSrc.connect(pGain);
    bGain.connect(hp);
    pGain.connect(hp);
    hp.connect(lp);
    lp.connect(bedGain);
    bedGain.connect(masterIn);
    brownSrc.start(0);
    pinkSrc.start(0);

    // 창문·처마에 톡톡 떨어지는 따뜻한 빗방울 레이어 (핑크 노이즈 기반, 700~1550Hz 부드러운 감쇠)
    const dropNoiseBuf = createPinkNoiseBuffer(ctx, 0.12);
    const dropCount = 96;
    for (let i = 0; i < dropCount; i++) {
      const startTime = Math.random() * (RENDER_DURATION_SEC - 0.15);
      const dur = 0.022 + Math.random() * 0.036;
      const src = ctx.createBufferSource();
      src.buffer = dropNoiseBuf;

      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 720 + Math.random() * 820;
      bp.Q.value = 1.5 + Math.random() * 1.4;

      const g = ctx.createGain();
      const peak = 0.065 + Math.random() * 0.095;
      g.gain.setValueAtTime(0.0001, startTime);
      g.gain.linearRampToValueAtTime(peak, startTime + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

      const pan = createStereoPanner(ctx, (Math.random() * 2 - 1) * 0.78);

      src.connect(bp);
      bp.connect(g);
      g.connect(pan);
      pan.connect(masterIn);

      src.start(startTime, Math.random() * 0.04, dur + 0.015);

      // 간헐적인 창유리 톡- 물방울 공명 (38% 확률, 아주 부드러운 중저음)
      if (Math.random() < 0.38) {
        const tapOsc = ctx.createOscillator();
        tapOsc.type = "sine";
        const fTap = 430 + Math.random() * 290;
        tapOsc.frequency.setValueAtTime(fTap * 1.12, startTime);
        tapOsc.frequency.exponentialRampToValueAtTime(fTap * 0.85, startTime + 0.038);

        const tapGain = ctx.createGain();
        tapGain.gain.setValueAtTime(0.0001, startTime);
        tapGain.gain.linearRampToValueAtTime(0.022 + Math.random() * 0.018, startTime + 0.004);
        tapGain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.042);

        tapOsc.connect(tapGain);
        tapGain.connect(pan);
        tapOsc.start(startTime);
        tapOsc.stop(startTime + 0.048);
      }
    }
  }

  // 2) 바람: 거친 쉭쉭 고음 제거, 멀리서 잔잔히 스치는 저중역(160~380Hz) 산들바람
  function buildWindTrack(ctx, masterIn) {
    const brownSrc = ctx.createBufferSource();
    brownSrc.buffer = createBrownNoiseBuffer(ctx, RENDER_DURATION_SEC);
    const pinkSrc = ctx.createBufferSource();
    pinkSrc.buffer = createPinkNoiseBuffer(ctx, RENDER_DURATION_SEC);

    const bGain = ctx.createGain();
    bGain.gain.value = 0.85;
    const pGain = ctx.createGain();
    pGain.gain.value = 0.16;

    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.05;
    bp.frequency.setValueAtTime(220, 0);

    const windLp = ctx.createBiquadFilter();
    windLp.type = "lowpass";
    windLp.frequency.value = 480;
    windLp.Q.value = 0.6;

    const windGain = ctx.createGain();
    windGain.gain.setValueAtTime(0.36, 0);

    // 8~12초 주기의 완만하고 차분한 원거리 바람결 곡선 (160Hz <-> 380Hz)
    let cursor = 0;
    while (cursor < RENDER_DURATION_SEC) {
      const riseDur = 3.6 + Math.random() * 2.4;
      const fallDur = 4.4 + Math.random() * 2.8;
      const peakFreq = 290 + Math.random() * 90; // ~290..380Hz
      const troughFreq = 160 + Math.random() * 55; // ~160..215Hz
      const peakAmp = 0.56 + Math.random() * 0.18;
      const troughAmp = 0.24 + Math.random() * 0.1;

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
    bp.connect(windLp);
    windLp.connect(windGain);
    windGain.connect(masterIn);

    brownSrc.start(0);
    pinkSrc.start(0);
  }

  // 3) 장작: 바람 같은 배경 노이즈 대폭 축소 + 따뜻한 저음 화로 울림 + 자연스러운 나무 타닥타닥 크래클
  function buildFireTrack(ctx, masterIn) {
    // Layer 1: 낮고 포근한 화로 저음 울림 (LP 135Hz)
    const rumbleSrc = ctx.createBufferSource();
    rumbleSrc.buffer = createBrownNoiseBuffer(ctx, RENDER_DURATION_SEC);
    const rumbleLp = ctx.createBiquadFilter();
    rumbleLp.type = "lowpass";
    rumbleLp.frequency.value = 135;
    rumbleLp.Q.value = 0.7;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = 0.62;

    rumbleSrc.connect(rumbleLp);
    rumbleLp.connect(rumbleGain);
    rumbleGain.connect(masterIn);
    rumbleSrc.start(0);

    // Layer 2: 아주 미세한 불씨 일렁임 (바람 소리 느낌 제거)
    const emberSrc = ctx.createBufferSource();
    emberSrc.buffer = createBrownNoiseBuffer(ctx, RENDER_DURATION_SEC);
    const emberBp = ctx.createBiquadFilter();
    emberBp.type = "bandpass";
    emberBp.frequency.setValueAtTime(260, 0);
    emberBp.Q.value = 1.1;
    const emberGain = ctx.createGain();
    emberGain.gain.setValueAtTime(0.06, 0);

    let ft = 0;
    while (ft < RENDER_DURATION_SEC) {
      ft += 1.4 + Math.random() * 1.8;
      const tNext = Math.min(RENDER_DURATION_SEC, ft);
      emberBp.frequency.exponentialRampToValueAtTime(210 + Math.random() * 110, tNext);
      emberGain.gain.linearRampToValueAtTime(0.04 + Math.random() * 0.04, tNext);
    }

    emberSrc.connect(emberBp);
    emberBp.connect(emberGain);
    emberGain.connect(masterIn);
    emberSrc.start(0);

    // Layer 3: 따뜻한 나무 타닥·탁탁 크래클 (핑크 노이즈 기반, 귀 찌르는 3kHz+ 고음 차단)
    const crackleBuf = createPinkNoiseBuffer(ctx, 0.08);
    let ct = 0.18;
    while (ct < RENDER_DURATION_SEC - 0.18) {
      const clusterCount = Math.random() < 0.42 ? 2 + Math.floor(Math.random() * 2) : 1;
      for (let k = 0; k < clusterCount; k++) {
        const t0 = ct + k * (0.045 + Math.random() * 0.11);
        if (t0 >= RENDER_DURATION_SEC - 0.1) break;

        const isDeepWoodPop = Math.random() < 0.34;
        const dur = isDeepWoodPop ? 0.018 + Math.random() * 0.014 : 0.008 + Math.random() * 0.014;
        const src = ctx.createBufferSource();
        src.buffer = crackleBuf;

        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = isDeepWoodPop
          ? 420 + Math.random() * 320
          : 980 + Math.random() * 1080;
        bp.Q.value = isDeepWoodPop ? 1.6 : 1.5 + Math.random() * 1.5;

        const g = ctx.createGain();
        const amp = (isDeepWoodPop ? 0.28 : 0.2) + Math.random() * 0.2;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(amp, t0 + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

        const pan = createStereoPanner(ctx, (Math.random() * 2 - 1) * 0.66);
        src.connect(bp);
        bp.connect(g);
        g.connect(pan);
        pan.connect(masterIn);

        src.start(t0, Math.random() * 0.03, dur + 0.015);
      }

      ct += 0.26 + Math.random() * 0.92;
    }
  }

  // 4) 새소리: 날카로운 고음 전자음 제거, 중음역대(1150~1900Hz) 부드러운 플루트 톤 + 여유로운 간격
  function buildBirdsTrack(ctx, masterIn) {
    // 아주 잔잔한 숲속 저역 공기감 (바람 치찰음 없음)
    const airSrc = ctx.createBufferSource();
    airSrc.buffer = createBrownNoiseBuffer(ctx, RENDER_DURATION_SEC);
    const airLp = ctx.createBiquadFilter();
    airLp.type = "lowpass";
    airLp.frequency.value = 380;
    airLp.Q.value = 0.65;
    const airGain = ctx.createGain();
    airGain.gain.value = 0.065;
    airSrc.connect(airLp);
    airLp.connect(airGain);
    airGain.connect(masterIn);
    airSrc.start(0);

    // 창밖 원거리감 + 따뜻한 잔향 버스 (2150Hz 이상 감쇠)
    const birdBus = ctx.createGain();
    birdBus.gain.value = 1.0;

    const birdLp = ctx.createBiquadFilter();
    birdLp.type = "lowpass";
    birdLp.frequency.value = 2150;
    birdLp.Q.value = 0.65;

    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.48;

    const convolver = ctx.createConvolver();
    convolver.buffer = createSoftReverbIR(ctx, 1.85, 2.5);
    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.54;

    birdBus.connect(birdLp);
    birdLp.connect(dryGain);
    birdLp.connect(convolver);
    convolver.connect(wetGain);
    dryGain.connect(masterIn);
    wetGain.connect(masterIn);

    // 4.5~7.2초의 여유로운 간격으로 부드러운 중음역 2~3음절 지저귐
    let cursor = 1.8 + Math.random() * 1.4;
    while (cursor < RENDER_DURATION_SEC - 3.2) {
      const baseFreq = 1180 + Math.random() * 580; // 1180~1760Hz 편안한 중음역
      const noteCount = Math.random() < 0.6 ? 2 : 3;
      const panVal = (Math.random() * 2 - 1) * 0.62;
      const panNode = createStereoPanner(ctx, panVal);
      panNode.connect(birdBus);

      let noteTime = cursor;
      for (let n = 0; n < noteCount; n++) {
        const noteDur = 0.14 + Math.random() * 0.07;
        const pitchMult =
          n === 1 ? 1.06 + Math.random() * 0.08 : n === 2 ? 0.93 + Math.random() * 0.06 : 1.0;
        const f0 = Math.min(1880, baseFreq * pitchMult);
        const fPeak = Math.min(1980, f0 * (1.06 + Math.random() * 0.06));
        const fEnd = Math.max(1060, f0 * (0.9 + Math.random() * 0.05));

        const osc = ctx.createOscillator();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(f0, noteTime);
        osc.frequency.exponentialRampToValueAtTime(fPeak, noteTime + noteDur * 0.45);
        osc.frequency.exponentialRampToValueAtTime(fEnd, noteTime + noteDur);

        // 삼각파의 부드러운 배음만 남기는 개별 로우패스
        const toneLp = ctx.createBiquadFilter();
        toneLp.type = "lowpass";
        toneLp.frequency.value = f0 * 1.35;
        toneLp.Q.value = 0.6;

        const g = ctx.createGain();
        const peakAmp = 0.095 + Math.random() * 0.04;
        g.gain.setValueAtTime(0.0001, noteTime);
        g.gain.linearRampToValueAtTime(peakAmp, noteTime + 0.036);
        g.gain.exponentialRampToValueAtTime(0.0001, noteTime + noteDur);

        osc.connect(toneLp);
        toneLp.connect(g);
        g.connect(panNode);

        osc.start(noteTime);
        osc.stop(noteTime + noteDur + 0.025);

        noteTime += noteDur + 0.075 + Math.random() * 0.065;
      }

      // 4.5~7.2초 여유로운 숲속 여백
      cursor = noteTime + 4.5 + Math.random() * 2.7;
    }
  }

  // 5) 귀뚜라미: 휘파람 같은 단조 사인파 제거, 멀리서 잔잔히 들리는 자연스러운 밤 풀벌레 펄스 리듬
  function buildCricketTrack(ctx, masterIn) {
    // 고요한 밤공기 저역 배경음
    const nightSrc = ctx.createBufferSource();
    nightSrc.buffer = createBrownNoiseBuffer(ctx, RENDER_DURATION_SEC);
    const nightLp = ctx.createBiquadFilter();
    nightLp.type = "lowpass";
    nightLp.frequency.value = 240;
    nightLp.Q.value = 0.68;
    const nightGain = ctx.createGain();
    nightGain.gain.value = 0.1;
    nightSrc.connect(nightLp);
    nightLp.connect(nightGain);
    nightGain.connect(masterIn);
    nightSrc.start(0);

    // 먼 풀숲 거리감 + 따뜻한 잔향 버스 (2500Hz 이상 감쇠해 귀 시림 제거)
    const cricketBus = ctx.createGain();
    cricketBus.gain.value = 1.0;

    const cricketLp = ctx.createBiquadFilter();
    cricketLp.type = "lowpass";
    cricketLp.frequency.value = 2450;
    cricketLp.Q.value = 0.65;

    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.36;

    const convolver = ctx.createConvolver();
    convolver.buffer = createSoftReverbIR(ctx, 1.65, 2.7);
    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.56;

    cricketBus.connect(cricketLp);
    cricketLp.connect(dryGain);
    cricketLp.connect(convolver);
    convolver.connect(wetGain);
    dryGain.connect(masterIn);
    wetGain.connect(masterIn);

    // 멀리 좌우 풀숲에서 번갈아 들리는 잔잔한 귀뚜라미 리듬 (2180~2420Hz 부드러운 음역)
    const crickets = [
      { freq: 2220, pan: -0.56 },
      { freq: 2380, pan: 0.58 }
    ];

    let cursor = 1.3 + Math.random() * 1.1;
    let voiceIdx = 0;

    while (cursor < RENDER_DURATION_SEC - 2.8) {
      const voice = crickets[voiceIdx % crickets.length];
      voiceIdx += 1;

      const panNode = createStereoPanner(ctx, voice.pan + (Math.random() - 0.5) * 0.14);
      panNode.connect(cricketBus);

      const syllables = 3 + (Math.random() < 0.4 ? 1 : 0); // 3~4회 '귀뚤-귀뚤-귀뚤'
      const baseFreq = voice.freq + (Math.random() - 0.5) * 55;
      const baseAmp = 0.048 + Math.random() * 0.018;

      let st = cursor;
      for (let s = 0; s < syllables; s++) {
        // 각 음절을 3개의 부드러운 짧은 날개 마찰 펄스로 분절 (연속 휘파람 느낌 제거)
        const pulses = 3;
        for (let p = 0; p < pulses; p++) {
          const pStart = st + p * 0.042;
          const pDur = 0.024;
          const pFreq = baseFreq + (p === 1 ? 18 : 0);

          const oscA = ctx.createOscillator();
          oscA.type = "sine";
          oscA.frequency.setValueAtTime(pFreq, pStart);

          const oscB = ctx.createOscillator();
          oscB.type = "sine";
          oscB.frequency.setValueAtTime(pFreq * 1.007, pStart); // 미세한 자연 코러스

          const g = ctx.createGain();
          const pulseAmp = baseAmp * (p === 1 ? 1.0 : 0.78);
          g.gain.setValueAtTime(0.0001, pStart);
          g.gain.linearRampToValueAtTime(pulseAmp, pStart + 0.006);
          g.gain.exponentialRampToValueAtTime(0.0001, pStart + pDur);

          oscA.connect(g);
          oscB.connect(g);
          g.connect(panNode);

          oscA.start(pStart);
          oscA.stop(pStart + pDur + 0.008);
          oscB.start(pStart);
          oscB.stop(pStart + pDur + 0.008);
        }

        st += 0.195 + Math.random() * 0.035;
      }

      // 2.2~4.2초의 고요한 밤 휴지기
      cursor = st + 2.2 + Math.random() * 2.0;
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
