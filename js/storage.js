/**
 * [Zero-Cost Architecture] 로컬 스토리지 상태 관리 모듈
 * - 보유 뼈다귀, 인벤토리 보유/배치 목록, 누적 집중 시간, 5일 치 시드 집중 기록(focusLogs) 및
 *   오늘의 한 줄 그림일기 데이터를 100% 브라우저 localStorage에 자동 저장 및 복원합니다.
 */
(function (global) {
  const PetFocus = (global.PetFocus = global.PetFocus || {});
  const {
    ITEMS_CATALOG,
    MAX_PLACED_SLOTS,
    ABSOLUTE_MAX_SLOTS = 30,
    SLOT_EXPANSION_TIERS = [],
    getMaxOwnedForItem,
    calculateRewardBreakdown
  } = PetFocus;

  function maxOwnedLimit(itemId) {
    if (typeof getMaxOwnedForItem === "function") {
      return getMaxOwnedForItem(itemId);
    }
    const item = ITEMS_CATALOG.find((i) => i.id === itemId);
    return item && item.category === "window_view" ? 1 : 3;
  }

  function createInstanceId(itemId) {
    return `inst_${itemId}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  }

  const STORAGE_KEY = "pet_focus_timer_state_v3";
  const LEGACY_KEYS = ["pet_focus_timer_state_v1", "pet_focus_timer_state_v2"];

  function formatDateYMD(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function formatDateMD(dateObj) {
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${m}.${d}`;
  }

  function getOffsetDate(daysAgo) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - daysAgo);
    return d;
  }

  /**
   * 최근 5일 치의 자연스러운 샘플 집중 내역(시드 데이터) 생성
   * - 오늘(D-0), 어제(D-1), 그제(D-2) 연속 기록으로 기본 '🔥 3일째' 연속 달성 구현
   * - D-4, D-5 기록을 포함해 총 5일 치 달력 도장 & 주간 그래프 & 타임라인 구성
   */
  function buildDefaultFocusLogs() {
    const d0 = getOffsetDate(0);
    const d1 = getOffsetDate(1);
    const d2 = getOffsetDate(2);
    const d4 = getOffsetDate(4);
    const d5 = getOffsetDate(5);

    return [
      {
        id: "seed-d0-2",
        date: formatDateYMD(d0),
        displayDate: formatDateMD(d0),
        time: "14:30",
        minutes: 25,
        reward: 15,
        label: "25분 집중 완료"
      },
      {
        id: "seed-d0-1",
        date: formatDateYMD(d0),
        displayDate: formatDateMD(d0),
        time: "09:30",
        minutes: 25,
        reward: 15,
        label: "25분 집중 완료"
      },
      {
        id: "seed-d1-3",
        date: formatDateYMD(d1),
        displayDate: formatDateMD(d1),
        time: "20:40",
        minutes: 25,
        reward: 15,
        label: "25분 집중 완료"
      },
      {
        id: "seed-d1-2",
        date: formatDateYMD(d1),
        displayDate: formatDateMD(d1),
        time: "15:10",
        minutes: 30,
        reward: 18,
        label: "30분 집중 완료"
      },
      {
        id: "seed-d1-1",
        date: formatDateYMD(d1),
        displayDate: formatDateMD(d1),
        time: "10:15",
        minutes: 25,
        reward: 15,
        label: "25분 집중 완료"
      },
      {
        id: "seed-d2-2",
        date: formatDateYMD(d2),
        displayDate: formatDateMD(d2),
        time: "16:20",
        minutes: 25,
        reward: 15,
        label: "25분 집중 완료"
      },
      {
        id: "seed-d2-1",
        date: formatDateYMD(d2),
        displayDate: formatDateMD(d2),
        time: "11:00",
        minutes: 25,
        reward: 15,
        label: "25분 집중 완료"
      },
      {
        id: "seed-d4-3",
        date: formatDateYMD(d4),
        displayDate: formatDateMD(d4),
        time: "19:30",
        minutes: 25,
        reward: 15,
        label: "25분 집중 완료"
      },
      {
        id: "seed-d4-2",
        date: formatDateYMD(d4),
        displayDate: formatDateMD(d4),
        time: "14:00",
        minutes: 30,
        reward: 18,
        label: "30분 집중 완료"
      },
      {
        id: "seed-d4-1",
        date: formatDateYMD(d4),
        displayDate: formatDateMD(d4),
        time: "09:50",
        minutes: 30,
        reward: 18,
        label: "30분 집중 완료"
      },
      {
        id: "seed-d5-2",
        date: formatDateYMD(d5),
        displayDate: formatDateMD(d5),
        time: "17:45",
        minutes: 35,
        reward: 21,
        label: "35분 집중 완료"
      },
      {
        id: "seed-d5-1",
        date: formatDateYMD(d5),
        displayDate: formatDateMD(d5),
        time: "13:00",
        minutes: 25,
        reward: 15,
        label: "25분 집중 완료"
      }
    ];
  }

  function cloneDefaultState() {
    const focusLogs = buildDefaultFocusLogs();
    const todayYMD = formatDateYMD(new Date());
    const todaySessions = focusLogs.filter((l) => l.date === todayYMD);

    return {
      bones: 9999, // 뼈다귀 보유 개수 9999개 설정
      defaultPolicyRev: 8, // 뼈다귀 9999개 설정 버전
      ownedItems: ["living_room_dog"], // 초기 기본 제공(무료 보유): 크로키 강아지 1종만
      ownedCounts: { living_room_dog: 1 }, // 품목별 보유 수량 { [itemId]: count }
      placedItems: [], // 하위 호환용 배치 itemId 배열 (placedInstances와 항상 동기화)
      placedInstances: [], // 거실 배치 개별 인스턴스 [{ instanceId, itemId, x, y, flipX, animDelay }]
      maxPlacementSlots: MAX_PLACED_SLOTS, // 기본 배치 한도 10칸 (뼈다귀로 5단계, 최대 20칸까지 확장 가능)
      activeWindowView: null, // 창밖 풍경 전용 1슬롯 (미착용 시 기본 빈 창문)
      itemPositions: {}, // 드래그로 이동한 각 소품·동물의 사용자 지정 좌표 { [itemId]: { x, y } }
      firstFocusCompleted: false, // 생애 첫 집중 완주 웰컴 보너스(+30개) 수령 여부
      timerMinutes: 25,
      baseHistoricalMinutes: 420, // 시드(325분) + 420분 = 총 745분(12시간 25분)
      totalFocusMinutes: 745,
      totalSessionsCount: focusLogs.length,
      lastDate: todayYMD,
      focusLogs,
      todaySessions,
      settings: {
        soundEnabled: false,
        soundTheme: "rain",
        autoSyncSoundWithWindow: false, // 창밖 풍경에 맞춰 소리 자동 변경 (기본 OFF: 완전 독립)
        autoEquipOnBuy: true,
        customDiaryNote: "",
        dndEnabled: false,
        dndAllowRepeatCalls: true,
        lampLit: true,
        lightStates: {
          stand_lamp: true,
          cloud_wall_lamp: true,
          crescent_mood_lamp: true,
          mushroom_stand_lamp: true,
          starlight_garland: true,
          aroma_candle: true
        }
      }
    };
  }

  class AppStorage {
    constructor() {
      this.state = this.load();
      this.listeners = new Set();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (e) {
        // ignore storage quota errors on init
      }
    }

    load() {
      try {
        LEGACY_KEYS.forEach((key) => {
          if (localStorage.getItem(key)) {
            localStorage.removeItem(key);
          }
        });

        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
          return cloneDefaultState();
        }
        const parsed = JSON.parse(raw);
        const defaults = cloneDefaultState();
        const todayYMD = formatDateYMD(new Date());

        let focusLogs = Array.isArray(parsed.focusLogs) && parsed.focusLogs.length >= 5
          ? parsed.focusLogs
          : defaults.focusLogs;

        const todaySessions = focusLogs.filter((l) => l.date === todayYMD);
        const logsSumMins = focusLogs.reduce((acc, l) => acc + (Number(l.minutes) || 0), 0);
        const baseHist = typeof parsed.baseHistoricalMinutes === "number" ? parsed.baseHistoricalMinutes : 420;

        const validCatalogIds = new Set(ITEMS_CATALOG.map((i) => i.id));
        const defaultOwned = ITEMS_CATALOG.filter((i) => i.defaultOwned).map((i) => i.id);
        let rawOwned = Array.isArray(parsed.ownedItems) ? parsed.ownedItems : [];
        let rawPlaced = Array.isArray(parsed.placedItems) ? parsed.placedItems : [];
        let currentBones = typeof parsed.bones === "number" ? parsed.bones : 1000;

        // 삭제된 구 아이템(예: heart_rug)이 localStorage에 남아 있더라도 오류가 나지 않게 안전하게 필터링
        rawOwned = rawOwned.filter((id) => validCatalogIds.has(id));
        rawPlaced = rawPlaced.filter((id) => validCatalogIds.has(id));

        // [기본 제공 아이템 정책 변경 & 뼈다귀 1000개 충전 마이그레이션]
        if ((Number(parsed.defaultPolicyRev) || 0) < 2) {
          rawOwned = ["living_room_dog"];
          rawPlaced = rawPlaced.filter((id) => id === "living_room_dog");
        }
        if ((Number(parsed.defaultPolicyRev) || 0) < 5) {
          currentBones = 1000;
        }
        if ((Number(parsed.defaultPolicyRev) || 0) < 7) {
          currentBones += 1000;
        }
        if ((Number(parsed.defaultPolicyRev) || 0) < 8) {
          currentBones = 9999;
        }

        const ownedSet = new Set([...defaultOwned, ...rawOwned]);

        const cleanedPositions = {};
        if (parsed.itemPositions && typeof parsed.itemPositions === "object") {
          Object.entries(parsed.itemPositions).forEach(([k, v]) => {
            if (validCatalogIds.has(k) && v && typeof v.x === "number" && typeof v.y === "number") {
              cleanedPositions[k] = { x: v.x, y: v.y };
            }
          });
        }

        // [창문·창틀선 상향 조정 마이그레이션 (v4): 기존 창틀(54/122/190)에 배치된 소품·동물을 새 창틀선(24/92/160)으로 자동 이동]
        if ((Number(parsed.defaultPolicyRev) || 0) < 4) {
          const LEGACY_SILL_OFFSETS = {
            cockatiel_bird: 1.5,
            hamster_friend: 1,
            living_room_dog: 17,
            wall_clock: 18,
            mini_bookshelf: 7,
            tennis_ball: 10.5,
            yarn_ball: 11
          };
          Object.entries(cleanedPositions).forEach(([k, pos]) => {
            const offset = LEGACY_SILL_OFFSETS[k] || 0;
            const footY = pos.y + offset;
            const onOldBottom =
              pos.x >= 20 && pos.x <= 360 && Math.abs(footY - 190) <= 10;
            const onOldMid =
              pos.x >= 106 && pos.x <= 274 && Math.abs(footY - 122) <= 10;
            const onOldTop =
              pos.x >= 106 && pos.x <= 274 && Math.abs(footY - 54) <= 10;
            if (onOldBottom || onOldMid || onOldTop) {
              cleanedPositions[k] = {
                x: pos.x,
                y: Math.round((pos.y - 30) * 10) / 10
              };
            }
          });
        }

        const windowViewIdSet = new Set(
          ITEMS_CATALOG.filter((i) => i.category === "window_view").map((i) => i.id)
        );
        // v6 마이그레이션: 기존 무료 제공이던 view_sunny_clouds를 유료 상점 1번으로 전환하고 기본 창문을 깨끗한 빈 창문으로 원복
        if ((Number(parsed.defaultPolicyRev) || 0) < 6) {
          ownedSet.delete("view_sunny_clouds");
        }

        // [자동 마이그레이션 1] ownedCounts { [itemId]: count } 생성 (구 ownedItems string[] -> 각 count: 1 자동 변환)
        const ownedCounts = {};
        if (parsed.ownedCounts && typeof parsed.ownedCounts === "object" && !Array.isArray(parsed.ownedCounts)) {
          Object.entries(parsed.ownedCounts).forEach(([id, cnt]) => {
            if (!validCatalogIds.has(id)) return;
            const n = Math.floor(Number(cnt) || 0);
            if (n > 0) {
              ownedCounts[id] = Math.min(maxOwnedLimit(id), n);
            }
          });
        }
        // 기존 배열(ownedItems) 및 기본 보유 아이템도 누락 없이 최소 1개로 병합
        ownedSet.forEach((id) => {
          if (!validCatalogIds.has(id)) return;
          if (!ownedCounts[id] || ownedCounts[id] < 1) {
            ownedCounts[id] = 1;
          }
        });
        // v6 마이그레이션에서 제거된 view_sunny_clouds가 ownedCounts에 남아있다면 정리
        if ((Number(parsed.defaultPolicyRev) || 0) < 6) {
          delete ownedCounts.view_sunny_clouds;
        }
        const finalOwnedIds = Object.keys(ownedCounts).filter((id) => ownedCounts[id] > 0);
        const finalOwnedSet = new Set(finalOwnedIds);

        // 기존 placedItems에 창밖 풍경이 들어있었다면 전용 슬롯(activeWindowView)으로 분리 이관
        let resolvedWindowView =
          typeof parsed.activeWindowView === "string" &&
          windowViewIdSet.has(parsed.activeWindowView) &&
          finalOwnedSet.has(parsed.activeWindowView)
            ? parsed.activeWindowView
            : null;

        const urlParams =
          typeof window !== "undefined" && window.location
            ? new URLSearchParams(window.location.search)
            : null;
        const shouldResetSlots = Boolean(urlParams && urlParams.get("resetSlots") === "1");
        if (shouldResetSlots && window.history && typeof window.history.replaceState === "function") {
          window.history.replaceState({}, document.title, window.location.pathname);
        }

        const rawMaxSlots = Number(parsed.maxPlacementSlots);
        const resolvedMaxSlots = shouldResetSlots
          ? MAX_PLACED_SLOTS
          : Number.isFinite(rawMaxSlots) && rawMaxSlots >= MAX_PLACED_SLOTS
            ? Math.min(ABSOLUTE_MAX_SLOTS, Math.floor(rawMaxSlots / 2) * 2)
            : MAX_PLACED_SLOTS;

        // [자동 마이그레이션 2] placedInstances [{ instanceId, itemId, x, y, flipX, animDelay }] 복원 또는 구 placedItems 자동 변환
        const placedInstances = [];
        const perItemPlacedCount = {};
        const usedInstanceIds = new Set();

        const getFallbackPos = (itemId) => {
          if (cleanedPositions[itemId]) {
            return { x: cleanedPositions[itemId].x, y: cleanedPositions[itemId].y };
          }
          const catItem = ITEMS_CATALOG.find((i) => i.id === itemId);
          return catItem?.defaultPos ? { ...catItem.defaultPos } : { x: 190, y: 290 };
        };

        if (Array.isArray(parsed.placedInstances)) {
          for (const entry of parsed.placedInstances) {
            if (!entry || typeof entry !== "object") continue;
            const id = entry.itemId;
            if (!id || !finalOwnedSet.has(id) || !validCatalogIds.has(id)) continue;
            if (windowViewIdSet.has(id)) {
              if (!resolvedWindowView) resolvedWindowView = id;
              continue;
            }
            const curCount = perItemPlacedCount[id] || 0;
            if (curCount >= (ownedCounts[id] || 0)) continue;
            if (placedInstances.length >= resolvedMaxSlots) break;

            const fallback = getFallbackPos(id);
            let instId =
              typeof entry.instanceId === "string" && entry.instanceId.trim()
                ? entry.instanceId.trim()
                : `inst_${id}_${curCount + 1}`;
            if (usedInstanceIds.has(instId)) {
              instId = createInstanceId(id);
            }
            usedInstanceIds.add(instId);

            const px = typeof entry.x === "number" && Number.isFinite(entry.x) ? entry.x : fallback.x;
            const py = typeof entry.y === "number" && Number.isFinite(entry.y) ? entry.y : fallback.y;
            placedInstances.push({
              instanceId: instId,
              itemId: id,
              x: Math.round(px * 10) / 10,
              y: Math.round(py * 10) / 10,
              flipX: Boolean(entry.flipX),
              animDelay: Number.isFinite(Number(entry.animDelay)) ? Number(entry.animDelay) : 0
            });
            perItemPlacedCount[id] = curCount + 1;
          }
        } else {
          // 구 버전 placedItems(string[])를 고유 instanceId 객체 배열로 자동 마이그레이션 (기존 좌표 유지)
          for (const id of rawPlaced) {
            if (!finalOwnedSet.has(id) || !validCatalogIds.has(id)) continue;
            if (windowViewIdSet.has(id)) {
              if (!resolvedWindowView) resolvedWindowView = id;
              continue;
            }
            const curCount = perItemPlacedCount[id] || 0;
            if (curCount >= (ownedCounts[id] || 0)) continue;
            if (placedInstances.length >= resolvedMaxSlots) break;

            const pos = getFallbackPos(id);
            const instId = `inst_${id}_${curCount + 1}`;
            usedInstanceIds.add(instId);
            placedInstances.push({
              instanceId: instId,
              itemId: id,
              x: Math.round(pos.x * 10) / 10,
              y: Math.round(pos.y * 10) / 10,
              flipX: curCount % 2 === 1,
              animDelay: curCount === 0 ? 0 : Number((curCount * 1.2).toFixed(2))
            });
            perItemPlacedCount[id] = curCount + 1;
          }
        }

        return {
          ...defaults,
          ...parsed,
          bones: currentBones,
          defaultPolicyRev: 8,
          baseHistoricalMinutes: baseHist,
          totalFocusMinutes: baseHist + logsSumMins,
          focusLogs,
          todaySessions,
          lastDate: todayYMD,
          firstFocusCompleted: Boolean(parsed.firstFocusCompleted),
          ownedCounts,
          ownedItems: finalOwnedIds,
          maxPlacementSlots: resolvedMaxSlots,
          placedInstances,
          placedItems: placedInstances.map((inst) => inst.itemId),
          activeWindowView: resolvedWindowView,
          itemPositions: cleanedPositions,
          settings: {
            ...defaults.settings,
            ...(parsed.settings || {}),
            lightStates: {
              ...(defaults.settings.lightStates || {}),
              ...(parsed.settings?.lightStates || {})
            }
          }
        };
      } catch (e) {
        console.warn("[AppStorage] localStorage 읽기 실패, 기본값 사용:", e);
        return cloneDefaultState();
      }
    }

    save(options = {}) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (e) {
        console.warn("[AppStorage] localStorage 저장 실패:", e);
      }
      if (!options.silent) {
        this.notify();
      }
    }

    subscribe(listener) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    }

    notify() {
      for (const cb of this.listeners) {
        cb(this.state);
      }
    }

    getState() {
      return this.state;
    }

    syncLegacyCollections() {
      const counts = this.state.ownedCounts || {};
      this.state.ownedItems = Object.keys(counts).filter((id) => (Number(counts[id]) || 0) > 0);
      const instances = Array.isArray(this.state.placedInstances) ? this.state.placedInstances : [];
      this.state.placedItems = instances.map((inst) => inst.itemId);
    }

    getOwnedCount(itemId) {
      if (!itemId) return 0;
      const counts = this.state.ownedCounts || {};
      return Math.max(0, Math.floor(Number(counts[itemId]) || 0));
    }

    getMaxOwnedCount(itemId) {
      return maxOwnedLimit(itemId);
    }

    isOwned(itemId) {
      return this.getOwnedCount(itemId) > 0;
    }

    getPlacedInstances() {
      return Array.isArray(this.state.placedInstances) ? this.state.placedInstances : [];
    }

    getPlacedInstancesByItem(itemId) {
      return this.getPlacedInstances().filter((inst) => inst.itemId === itemId);
    }

    getPlacedCount(itemId) {
      const item = ITEMS_CATALOG.find((i) => i.id === itemId);
      if (item && item.category === "window_view") {
        return this.getActiveWindowViewId() === itemId ? 1 : 0;
      }
      return this.getPlacedInstancesByItem(itemId).length;
    }

    getInstanceById(instanceId) {
      if (!instanceId) return null;
      return this.getPlacedInstances().find((inst) => inst.instanceId === instanceId) || null;
    }

    isPlaced(itemId) {
      return this.getPlacedCount(itemId) > 0;
    }

    setTimerMinutes(minutes) {
      const clamped = Math.max(5, Math.min(120, minutes));
      this.state.timerMinutes = clamped;
      this.save();
    }

    setAutoEquipOnBuy(val) {
      this.state.settings.autoEquipOnBuy = Boolean(val);
      this.save();
    }

    setAutoSyncSoundWithWindow(val) {
      this.state.settings.autoSyncSoundWithWindow = Boolean(val);
      this.save();
    }

    getActiveWindowViewId() {
      const cur = this.state.activeWindowView;
      if (cur && ITEMS_CATALOG.some((i) => i.id === cur && i.category === "window_view")) {
        return cur;
      }
      return null;
    }

    getAllActiveBoostIds() {
      // 같은 itemId가 거실에 2~3개 배치되어 있어도 Set으로 중복 제거해 종류당 1회만 부스트 합산
      const uniqueIds = new Set(this.getPlacedInstances().map((inst) => inst.itemId));
      const activeView = this.getActiveWindowViewId();
      if (activeView) uniqueIds.add(activeView);
      return Array.from(uniqueIds);
    }

    getMaxPlacementSlots() {
      const cur = Number(this.state.maxPlacementSlots);
      if (Number.isFinite(cur) && cur >= MAX_PLACED_SLOTS) {
        return Math.min(ABSOLUTE_MAX_SLOTS, Math.floor(cur / 2) * 2);
      }
      return MAX_PLACED_SLOTS;
    }

    getNextSlotExpansionTier() {
      const curMax = this.getMaxPlacementSlots();
      if (curMax >= ABSOLUTE_MAX_SLOTS) return null;
      return SLOT_EXPANSION_TIERS.find((tier) => tier.from === curMax) || null;
    }

    expandPlacementSlots() {
      const nextTier = this.getNextSlotExpansionTier();
      if (!nextTier) {
        return { ok: false, reason: "ALREADY_MAX", maxSlots: this.getMaxPlacementSlots() };
      }
      if (this.state.bones < nextTier.cost) {
        return {
          ok: false,
          reason: "NOT_ENOUGH_BONES",
          tier: nextTier,
          shortage: nextTier.cost - this.state.bones
        };
      }

      this.state.bones -= nextTier.cost;
      this.state.maxPlacementSlots = nextTier.to;
      this.save();
      return {
        ok: true,
        tier: nextTier,
        maxSlots: nextTier.to,
        remainingBones: this.state.bones
      };
    }

    setCustomDiaryNote(noteText) {
      this.state.settings.customDiaryNote = String(noteText || "");
      this.save();
    }

    setDndSettings(dndEnabled, dndAllowRepeatCalls) {
      if (typeof dndEnabled === "boolean") {
        this.state.settings.dndEnabled = dndEnabled;
      }
      if (typeof dndAllowRepeatCalls === "boolean") {
        this.state.settings.dndAllowRepeatCalls = dndAllowRepeatCalls;
      }
      this.save();
    }

    getLampLit(itemId = "stand_lamp") {
      if (itemId && this.state.settings?.lightStates && typeof this.state.settings.lightStates[itemId] === "boolean") {
        return this.state.settings.lightStates[itemId];
      }
      return this.state.settings?.lampLit !== false;
    }

    setLampLit(isLit, itemId = "stand_lamp") {
      if (!this.state.settings) this.state.settings = {};
      if (!this.state.settings.lightStates || typeof this.state.settings.lightStates !== "object") {
        this.state.settings.lightStates = {};
      }
      const val = Boolean(isLit);
      if (typeof itemId === "string" && itemId) {
        this.state.settings.lightStates[itemId] = val;
        if (itemId === "stand_lamp") {
          this.state.settings.lampLit = val;
        }
      } else {
        this.state.settings.lampLit = val;
        this.state.settings.lightStates.stand_lamp = val;
      }
      this.save();
    }

    /**
     * 드래그 앤 드롭으로 이동한 소품·동물의 최종 좌표(x, y)를 localStorage에 즉시 저장합니다.
     * - 1번째 인스턴스 좌표와 itemPositions[itemId]를 동기화 유지
     */
    setItemPosition(itemId, x, y) {
      if (!itemId) return;
      const rx = Math.round((Number(x) || 0) * 10) / 10;
      const ry = Math.round((Number(y) || 0) * 10) / 10;
      if (!this.state.itemPositions || typeof this.state.itemPositions !== "object") {
        this.state.itemPositions = {};
      }
      this.state.itemPositions[itemId] = { x: rx, y: ry };
      const firstInst = this.getPlacedInstancesByItem(itemId)[0];
      if (firstInst) {
        firstInst.x = rx;
        firstInst.y = ry;
      }
      // 드래그·드롭 좌표 저장은 캔버스가 이미 해당 객체만 직접 갱신했으므로 전체 리렌더링(notify) 생략
      this.save({ silent: true });
    }

    setInstancePosition(instanceId, x, y) {
      if (!instanceId) return;
      const inst = this.getInstanceById(instanceId);
      if (!inst) return;
      const rx = Math.round((Number(x) || 0) * 10) / 10;
      const ry = Math.round((Number(y) || 0) * 10) / 10;
      inst.x = rx;
      inst.y = ry;
      const sameList = this.getPlacedInstancesByItem(inst.itemId);
      if (sameList[0] && sameList[0].instanceId === instanceId) {
        if (!this.state.itemPositions || typeof this.state.itemPositions !== "object") {
          this.state.itemPositions = {};
        }
        this.state.itemPositions[inst.itemId] = { x: rx, y: ry };
      }
      this.save({ silent: true });
    }

    getInstancePosition(instanceId) {
      const inst = this.getInstanceById(instanceId);
      if (inst && typeof inst.x === "number" && typeof inst.y === "number") {
        return { x: inst.x, y: inst.y };
      }
      return { x: 190, y: 290 };
    }

    getItemPosition(itemId) {
      const firstInst = this.getPlacedInstancesByItem(itemId)[0];
      if (firstInst && typeof firstInst.x === "number" && typeof firstInst.y === "number") {
        return { x: firstInst.x, y: firstInst.y };
      }
      const saved = this.state.itemPositions?.[itemId];
      if (saved && typeof saved.x === "number" && typeof saved.y === "number") {
        return { x: saved.x, y: saved.y };
      }
      const item = ITEMS_CATALOG.find((i) => i.id === itemId);
      return item?.defaultPos ? { ...item.defaultPos } : { x: 190, y: 290 };
    }

    /**
     * 같은 아이템을 2~3개 배치할 때 서로 겹치지 않도록 자연스럽게 비껴난 스폰 좌표를 계산합니다.
     */
    computeSpawnOffsetPosition(itemId, existingSameInstances = []) {
      const item = ITEMS_CATALOG.find((i) => i.id === itemId);
      const allPlaced = Array.isArray(this.state.placedInstances)
        ? this.state.placedInstances
        : [];
      const base = existingSameInstances.length === 0
        ? this.getItemPosition(itemId)
        : (item?.defaultPos ? { ...item.defaultPos } : this.getItemPosition(itemId));

      const isWallOrSill = base.y <= 170;

      // 첫 번째 인스턴스이고 주변에 겹치는 배치물이 없으면 원래 기본 위치 그대로 배치
      if (existingSameInstances.length === 0) {
        const collidesAny = allPlaced.some(
          (inst) => Math.hypot((inst.x || 0) - base.x, (inst.y || 0) - base.y) < 22
        );
        if (!collidesAny) {
          return { x: Math.round(base.x * 10) / 10, y: Math.round(base.y * 10) / 10 };
        }
      }

      const candidates = isWallOrSill
        ? [
            { dx: 46, dy: 0 },
            { dx: -46, dy: 0 },
            { dx: 84, dy: 0 },
            { dx: -84, dy: 0 },
            { dx: 120, dy: 0 },
            { dx: -120, dy: 0 },
            { dx: 26, dy: 0 },
            { dx: -26, dy: 0 }
          ]
        : [
            { dx: 52, dy: 8 },
            { dx: -52, dy: 12 },
            { dx: 84, dy: -10 },
            { dx: -84, dy: -8 },
            { dx: 34, dy: 38 },
            { dx: -34, dy: 42 },
            { dx: 96, dy: 48 },
            { dx: -96, dy: 46 },
            { dx: 0, dy: 64 },
            { dx: 64, dy: 82 },
            { dx: -64, dy: 82 },
            { dx: 120, dy: 24 },
            { dx: -120, dy: 24 },
            { dx: 44, dy: -46 },
            { dx: -44, dy: -46 }
          ];

      for (const offset of candidates) {
        const cx = Math.max(46, Math.min(334, base.x + offset.dx));
        const cy = isWallOrSill
          ? base.y
          : Math.max(194, Math.min(430, base.y + offset.dy));
        const tooClose = allPlaced.some(
          (inst) => Math.hypot((inst.x || 0) - cx, (inst.y || 0) - cy) < 28
        );
        if (!tooClose) {
          return { x: Math.round(cx * 10) / 10, y: Math.round(cy * 10) / 10 };
        }
      }

      // 최대 30개 배치 시에도 거실 전역에 고르게 분산되도록 여유 공간 탐색
      if (!isWallOrSill) {
        const floorGrid = [
          { x: 64, y: 214 }, { x: 130, y: 214 }, { x: 196, y: 214 }, { x: 262, y: 214 }, { x: 320, y: 214 },
          { x: 64, y: 274 }, { x: 130, y: 274 }, { x: 196, y: 274 }, { x: 262, y: 274 }, { x: 320, y: 274 },
          { x: 64, y: 336 }, { x: 130, y: 336 }, { x: 196, y: 336 }, { x: 262, y: 336 }, { x: 320, y: 336 },
          { x: 64, y: 398 }, { x: 130, y: 398 }, { x: 196, y: 398 }, { x: 262, y: 398 }, { x: 320, y: 398 }
        ];
        let bestSpot = floorGrid[0];
        let bestMinDist = -1;
        for (const pt of floorGrid) {
          let minDist = Infinity;
          for (const inst of allPlaced) {
            const d = Math.hypot((inst.x || 0) - pt.x, (inst.y || 0) - pt.y);
            if (d < minDist) minDist = d;
          }
          if (minDist > bestMinDist) {
            bestMinDist = minDist;
            bestSpot = pt;
          }
        }
        return { x: bestSpot.x, y: bestSpot.y };
      }

      const fallbackX = Math.max(46, Math.min(334, base.x + (existingSameInstances.length % 2 === 1 ? 42 : -42)));
      return { x: Math.round(fallbackX * 10) / 10, y: Math.round(base.y * 10) / 10 };
    }

    placeOneInstance(itemId) {
      const item = ITEMS_CATALOG.find((i) => i.id === itemId);
      if (!item) return { ok: false, reason: "NOT_FOUND" };
      if (!this.isOwned(itemId)) return { ok: false, reason: "NOT_OWNED" };

      if (item.category === "window_view") {
        const prevView = this.getActiveWindowViewId();
        this.state.activeWindowView = itemId;
        this.save();
        return { ok: true, action: prevView ? "replaced" : "placed" };
      }

      const ownedCount = this.getOwnedCount(itemId);
      const sameInstances = this.getPlacedInstancesByItem(itemId);
      if (sameInstances.length >= ownedCount) {
        return { ok: false, reason: "NO_SPARE_OWNED" };
      }
      if (this.getPlacedInstances().length >= this.getMaxPlacementSlots()) {
        return { ok: false, reason: "SLOT_FULL", maxSlots: this.getMaxPlacementSlots() };
      }

      const pos = this.computeSpawnOffsetPosition(itemId, sameInstances);
      const nthIndex = sameInstances.length; // 0, 1, 2
      const newInstance = {
        instanceId: createInstanceId(itemId),
        itemId,
        x: pos.x,
        y: pos.y,
        flipX: nthIndex % 2 === 1,
        animDelay: nthIndex === 0 ? 0 : Number((nthIndex * 1.15 + Math.random() * 0.45).toFixed(2))
      };

      if (!Array.isArray(this.state.placedInstances)) {
        this.state.placedInstances = [];
      }
      this.state.placedInstances.push(newInstance);
      this.syncLegacyCollections();
      this.save();
      return { ok: true, action: "placed", instance: newInstance };
    }

    removePlacedInstance(instanceId) {
      if (!instanceId || !Array.isArray(this.state.placedInstances)) return false;
      const idx = this.state.placedInstances.findIndex((inst) => inst.instanceId === instanceId);
      if (idx === -1) return false;
      this.state.placedInstances.splice(idx, 1);
      this.syncLegacyCollections();
      this.save();
      return true;
    }

    removeOneInstanceByItem(itemId) {
      const item = ITEMS_CATALOG.find((i) => i.id === itemId);
      if (item && item.category === "window_view") {
        if (this.getActiveWindowViewId() === itemId) {
          this.state.activeWindowView = null;
          this.save();
          return true;
        }
        return false;
      }
      const list = this.getPlacedInstances();
      for (let i = list.length - 1; i >= 0; i--) {
        if (list[i].itemId === itemId) {
          list.splice(i, 1);
          this.syncLegacyCollections();
          this.save();
          return true;
        }
      }
      return false;
    }

    getEffectivePurchasePrice(itemId) {
      const item = ITEMS_CATALOG.find((i) => i.id === itemId);
      if (!item) return 0;
      const curOwned = this.getOwnedCount(itemId);
      if (typeof PetFocus.getPurchasePriceForItem === "function") {
        return PetFocus.getPurchasePriceForItem(item, curOwned);
      }
      const basePrice = Number(item.price) || 0;
      return curOwned >= 1 && basePrice === 0 ? 50 : basePrice;
    }

    purchaseItem(itemId, autoPlace = true) {
      const item = ITEMS_CATALOG.find((i) => i.id === itemId);
      if (!item) return { ok: false, reason: "NOT_FOUND" };

      const curOwned = this.getOwnedCount(itemId);
      const maxOwned = this.getMaxOwnedCount(itemId);
      if (curOwned >= maxOwned) {
        return { ok: false, reason: "MAX_OWNED", maxOwned };
      }
      const effectivePrice = this.getEffectivePurchasePrice(itemId);
      if (this.state.bones < effectivePrice) return { ok: false, reason: "NOT_ENOUGH_BONES" };

      this.state.bones -= effectivePrice;
      if (!this.state.ownedCounts || typeof this.state.ownedCounts !== "object") {
        this.state.ownedCounts = {};
      }
      this.state.ownedCounts[itemId] = curOwned + 1;
      this.syncLegacyCollections();

      let placed = false;
      let replaced = false;
      let slotFull = false;

      if (autoPlace) {
        if (item.category === "window_view") {
          // 창밖 풍경 전용 슬롯(최대 배치 카운트에서 완전 제외): 슬롯이 가득 차 있어도 즉시 적용·교체 가능
          const prevView = this.getActiveWindowViewId();
          this.state.activeWindowView = itemId;
          placed = true;
          replaced = prevView !== itemId;
        } else if (this.getPlacedInstances().length < this.getMaxPlacementSlots()) {
          const sameInstances = this.getPlacedInstancesByItem(itemId);
          const pos = this.computeSpawnOffsetPosition(itemId, sameInstances);
          const nthIndex = sameInstances.length;
          if (!Array.isArray(this.state.placedInstances)) {
            this.state.placedInstances = [];
          }
          this.state.placedInstances.push({
            instanceId: createInstanceId(itemId),
            itemId,
            x: pos.x,
            y: pos.y,
            flipX: nthIndex % 2 === 1,
            animDelay: nthIndex === 0 ? 0 : Number((nthIndex * 1.15 + Math.random() * 0.45).toFixed(2))
          });
          this.syncLegacyCollections();
          placed = true;
        } else {
          slotFull = true;
        }
      }

      this.save();
      return { ok: true, placed, replaced, slotFull, item, ownedCount: this.getOwnedCount(itemId) };
    }

    togglePlaceItem(itemId) {
      if (!this.isOwned(itemId)) {
        return { ok: false, reason: "NOT_OWNED" };
      }

      const item = ITEMS_CATALOG.find((i) => i.id === itemId);

      // 창밖 풍경 전용 1슬롯 (배치 카운트에서 완전 제외, 언제든 자유롭게 적용·교체·해제)
      if (item && item.category === "window_view") {
        const curView = this.getActiveWindowViewId();
        if (curView === itemId) {
          this.state.activeWindowView = null;
          this.save();
          return { ok: true, action: "removed" };
        }
        this.state.activeWindowView = itemId;
        this.save();
        return { ok: true, action: curView ? "replaced" : "placed", replacedId: curView };
      }

      if (this.getPlacedCount(itemId) > 0) {
        this.removeOneInstanceByItem(itemId);
        return { ok: true, action: "removed" };
      }

      return this.placeOneInstance(itemId);
    }

    removePlacedItem(itemId) {
      return this.removeOneInstanceByItem(itemId);
    }

    /**
     * 창밖 풍경(activeWindowView)과 보유 수량(ownedCounts)은 유지한 채,
     * 거실에 배치된 모든 소품·동물 인스턴스만 일괄 보관함으로 되돌립니다.
     */
    clearAllPlacedInstances() {
      const prevCount = this.getPlacedInstances().length;
      if (prevCount === 0) return 0;
      this.state.placedInstances = [];
      this.syncLegacyCollections();
      this.save();
      return prevCount;
    }

    /**
     * 집중 완료 시 실시간으로 새 내역을 focusLogs 맨 앞에 추가하고
     * 기본 보상 + 몰입 보너스 + 거실 배치 부스트(창밖 풍경 포함) + 생애 첫 완주 웰컴 보너스(+30개)를 지급합니다.
     */
    recordFocusSession(minutes) {
      const now = new Date();
      const todayYMD = formatDateYMD(now);
      const displayDate = formatDateMD(now);
      const hh = String(now.getHours()).padStart(2, "0");
      const mm = String(now.getMinutes()).padStart(2, "0");

      const isFirstFocusPending = !this.state.firstFocusCompleted;
      const breakdown = calculateRewardBreakdown(
        minutes,
        this.getAllActiveBoostIds(),
        isFirstFocusPending
      );

      if (isFirstFocusPending) {
        this.state.firstFocusCompleted = true;
      }

      const newLog = {
        id: `session-${Date.now()}`,
        date: todayYMD,
        displayDate,
        time: `${hh}:${mm}`,
        minutes,
        reward: breakdown.totalWithExtras,
        label: `${minutes}분 집중 완료`
      };

      this.state.bones += breakdown.totalWithExtras;
      this.state.totalFocusMinutes += minutes;
      this.state.totalSessionsCount += 1;
      this.state.lastDate = todayYMD;

      if (!Array.isArray(this.state.focusLogs)) {
        this.state.focusLogs = [];
      }
      this.state.focusLogs.unshift(newLog);
      this.state.todaySessions = this.state.focusLogs.filter((l) => l.date === todayYMD);

      this.save();
      return breakdown;
    }

    /**
     * 연속 달성 일수(Streak) 계산 (오늘 또는 어제부터 연속으로 기록이 존재하는 일수)
     */
    getStreakDays() {
      const logs = Array.isArray(this.state.focusLogs) ? this.state.focusLogs : [];
      const dateSet = new Set(logs.map((l) => l.date));
      if (dateSet.size === 0) return 0;

      let streak = 0;
      const cursor = new Date();
      cursor.setHours(12, 0, 0, 0);

      // 오늘 아직 기록이 없다면 어제부터 체크
      if (!dateSet.has(formatDateYMD(cursor))) {
        cursor.setDate(cursor.getDate() - 1);
      }

      while (dateSet.has(formatDateYMD(cursor))) {
        streak += 1;
        cursor.setDate(cursor.getDate() - 1);
      }
      return streak;
    }

    addBonusBones(amount = 100) {
      this.state.bones += amount;
      this.save();
    }

    unlockAllForSlotTest() {
      if (!this.state.ownedCounts || typeof this.state.ownedCounts !== "object") {
        this.state.ownedCounts = {};
      }
      for (const item of ITEMS_CATALOG) {
        if ((this.state.ownedCounts[item.id] || 0) < 1) {
          this.state.ownedCounts[item.id] = 1;
        }
      }
      this.syncLegacyCollections();
      if (this.state.bones < 1000) {
        this.state.bones = 1000;
      }
      this.save();
    }

    /**
     * 초기 상태로 완전 리셋 (placedItems: [], 빈 4분할 창문과 창틀 선반만 표시되는 최초 실행 상태)
     */
    resetToInitialState() {
      this.state = cloneDefaultState();
      this.save();
    }
  }

  PetFocus.formatDateYMD = formatDateYMD;
  PetFocus.formatDateMD = formatDateMD;
  PetFocus.appStorage = new AppStorage();
})(window);
