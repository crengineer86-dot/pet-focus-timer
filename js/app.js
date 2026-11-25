/**
 * 반려동물 힐링 포모도로 집중 타이머 (pet-focus-timer) 메인 애플리케이션 컨트롤러
 */
(function (global) {
  const PetFocus = (global.PetFocus = global.PetFocus || {});
  const {
    ITEMS_CATALOG,
    MAX_PLACED_SLOTS,
    SLOT_EXPANSION_TIERS = [],
    getItemById,
    calculateRewardBreakdown,
    getTotalBoostPercent,
    appStorage,
    liveCounter,
    audioEngine,
    nativeBridge,
    LivingRoomScene,
    renderShopMiniPreviewSVG,
    renderPolaroidSceneSVG
  } = PetFocus;

  function formatBones(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return String(value ?? 0);
    return num.toLocaleString("en-US");
  }

  const DEFAULT_FOCUS_STATUS_QUOTE = "조용한 거실에서 나만의 속도로 몰입하는 중";

  const WINDOW_VIEW_FOCUS_QUOTES = {
    view_sunny_clouds: "창가에 스미는 햇살과 함께 몰입하는 중",
    view_gentle_rain: "창밖 빗줄기와 함께 차분히 몰입하는 중",
    view_cozy_snow: "창밖 눈송이를 보며 포근하게 몰입하는 중",
    view_starry_night: "고요한 밤하늘 아래 깊이 집중하는 중",
    view_pink_dawn: "잔잔한 새벽빛과 함께 몰입하는 중",
    view_summer_leaves: "살랑이는 여름 잎새와 함께 몰입하는 중",
    view_cherry_blossom: "흩날리는 벚꽃잎과 함께 몰입하는 중",
    view_autumn_sunset: "따뜻한 노을빛 아래 차분히 몰입하는 중",
    view_after_rain_rainbow: "맑게 갠 하늘 아래 기분 좋게 몰입하는 중",
    view_firefly_night: "반딧불이 불빛 아래 고요히 집중하는 중"
  };

  const DIARY_QUOTES_IDLE = [
    "아직은 고요한 우리 거실,\n함께 보낼 시간이 기대돼요 🌱",
    "창가에 내려앉은 따스한 햇살,\n기분 좋게 몰입해 볼까요? ☀️"
  ];

  const DIARY_QUOTES_ACTIVE = [
    "오늘도 차곡차곡 쌓인 평온,\n내일도 창가에서 기다릴게요 ☀️",
    "조용히 집중한 오늘의 시간,\n반려동물 친구도 함께 웃어요 🐾",
    "잠깐의 몰입이 모여,\n따뜻한 하루가 완성됐어요 ✨",
    "창가에 스미는 따스한 햇살,\n발치에서 포근히 낮잠 잤어요 🍃",
    "사각사각 기분 좋은 집중 소리,\n꼬리가 절로 살랑거렸어요 🦴"
  ];

  const LEGACY_SINGLE_LINE_QUOTE_MAP = {
    "아직은 고요한 거실, 오늘 주인님과 얼마나 평화로운 시간을 보낼지 기대돼요 🌱":
      DIARY_QUOTES_IDLE[0],
    "아직은 고요한 거실,\n오늘 함께 보낼 평화로운 시간이 기대돼요 🌱":
      DIARY_QUOTES_IDLE[0],
    "창가 선반 위로 따스한 햇살이 내려앉았어요. 오늘도 같이 몰입해 볼까요? ☀️":
      DIARY_QUOTES_IDLE[1],
    "창가 위로 따스한 햇살이 내려앉았어요,\n오늘도 기분 좋게 같이 몰입해 볼까요? ☀️":
      DIARY_QUOTES_IDLE[1],
    "창가위로 따스한 햇살이 내려앉았어요,\n오늘도 같이 몰입해 볼까요? ☀️":
      DIARY_QUOTES_IDLE[1],
    "창가에 스미는 햇살을 덮고 주인님 발치에서 쿨쿨 낮잠을 잤어요 🐾":
      DIARY_QUOTES_ACTIVE[3],
    "창가에 스미는 햇살을 덮고\n주인님 발치에서 쿨쿨 낮잠을 잤어요 🐾":
      DIARY_QUOTES_ACTIVE[3],
    "창가에 스미는 햇살을 덮고,\n주인님 발치에서 쿨쿨 낮잠을 잤어요 🐾":
      DIARY_QUOTES_ACTIVE[3],
    "사각사각 집중하는 소리가 자장가처럼 들려서 꼬리가 절로 살랑거렸어요 ✨":
      DIARY_QUOTES_ACTIVE[4],
    "사각사각 집중하는 소리가 자장가처럼 들려서,\n꼬리가 절로 살랑거렸어요 ✨":
      DIARY_QUOTES_ACTIVE[4],
    "사각사각 집중하는 소리가 자장가 같아서,\n꼬리가 절로 살랑거렸어요 ✨":
      DIARY_QUOTES_ACTIVE[4],
    "따뜻한 창가 아래에서 주인님과 함께 보낸 고요한 시간이 참 행복해요 🍃":
      DIARY_QUOTES_ACTIVE[1],
    "따뜻한 창가 아래에서 함께 보낸,\n고요한 시간이 참 행복해요 🍃":
      DIARY_QUOTES_ACTIVE[1],
    "주인님이 몰입하는 동안 폭신한 방석 위에서 조용히 응원했어요 🦴":
      DIARY_QUOTES_ACTIVE[2],
    "주인님이 차분히 몰입하는 동안,\n폭신한 방석 위에서 조용히 응원했어요 🦴":
      DIARY_QUOTES_ACTIVE[2],
    "오늘도 차곡차곡 쌓인 평온한 순간들, 내일도 창가에서 기다릴게요 ☀️":
      DIARY_QUOTES_ACTIVE[0],
    "오늘도 차곡차곡 쌓인 평온한 순간들,\n내일도 창가에서 기다릴게요 ☀️":
      DIARY_QUOTES_ACTIVE[0]
  };

  class PetFocusTimerApp {
    constructor() {
      this.timerState = "idle";
      this.configuredMinutes = appStorage.getState().timerMinutes || 25;
      this.initialStartedMinutes = null; // 집중 시작 시 목표 시간 (진행 중 축소 방지용)
      this.remainingSeconds = this.configuredMinutes * 60;
      this.targetEndTimestamp = null;
      this.timerInterval = null;

      this.currentScreen = "main";
      this.shopCategory = "all";
      this.invCategory = "all";

      this.pendingPurchaseItem = null;
      this.autoPlaceOnBuy = appStorage.getState().settings.autoEquipOnBuy ?? true;

      this.wakeLockSentinel = null;
      this.isWakeLockEnabled = false;

      // 방해금지(DND) 및 창밖 풍경-소리 자동 연동 설정 상태 초기화 (localStorage 연동)
      const initialSettings = appStorage.getState().settings || {};
      this.dndEnabled = Boolean(initialSettings.dndEnabled);
      this.dndAllowRepeatCalls = initialSettings.dndAllowRepeatCalls !== false;
      this.autoSyncSoundWithWindow = Boolean(initialSettings.autoSyncSoundWithWindow);

      this.toastTimer = null;
      this.miniToastTimer = null;
      this.soundSuggestTimer = null;
      this.pendingSuggestedSound = null;

      this.initDOMReferences();
      this.initScene();
      this.initLiveCounter();
      this.bindEvents();
      this.renderAll();
    }

    initDOMReferences() {
      this.screens = {
        main: document.getElementById("screen-main"),
        shop: document.getElementById("screen-shop"),
        inventory: document.getElementById("screen-inventory")
      };

      this.liveStatusEl = document.getElementById("live-status");
      this.liveStatusTextEl = document.getElementById("live-status-text");
      this.liveCountNumEl = document.getElementById("live-count-num");
      this.dotSoundEl = document.getElementById("dot-sound");
      this.soundMenuWrapEl = document.getElementById("sound-menu-wrap");
      this.soundToggleBtnEl = document.getElementById("btn-toggle-sound");
      this.soundPopoverEl = document.getElementById("sound-popover");
      this.btnSoundWindowSyncEl = document.getElementById("btn-sound-window-sync");
      this.soundSuggestToastEl = document.getElementById("sound-suggest-toast");
      this.soundSuggestTextEl = document.getElementById("sound-suggest-text");
      this.btnSoundSuggestAcceptEl = document.getElementById("btn-sound-suggest-accept");
      this.dotWakeLockEl = document.getElementById("dot-wakelock");
      this.timerMinusBtnEl = document.getElementById("btn-timer-minus");
      this.timerPlusBtnEl = document.getElementById("btn-timer-plus");
      this.timerDisplayEl = document.getElementById("timer-display");
      this.timerRewardTextEl = document.getElementById("timer-reward-text");
      this.timerImmersionBadgeEl = document.getElementById("timer-immersion-badge");
      this.timerImmersionTextEl = document.getElementById("timer-immersion-text");
      this.timerRewardBadgeEl = document.getElementById("timer-reward-badge");
      this.lastImmersionBonus = null;
      this.immersionBounceTimer = null;

      this.actionGroupIdleEl = document.getElementById("action-group-idle");
      this.actionGroupFocusEl = document.getElementById("action-group-focus");
      this.pauseBtnIconEl = document.getElementById("pause-btn-icon");
      this.pauseBtnLabelEl = document.getElementById("pause-btn-label");
      this.focusQuoteEl = document.getElementById("focus-serenity-quote");

      this.shopHeaderBonesEl = document.getElementById("shop-header-bones");
      this.shopBannerBonesEl = document.getElementById("shop-banner-bones");
      this.shopPreviewSlotBadgeEl = document.getElementById("shop-preview-slot-badge");
      this.shopPreviewBoostBadgeEl = document.getElementById("shop-preview-boost-badge");
      this.shopMiniPreviewCanvasEl = document.getElementById("shop-mini-preview-canvas");
      this.shopMiniPlacedListEl = document.getElementById("shop-mini-placed-list");
      this.shopCollectionCountEl = document.getElementById("shop-collection-count");
      this.shopItemsGridEl = document.getElementById("shop-items-grid");
      this.purchaseToastEl = document.getElementById("purchase-toast");
      this.toastTitleEl = document.getElementById("toast-title");
      this.toastSubtitleEl = document.getElementById("toast-subtitle");

      this.invHeaderBonesEl = document.getElementById("inv-header-bones");
      this.invSlotCounterEl = document.getElementById("inv-slot-counter");
      this.invEquippedStripEl = document.getElementById("inv-equipped-strip");
      this.invCntAllEl = document.getElementById("inv-cnt-all");
      this.invItemsGridEl = document.getElementById("inventory-items-grid");

      this.modalPurchaseEl = document.getElementById("modal-purchase");
      this.purchaseModalThumbEl = document.getElementById("purchase-modal-thumb");
      this.purchaseModalCatEl = document.getElementById("purchase-modal-cat");
      this.purchaseModalTitleEl = document.getElementById("purchase-modal-title");
      this.purchaseModalDescEl = document.getElementById("purchase-modal-desc");
      this.purchaseCurBonesEl = document.getElementById("purchase-cur-bones");
      this.purchaseNeedBonesEl = document.getElementById("purchase-need-bones");
      this.purchaseRemBonesEl = document.getElementById("purchase-rem-bones");
      this.autoPlaceSwitchBtn = document.getElementById("btn-auto-place-switch");
      this.autoPlaceSubtextEl = document.getElementById("auto-place-subtext");
      this.purchaseBtnPriceEl = document.getElementById("purchase-btn-price");

      // 슬롯 제한(N/N FULL), 슬롯 확장 확인 모달, 중도 포기 확인 모달 & 뼈다귀 적립 가이드 통합 모달 DOM 참조
      this.btnShopExpandSlotsEl = document.getElementById("btn-shop-expand-slots");
      this.btnShopResetPlacedEl = document.getElementById("btn-shop-reset-placed");
      this.btnInvExpandSlotsEl = document.getElementById("btn-inv-expand-slots");
      this.invPanelSubEl = document.getElementById("inv-panel-sub");

      this.modalSlotLimitEl = document.getElementById("modal-slot-limit");
      this.slotLimitBadgeEl = document.getElementById("slot-limit-badge");
      this.slotLimitTitleEl = document.getElementById("slot-limit-title");
      this.slotLimitDescEl = document.getElementById("slot-limit-desc");
      this.btnLimitExpandSlotsEl = document.getElementById("btn-limit-expand-slots");
      this.slotLimitExpandCostEl = document.getElementById("slot-limit-expand-cost");
      this.slotLimitQuickListEl = document.getElementById("slot-limit-quick-list");

      this.modalSlotExpandEl = document.getElementById("modal-slot-expand");
      this.slotExpandDotsEl = document.getElementById("slot-expand-dots");
      this.slotExpandStepEl = document.getElementById("slot-expand-step");
      this.slotExpandFromNumEl = document.getElementById("slot-expand-from-num");
      this.slotExpandToNumEl = document.getElementById("slot-expand-to-num");
      this.slotExpandDeltaEl = document.getElementById("slot-expand-delta");
      this.slotExpandStatusBoneEl = document.getElementById("slot-expand-status-bone");
      this.slotExpandStatusTextEl = document.getElementById("slot-expand-status-text");
      this.slotExpandBtnBoneEl = document.getElementById("slot-expand-btn-bone");
      this.slotExpandConfirmLabelEl = document.getElementById("slot-expand-confirm-label");
      this.btnConfirmSlotExpandEl = document.getElementById("btn-confirm-slot-expand");
      this.previewExpandStep = 1;

      // 보유 아이템 관리 미니 팝업 DOM 참조 (1줄 스텝퍼 바 + 추가 구매)
      this.modalItemManageEl = document.getElementById("modal-item-manage");
      this.itemManageThumbEl = document.getElementById("item-manage-thumb");
      this.itemManageTitleEl = document.getElementById("item-manage-title");
      this.itemManageSummaryEl = document.getElementById("item-manage-summary");
      this.itemManagePlacedNumEl = document.getElementById("item-manage-placed-num");
      this.itemManageOwnedNumEl = document.getElementById("item-manage-owned-num");
      this.btnManagePlaceOneEl = document.getElementById("btn-manage-place-one");
      this.btnManageRecallOneEl = document.getElementById("btn-manage-recall-one");
      this.btnManageBuyMoreEl = document.getElementById("btn-manage-buy-more");
      this.itemManageBuyBoneEl = document.getElementById("item-manage-buy-bone");
      this.itemManageBuyLabelEl = document.getElementById("item-manage-buy-label");
      this.managingItemId = null;

      // 거실 배치 일괄 초기화 확인 미니 팝업 & 슬롯 가득 참 액션 토스트 DOM 참조
      this.modalResetPlacedEl = document.getElementById("modal-reset-placed");
      this.resetPlacedDescEl = document.getElementById("reset-placed-desc");
      this.slotFullActionToastEl = document.getElementById("slot-full-action-toast");
      this.btnToastQuickExpandEl = document.getElementById("btn-toast-quick-expand");
      this.slotFullToastTimer = null;

      this.modalGiveupConfirmEl = document.getElementById("modal-giveup-confirm");
      this.giveupLostBonesEl = document.getElementById("giveup-lost-bones");

      this.modalBoneGuideEl = document.getElementById("modal-bone-guide");
      this.boneGuideBoostBoxEl = document.getElementById("bone-guide-boost-box");
      this.boneGuideBoostTextEl = document.getElementById("bone-guide-boost-text");
      this.guideWelcomeStatusChipEl = document.getElementById("guide-welcome-status-chip");

      this.modalReceiptEl = document.getElementById("modal-receipt");

      // 기록 & 그림일기 통합 모달 상태 및 DOM 참조
      const now = new Date();
      this.recordMainTab = "history"; // 'history' | 'diary'
      this.historyVizMode = "calendar"; // 'calendar' | 'graph'
      this.graphPeriodMode = "weekly"; // 'weekly' | 'monthly'
      this.graphWeekOffset = 0; // 0: 이번 주(월~일), -1: 지난주 ...
      this.calYear = now.getFullYear();
      this.calMonth = now.getMonth(); // 0-indexed
      this.selectedFilterDate = null;

      this.recordsMainTabsEl = document.getElementById("records-main-tabs");
      this.recordPaneHistoryEl = document.getElementById("record-pane-history");
      this.recordPaneDiaryEl = document.getElementById("record-pane-diary");

      this.statTodayMinsEl = document.getElementById("stat-today-mins");
      this.statTotalTimeEl = document.getElementById("stat-total-time");
      this.statStreakDaysEl = document.getElementById("stat-streak-days");

      this.historyVizSubtabsEl = document.getElementById("history-viz-subtabs");
      this.calendarMonthNavEl = document.getElementById("calendar-month-nav");
      this.calMonthLabelEl = document.getElementById("cal-month-label");
      this.btnCalNextEl = document.getElementById("btn-cal-next");
      this.graphPeriodTabsEl = document.getElementById("graph-period-tabs");
      this.btnGraphPrevEl = document.getElementById("btn-graph-prev");
      this.btnGraphNextEl = document.getElementById("btn-graph-next");
      this.graphPeriodLabelEl = document.getElementById("graph-period-label");
      this.graphPeriodTotalEl = document.getElementById("graph-period-total");
      this.vizBodyCalendarEl = document.getElementById("viz-body-calendar");
      this.calendarDaysGridEl = document.getElementById("calendar-days-grid");
      this.vizBodyGraphEl = document.getElementById("viz-body-graph");
      this.weeklyBarChartEl = document.getElementById("weekly-bar-chart");

      this.timelineFilterTitleEl = document.getElementById("timeline-filter-title");
      this.btnResetDateFilterEl = document.getElementById("btn-reset-date-filter");
      this.focusTimelineListEl = document.getElementById("focus-timeline-list");

      this.polaroidPhotoFrameEl = document.getElementById("polaroid-photo-frame");
      this.diaryDateTextEl = document.getElementById("diary-date-text");
      this.diaryFocusSummaryEl = document.getElementById("diary-focus-summary");
      this.diaryQuoteEditableEl = document.getElementById("diary-quote-editable");
      this.diaryQuoteIndex = 0;

      // 방해금지(DND) 설정 모달 DOM 참조
      this.btnOpenDndEl = document.getElementById("btn-open-dnd");
      this.dotDndEl = document.getElementById("dot-dnd");
      this.modalDndEl = document.getElementById("modal-dnd");
      this.dndHeaderIconBadgeEl = document.getElementById("dnd-header-icon-badge");
      this.dndRepeatRowEl = document.getElementById("dnd-repeat-row");
      this.btnDndMainSwitchEl = document.getElementById("btn-dnd-main-switch");
      this.btnDndRepeatSwitchEl = document.getElementById("btn-dnd-repeat-switch");

      this.miniTopToastEl = document.getElementById("mini-top-toast");
      this.wakeLockToastEl = document.getElementById("wakelock-tooltip");
    }

    initScene() {
      const svgEl = document.getElementById("living-room-svg");
      const bubbleEl = document.getElementById("pet-speech-bubble");
      this.scene = new LivingRoomScene(svgEl, bubbleEl);
      this.scene.setPlacedItems(appStorage.getState().placedItems);
    }

    initLiveCounter() {
      liveCounter.init((count, meta = {}) => {
        const isLiveCrowd = Boolean(meta.connected) && Number(count) >= 2;
        if (this.liveStatusEl) {
          this.liveStatusEl.classList.toggle("is-quiet", !isLiveCrowd);
        }
        if (this.liveStatusTextEl) {
          if (isLiveCrowd) {
            this.liveStatusTextEl.innerHTML = `<strong>${count}</strong>명 집중 중`;
          } else {
            this.liveStatusTextEl.textContent = "조용히 집중하는 시간";
          }
        }
      });
    }

    bindEvents() {
      appStorage.subscribe(() => {
        this.renderAll();
      });

      this.soundToggleBtnEl?.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggleSoundPopover();
      });

      this.soundPopoverEl?.querySelectorAll(".sound-mode-item").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const modeId = btn.getAttribute("data-sound-mode");
          if (!modeId) return;
          const res = audioEngine.selectMode(modeId);
          this.dotSoundEl?.classList.toggle("on", res.playing);
          this.updateSoundPopoverActiveUI(res.modeId);
          this.showMiniToast(res.message);
          this.closeSoundPopover();
        });
      });

      this.btnSoundWindowSyncEl?.addEventListener("click", (e) => {
        e.stopPropagation();
        this.autoSyncSoundWithWindow = !this.autoSyncSoundWithWindow;
        appStorage.setAutoSyncSoundWithWindow(this.autoSyncSoundWithWindow);
        this.updateSoundSyncSwitchUI();
        this.showMiniToast(
          this.autoSyncSoundWithWindow
            ? "🪟 창밖 풍경에 맞춰 소리가 자동 변경돼요"
            : "🎧 창밖 풍경과 소리를 독립적으로 사용해요"
        );
      });

      this.btnSoundSuggestAcceptEl?.addEventListener("click", () => {
        if (!this.pendingSuggestedSound) return;
        const targetModeId = this.pendingSuggestedSound;
        this.hideSoundSuggestToast();
        audioEngine.startAsmr(targetModeId);
        this.dotSoundEl?.classList.toggle("on", audioEngine.isPlayingAsmr);
        this.updateSoundPopoverActiveUI(audioEngine.currentModeId);
        const modeInfo = PetFocus.SOUND_MODES?.[targetModeId];
        if (modeInfo?.toastOn) {
          this.showMiniToast(modeInfo.toastOn);
        }
      });

      document.addEventListener("click", (e) => {
        if (this.soundMenuWrapEl && !this.soundMenuWrapEl.contains(e.target)) {
          this.closeSoundPopover();
        }
      });

      document.getElementById("btn-open-shop")?.addEventListener("click", () => {
        this.navigateTo("shop");
      });

      document.getElementById("btn-open-receipt")?.addEventListener("click", () => {
        this.openReceiptModal();
      });

      document.getElementById("btn-toggle-wakelock")?.addEventListener("click", () => {
        this.toggleWakeLock();
      });

      this.btnOpenDndEl?.addEventListener("click", () => {
        this.openDndModal();
      });

      document.getElementById("btn-close-dnd-modal")?.addEventListener("click", () => {
        this.closeDndModal();
      });

      document.getElementById("btn-dnd-confirm")?.addEventListener("click", () => {
        this.closeDndModal();
      });

      this.modalDndEl?.addEventListener("click", (e) => {
        if (e.target === this.modalDndEl) {
          this.closeDndModal();
        }
      });

      this.btnDndMainSwitchEl?.addEventListener("click", () => {
        this.dndEnabled = !this.dndEnabled;
        appStorage.setDndSettings(this.dndEnabled, this.dndAllowRepeatCalls);
        this.updateDndUI();
        if (this.timerState === "running") {
          this.syncNativeDoNotDisturb(this.dndEnabled, this.dndAllowRepeatCalls);
        }
        this.showMiniToast(
          this.dndEnabled
            ? "🔕 집중 시 방해금지 설정이 켜졌어요"
            : "집중 시 방해금지 설정이 해제되었어요"
        );
      });

      this.btnDndRepeatSwitchEl?.addEventListener("click", () => {
        if (!this.dndEnabled) return;
        this.dndAllowRepeatCalls = !this.dndAllowRepeatCalls;
        appStorage.setDndSettings(this.dndEnabled, this.dndAllowRepeatCalls);
        this.updateDndUI();
        if (this.timerState === "running") {
          this.syncNativeDoNotDisturb(this.dndEnabled, this.dndAllowRepeatCalls);
        }
      });

      document.getElementById("btn-timer-minus")?.addEventListener("click", () => {
        this.adjustTimerMinutes(-5);
      });

      document.getElementById("btn-timer-plus")?.addEventListener("click", () => {
        this.adjustTimerMinutes(5);
      });

      document.getElementById("btn-start-focus")?.addEventListener("click", () => {
        this.startFocus();
      });

      document.getElementById("btn-pause-focus")?.addEventListener("click", () => {
        this.togglePauseFocus();
      });

      document.getElementById("btn-giveup-focus")?.addEventListener("click", () => {
        this.openGiveUpConfirmModal();
      });

      document.getElementById("btn-giveup-cancel")?.addEventListener("click", () => {
        this.closeGiveUpConfirmModal();
      });

      document.getElementById("btn-giveup-confirm")?.addEventListener("click", () => {
        this.closeGiveUpConfirmModal();
        this.giveUpFocus();
      });

      this.modalGiveupConfirmEl?.addEventListener("click", (e) => {
        if (e.target === this.modalGiveupConfirmEl) {
          this.closeGiveUpConfirmModal();
        }
      });

      // ⓘ 진입 버튼(타이머 하단 메인 배지, 우측 몰입 보너스 미니 배지, 상점 상단 보유 뼈다귀 영역) -> '뼈다귀 적립 가이드' 통합 모달 오픈
      this.timerRewardBadgeEl?.addEventListener("click", () => {
        this.openBoneGuideModal();
      });

      this.timerImmersionBadgeEl?.addEventListener("click", () => {
        this.openBoneGuideModal();
      });

      document.getElementById("btn-shop-bone-guide-top")?.addEventListener("click", () => {
        this.openBoneGuideModal();
      });

      document.getElementById("btn-shop-bone-guide-banner")?.addEventListener("click", () => {
        this.openBoneGuideModal();
      });

      document.getElementById("btn-close-bone-guide")?.addEventListener("click", () => {
        this.closeBoneGuideModal();
      });

      document.getElementById("btn-ok-bone-guide")?.addEventListener("click", () => {
        this.closeBoneGuideModal();
      });

      this.modalBoneGuideEl?.addEventListener("click", (e) => {
        if (e.target === this.modalBoneGuideEl) {
          this.closeBoneGuideModal();
        }
      });

      document.getElementById("btn-shop-back")?.addEventListener("click", () => {
        this.navigateTo("main");
      });

      document.getElementById("btn-shop-go-focus")?.addEventListener("click", () => {
        this.navigateTo("main");
      });

      document.getElementById("btn-preview-to-inventory")?.addEventListener("click", () => {
        this.navigateTo("inventory");
      });

      document.getElementById("btn-toast-go-inventory")?.addEventListener("click", () => {
        this.hidePurchaseToast();
        this.navigateTo("inventory");
      });

      document.getElementById("shop-category-tabs")?.addEventListener("click", (e) => {
        const btn = e.target.closest(".cat-tab");
        if (!btn) return;
        this.shopCategory = btn.getAttribute("data-category") || "all";
        this.updateCategoryTabUI("shop-category-tabs", this.shopCategory);
        this.renderShopGrid();
      });

      document.getElementById("btn-inventory-back")?.addEventListener("click", () => {
        this.navigateTo("shop");
      });

      document.getElementById("btn-inv-to-room")?.addEventListener("click", () => {
        this.navigateTo("main");
      });

      document.getElementById("inv-category-tabs")?.addEventListener("click", (e) => {
        const btn = e.target.closest(".cat-tab");
        if (!btn) return;
        this.invCategory = btn.getAttribute("data-category") || "all";
        this.updateCategoryTabUI("inv-category-tabs", this.invCategory);
        this.renderInventoryGrid();
      });

      this.initEquippedStripDragScroll();

      document.getElementById("btn-close-purchase-modal")?.addEventListener("click", () => {
        this.closePurchaseModal();
      });

      document.getElementById("btn-cancel-purchase")?.addEventListener("click", () => {
        this.closePurchaseModal();
      });

      this.autoPlaceSwitchBtn?.addEventListener("click", () => {
        this.autoPlaceOnBuy = !this.autoPlaceOnBuy;
        appStorage.setAutoEquipOnBuy(this.autoPlaceOnBuy);
        this.updateAutoPlaceSwitchUI();
      });

      document.getElementById("btn-confirm-purchase")?.addEventListener("click", () => {
        this.confirmPurchase();
      });

      this.modalPurchaseEl?.addEventListener("click", (e) => {
        if (e.target === this.modalPurchaseEl) this.closePurchaseModal();
      });

      document.getElementById("btn-close-slot-limit")?.addEventListener("click", () => {
        this.closeSlotLimitModal();
      });

      this.modalSlotLimitEl?.addEventListener("click", (e) => {
        if (e.target === this.modalSlotLimitEl) this.closeSlotLimitModal();
      });

      // 배치 슬롯 확장 버튼 (상점 / 보관함 / 한도 초과 모달)
      this.btnShopExpandSlotsEl?.addEventListener("click", () => {
        this.openSlotExpandModal();
      });

      this.btnInvExpandSlotsEl?.addEventListener("click", () => {
        this.openSlotExpandModal();
      });

      this.btnLimitExpandSlotsEl?.addEventListener("click", () => {
        this.closeSlotLimitModal();
        this.openSlotExpandModal();
      });

      document.getElementById("btn-cancel-slot-expand")?.addEventListener("click", () => {
        this.closeSlotExpandModal();
      });

      this.btnConfirmSlotExpandEl?.addEventListener("click", () => {
        this.confirmSlotExpand();
      });

      this.slotExpandDotsEl?.addEventListener("click", (e) => {
        const dotBtn = e.target.closest(".slot-dot-btn");
        if (!dotBtn) return;
        const stepNum = Number(dotBtn.getAttribute("data-expand-step"));
        if (stepNum >= 1 && stepNum <= SLOT_EXPANSION_TIERS.length) {
          this.previewExpandStep = stepNum;
          this.renderSlotExpandModalStep();
        }
      });

      this.modalSlotExpandEl?.addEventListener("click", (e) => {
        if (e.target === this.modalSlotExpandEl) this.closeSlotExpandModal();
      });

      // 보유 아이템 관리 미니 팝업 이벤트
      document.getElementById("btn-close-item-manage")?.addEventListener("click", () => {
        this.closeItemManageModal();
      });

      this.modalItemManageEl?.addEventListener("click", (e) => {
        if (e.target === this.modalItemManageEl) this.closeItemManageModal();
      });

      this.btnManagePlaceOneEl?.addEventListener("click", () => {
        this.handleManagePlaceOne();
      });

      this.btnManageRecallOneEl?.addEventListener("click", () => {
        this.handleManageRecallOne();
      });

      this.btnManageBuyMoreEl?.addEventListener("click", () => {
        this.handleManageBuyMore();
      });

      // 상점 '배치 N/M' 옆 일괄 초기화 버튼 & 미니 확인 팝업 이벤트
      this.btnShopResetPlacedEl?.addEventListener("click", () => {
        this.openResetPlacedModal();
      });

      document.getElementById("btn-cancel-reset-placed")?.addEventListener("click", () => {
        this.closeResetPlacedModal();
      });

      document.getElementById("btn-confirm-reset-placed")?.addEventListener("click", () => {
        this.confirmResetPlaced();
      });

      this.modalResetPlacedEl?.addEventListener("click", (e) => {
        if (e.target === this.modalResetPlacedEl) this.closeResetPlacedModal();
      });

      // 슬롯 가득 참 토스트 내 '확장 >' 바로가기 클릭 (모달 바깥 클릭 버블링 차단)
      this.slotFullActionToastEl?.addEventListener("click", (e) => {
        e.stopPropagation();
      });

      this.btnToastQuickExpandEl?.addEventListener("click", (e) => {
        e.stopPropagation();
        this.hideSlotFullActionToast();
        this.closeItemManageModal();
        this.openSlotExpandModal();
      });

      document.getElementById("btn-close-receipt-modal")?.addEventListener("click", () => {
        this.closeReceiptModal();
      });

      // [1. 상단 메인 탭 전환 (📊 집중 내역 | 📔 오늘의 그림일기)]
      this.recordsMainTabsEl?.addEventListener("click", (e) => {
        const btn = e.target.closest(".record-main-tab");
        if (!btn) return;
        const tab = btn.getAttribute("data-record-tab");
        if (tab) {
          this.switchRecordMainTab(tab);
        }
      });

      // [2. 뷰 전환 서브 탭 (📅 달력형 | 📈 그래프형)]
      this.historyVizSubtabsEl?.addEventListener("click", (e) => {
        const btn = e.target.closest(".viz-subtab");
        if (!btn) return;
        const mode = btn.getAttribute("data-viz-mode");
        if (mode) {
          this.switchHistoryVizMode(mode);
        }
      });

      // 달력 이전/다음 달 이동
      document.getElementById("btn-cal-prev")?.addEventListener("click", () => {
        this.changeCalendarMonth(-1);
      });

      document.getElementById("btn-cal-next")?.addEventListener("click", () => {
        this.changeCalendarMonth(1);
      });

      // 그래프 주간/월간 전환 및 기간 이동 (< >)
      this.graphPeriodTabsEl?.addEventListener("click", (e) => {
        const btn = e.target.closest(".graph-period-tab");
        if (!btn) return;
        const period = btn.getAttribute("data-graph-period");
        if (period) {
          this.switchGraphPeriodMode(period);
        }
      });

      this.btnGraphPrevEl?.addEventListener("click", () => {
        this.navigateGraphPeriod(-1);
      });

      this.btnGraphNextEl?.addEventListener("click", () => {
        this.navigateGraphPeriod(1);
      });

      // 날짜 필터 해제 (전체 내역 보기)
      this.btnResetDateFilterEl?.addEventListener("click", () => {
        this.selectedFilterDate = null;
        this.renderReceiptModalContent();
      });

      document.getElementById("btn-shuffle-diary-quote")?.addEventListener("click", () => {
        this.shuffleDiaryQuote();
      });

      this.diaryQuoteEditableEl?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          const curText = this.diaryQuoteEditableEl.innerText || "";
          const lineCount = curText.replace(/\r\n/g, "\n").split("\n").length;
          if (lineCount >= 2) {
            e.preventDefault();
            this.showMiniToast("✏️ 그림일기 문구는 최대 2줄까지 입력할 수 있어요");
          }
        }
      });

      this.diaryQuoteEditableEl?.addEventListener("input", () => {
        const rawText = (this.diaryQuoteEditableEl.innerText || "").replace(/\r\n/g, "\n");
        const lines = rawText.split("\n");
        let clampedLines = lines.slice(0, 2).map((l) => Array.from(l).slice(0, 17).join(""));
        const normalized = clampedLines.join("\n");
        if (lines.length > 2 || normalized !== rawText) {
          this.diaryQuoteEditableEl.innerText = normalized;
          // 커서를 맨 끝으로 이동
          try {
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(this.diaryQuoteEditableEl);
            range.collapse(false);
            sel?.removeAllRanges();
            sel?.addRange(range);
          } catch (_) {}
          this.showMiniToast("✏️ 한 줄당 17자 · 최대 2줄까지 입력할 수 있어요");
        }
        appStorage.setCustomDiaryNote(normalized.trim());
      });

      document.getElementById("btn-save-share-diary")?.addEventListener("click", () => {
        this.exportAndShareDiaryCard();
      });

      this.modalReceiptEl?.addEventListener("click", (e) => {
        if (e.target === this.modalReceiptEl) this.closeReceiptModal();
      });

      document.addEventListener("visibilitychange", () => {
        if (!document.hidden && this.timerState === "running") {
          this.tickTimer();
        }
      });
    }

    navigateTo(screenName) {
      this.currentScreen = screenName;
      Object.entries(this.screens).forEach(([key, el]) => {
        if (!el) return;
        el.classList.toggle("active", key === screenName);
      });
      this.closeSoundPopover();
      this.hidePurchaseToast();
      this.renderAll();
    }

    toggleSoundPopover() {
      if (!this.soundPopoverEl) return;
      const isHidden = this.soundPopoverEl.classList.contains("hidden");
      if (isHidden) {
        this.updateSoundPopoverActiveUI(audioEngine.currentModeId);
        this.soundPopoverEl.classList.remove("hidden");
        this.soundToggleBtnEl?.setAttribute("aria-expanded", "true");
      } else {
        this.closeSoundPopover();
      }
    }

    closeSoundPopover() {
      if (!this.soundPopoverEl) return;
      this.soundPopoverEl.classList.add("hidden");
      this.soundToggleBtnEl?.setAttribute("aria-expanded", "false");
    }

    updateSoundPopoverActiveUI(activeModeId) {
      if (!this.soundPopoverEl) return;
      this.soundPopoverEl.querySelectorAll(".sound-mode-item").forEach((btn) => {
        const modeId = btn.getAttribute("data-sound-mode");
        btn.classList.toggle("active", Boolean(activeModeId && modeId === activeModeId));
      });
    }

    updateCategoryTabUI(containerId, activeCat) {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.querySelectorAll(".cat-tab").forEach((btn) => {
        const isMatch = btn.getAttribute("data-category") === activeCat;
        btn.classList.toggle("active", isMatch);
        btn.setAttribute("aria-selected", String(isMatch));
      });
    }

    getRewardBreakdown(minutes = this.configuredMinutes) {
      const state = appStorage.getState();
      return calculateRewardBreakdown(
        minutes,
        appStorage.getAllActiveBoostIds(),
        !state.firstFocusCompleted
      );
    }

    adjustTimerMinutes(deltaMinutes) {
      if (this.timerState === "idle") {
        // 대기 중: 5분 ~ 120분 5분 단위 자유 조절
        const nextMins = Math.max(5, Math.min(120, this.configuredMinutes + deltaMinutes));
        if (nextMins === this.configuredMinutes) return;
        this.configuredMinutes = nextMins;
        this.remainingSeconds = nextMins * 60;
        appStorage.setTimerMinutes(nextMins);
        this.renderTimerHeader();
      } else {
        // 집중 진행 중(일시정지 포함): 처음 시작한 목표 시간보다 시간을 줄일 수 없도록 차단
        if (deltaMinutes < 0) {
          const minAllowed = this.initialStartedMinutes || this.configuredMinutes;
          if (this.configuredMinutes + deltaMinutes < minAllowed) {
            this.showMiniToast(
              `⚠️ 집중 중에는 처음 목표 시간(${minAllowed}분)보다 줄일 수 없어요`
            );
            return;
          }
        }

        const deltaSecs = deltaMinutes * 60;
        const nextMins = Math.max(
          this.initialStartedMinutes || 5,
          Math.min(120, this.configuredMinutes + deltaMinutes)
        );
        if (nextMins === this.configuredMinutes) return;

        this.configuredMinutes = nextMins;
        this.remainingSeconds = Math.max(60, this.remainingSeconds + deltaSecs);

        if (this.timerState === "running") {
          this.targetEndTimestamp = Date.now() + this.remainingSeconds * 1000;
        }
        this.renderTimerHeader();
        this.showMiniToast(
          deltaMinutes > 0
            ? `집중 목표 시간을 ${this.configuredMinutes}분으로 +5분 늘렸어요 ⏱️`
            : `집중 목표 시간을 ${this.configuredMinutes}분으로 조정했어요 ⏱️`
        );
      }

      if (this.timerRewardBadgeEl) {
        this.timerRewardBadgeEl.classList.add("pulse");
        setTimeout(() => {
          this.timerRewardBadgeEl?.classList.remove("pulse");
        }, 200);
      }
    }

    startFocus() {
      this.timerState = "running";
      this.initialStartedMinutes = this.configuredMinutes;
      if (this.remainingSeconds <= 0) {
        this.remainingSeconds = this.configuredMinutes * 60;
      }
      this.targetEndTimestamp = Date.now() + this.remainingSeconds * 1000;

      // 네이티브(Capacitor) 화면 꺼짐 방지 및 집중 완료 로컬 푸시 예약
      if (nativeBridge) {
        nativeBridge.setKeepAwake(true);
        const endTs = this.targetEndTimestamp;
        const mins = this.configuredMinutes;
        nativeBridge.requestNotificationPermission().then((granted) => {
          if (granted && this.timerState === "running" && this.targetEndTimestamp === endTs) {
            nativeBridge.scheduleFocusNotification(
              endTs,
              `${mins}분 집중 완료! 🐾`,
              "반려동물과 함께 집중을 완주했어요. 뼈다귀 보상을 확인해 보세요!"
            );
          }
        });
      }

      liveCounter.setUserFocusing(true);
      this.scene.setFocusMode("running");
      this.renderTimerHeader();
      this.updateMainBottomActionsUI();

      // 방해금지 옵션이 ON일 때 토스트 피드백 및 네이티브 브리지 호출
      if (this.dndEnabled) {
        this.syncNativeDoNotDisturb(true, this.dndAllowRepeatCalls);
        const repeatMsg = this.dndAllowRepeatCalls
          ? "2회 이상 반복 전화 허용 중"
          : "모든 알림·전화 차단 중";
        this.showMiniToast(`🔕 방해금지 모드가 켜졌어요 (${repeatMsg})`);
      }

      if (this.timerInterval) clearInterval(this.timerInterval);
      this.timerInterval = setInterval(() => this.tickTimer(), 250);
    }

    togglePauseFocus() {
      if (this.timerState === "running") {
        this.tickTimer();
        this.timerState = "paused";
        if (this.timerInterval) {
          clearInterval(this.timerInterval);
          this.timerInterval = null;
        }
        this.scene.setFocusMode("paused");
        this.updateMainBottomActionsUI();
        liveCounter.setUserFocusing(false);
        if (nativeBridge) {
          nativeBridge.setKeepAwake(false);
          nativeBridge.cancelFocusNotification();
        }
      } else if (this.timerState === "paused") {
        this.timerState = "running";
        this.targetEndTimestamp = Date.now() + this.remainingSeconds * 1000;
        this.scene.setFocusMode("running");
        this.updateMainBottomActionsUI();
        liveCounter.setUserFocusing(true);
        if (nativeBridge) {
          nativeBridge.setKeepAwake(true);
          nativeBridge.scheduleFocusNotification(
            this.targetEndTimestamp,
            `${this.configuredMinutes}분 집중 완료! 🐾`,
            "반려동물과 함께 집중을 완주했어요. 뼈다귀 보상을 확인해 보세요!"
          );
        }
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => this.tickTimer(), 250);
      }
    }

    openGiveUpConfirmModal() {
      const breakdown = this.getRewardBreakdown(this.configuredMinutes);
      if (this.giveupLostBonesEl) {
        this.giveupLostBonesEl.textContent = `🦴 +${formatBones(breakdown.subtotal)}개`;
      }
      this.modalGiveupConfirmEl?.classList.remove("hidden");
    }

    closeGiveUpConfirmModal() {
      this.modalGiveupConfirmEl?.classList.add("hidden");
    }

    giveUpFocus() {
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
      this.timerState = "idle";
      this.initialStartedMinutes = null;
      this.configuredMinutes = appStorage.getState().timerMinutes || 25;
      this.remainingSeconds = this.configuredMinutes * 60;
      this.targetEndTimestamp = null;

      if (this.dndEnabled) {
        this.syncNativeDoNotDisturb(false, false);
      }
      if (nativeBridge) {
        nativeBridge.setKeepAwake(false);
        nativeBridge.cancelFocusNotification();
      }

      liveCounter.setUserFocusing(false);
      this.scene.setFocusMode("idle");
      this.renderTimerHeader();
      this.updateMainBottomActionsUI();
      this.scene.triggerDogInteraction("괜찮아요! 숨 고르고 다시 시작해 봐요 🐾");
      this.showMiniToast("집중을 중단했어요. 다음엔 끝까지 완주해 봐요!");
    }

    tickTimer() {
      if (this.timerState !== "running" || !this.targetEndTimestamp) return;

      const diffMs = this.targetEndTimestamp - Date.now();
      if (diffMs <= 0) {
        this.remainingSeconds = 0;
        this.renderTimerHeader();
        this.completeFocusSession();
        return;
      }

      const nextSecs = Math.ceil(diffMs / 1000);
      if (nextSecs !== this.remainingSeconds) {
        this.remainingSeconds = nextSecs;
        this.renderTimerHeader();
      }
    }

    completeFocusSession() {
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }

      const completedMins = this.configuredMinutes;
      this.timerState = "idle";
      this.initialStartedMinutes = null;
      this.remainingSeconds = this.configuredMinutes * 60;
      this.targetEndTimestamp = null;

      if (this.dndEnabled) {
        this.syncNativeDoNotDisturb(false, false);
      }
      if (nativeBridge) {
        nativeBridge.setKeepAwake(false);
        nativeBridge.cancelFocusNotification();
      }

      liveCounter.setUserFocusing(false);
      this.scene.setFocusMode("idle");
      audioEngine.playChime();

      // 기본 보상 + 장시간 몰입 보너스 + 거실 부스트 + 첫 완주 웰컴 보너스(+30) 정산
      const breakdown = appStorage.recordFocusSession(completedMins);

      this.renderTimerHeader();
      this.updateMainBottomActionsUI();
      this.scene.triggerDogInteraction(
        `와아! 집중 완주! 🦴 +${formatBones(breakdown.totalWithExtras)}개 받았어요!`
      );

      if (breakdown.welcomeBonus > 0) {
        this.showMiniToast(
          `🎉 첫 집중 달성 웰컴 보너스(+30개) 포함 총 🦴 +${formatBones(breakdown.totalWithExtras)}개 획득!`
        );
      } else if (breakdown.boostBones > 0) {
        this.showMiniToast(
          `🎉 ${completedMins}분 집중 완료! 🦴 +${formatBones(breakdown.totalWithExtras)}개 획득 (부스트 +${formatBones(breakdown.boostBones)} 포함)`
        );
      } else {
        this.showMiniToast(
          `🎉 ${completedMins}분 집중 완료! 뼈다귀 +${formatBones(breakdown.totalWithExtras)}개 획득`
        );
      }
    }

    renderTimerHeader() {
      const mins = Math.floor(this.remainingSeconds / 60);
      const secs = this.remainingSeconds % 60;
      const formatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

      if (this.timerDisplayEl) {
        this.timerDisplayEl.textContent = formatted;
      }

      const breakdown = this.getRewardBreakdown(this.configuredMinutes);
      if (this.timerRewardTextEl) {
        this.timerRewardTextEl.textContent = `+${formatBones(breakdown.subtotal)}개`;
      }

      if (this.timerImmersionBadgeEl && this.timerImmersionTextEl) {
        const bonus = breakdown.immersionBonus;
        if (bonus > 0) {
          const shouldBounce =
            this.lastImmersionBonus !== null && this.lastImmersionBonus !== bonus;
          this.timerImmersionTextEl.textContent = `+${bonus}`;
          this.timerImmersionBadgeEl.classList.remove("hidden");

          if (shouldBounce) {
            this.timerImmersionBadgeEl.classList.remove("pop-bounce");
            // reflow 강제 후 1회성 Pop-in / Bounce 재생
            void this.timerImmersionBadgeEl.offsetWidth;
            this.timerImmersionBadgeEl.classList.add("pop-bounce");
            if (this.immersionBounceTimer) clearTimeout(this.immersionBounceTimer);
            this.immersionBounceTimer = setTimeout(() => {
              this.timerImmersionBadgeEl?.classList.remove("pop-bounce");
            }, 300);
          }
        } else {
          this.timerImmersionBadgeEl.classList.add("hidden");
          this.timerImmersionBadgeEl.classList.remove("pop-bounce");
        }
        this.lastImmersionBonus = bonus;
      }

      // 최소 시간(5분) 도달 또는 집중 중 목표 시간 축소 불가 상태 시각적 표시
      if (this.timerMinusBtnEl) {
        const isAtMinIdle = this.timerState === "idle" && this.configuredMinutes <= 5;
        const isLockedRunning =
          this.timerState !== "idle" &&
          this.configuredMinutes <= (this.initialStartedMinutes || this.configuredMinutes);
        const isLocked = isAtMinIdle || isLockedRunning;
        this.timerMinusBtnEl.classList.toggle("locked", isLocked);
        this.timerMinusBtnEl.setAttribute("aria-disabled", String(isLocked));
      }

      // 최대 시간(120분) 도달 시 + 버튼 상한 잠금 표시
      if (this.timerPlusBtnEl) {
        const isAtMax = this.configuredMinutes >= 120;
        this.timerPlusBtnEl.classList.toggle("locked", isAtMax);
        this.timerPlusBtnEl.setAttribute("aria-disabled", String(isAtMax));
      }
    }

    updateMainBottomActionsUI() {
      const isIdle = this.timerState === "idle";
      this.actionGroupIdleEl?.classList.toggle("hidden", !isIdle);
      this.actionGroupFocusEl?.classList.toggle("hidden", isIdle);

      if (!isIdle) {
        const isPaused = this.timerState === "paused";
        if (this.pauseBtnIconEl) {
          this.pauseBtnIconEl.innerHTML = isPaused
            ? `<svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><polygon points="6,4 20,12 6,20" /></svg>`
            : `<svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><rect x="6" y="4" width="4" height="16" rx="1.2" /><rect x="14" y="4" width="4" height="16" rx="1.2" /></svg>`;
        }
        if (this.pauseBtnLabelEl) {
          this.pauseBtnLabelEl.textContent = isPaused ? "계속하기" : "일시정지";
        }
        if (this.focusQuoteEl) {
          const activeViewId = appStorage.getActiveWindowViewId?.();
          const themeQuote =
            (activeViewId && WINDOW_VIEW_FOCUS_QUOTES[activeViewId]) ||
            DEFAULT_FOCUS_STATUS_QUOTE;
          this.focusQuoteEl.textContent = isPaused
            ? "잠시 숨을 고르는 중이에요 ☕"
            : themeQuote;
        }
      }
    }

    async toggleWakeLock() {
      if (this.isWakeLockEnabled) {
        if (this.wakeLockSentinel) {
          try {
            await this.wakeLockSentinel.release();
          } catch (_) {}
          this.wakeLockSentinel = null;
        }
        this.isWakeLockEnabled = false;
        this.dotWakeLockEl?.classList.remove("on");
        this.showWakeLockToast("🌙 화면 켜짐 해제");
        return;
      }

      try {
        if ("wakeLock" in navigator) {
          this.wakeLockSentinel = await navigator.wakeLock.request("screen");
        }
        this.isWakeLockEnabled = true;
        this.dotWakeLockEl?.classList.add("on");
        this.showWakeLockToast("☀️ 화면 켜짐 유지");
      } catch (_) {
        this.isWakeLockEnabled = true;
        this.dotWakeLockEl?.classList.add("on");
        this.showWakeLockToast("☀️ 화면 켜짐 유지");
      }
    }

    openDndModal() {
      this.closeSoundPopover();
      this.updateDndUI();
      this.modalDndEl?.classList.remove("hidden");
    }

    closeDndModal() {
      this.modalDndEl?.classList.add("hidden");
    }

    updateDndUI() {
      const enabled = Boolean(this.dndEnabled);
      const allowRepeat = Boolean(this.dndAllowRepeatCalls);

      // 상단 우측 5번째 방해금지 아이콘 활성화 점 & 굵은 라인 표시
      this.dotDndEl?.classList.toggle("on", enabled);
      this.btnOpenDndEl?.classList.toggle("dnd-active", enabled);
      this.dndHeaderIconBadgeEl?.classList.toggle("active", enabled);

      // ① 메인 토글 스위치 상태
      if (this.btnDndMainSwitchEl) {
        this.btnDndMainSwitchEl.classList.toggle("on", enabled);
        this.btnDndMainSwitchEl.setAttribute("aria-checked", String(enabled));
      }

      // ② 부가 옵션(2번 이상 걸려온 전화는 받기) 활성/비활성 연동
      if (this.dndRepeatRowEl) {
        this.dndRepeatRowEl.classList.toggle("disabled", !enabled);
      }
      if (this.btnDndRepeatSwitchEl) {
        this.btnDndRepeatSwitchEl.disabled = !enabled;
        this.btnDndRepeatSwitchEl.classList.toggle("on", enabled && allowRepeat);
        this.btnDndRepeatSwitchEl.setAttribute("aria-checked", String(enabled && allowRepeat));
      }
    }

    /**
     * 안드로이드 WebView 네이티브 브리지 연동 인터페이스
     * 모바일 APK 환경에서 기기 방해금지(DND) 권한 및 반복 통화 허용 설정을 제어합니다.
     */
    syncNativeDoNotDisturb(enabled, allowRepeatCallers) {
      try {
        window.AndroidBridge?.setDoNotDisturb(Boolean(enabled), Boolean(allowRepeatCallers));
      } catch (err) {
        console.warn("[AndroidBridge] setDoNotDisturb 호출 실패:", err);
      }
    }

    renderAll() {
      const state = appStorage.getState();
      this.scene.setPlacedItems(state.placedItems);
      this.renderTimerHeader();
      this.updateMainBottomActionsUI();
      this.updateDndUI();
      this.updateSoundSyncSwitchUI();
      this.renderShopScreen();
      this.renderInventoryScreen();
      if (this.managingItemId && !this.modalItemManageEl?.classList.contains("hidden")) {
        this.renderItemManageModal();
      }
      if (this.modalReceiptEl && !this.modalReceiptEl.classList.contains("hidden")) {
        this.renderReceiptModalContent();
      }
      if (this.modalBoneGuideEl && !this.modalBoneGuideEl.classList.contains("hidden")) {
        this.renderBoneGuideModal();
      }
    }

    updateSoundSyncSwitchUI() {
      if (!this.btnSoundWindowSyncEl) return;
      const enabled = Boolean(this.autoSyncSoundWithWindow);
      this.btnSoundWindowSyncEl.classList.toggle("on", enabled);
      this.btnSoundWindowSyncEl.setAttribute("aria-checked", String(enabled));
    }

    handleWindowViewChanged(viewId) {
      const activeId = viewId !== undefined ? viewId : appStorage.getActiveWindowViewId();
      if (!activeId) return false;
      const item = getItemById(activeId);
      const soundId = item?.recommendedSound;
      const soundMode = soundId ? PetFocus.SOUND_MODES?.[soundId] : null;
      if (!soundId || !soundMode) {
        this.hideSoundSuggestToast();
        return false;
      }

      const viewLabel = item?.shortName || item?.name || "창밖 풍경";

      if (this.autoSyncSoundWithWindow) {
        this.hideSoundSuggestToast();
        audioEngine.startAsmr(soundId);
        this.dotSoundEl?.classList.toggle("on", audioEngine.isPlayingAsmr);
        this.updateSoundPopoverActiveUI(audioEngine.currentModeId);
        this.showMiniToast(`🪟 '${viewLabel}' 적용 · ${soundMode.label} 재생`);
        return true;
      }

      // 기본값은 독립 모드: 해당 사운드가 꺼져 있거나 다른 사운드 재생 중이면 1개 통합 바로 안내
      if (!(audioEngine.isPlayingAsmr && audioEngine.currentModeId === soundId)) {
        this.showSoundSuggestToast(soundId, soundMode.label, viewLabel);
        return true;
      }

      this.hideSoundSuggestToast();
      return false;
    }

    showSoundSuggestToast(soundId, soundLabel, viewLabel = "") {
      if (!this.soundSuggestToastEl || !this.soundSuggestTextEl) return;
      this.hideMiniToast();
      this.pendingSuggestedSound = soundId;
      this.soundSuggestTextEl.textContent = viewLabel
        ? `'${viewLabel}' 적용 · ${soundLabel} ASMR 켤까요?`
        : `${soundLabel} ASMR도 함께 켜볼까요?`;
      this.soundSuggestToastEl.classList.add("show");

      if (this.soundSuggestTimer) clearTimeout(this.soundSuggestTimer);
      this.soundSuggestTimer = setTimeout(() => {
        this.hideSoundSuggestToast();
      }, 3600);
    }

    hideMiniToast() {
      this.miniTopToastEl?.classList.remove("show");
      if (this.miniToastTimer) {
        clearTimeout(this.miniToastTimer);
        this.miniToastTimer = null;
      }
    }

    hideSoundSuggestToast() {
      this.soundSuggestToastEl?.classList.remove("show");
      this.pendingSuggestedSound = null;
      if (this.soundSuggestTimer) {
        clearTimeout(this.soundSuggestTimer);
        this.soundSuggestTimer = null;
      }
    }

    resetToInitialEmptyRoom() {
      appStorage.resetToInitialState();
      const state = appStorage.getState();
      this.configuredMinutes = state.timerMinutes || 25;
      if (this.timerState === "idle") {
        this.remainingSeconds = this.configuredMinutes * 60;
      }
      this.dndEnabled = Boolean(state.settings?.dndEnabled);
      this.dndAllowRepeatCalls = state.settings?.dndAllowRepeatCalls !== false;
      this.renderAll();
      this.showMiniToast("🔄 초기 상태(빈 창문 · 배치 0개)로 리셋되었어요!");
    }

    /* ==========================================================================
       ['뼈다귀 적립 가이드' 통합 모달 (ⓘ 버튼 2곳 공통 진입)]
       ========================================================================== */
    openBoneGuideModal() {
      this.closeSoundPopover();
      this.renderBoneGuideModal();
      this.modalBoneGuideEl?.classList.remove("hidden");
    }

    closeBoneGuideModal() {
      this.modalBoneGuideEl?.classList.add("hidden");
    }

    renderBoneGuideModal() {
      const state = appStorage.getState();
      const boostPct = getTotalBoostPercent(appStorage.getAllActiveBoostIds());

      if (this.boneGuideBoostBoxEl && this.boneGuideBoostTextEl) {
        this.boneGuideBoostBoxEl.classList.toggle("active", boostPct > 0);
        this.boneGuideBoostTextEl.textContent = `✨ 현재 거실 부스트 +${boostPct}% 적용 중`;
      }

      if (this.guideWelcomeStatusChipEl) {
        if (state.firstFocusCompleted) {
          this.guideWelcomeStatusChipEl.textContent = "달성 ✓";
          this.guideWelcomeStatusChipEl.classList.add("done");
        } else {
          this.guideWelcomeStatusChipEl.textContent = "1회 한정";
          this.guideWelcomeStatusChipEl.classList.remove("done");
        }
      }
    }

    updateSlotExpandButtonUI(btnEl) {
      if (!btnEl) return;
      const nextTier = appStorage.getNextSlotExpansionTier();
      if (!nextTier) {
        btnEl.textContent = "MAX";
        btnEl.classList.add("is-max");
        btnEl.disabled = true;
        btnEl.title = "최대 배치 슬롯(20칸)에 도달했어요";
      } else {
        btnEl.textContent = "+ 확장";
        btnEl.classList.remove("is-max");
        btnEl.disabled = false;
        btnEl.title = `뼈다귀 ${formatBones(nextTier.cost)}개로 배치 한도 ${nextTier.to}칸(+${nextTier.delta}칸) 확장`;
      }
    }

    renderShopScreen() {
      const state = appStorage.getState();
      const placedInstances = appStorage.getPlacedInstances();
      const placedIds = placedInstances.map((inst) => inst.itemId);
      const placedCount = placedInstances.length;
      const maxSlots = appStorage.getMaxPlacementSlots();
      const boostPct = getTotalBoostPercent(appStorage.getAllActiveBoostIds());

      if (this.shopHeaderBonesEl) this.shopHeaderBonesEl.textContent = formatBones(state.bones);
      if (this.shopBannerBonesEl) this.shopBannerBonesEl.textContent = formatBones(state.bones);
      if (this.shopPreviewSlotBadgeEl) {
        this.shopPreviewSlotBadgeEl.textContent = `배치 ${placedCount}/${maxSlots}`;
      }
      if (this.btnShopResetPlacedEl) {
        this.btnShopResetPlacedEl.disabled = placedCount <= 0;
      }
      this.updateSlotExpandButtonUI(this.btnShopExpandSlotsEl);
      if (this.shopPreviewBoostBadgeEl) {
        this.shopPreviewBoostBadgeEl.textContent = `✨ +${boostPct}%`;
      }
      if (this.shopMiniPreviewCanvasEl) {
        this.shopMiniPreviewCanvasEl.innerHTML = renderShopMiniPreviewSVG(placedIds);
      }
      this.renderShopMiniPlacedList(placedInstances);

      this.renderShopGrid();
    }

    renderShopMiniPlacedList(placedInstances = []) {
      if (!this.shopMiniPlacedListEl) return;

      if (!placedInstances || placedInstances.length === 0) {
        this.shopMiniPlacedListEl.innerHTML = `
          <div class="mini-placed-empty-box">거실이 비어 있어요.
아래에서 소품을 배치해 보세요!</div>
        `;
        return;
      }

      const countByItem = {};
      placedInstances.forEach((inst) => {
        countByItem[inst.itemId] = (countByItem[inst.itemId] || 0) + 1;
      });
      const seenByItem = {};

      const rowsHtml = placedInstances
        .map((inst) => {
          const item = getItemById(inst.itemId);
          if (!item) return "";
          seenByItem[inst.itemId] = (seenByItem[inst.itemId] || 0) + 1;
          const idxNum = seenByItem[inst.itemId];
          const baseName = item.shortName || item.name;
          const displayName = countByItem[inst.itemId] > 1 ? `${baseName} #${idxNum}` : baseName;
          return `
            <div class="mini-placed-row-item" data-mini-placed-id="${item.id}" data-instance-id="${inst.instanceId}">
              <div class="mini-placed-row-left">
                <span class="mini-placed-row-thumb">
                  ${item.svgThumb}
                </span>
                <span class="mini-placed-row-name" title="${item.name}">${displayName}</span>
              </div>
              <button
                type="button"
                class="mini-placed-unplace-btn"
                data-quick-unplace-instance="${inst.instanceId}"
                data-quick-unplace-item="${item.id}"
                title="${displayName} 거실 배치 해제"
                aria-label="${displayName} 거실에서 빼기"
              >&times;</button>
            </div>
          `;
        })
        .join("");

      this.shopMiniPlacedListEl.innerHTML = rowsHtml;

      this.shopMiniPlacedListEl.querySelectorAll("[data-quick-unplace-instance]").forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const instanceId = btn.getAttribute("data-quick-unplace-instance");
          const itemId = btn.getAttribute("data-quick-unplace-item");
          if (!instanceId) return;
          const item = getItemById(itemId);
          const removed = appStorage.removePlacedInstance(instanceId);
          if (removed) {
            this.showMiniToast(`${item?.shortName || item?.name || "소품"} 1개를 거실에서 빼서 보관함으로 이동했어요`);
          }
        });
      });
    }

    renderShopGrid() {
      if (!this.shopItemsGridEl) return;

      const state = appStorage.getState();
      const filtered = ITEMS_CATALOG.map((item, idx) => ({ item, idx }))
        .filter(({ item }) => !item.hideInShop)
        .filter(({ item }) =>
          this.shopCategory === "all" ? true : item.category === this.shopCategory
        )
        .sort((a, b) => {
          const priceA = Number(a.item.price) || 0;
          const priceB = Number(b.item.price) || 0;
          if (priceA !== priceB) return priceA - priceB;
          return a.idx - b.idx;
        })
        .map(({ item }) => item);

      if (this.shopCollectionCountEl) {
        this.shopCollectionCountEl.textContent = `총 ${filtered.length}종`;
      }

      this.shopItemsGridEl.innerHTML = filtered
        .map((item) => {
          const ownedCount = appStorage.getOwnedCount(item.id);
          const maxOwned = appStorage.getMaxOwnedCount(item.id);
          const placedCount = appStorage.getPlacedCount(item.id);
          const isOwned = ownedCount > 0;
          const isPlaced = placedCount > 0;
          const isMultiCapable = maxOwned > 1;
          const canAfford = state.bones >= item.price;

          let topLeftBadge = `<span class="item-badge">${item.categoryLabel}</span>`;
          if (isMultiCapable && isOwned) {
            topLeftBadge = isPlaced
              ? `<span class="item-badge placed">● 배치 ${placedCount} · 보유 ${ownedCount}/${maxOwned}</span>`
              : `<span class="item-badge owned">보유 ${ownedCount}/${maxOwned}</span>`;
          } else if (isPlaced) {
            topLeftBadge = `<span class="item-badge placed">● 적용 중</span>`;
          } else if (isOwned) {
            topLeftBadge = `<span class="item-badge owned">보유함</span>`;
          }

          const topRightBadge = item.boostPercent
            ? `<span class="item-badge">✨ +${item.boostPercent}%</span>`
            : `<span style="font-size:12px; color:#9C968C;">${isPlaced ? "🏡" : "♡"}</span>`;

          const buyBtnBoneSvg = `
            <svg class="slot-bone-svg" viewBox="0 0 24 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M3.9 7C2.2 6.6 1.8 4.4 3.2 3.1C4.5 1.9 6.7 2.5 7.4 4.6H16.6C17.3 2.5 19.5 1.9 20.8 3.1C22.2 4.4 21.8 6.6 20.1 7C21.8 7.4 22.2 9.6 20.8 10.9C19.5 12.1 17.3 11.5 16.6 9.4H7.4C6.7 11.5 4.5 12.1 3.2 10.9C1.8 9.6 2.2 7.4 3.9 7Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          `;

          let buttonHtml = "";
          let cardAction = "open-buy";
          if (isOwned && isMultiCapable) {
            cardAction = "open-manage";
            const isMaxOwned = ownedCount >= maxOwned;
            const btnLabel = isMaxOwned
              ? isPlaced
                ? "✓ 배치 관리"
                : "배치 관리"
              : isPlaced
                ? "✓ 배치 · 추가 구매"
                : "배치 · 추가 구매";
            buttonHtml = `
              <button type="button" class="shop-card-btn ${isPlaced ? "btn-placed" : "btn-equip"}" data-action="open-manage" data-id="${item.id}">
                ${btnLabel}
              </button>
            `;
          } else if (isPlaced) {
            cardAction = "toggle-place";
            buttonHtml = `
              <button type="button" class="shop-card-btn btn-placed" data-action="toggle-place" data-id="${item.id}">
                ${item.category === "window_view" ? "✓ 적용 중" : "✓ 배치 완료"}
              </button>
            `;
          } else if (isOwned) {
            cardAction = "toggle-place";
            buttonHtml = `
              <button type="button" class="shop-card-btn btn-equip" data-action="toggle-place" data-id="${item.id}">
                ${item.category === "window_view" ? "적용하기" : "거실에 배치"}
              </button>
            `;
          } else {
            cardAction = "open-buy";
            buttonHtml = `
              <button type="button" class="shop-card-btn ${canAfford ? "btn-buy" : "btn-short"}" data-action="open-buy" data-id="${item.id}">
                ${buyBtnBoneSvg}<span>${formatBones(item.price)} 구매하기</span>
              </button>
            `;
          }

          return `
            <article class="shop-item-card ${isPlaced ? "is-placed" : ""}" data-card-id="${item.id}">
              <div class="shop-card-top-badges">
                ${topLeftBadge}
                ${topRightBadge}
              </div>
              <div class="shop-thumb-box" style="background-color:${item.cardBg};" data-action="${cardAction}" data-id="${item.id}">
                ${item.svgThumb}
              </div>
              <h3 class="shop-item-name">${item.name}</h3>
              <p class="shop-item-desc">${item.description}</p>
              ${buttonHtml}
            </article>
          `;
        })
        .join("");

      this.shopItemsGridEl.querySelectorAll("[data-action]").forEach((el) => {
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          const action = el.getAttribute("data-action");
          const itemId = el.getAttribute("data-id");
          if (!itemId) return;

          if (action === "open-buy") {
            this.openPurchaseModal(itemId);
          } else if (action === "open-manage") {
            this.openItemManageModal(itemId);
          } else if (action === "toggle-place") {
            this.handleTogglePlace(itemId);
          }
        });
      });
    }

    openPurchaseModal(itemId) {
      const item = getItemById(itemId);
      if (!item) return;

      this.pendingPurchaseItem = item;
      const state = appStorage.getState();
      const remain = state.bones - item.price;

      if (this.purchaseModalThumbEl) {
        this.purchaseModalThumbEl.style.backgroundColor = item.cardBg;
        this.purchaseModalThumbEl.innerHTML = item.svgThumb;
      }
      if (this.purchaseModalCatEl) {
        this.purchaseModalCatEl.textContent = item.boostPercent
          ? `${item.categoryLabel} · ✨ 부스트 +${item.boostPercent}%`
          : item.badge || item.categoryLabel;
      }
      if (this.purchaseModalTitleEl) {
        this.purchaseModalTitleEl.textContent = item.name;
      }
      if (this.purchaseModalDescEl) {
        this.purchaseModalDescEl.textContent = item.description;
      }
      if (this.purchaseCurBonesEl) {
        this.purchaseCurBonesEl.textContent = `🦴 ${formatBones(state.bones)}개`;
      }
      if (this.purchaseNeedBonesEl) {
        this.purchaseNeedBonesEl.textContent = `- ${formatBones(item.price)}개`;
      }
      if (this.purchaseRemBonesEl) {
        this.purchaseRemBonesEl.textContent =
          remain >= 0 ? `${formatBones(remain)}개` : `${formatBones(Math.abs(remain))}개 부족`;
        this.purchaseRemBonesEl.style.color = remain >= 0 ? "#1F1E1D" : "#E5484D";
      }
      if (this.purchaseBtnPriceEl) {
        this.purchaseBtnPriceEl.textContent = formatBones(item.price);
      }

      this.updateAutoPlaceSwitchUI();
      this.modalPurchaseEl?.classList.remove("hidden");
    }

    updateAutoPlaceSwitchUI() {
      if (!this.autoPlaceSwitchBtn || !this.autoPlaceSubtextEl) return;

      this.autoPlaceSwitchBtn.classList.toggle("on", this.autoPlaceOnBuy);
      this.autoPlaceSwitchBtn.setAttribute("aria-checked", String(this.autoPlaceOnBuy));

      if (this.autoPlaceOnBuy) {
        const maxSlots = appStorage.getMaxPlacementSlots();
        this.autoPlaceSubtextEl.textContent =
          this.pendingPurchaseItem?.category === "window_view"
            ? `배치 수(${maxSlots}개)와 무관하게 창밖 전용 슬롯에 즉시 적용돼요`
            : `남은 배치 슬롯(최대 ${maxSlots}개)에 즉시 적용돼요`;
      } else {
        this.autoPlaceSubtextEl.textContent = "구매 시 보관함에 저장돼요";
      }
    }

    closePurchaseModal() {
      this.modalPurchaseEl?.classList.add("hidden");
      this.pendingPurchaseItem = null;
    }

    confirmPurchase() {
      if (!this.pendingPurchaseItem) return;
      const item = this.pendingPurchaseItem;
      const state = appStorage.getState();

      if (state.bones < item.price) {
        this.showMiniToast("🦴 뼈다귀가 부족해요! 집중을 완료하거나 영수증에서 충전해 보세요.");
        return;
      }

      const res = appStorage.purchaseItem(item.id, this.autoPlaceOnBuy);
      this.closePurchaseModal();

      if (res.ok) {
        audioEngine.playPetReactionSound("bark");
        if (res.slotFull) {
          const maxSlots = appStorage.getMaxPlacementSlots();
          this.showPurchaseToast(
            `${item.name} 구매 완료!`,
            `거실 슬롯(${maxSlots}/${maxSlots})이 가득 차서 보관함에 저장되었어요`
          );
          this.openSlotLimitModal();
        } else if (res.placed) {
          this.showPurchaseToast(
            `${item.name} 구매 완료!`,
            item.category === "window_view"
              ? "창밖 풍경이 거실 창문에 바로 적용되었어요"
              : "아이템이 거실과 보관함에 쏙 들어갔어요"
          );
          if (item.category === "window_view") {
            this.handleWindowViewChanged(item.id);
          }
        } else {
          this.showPurchaseToast(
            `${item.name} 구매 완료!`,
            "아이템이 보관함에 쏙 들어갔어요"
          );
        }
      }
    }

    showPurchaseToast(title, subtitle) {
      if (!this.purchaseToastEl) return;
      if (this.toastTitleEl) this.toastTitleEl.textContent = title;
      if (this.toastSubtitleEl) this.toastSubtitleEl.textContent = subtitle;

      this.purchaseToastEl.classList.add("show");
      if (this.toastTimer) clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(() => {
        this.hidePurchaseToast();
      }, 4500);
    }

    hidePurchaseToast() {
      this.purchaseToastEl?.classList.remove("show");
    }

    initEquippedStripDragScroll() {
      const strip = this.invEquippedStripEl;
      if (!strip) return;

      let isDown = false;
      let startX = 0;
      let scrollLeft = 0;
      this.invStripDragged = false;

      strip.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        isDown = true;
        this.invStripDragged = false;
        strip.classList.add("is-dragging");
        startX = e.pageX - strip.offsetLeft;
        scrollLeft = strip.scrollLeft;
      });

      window.addEventListener("mouseup", () => {
        if (!isDown) return;
        isDown = false;
        strip.classList.remove("is-dragging");
        setTimeout(() => {
          this.invStripDragged = false;
        }, 40);
      });

      strip.addEventListener("mouseleave", () => {
        if (!isDown) return;
        isDown = false;
        strip.classList.remove("is-dragging");
      });

      strip.addEventListener("mousemove", (e) => {
        if (!isDown) return;
        const x = e.pageX - strip.offsetLeft;
        const walk = x - startX;
        if (Math.abs(walk) > 4) {
          this.invStripDragged = true;
          e.preventDefault();
          strip.scrollLeft = scrollLeft - walk;
        }
      });
    }

    renderInventoryScreen() {
      const state = appStorage.getState();
      const placedInstances = appStorage.getPlacedInstances();
      const ownedIds = state.ownedItems;
      const maxSlots = appStorage.getMaxPlacementSlots();

      if (this.invHeaderBonesEl) {
        this.invHeaderBonesEl.textContent = formatBones(state.bones);
      }
      if (this.invPanelSubEl) {
        this.invPanelSubEl.textContent = `최대 ${maxSlots}개 배치 · 거실에서 자유롭게 이동`;
      }
      if (this.invSlotCounterEl) {
        this.invSlotCounterEl.textContent = `배치 ${placedInstances.length}/${maxSlots}`;
      }
      this.updateSlotExpandButtonUI(this.btnInvExpandSlotsEl);
      if (this.invCntAllEl) {
        this.invCntAllEl.textContent = String(ownedIds.length);
      }

      if (this.invEquippedStripEl) {
        const cardsHtml = [];
        const countByItem = {};
        placedInstances.forEach((inst) => {
          countByItem[inst.itemId] = (countByItem[inst.itemId] || 0) + 1;
        });
        const seenByItem = {};

        placedInstances.forEach((inst) => {
          const item = getItemById(inst.itemId);
          if (!item) return;
          seenByItem[inst.itemId] = (seenByItem[inst.itemId] || 0) + 1;
          const idxNum = seenByItem[inst.itemId];
          const labelName = countByItem[inst.itemId] > 1 ? `${item.shortName} #${idxNum}` : item.shortName;
          cardsHtml.push(`
            <div class="slot-mini-card" data-instance-id="${inst.instanceId}">
              <div class="slot-mini-thumb">${item.svgThumb}</div>
              <span class="slot-mini-name">${labelName}</span>
              <button type="button" class="slot-recall-btn" data-recall-instance="${inst.instanceId}" data-recall-item="${item.id}">회수</button>
            </div>
          `);
        });

        const emptyCount = Math.max(0, maxSlots - placedInstances.length);
        for (let i = 0; i < emptyCount; i++) {
          cardsHtml.push(`
            <div class="slot-empty-card">
              <span style="font-size:14px;">+</span>
              <span>빈 슬롯</span>
            </div>
          `);
        }

        this.invEquippedStripEl.innerHTML = cardsHtml.join("");

        this.invEquippedStripEl.querySelectorAll("[data-recall-instance]").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            if (this.invStripDragged) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }
            const instanceId = btn.getAttribute("data-recall-instance");
            const itemId = btn.getAttribute("data-recall-item");
            if (instanceId) {
              appStorage.removePlacedInstance(instanceId);
              const item = getItemById(itemId);
              this.showMiniToast(`${item?.shortName || "소품"} 1개를 보관함으로 회수했어요`);
            }
          });
        });
      }

      this.renderInventoryGrid();
    }

    renderInventoryGrid() {
      if (!this.invItemsGridEl) return;

      const state = appStorage.getState();
      const ownedCatalog = ITEMS_CATALOG.filter((item) =>
        appStorage.getOwnedCount(item.id) > 0
      ).filter((item) =>
        this.invCategory === "all" ? true : item.category === this.invCategory
      );

      this.invItemsGridEl.innerHTML = ownedCatalog
        .map((item) => {
          const ownedCount = appStorage.getOwnedCount(item.id);
          const placedCount = appStorage.getPlacedCount(item.id);
          const isPlaced = placedCount > 0;
          const dotText =
            ownedCount > 1
              ? `${isPlaced ? "● " : ""}${placedCount}/${ownedCount}`
              : isPlaced
                ? "●"
                : "";
          return `
            <button
              type="button"
              class="inv-compact-tile ${isPlaced ? "is-placed" : ""}"
              data-inv-toggle="${item.id}"
              title="${item.name} (보유 ${ownedCount}개 · 배치 ${placedCount}개)"
              aria-pressed="${isPlaced}"
            >
              <div class="inv-tile-top-row">
                <span class="inv-tile-placed-dot" aria-hidden="true">${dotText}</span>
                <span class="inv-tile-boost-text">✨ +${item.boostPercent || 0}%</span>
              </div>
              <div class="inv-tile-thumb" style="background-color:${item.cardBg || "#F7F2E9"};">
                ${item.svgThumb}
              </div>
              <span class="inv-tile-name">${item.shortName || item.name}</span>
            </button>
          `;
        })
        .join("");

      this.invItemsGridEl.querySelectorAll("[data-inv-toggle]").forEach((tile) => {
        tile.addEventListener("click", () => {
          const itemId = tile.getAttribute("data-inv-toggle");
          if (!itemId) return;
          const ownedCount = appStorage.getOwnedCount(itemId);
          const maxOwned = appStorage.getMaxOwnedCount(itemId);
          if (maxOwned > 1 && ownedCount > 1) {
            this.openItemManageModal(itemId);
          } else {
            this.handleTogglePlace(itemId, true);
          }
        });
      });
    }

    handleTogglePlace(itemId, fromCompactTile = false) {
      const item = getItemById(itemId);
      const res = appStorage.togglePlaceItem(itemId);

      if (!res.ok && res.reason === "SLOT_FULL") {
        const maxSlots = appStorage.getMaxPlacementSlots();
        this.showMiniToast(`배치 슬롯(${maxSlots}/${maxSlots})이 가득 찼어요!`);
        this.openSlotLimitModal();
        return;
      }

      if (res.ok) {
        if (item?.category === "window_view") {
          if (res.action === "replaced" || res.action === "placed") {
            const handledWithUnifiedBar = this.handleWindowViewChanged(item.id);
            if (!handledWithUnifiedBar) {
              this.showMiniToast(`🪟 창밖 풍경을 '${item.shortName}'(으)로 적용했어요 ✨`);
            }
          } else {
            this.hideSoundSuggestToast();
            this.showMiniToast("🪟 창밖 풍경을 해제해 깨끗한 빈 창문으로 되돌렸어요");
          }
        } else if (res.action === "placed") {
          this.showMiniToast(
            `🏠 '${item?.shortName}' 거실에 배치 완료! 드래그해서 위치를 옮겨보세요 ✨`
          );
        } else {
          this.showMiniToast(`↩ '${item?.shortName}' 배치를 해제했어요`);
        }
      }
    }

    openSlotLimitModal() {
      if (!this.modalSlotLimitEl) return;
      const maxSlots = appStorage.getMaxPlacementSlots();
      const nextTier = appStorage.getNextSlotExpansionTier();

      if (this.slotLimitBadgeEl) {
        this.slotLimitBadgeEl.textContent = `${maxSlots} / ${maxSlots} FULL`;
      }
      if (this.slotLimitTitleEl) {
        this.slotLimitTitleEl.textContent = `거실 배치 슬롯이 가득 찼어요 (${maxSlots}/${maxSlots})`;
      }
      if (this.slotLimitDescEl) {
        this.slotLimitDescEl.innerHTML = nextTier
          ? `거실에는 현재 최대 ${maxSlots}개의 동물·소품을 동시에 꺼내놓을 수 있어요.<br />기존 소품을 하나 회수하거나 슬롯을 확장해 보세요!`
          : `거실에는 최대 ${maxSlots}개의 동물·소품을 동시에 꺼내놓을 수 있어요.<br />기존에 배치된 소품을 하나 회수한 뒤 다시 배치해 주세요!`;
      }
      if (this.btnLimitExpandSlotsEl) {
        if (nextTier) {
          this.btnLimitExpandSlotsEl.classList.remove("hidden");
          if (this.slotLimitExpandCostEl) {
            this.slotLimitExpandCostEl.textContent = `(🦴 ${formatBones(nextTier.cost)})`;
          }
        } else {
          this.btnLimitExpandSlotsEl.classList.add("hidden");
        }
      }

      this.renderSlotLimitQuickList();
      this.modalSlotLimitEl.classList.remove("hidden");
    }

    renderSlotLimitQuickList() {
      if (!this.slotLimitQuickListEl) return;
      const placedInstances = appStorage.getPlacedInstances();
      const countByItem = {};
      placedInstances.forEach((inst) => {
        countByItem[inst.itemId] = (countByItem[inst.itemId] || 0) + 1;
      });
      const seenByItem = {};

      this.slotLimitQuickListEl.innerHTML = placedInstances
        .map((inst) => {
          const item = getItemById(inst.itemId);
          if (!item) return "";
          seenByItem[inst.itemId] = (seenByItem[inst.itemId] || 0) + 1;
          const idxNum = seenByItem[inst.itemId];
          const labelName = countByItem[inst.itemId] > 1 ? `${item.name} #${idxNum}` : item.name;
          return `
            <div class="slot-quick-item">
              <span>${labelName}</span>
              <button type="button" class="slot-quick-recall-btn" data-quick-recall-instance="${inst.instanceId}">
                회수
              </button>
            </div>
          `;
        })
        .join("");

      this.slotLimitQuickListEl.querySelectorAll("[data-quick-recall-instance]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const instanceId = btn.getAttribute("data-quick-recall-instance");
          if (instanceId) {
            appStorage.removePlacedInstance(instanceId);
            this.closeSlotLimitModal();
            this.showMiniToast("슬롯을 1칸 비웠어요! 이제 원하는 소품을 배치해 보세요 ✨");
          }
        });
      });
    }

    openItemManageModal(itemId) {
      const item = getItemById(itemId);
      if (!item || !this.modalItemManageEl) return;
      this.managingItemId = itemId;
      this.renderItemManageModal();
      this.modalItemManageEl.classList.remove("hidden");
    }

    closeItemManageModal() {
      this.hideSlotFullActionToast();
      this.modalItemManageEl?.classList.add("hidden");
      this.managingItemId = null;
    }

    renderItemManageModal() {
      if (!this.managingItemId) return;
      const item = getItemById(this.managingItemId);
      if (!item) return;

      const state = appStorage.getState();
      const ownedCount = appStorage.getOwnedCount(item.id);
      const maxOwned = appStorage.getMaxOwnedCount(item.id);
      const placedCount = appStorage.getPlacedCount(item.id);
      const totalPlaced = appStorage.getPlacedInstances().length;
      const maxSlots = appStorage.getMaxPlacementSlots();
      const hasSpare = placedCount < ownedCount;
      const isRoomFull = totalPlaced >= maxSlots;
      const canBuyMore = ownedCount < maxOwned;
      const effectivePrice = appStorage.getEffectivePurchasePrice(item.id);
      const canAfford = state.bones >= effectivePrice;

      if (this.itemManageThumbEl) {
        this.itemManageThumbEl.style.backgroundColor = item.cardBg || "#F4EFE7";
        this.itemManageThumbEl.innerHTML = item.svgThumb;
      }
      if (this.itemManageTitleEl) {
        this.itemManageTitleEl.textContent = item.name;
      }
      if (this.itemManageSummaryEl) {
        this.itemManageSummaryEl.textContent = `보유 ${ownedCount} / ${maxOwned}`;
      }
      if (this.itemManagePlacedNumEl) {
        this.itemManagePlacedNumEl.textContent = String(placedCount);
      }
      if (this.itemManageOwnedNumEl) {
        this.itemManageOwnedNumEl.textContent = String(ownedCount);
      }

      // 1줄 스텝퍼 바 버튼 상태 ([ − ] / [ + ])
      if (this.btnManageRecallOneEl) {
        this.btnManageRecallOneEl.disabled = placedCount <= 0;
      }
      if (this.btnManagePlaceOneEl) {
        if (!hasSpare) {
          // 보유한 수량을 전부 배치한 경우: 완전 비활성화
          this.btnManagePlaceOneEl.disabled = true;
          this.btnManagePlaceOneEl.classList.remove("is-slot-full");
        } else if (isRoomFull) {
          // 여분이 있지만 거실 슬롯이 가득 찬 경우: 시각적으로 흐리게 유지하되 클릭 시 토스트 노출
          this.btnManagePlaceOneEl.disabled = false;
          this.btnManagePlaceOneEl.classList.add("is-slot-full");
        } else {
          this.btnManagePlaceOneEl.disabled = false;
          this.btnManagePlaceOneEl.classList.remove("is-slot-full");
        }
      }

      // 하단 추가 구매 버튼 (최대 3개, 기본 무료 아이템은 2~3번째 50뼈다귀 적용)
      if (this.btnManageBuyMoreEl) {
        if (canBuyMore) {
          this.itemManageBuyBoneEl?.classList.remove("hidden");
          if (this.itemManageBuyLabelEl) {
            this.itemManageBuyLabelEl.textContent = `${formatBones(effectivePrice)} 추가 구매`;
          }
          this.btnManageBuyMoreEl.disabled = !canAfford;
        } else {
          this.itemManageBuyBoneEl?.classList.add("hidden");
          if (this.itemManageBuyLabelEl) {
            this.itemManageBuyLabelEl.textContent = "최대 보유 완료";
          }
          this.btnManageBuyMoreEl.disabled = true;
        }
      }
    }

    handleManagePlaceOne() {
      if (!this.managingItemId) return;
      const item = getItemById(this.managingItemId);
      const res = appStorage.placeOneInstance(this.managingItemId);
      if (!res.ok) {
        if (res.reason === "SLOT_FULL") {
          this.showSlotFullActionToast();
        }
        return;
      }
      this.showMiniToast(`🏠 '${item?.shortName || "소품"}' 1개를 거실에 배치했어요! 드래그해 위치를 옮겨보세요 ✨`);
      this.renderItemManageModal();
    }

    showSlotFullActionToast() {
      if (!this.slotFullActionToastEl) return;
      const canExpandMore = Boolean(appStorage.getNextSlotExpansionTier());
      if (this.btnToastQuickExpandEl) {
        this.btnToastQuickExpandEl.classList.toggle("hidden", !canExpandMore);
      }
      this.slotFullActionToastEl.classList.add("show");
      if (this.slotFullToastTimer) clearTimeout(this.slotFullToastTimer);
      this.slotFullToastTimer = setTimeout(() => {
        this.hideSlotFullActionToast();
      }, 2600);
    }

    hideSlotFullActionToast() {
      if (this.slotFullToastTimer) {
        clearTimeout(this.slotFullToastTimer);
        this.slotFullToastTimer = null;
      }
      this.slotFullActionToastEl?.classList.remove("show");
    }

    openResetPlacedModal() {
      const placedCount = appStorage.getPlacedInstances().length;
      if (placedCount <= 0 || !this.modalResetPlacedEl) return;
      if (this.resetPlacedDescEl) {
        this.resetPlacedDescEl.innerHTML = `창밖 제외 <strong>${placedCount}개</strong>가 보관함으로 돌아가요`;
      }
      this.modalResetPlacedEl.classList.remove("hidden");
    }

    closeResetPlacedModal() {
      this.modalResetPlacedEl?.classList.add("hidden");
    }

    confirmResetPlaced() {
      const removedCount = appStorage.clearAllPlacedInstances();
      this.closeResetPlacedModal();
      if (removedCount > 0) {
        this.showMiniToast("거실 배치를 초기화했어요");
      }
    }

    handleManageRecallOne() {
      if (!this.managingItemId) return;
      const item = getItemById(this.managingItemId);
      const removed = appStorage.removeOneInstanceByItem(this.managingItemId);
      if (removed) {
        this.showMiniToast(`↩ '${item?.shortName || "소품"}' 1개를 보관함으로 넣었어요`);
        this.renderItemManageModal();
      }
    }

    handleManageBuyMore() {
      if (!this.managingItemId) return;
      const item = getItemById(this.managingItemId);
      if (!item) return;

      const state = appStorage.getState();
      const effectivePrice = appStorage.getEffectivePurchasePrice(item.id);
      if (state.bones < effectivePrice) {
        this.showMiniToast("🦴 뼈다귀가 부족해요!");
        return;
      }

      const res = appStorage.purchaseItem(item.id, true);
      if (!res.ok) {
        if (res.reason === "MAX_OWNED") {
          this.showMiniToast("이미 최대 수량(3개)을 모두 보유하고 있어요 ✨");
        }
        return;
      }

      audioEngine.playPetReactionSound("bark");
      if (res.slotFull) {
        this.showMiniToast(`${item.shortName} 추가 구매 완료! 슬롯이 가득 차서 보관함에 저장했어요`);
      } else if (res.placed) {
        this.showMiniToast(`🎉 ${item.shortName} 추가 구매 완료! 거실에 바로 꺼내놓았어요`);
      } else {
        this.showMiniToast(`🎉 ${item.shortName} 추가 구매 완료! (${res.ownedCount}/3)`);
      }
      this.renderItemManageModal();
    }

    closeSlotLimitModal() {
      this.modalSlotLimitEl?.classList.add("hidden");
    }

    openSlotExpandModal() {
      if (!this.modalSlotExpandEl) return;
      const nextTier = appStorage.getNextSlotExpansionTier();
      if (!nextTier) {
        this.showMiniToast("이미 최대 배치 한도(20칸)까지 모두 확장했어요 ✨");
        return;
      }

      // 팝업을 열면 항상 현재 확장해야 할 다음 단계를 기본 선택
      this.previewExpandStep = nextTier.step;
      this.renderSlotExpandModalStep();
      this.modalSlotExpandEl.classList.remove("hidden");
    }

    renderSlotExpandModalStep() {
      const nextTier = appStorage.getNextSlotExpansionTier();
      const activeStep = nextTier ? nextTier.step : SLOT_EXPANSION_TIERS.length + 1;
      const selectedStep = Math.max(
        1,
        Math.min(SLOT_EXPANSION_TIERS.length, Number(this.previewExpandStep) || activeStep)
      );
      const tier = SLOT_EXPANSION_TIERS[selectedStep - 1];
      if (!tier) return;

      const curBones = appStorage.getState().bones;
      const shortage = tier.cost - curBones;
      const canAfford = curBones >= tier.cost;

      // 5단계 인터랙티브 도트 상태 업데이트 (선택된 단계 / 완료된 단계 / 미해금 단계)
      if (this.slotExpandDotsEl) {
        const dotBtns = this.slotExpandDotsEl.querySelectorAll(".slot-dot-btn");
        dotBtns.forEach((btn) => {
          const btnStep = Number(btn.getAttribute("data-expand-step"));
          const isSelected = btnStep === selectedStep;
          const isCompleted = btnStep < activeStep;
          btn.classList.toggle("is-selected", isSelected);
          btn.classList.toggle("is-completed", !isSelected && isCompleted);
          btn.setAttribute("aria-selected", String(isSelected));
        });
      }

      if (this.slotExpandStepEl) {
        this.slotExpandStepEl.textContent = `${selectedStep}/${SLOT_EXPANSION_TIERS.length}`;
      }
      if (this.slotExpandFromNumEl) {
        this.slotExpandFromNumEl.textContent = String(tier.from);
      }
      if (this.slotExpandToNumEl) {
        this.slotExpandToNumEl.textContent = String(tier.to);
      }
      if (this.slotExpandDeltaEl) {
        this.slotExpandDeltaEl.textContent = `+${tier.delta}`;
      }

      // 단계 상태별 안내 문구 & 하단 버튼 분기 (오클릭 방지)
      if (selectedStep === activeStep) {
        // ① 현재 확장 가능한 차례
        this.slotExpandStatusBoneEl?.classList.remove("hidden");
        this.slotExpandBtnBoneEl?.classList.remove("hidden");
        if (this.slotExpandStatusTextEl) {
          if (canAfford) {
            this.slotExpandStatusTextEl.textContent = `현재 보유 ${formatBones(curBones)}개`;
          } else {
            this.slotExpandStatusTextEl.innerHTML = `보유 ${formatBones(curBones)}개<span class="slot-status-dot">·</span><span class="slot-status-need">${formatBones(shortage)}개 더 필요해요</span>`;
          }
        }
        if (this.slotExpandConfirmLabelEl) {
          this.slotExpandConfirmLabelEl.textContent = `${formatBones(tier.cost)} 확장하기`;
        }
        if (this.btnConfirmSlotExpandEl) {
          this.btnConfirmSlotExpandEl.disabled = !canAfford;
        }
      } else if (selectedStep > activeStep) {
        // ② 미래 잠금 단계 미리보기
        this.slotExpandStatusBoneEl?.classList.remove("hidden");
        this.slotExpandBtnBoneEl?.classList.add("hidden");
        if (this.slotExpandStatusTextEl) {
          this.slotExpandStatusTextEl.textContent = `필요 뼈다귀 ${formatBones(tier.cost)}개 · 이전 단계 확장 후 열려요`;
        }
        if (this.slotExpandConfirmLabelEl) {
          this.slotExpandConfirmLabelEl.textContent = "이전 단계 먼저 확장";
        }
        if (this.btnConfirmSlotExpandEl) {
          this.btnConfirmSlotExpandEl.disabled = true;
        }
      } else {
        // ③ 이미 완료한 과거 단계
        this.slotExpandStatusBoneEl?.classList.add("hidden");
        this.slotExpandBtnBoneEl?.classList.add("hidden");
        if (this.slotExpandStatusTextEl) {
          this.slotExpandStatusTextEl.textContent = "이미 확장을 완료한 단계예요";
        }
        if (this.slotExpandConfirmLabelEl) {
          this.slotExpandConfirmLabelEl.textContent = "확장 완료";
        }
        if (this.btnConfirmSlotExpandEl) {
          this.btnConfirmSlotExpandEl.disabled = true;
        }
      }
    }

    closeSlotExpandModal() {
      this.modalSlotExpandEl?.classList.add("hidden");
    }

    confirmSlotExpand() {
      const nextTier = appStorage.getNextSlotExpansionTier();
      if (!nextTier) {
        this.showMiniToast("이미 최대 배치 한도(20칸)에 도달했어요 ✨");
        return;
      }
      if (this.previewExpandStep !== nextTier.step) {
        return;
      }
      const res = appStorage.expandPlacementSlots();
      if (!res.ok) {
        if (res.reason === "NOT_ENOUGH_BONES") {
          this.showMiniToast(`🦴 뼈다귀가 ${formatBones(res.shortage)}개 부족해요!`);
        } else if (res.reason === "ALREADY_MAX") {
          this.showMiniToast("이미 최대 배치 한도(20칸)에 도달했어요 ✨");
        }
        return;
      }

      this.closeSlotExpandModal();
      audioEngine.playPetReactionSound("bark");
      this.showMiniToast(
        `🎉 거실 배치 한도가 ${res.maxSlots}칸(+${res.tier.delta}칸)으로 확장되었어요!`
      );
    }

    openReceiptModal() {
      this.renderReceiptModalContent();
      this.modalReceiptEl?.classList.remove("hidden");
    }

    switchRecordMainTab(tab) {
      this.recordMainTab = tab === "diary" ? "diary" : "history";

      this.recordsMainTabsEl?.querySelectorAll(".record-main-tab").forEach((btn) => {
        const isMatch = btn.getAttribute("data-record-tab") === this.recordMainTab;
        btn.classList.toggle("active", isMatch);
        btn.setAttribute("aria-selected", String(isMatch));
      });

      this.recordPaneHistoryEl?.classList.toggle("active", this.recordMainTab === "history");
      this.recordPaneDiaryEl?.classList.toggle("active", this.recordMainTab === "diary");

      this.renderReceiptModalContent();
    }

    switchHistoryVizMode(mode) {
      this.historyVizMode = mode === "graph" ? "graph" : "calendar";

      this.historyVizSubtabsEl?.querySelectorAll(".viz-subtab").forEach((btn) => {
        const isMatch = btn.getAttribute("data-viz-mode") === this.historyVizMode;
        btn.classList.toggle("active", isMatch);
        btn.setAttribute("aria-selected", String(isMatch));
      });

      const isCal = this.historyVizMode === "calendar";
      this.vizBodyCalendarEl?.classList.toggle("hidden", !isCal);
      this.calendarMonthNavEl?.classList.toggle("hidden", !isCal);
      this.graphPeriodTabsEl?.classList.toggle("hidden", isCal);
      this.vizBodyGraphEl?.classList.toggle("hidden", isCal);

      this.renderReceiptModalContent();
    }

    switchGraphPeriodMode(period) {
      this.graphPeriodMode = period === "monthly" ? "monthly" : "weekly";

      this.graphPeriodTabsEl?.querySelectorAll(".graph-period-tab").forEach((btn) => {
        const isMatch = btn.getAttribute("data-graph-period") === this.graphPeriodMode;
        btn.classList.toggle("active", isMatch);
        btn.setAttribute("aria-selected", String(isMatch));
      });

      this.selectedFilterDate = null;
      this.renderReceiptModalContent();
    }

    navigateGraphPeriod(delta) {
      if (this.graphPeriodMode === "weekly") {
        const nextOffset = this.graphWeekOffset + delta;
        if (nextOffset > 0) return;
        this.graphWeekOffset = nextOffset;
        this.selectedFilterDate = null;

        // 이동한 주의 기준 월(이번 주면 오늘, 이전 주면 목요일)과 하단 타임라인 월을 동기화
        const refDate = new Date();
        refDate.setHours(12, 0, 0, 0);
        if (this.graphWeekOffset < 0) {
          const dow = refDate.getDay();
          const diffToMon = dow === 0 ? -6 : 1 - dow;
          refDate.setDate(refDate.getDate() + diffToMon + this.graphWeekOffset * 7 + 3);
        }
        this.calYear = refDate.getFullYear();
        this.calMonth = refDate.getMonth();
        this.renderReceiptModalContent();
      } else {
        this.changeCalendarMonth(delta);
      }
    }

    isViewingCurrentMonth() {
      const now = new Date();
      return this.calYear === now.getFullYear() && this.calMonth === now.getMonth();
    }

    changeCalendarMonth(delta) {
      let nextYear = this.calYear;
      let nextMonth = this.calMonth + delta;
      if (nextMonth < 0) {
        nextMonth = 11;
        nextYear -= 1;
      } else if (nextMonth > 11) {
        nextMonth = 0;
        nextYear += 1;
      }

      const now = new Date();
      if (
        nextYear > now.getFullYear() ||
        (nextYear === now.getFullYear() && nextMonth > now.getMonth())
      ) {
        return;
      }

      this.calYear = nextYear;
      this.calMonth = nextMonth;
      // 다른 월로 이동하면 기존에 선택되어 있던 일별 필터는 자동으로 해제
      this.selectedFilterDate = null;
      this.renderReceiptModalContent();
    }

    formatHoursAndMinutes(totalMinutes) {
      const mins = Math.max(0, Number(totalMinutes) || 0);
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      if (h === 0) return `${m}분`;
      if (m === 0) return `${h}시간`;
      return `${h}시간 ${m}분`;
    }

    getDailyMinutesMap() {
      const state = appStorage.getState();
      const logs = Array.isArray(state.focusLogs) ? state.focusLogs : [];
      const map = new Map();
      logs.forEach((log) => {
        if (!log.date) return;
        map.set(log.date, (map.get(log.date) || 0) + (Number(log.minutes) || 0));
      });
      return map;
    }

    getTodayFocusTotals() {
      const state = appStorage.getState();
      const sessions = Array.isArray(state.todaySessions) ? state.todaySessions : [];
      const totalMins = sessions.reduce((acc, s) => acc + (Number(s.minutes) || 0), 0);
      const totalBones = sessions.reduce((acc, s) => acc + (Number(s.reward) || 0), 0);
      return { totalMins, totalBones };
    }

    getRecommendedDiaryQuote(totalMins) {
      if (totalMins <= 0) {
        return DIARY_QUOTES_IDLE[this.diaryQuoteIndex % DIARY_QUOTES_IDLE.length];
      }
      return DIARY_QUOTES_ACTIVE[this.diaryQuoteIndex % DIARY_QUOTES_ACTIVE.length];
    }

    shuffleDiaryQuote() {
      this.diaryQuoteIndex += 1;
      const { totalMins } = this.getTodayFocusTotals();
      const pool = totalMins <= 0 ? [...DIARY_QUOTES_IDLE, ...DIARY_QUOTES_ACTIVE] : DIARY_QUOTES_ACTIVE;
      const nextQuote = pool[this.diaryQuoteIndex % pool.length];

      if (this.diaryQuoteEditableEl) {
        this.diaryQuoteEditableEl.innerText = nextQuote;
      }
      appStorage.setCustomDiaryNote(nextQuote);
    }

    renderReceiptModalContent() {
      const state = appStorage.getState();
      const now = new Date();
      const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}.${String(now.getDate()).padStart(2, "0")}`;

      const { totalMins, totalBones } = this.getTodayFocusTotals();
      const streakDays = appStorage.getStreakDays();
      const dailyMap = this.getDailyMinutesMap();

      // 1. [탭 1] 상단 누적 요약 카드 (3분할 미니멀 박스)
      if (this.statTodayMinsEl) {
        this.statTodayMinsEl.textContent = `${totalMins}분`;
      }
      if (this.statTotalTimeEl) {
        this.statTotalTimeEl.textContent = this.formatHoursAndMinutes(state.totalFocusMinutes);
      }
      if (this.statStreakDaysEl) {
        this.statStreakDaysEl.textContent = `🔥 ${streakDays}일째`;
      }

      // 2. [탭 1] 달력형 / 그래프형 렌더링
      this.renderCalendarView(dailyMap);
      this.renderGraphView(dailyMap);

      // 3. [탭 1] 하단 집중 타임라인 리스트 렌더링
      this.renderTimelineList();

      // 4. [탭 2] 오늘의 그림일기 (폴라로이드 엽서) 렌더링
      if (this.diaryDateTextEl) {
        this.diaryDateTextEl.textContent = dateStr;
      }

      if (this.polaroidPhotoFrameEl && typeof renderPolaroidSceneSVG === "function") {
        this.polaroidPhotoFrameEl.innerHTML = renderPolaroidSceneSVG(state.placedItems);
      }

      if (this.diaryFocusSummaryEl) {
        this.diaryFocusSummaryEl.textContent = `오늘 총 ${totalMins}분 집중 · 🦴 +${formatBones(totalBones)}`;
      }

      if (this.diaryQuoteEditableEl) {
        let savedNote = (state.settings?.customDiaryNote || "").trim();
        if (savedNote && LEGACY_SINGLE_LINE_QUOTE_MAP[savedNote]) {
          savedNote = LEGACY_SINGLE_LINE_QUOTE_MAP[savedNote];
          appStorage.setCustomDiaryNote(savedNote);
        }
        this.diaryQuoteEditableEl.innerText =
          savedNote || this.getRecommendedDiaryQuote(totalMins);
      }
    }

    renderCalendarView(dailyMap) {
      if (!this.calendarDaysGridEl) return;

      const year = this.calYear;
      const month = this.calMonth;
      if (this.calMonthLabelEl) {
        this.calMonthLabelEl.textContent = `${year}. ${String(month + 1).padStart(2, "0")}`;
      }
      if (this.btnCalNextEl) {
        this.btnCalNextEl.disabled = this.isViewingCurrentMonth();
      }

      const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0(일) ~ 6(토)
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const todayYMD = PetFocus.formatDateYMD(new Date());

      const pawSvg = `
        <svg class="cal-paw-stamp" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <ellipse cx="12" cy="15.5" rx="4.4" ry="3.6" />
          <ellipse cx="6.3" cy="10.3" rx="1.8" ry="2.4" transform="rotate(-20 6.3 10.3)" />
          <ellipse cx="9.8" cy="7.6" rx="1.8" ry="2.5" transform="rotate(-7 9.8 7.6)" />
          <ellipse cx="14.2" cy="7.6" rx="1.8" ry="2.5" transform="rotate(7 14.2 7.6)" />
          <ellipse cx="17.7" cy="10.3" rx="1.8" ry="2.4" transform="rotate(20 17.7 10.3)" />
        </svg>
      `;

      const cellsHtml = [];
      for (let i = 0; i < firstDayOfWeek; i++) {
        cellsHtml.push(`<div class="cal-day-cell empty"></div>`);
      }

      for (let d = 1; d <= daysInMonth; d++) {
        const ymd = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const mins = dailyMap.get(ymd) || 0;
        const isToday = ymd === todayYMD;
        const isSelected = this.selectedFilterDate === ymd;

        cellsHtml.push(`
          <button
            type="button"
            class="cal-day-cell ${mins > 0 ? "has-record" : ""} ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}"
            data-cal-date="${ymd}"
            title="${ymd} (${mins}분 집중)"
          >
            <span class="cal-day-num">${d}</span>
            ${
              mins > 0
                ? `${pawSvg}<span class="cal-day-mins">${mins}m</span>`
                : ""
            }
          </button>
        `);
      }

      this.calendarDaysGridEl.innerHTML = cellsHtml.join("");

      this.calendarDaysGridEl.querySelectorAll("[data-cal-date]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const clickedDate = btn.getAttribute("data-cal-date");
          if (!clickedDate) return;
          this.selectedFilterDate =
            this.selectedFilterDate === clickedDate ? null : clickedDate;
          this.renderReceiptModalContent();
        });
      });
    }

    renderGraphView(dailyMap) {
      if (!this.weeklyBarChartEl) return;

      const today = new Date();
      today.setHours(12, 0, 0, 0);
      const todayYMD = PetFocus.formatDateYMD(today);

      if (this.graphPeriodMode === "monthly") {
        // [월간 모드] 선택된 월을 1주차~4/5주차로 나누어 주차별 집중 시간 합계 집계
        const year = this.calYear;
        const month = this.calMonth;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const isCurrentMonth = this.isViewingCurrentMonth();
        const currentWeekIdx = Math.floor((today.getDate() - 1) / 7);

        const weekCount = daysInMonth > 28 ? 5 : 4;
        const buckets = [];
        let totalMonthMins = 0;

        for (let w = 0; w < weekCount; w++) {
          const startDay = w * 7 + 1;
          const endDay = Math.min(daysInMonth, (w + 1) * 7);
          let mins = 0;
          for (let d = startDay; d <= endDay; d++) {
            const ymd = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            mins += dailyMap.get(ymd) || 0;
          }
          totalMonthMins += mins;
          buckets.push({
            label: `${w + 1}주차`,
            rangeTitle: `${month + 1}월 ${startDay}일~${endDay}일`,
            mins,
            isCurrent: isCurrentMonth && w === currentWeekIdx
          });
        }

        if (this.graphPeriodLabelEl) {
          this.graphPeriodLabelEl.textContent = `${year}년 ${month + 1}월`;
        }
        if (this.graphPeriodTotalEl) {
          this.graphPeriodTotalEl.textContent = `합계 ${this.formatHoursAndMinutes(totalMonthMins)}`;
        }
        if (this.btnGraphNextEl) {
          this.btnGraphNextEl.disabled = isCurrentMonth;
        }

        const periodMax = Math.max(0, ...buckets.map((b) => b.mins));
        const scaleMax = Math.max(30, periodMax);

        this.weeklyBarChartEl.classList.add("is-monthly");
        this.weeklyBarChartEl.style.gridTemplateColumns = `repeat(${buckets.length}, 1fr)`;
        this.weeklyBarChartEl.innerHTML = buckets
          .map((b) => {
            const heightPx = b.mins > 0 ? Math.max(12, Math.round((b.mins / scaleMax) * 84)) : 3;
            return `
              <div
                class="bar-col non-interactive ${b.mins === 0 ? "zero" : ""} ${b.isCurrent ? "is-current" : ""}"
                title="${b.rangeTitle}: ${b.mins}분 집중"
              >
                <div class="bar-track">
                  <span class="bar-val-label">${b.mins > 0 ? `${b.mins}m` : "&nbsp;"}</span>
                  <div class="bar-pillar" style="height:${heightPx}px;"></div>
                </div>
                <span class="bar-day-label">${b.label}</span>
              </div>
            `;
          })
          .join("");
        return;
      }

      // [주간 모드] 선택된 주의 월~일 7일 고정 막대그래프
      const weekDayLabels = ["월", "화", "수", "목", "금", "토", "일"];
      const dow = today.getDay(); // 0(일) ~ 6(토)
      const diffToMonday = dow === 0 ? -6 : 1 - dow;
      const monday = new Date(today);
      monday.setDate(today.getDate() + diffToMonday + this.graphWeekOffset * 7);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const days = [];
      let totalWeekMins = 0;

      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const ymd = PetFocus.formatDateYMD(d);
        const mins = dailyMap.get(ymd) || 0;
        totalWeekMins += mins;
        days.push({
          ymd,
          dayLabel: weekDayLabels[i],
          mins,
          isCurrent: this.graphWeekOffset === 0 && ymd === todayYMD
        });
      }

      if (this.graphPeriodLabelEl) {
        this.graphPeriodLabelEl.textContent = `${PetFocus.formatDateMD(monday)} ~ ${PetFocus.formatDateMD(sunday)}`;
      }
      if (this.graphPeriodTotalEl) {
        this.graphPeriodTotalEl.textContent = `합계 ${this.formatHoursAndMinutes(totalWeekMins)}`;
      }
      if (this.btnGraphNextEl) {
        this.btnGraphNextEl.disabled = this.graphWeekOffset >= 0;
      }

      const periodMax = Math.max(0, ...days.map((d) => d.mins));
      const scaleMax = Math.max(30, periodMax);

      this.weeklyBarChartEl.classList.remove("is-monthly");
      this.weeklyBarChartEl.style.gridTemplateColumns = "repeat(7, 1fr)";
      this.weeklyBarChartEl.innerHTML = days
        .map((d) => {
          const heightPx = d.mins > 0 ? Math.max(12, Math.round((d.mins / scaleMax) * 84)) : 3;
          const isSelected = this.selectedFilterDate === d.ymd;
          return `
            <div
              class="bar-col ${d.mins === 0 ? "zero" : ""} ${d.isCurrent ? "is-current" : ""} ${isSelected ? "selected" : ""}"
              data-bar-date="${d.ymd}"
              title="${d.ymd}: ${d.mins}분 집중"
            >
              <div class="bar-track">
                <span class="bar-val-label">${d.mins > 0 ? `${d.mins}m` : "&nbsp;"}</span>
                <div class="bar-pillar" style="height:${heightPx}px;"></div>
              </div>
              <span class="bar-day-label">${d.dayLabel}</span>
            </div>
          `;
        })
        .join("");

      this.weeklyBarChartEl.querySelectorAll("[data-bar-date]").forEach((col) => {
        col.addEventListener("click", () => {
          const clickedDate = col.getAttribute("data-bar-date");
          if (!clickedDate) return;
          if (this.selectedFilterDate === clickedDate) {
            this.selectedFilterDate = null;
          } else {
            this.selectedFilterDate = clickedDate;
            const [yStr, mStr] = clickedDate.split("-");
            const yNum = Number(yStr);
            const mNum = Number(mStr);
            if (yNum && mNum) {
              this.calYear = yNum;
              this.calMonth = mNum - 1;
            }
          }
          this.renderReceiptModalContent();
        });
      });
    }

    renderTimelineList() {
      if (!this.focusTimelineListEl) return;

      const state = appStorage.getState();
      const allLogs = Array.isArray(state.focusLogs) ? state.focusLogs : [];
      const currentMonthNum = this.calMonth + 1;
      const monthPrefix = `${this.calYear}-${String(currentMonthNum).padStart(2, "0")}`;

      let filteredLogs = [];
      let emptyMessage = "이번 달 집중 기록이 아직 없어요.";

      if (this.selectedFilterDate) {
        filteredLogs = allLogs.filter((l) => l.date === this.selectedFilterDate);
        const [, mStr, dStr] = this.selectedFilterDate.split("-");
        const mNum = Number(mStr) || currentMonthNum;
        const dNum = Number(dStr) || 1;
        if (this.timelineFilterTitleEl) {
          this.timelineFilterTitleEl.textContent = `${mNum}월 ${dNum}일 집중 내역 (총 ${filteredLogs.length}건)`;
        }
        this.btnResetDateFilterEl?.classList.remove("hidden");
        emptyMessage = "선택한 날짜에 집중 기록이 아직 없어요.";
      } else {
        filteredLogs = allLogs.filter(
          (l) => typeof l.date === "string" && l.date.startsWith(monthPrefix)
        );
        if (this.timelineFilterTitleEl) {
          this.timelineFilterTitleEl.textContent = `${currentMonthNum}월 집중 내역 (총 ${filteredLogs.length}건)`;
        }
        this.btnResetDateFilterEl?.classList.add("hidden");
        emptyMessage = `${currentMonthNum}월 집중 기록이 아직 없어요.`;
      }

      if (filteredLogs.length === 0) {
        this.focusTimelineListEl.innerHTML = `
          <div class="timeline-empty-notice">
            ${emptyMessage}
          </div>
        `;
        return;
      }

      this.focusTimelineListEl.innerHTML = filteredLogs
        .map((log) => {
          const md = log.displayDate || (log.date ? log.date.slice(5).replace("-", ".") : "");
          return `
            <div class="timeline-log-item">
              <div class="timeline-log-left">
                <span class="timeline-log-datetime">${md} ${log.time}</span>
                <span class="timeline-log-label">${log.label || `${log.minutes}분 집중 완료`}</span>
              </div>
              <span class="timeline-log-reward">🦴 +${formatBones(log.reward)}</span>
            </div>
          `;
        })
        .join("");
    }

    closeReceiptModal() {
      this.modalReceiptEl?.classList.add("hidden");
    }

    /**
     * 폴라로이드 엽서 영역을 고화질 PNG(HTML5 Canvas 2x)로 렌더링하여
     * 모바일 Web Share API 공유 또는 즉시 PNG 다운로드를 수행합니다.
     */
    async exportAndShareDiaryCard() {
      try {
        // 웹폰트(KyoboHand / Gowun Dodum)가 캔버스에 깨지지 않고 렌더링되도록 폰트 로딩 완료 대기
        if (document.fonts && document.fonts.ready) {
          try {
            await Promise.allSettled([
              document.fonts.load("400 32px 'KyoboHand'"),
              document.fonts.load("400 32px 'Gowun Dodum'")
            ]);
            await document.fonts.ready;
          } catch (_) {}
        }

        const state = appStorage.getState();
        const dateStr = this.diaryDateTextEl?.textContent || "2026.11.18";
        const summaryStr =
          this.diaryFocusSummaryEl?.textContent || "오늘 총 50분 집중 · 🦴 +30";
        const quoteStr =
          (this.diaryQuoteEditableEl?.innerText || "").trim() ||
          "오늘도 차곡차곡 쌓인 평온,\n내일도 창가에서 기다릴게요 ☀️";

        const svgMarkup = renderPolaroidSceneSVG(state.placedItems);
        const svgBlob = new Blob([svgMarkup], {
          type: "image/svg+xml;charset=utf-8"
        });
        const svgUrl = URL.createObjectURL(svgBlob);

        const img = await new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = svgUrl;
        });

        // 720 x 820 고화질 폴라로이드 엽서 캔버스 생성
        const canvas = document.createElement("canvas");
        canvas.width = 720;
        canvas.height = 820;
        const ctx = canvas.getContext("2d");

        // 1. 바깥 배경 (#FEF9F1 크림 아이보리)
        ctx.fillStyle = "#FEF9F1";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. 폴라로이드 엽서 카드 외곽 프레임 (#FFFDF9 & #1F1E1D 매트 블랙 라인)
        const cardX = 36;
        const cardY = 36;
        const cardW = 648;
        const cardH = 748;
        this.drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 28, "#FFFDF9", "#1F1E1D", 3.5);

        // 3. 상단 거실 미니 캔버스 프레임
        const photoX = 68;
        const photoY = 68;
        const photoW = 584;
        const photoH = 420;
        ctx.save();
        this.clipRoundedRect(ctx, photoX, photoY, photoW, photoH, 18);
        ctx.fillStyle = "#FEF9F1";
        ctx.fillRect(photoX, photoY, photoW, photoH);
        ctx.drawImage(img, photoX, photoY, photoW, photoH);
        ctx.restore();
        URL.revokeObjectURL(svgUrl);

        this.drawRoundedRect(ctx, photoX, photoY, photoW, photoH, 18, null, "#1F1E1D", 2.8);

        // 4. 폴라로이드 하단 메타 정보 (날짜 & 발바닥 도장 요약 배지)
        const metaY = 532;
        ctx.fillStyle = "#1F1E1D";
        ctx.font = "700 24px 'Space Grotesk', 'Pretendard', sans-serif";
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(dateStr, photoX + 6, metaY);

        // 우측 요약 배지
        ctx.font = "700 21px 'Pretendard', sans-serif";
        const badgeLabel = `🐾 ${summaryStr}`;
        const textWidth = ctx.measureText(badgeLabel).width;
        const badgeW = textWidth + 36;
        const badgeH = 42;
        const badgeX = photoX + photoW - badgeW;
        const badgeY = metaY - badgeH / 2;
        this.drawRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, 21, "#F7F0E4", "#E6DEC8", 2);

        ctx.fillStyle = "#1F1E1D";
        ctx.textAlign = "center";
        ctx.fillText(badgeLabel, badgeX + badgeW / 2, metaY + 1);

        // 구분 점선
        ctx.save();
        ctx.strokeStyle = "#E6DEC8";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(photoX, 574);
        ctx.lineTo(photoX + photoW, 574);
        ctx.stroke();
        ctx.restore();

        // 5. 중앙 손글씨 한 줄 일기 문구 (KyoboHand 교보 손글씨 + Gowun Dodum 폴백, 부드러운 차콜 #2C2A29, 정확히 2줄 중앙 정렬)
        ctx.fillStyle = "#2C2A29";
        ctx.font = "400 32px 'KyoboHand', 'Gowun Dodum', 'Pretendard', sans-serif";
        if ("letterSpacing" in ctx) {
          ctx.letterSpacing = "0.32px";
        }
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        this.drawWrappedText(ctx, quoteStr, canvas.width / 2, 664, photoW - 24, 53);
        if ("letterSpacing" in ctx) {
          ctx.letterSpacing = "0px";
        }

        // 6. 하단 워터마크
        ctx.fillStyle = "#9C968C";
        ctx.font = "600 17px 'Space Grotesk', 'Pretendard', sans-serif";
        ctx.fillText("PET FOCUS TIMER · PICTURE DIARY", canvas.width / 2, 752);

        const pngBlob = await new Promise((resolve) =>
          canvas.toBlob((b) => resolve(b), "image/png", 1.0)
        );
        if (!pngBlob) throw new Error("PNG 생성 실패");

        const fileName = `pet-focus-diary-${dateStr.replace(/\./g, "")}.png`;
        const file = new File([pngBlob], fileName, { type: "image/png" });

        // 모바일 Web Share API 지원 시 공유 시트 오픈
        if (
          navigator.canShare &&
          navigator.share &&
          navigator.canShare({ files: [file] })
        ) {
          try {
            await navigator.share({
              title: "오늘의 한 줄 그림일기 🐾",
              text: quoteStr,
              files: [file]
            });
            this.showMiniToast("📷 그림일기 카드를 공유했어요!");
            return;
          } catch (shareErr) {
            if (shareErr && shareErr.name === "AbortError") return;
          }
        }

        // 데스크탑 및 일반 브라우저: 즉시 고화질 PNG 다운로드
        const downloadUrl = URL.createObjectURL(pngBlob);
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 2000);

        this.showMiniToast("📷 그림일기 폴라로이드 카드를 이미지로 저장했어요!");
      } catch (err) {
        console.error("[DiaryExport]", err);
        this.showMiniToast("이미지 저장 중 오류가 발생했어요.");
      }
    }

    drawRoundedRect(ctx, x, y, w, h, r, fill, stroke, lineWidth = 2) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
    }

    clipRoundedRect(ctx, x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
      ctx.clip();
    }

    drawWrappedText(ctx, text, centerX, centerY, maxWidth, lineHeight) {
      // 1) 명시적 줄바꿈(\n) 단락을 먼저 분리하고,
      // 2) 각 단락이 maxWidth를 넘을 경우 어절(keep-all) 단위로 위아래 줄 길이가 가장 균형 있게(balance) 나뉘도록 줄바꿈
      const rawParagraphs = String(text || "")
        .replace(/\r\n/g, "\n")
        .split("\n")
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      const lines = [];

      for (const paragraph of rawParagraphs) {
        if (ctx.measureText(paragraph).width <= maxWidth) {
          lines.push(paragraph);
          continue;
        }

        const words = paragraph.split(/\s+/).filter(Boolean);

        // 2줄 이내로 들어가는 문장은 좌/우 어절 합계의 폭 차이가 가장 작은 지점에서 균형 분할(text-wrap: balance 효과)
        let bestSplitIdx = -1;
        let minDiff = Infinity;
        for (let i = 1; i < words.length; i++) {
          const firstHalf = words.slice(0, i).join(" ");
          const secondHalf = words.slice(i).join(" ");
          const w1 = ctx.measureText(firstHalf).width;
          const w2 = ctx.measureText(secondHalf).width;
          if (w1 <= maxWidth && w2 <= maxWidth) {
            const diff = Math.abs(w1 - w2);
            if (diff < minDiff) {
              minDiff = diff;
              bestSplitIdx = i;
            }
          }
        }

        if (bestSplitIdx !== -1) {
          lines.push(words.slice(0, bestSplitIdx).join(" "));
          lines.push(words.slice(bestSplitIdx).join(" "));
          continue;
        }

        // 2줄을 초과하는 긴 문장은 어절 단위(keep-all)로 순차 줄바꿈
        let currentLine = "";
        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          if (ctx.measureText(testLine).width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) lines.push(currentLine);
      }

      if (lines.length === 0) return;

      // 항상 최대 2줄로 깔끔하게 중앙 정렬 렌더링
      const finalLines = lines.slice(0, 2);
      const totalHeight = (finalLines.length - 1) * lineHeight;
      let startY = centerY - totalHeight / 2;

      finalLines.forEach((line) => {
        ctx.fillText(line, centerX, startY);
        startY += lineHeight;
      });
    }

    showMiniToast(message) {
      if (!this.miniTopToastEl) return;
      this.hideSoundSuggestToast();
      this.miniTopToastEl.textContent = message;
      this.miniTopToastEl.classList.add("show");

      if (this.miniToastTimer) clearTimeout(this.miniToastTimer);
      this.miniToastTimer = setTimeout(() => {
        this.miniTopToastEl.classList.remove("show");
      }, 2400);
    }

    showWakeLockToast(message) {
      if (!this.wakeLockToastEl) return;
      this.wakeLockToastEl.textContent = message;
      this.wakeLockToastEl.classList.add("show");

      if (this.wakeLockToastTimer) clearTimeout(this.wakeLockToastTimer);
      this.wakeLockToastTimer = setTimeout(() => {
        this.wakeLockToastEl.classList.remove("show");
      }, 1800);
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    window.petFocusApp = new PetFocusTimerApp();

    // 로컬 프리뷰 서버(localhost) 접속 시 파일 변경 및 서버 재연결 감지 자동 새로고침(Live Reload)
    if (location.hostname === "localhost" || location.hostname === "127.0.0.1") {
      let lastVersion = null;
      let wasOffline = false;
      setInterval(async () => {
        try {
          const res = await fetch("/__version", { cache: "no-store" });
          if (!res.ok) return;
          const ver = (await res.text()).trim();
          if (wasOffline || (lastVersion && ver && ver !== lastVersion)) {
            location.reload();
            return;
          }
          wasOffline = false;
          lastVersion = ver;
        } catch (_) {
          wasOffline = true;
        }
      }, 1000);
    }
  });
})(window);
