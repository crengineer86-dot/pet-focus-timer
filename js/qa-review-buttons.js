/**
 * 실기기 검수용 임시 QA 버튼 모듈 (QaReviewButtons)
 * - 출시 전 이 파일과 index.html의 <script src="./js/qa-review-buttons.js"> 1줄만 삭제하면
 *   앱 코드에 어떠한 흔적이나 영향도 남지 않습니다.
 */
(function (global) {
  // 수동 노출 플래그 (GitHub Actions 테스트 APK에서도 보이도록 DEV 환경 분기 미사용)
  const ENABLE_QA_TOOLS = true;
  global.ENABLE_QA_TOOLS = ENABLE_QA_TOOLS;

  if (!ENABLE_QA_TOOLS) return;

  function injectStyles() {
    if (document.getElementById("qa-review-buttons-style")) return;
    const style = document.createElement("style");
    style.id = "qa-review-buttons-style";
    style.textContent = `
      .qa-review-dock {
        position: absolute;
        left: 0.875rem;
        bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
        z-index: 75;
        display: inline-flex;
        align-items: center;
        gap: 0.375rem;
        pointer-events: auto;
      }

      .qa-review-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 1.5rem;
        padding: 0 0.5rem;
        border-radius: 999px;
        border: 1px solid rgba(31, 30, 29, 0.14);
        background: rgba(255, 253, 248, 0.78);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        color: #5C564F;
        font-family: inherit;
        font-size: 0.6875rem;
        font-weight: 700;
        line-height: 1;
        letter-spacing: -0.01em;
        opacity: 0.62;
        cursor: pointer;
        box-shadow: 0 2px 6px rgba(31, 30, 29, 0.08);
        transition: opacity 0.16s ease, transform 0.12s ease, background-color 0.16s ease;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
      }

      .qa-review-btn:hover {
        opacity: 0.96;
        background: rgba(255, 253, 248, 0.96);
      }

      .qa-review-btn:active {
        transform: scale(0.93);
      }
    `;
    document.head.appendChild(style);
  }

  function syncAfterBonesChange() {
    const app = global.petFocusApp;
    if (!app) return;

    app.renderShopScreen?.();
    app.renderInventoryScreen?.();

    if (app.modalSlotExpandEl && !app.modalSlotExpandEl.classList.contains("hidden")) {
      app.renderSlotExpandModal?.();
    }
    if (app.modalItemManageEl && !app.modalItemManageEl.classList.contains("hidden") && app.managingItemId) {
      app.openItemManageModal?.(app.managingItemId);
    }
    if (app.modalPurchaseEl && !app.modalPurchaseEl.classList.contains("hidden") && app.pendingPurchaseItemId) {
      app.openPurchaseModal?.(app.pendingPurchaseItemId);
    }
  }

  function handleAddBones() {
    const storage = global.PetFocus?.appStorage;
    if (!storage) return;

    storage.addBonusBones(1000);
    syncAfterBonesChange();
    global.petFocusApp?.showMiniToast?.("🦴 QA 뼈다귀 +1,000개가 추가되었어요");
  }

  function handleResetState() {
    const confirmed = global.confirm(
      "구매내역·슬롯 확장·뼈다귀를 초기 상태로 되돌릴까요?"
    );
    if (!confirmed) return;

    const PetFocus = global.PetFocus;
    const storage = PetFocus?.appStorage;
    const app = global.petFocusApp;
    if (!storage || !storage.state) return;

    const preservedSettings = storage.state.settings
      ? JSON.parse(JSON.stringify(storage.state.settings))
      : {};
    const preservedTimerMinutes = storage.state.timerMinutes || 25;

    storage.state.bones = 0;
    storage.state.maxPlacementSlots = PetFocus.MAX_PLACED_SLOTS || 10;
    storage.state.ownedItems = ["living_room_dog"];
    storage.state.ownedCounts = { living_room_dog: 1 };
    storage.state.placedItems = [];
    storage.state.placedInstances = [];
    storage.state.activeWindowView = null;
    storage.state.itemPositions = {};
    storage.state.firstFocusCompleted = false;
    storage.state.timerMinutes = preservedTimerMinutes;
    storage.state.settings = preservedSettings;
    storage.save();

    if (app) {
      app.closePurchaseModal?.();
      app.closeSlotExpandModal?.();
      app.closeSlotLimitModal?.();
      app.closeItemManageModal?.();
      app.closeResetPlacedModal?.();
      app.renderAll?.();
      app.showMiniToast?.("↺ 구매내역·슬롯·뼈다귀가 초기 상태(0개)로 복구되었어요");
    }
  }

  function mountQaReviewButtons() {
    if (document.getElementById("qa-review-dock")) return;
    const host = document.querySelector(".app-shell") || document.body;
    if (!host) return;

    injectStyles();

    const dock = document.createElement("div");
    dock.className = "qa-review-dock";
    dock.id = "qa-review-dock";
    dock.setAttribute("aria-label", "실기기 검수용 QA 도구");

    const btnAddBones = document.createElement("button");
    btnAddBones.type = "button";
    btnAddBones.className = "qa-review-btn";
    btnAddBones.id = "btn-qa-add-bones";
    btnAddBones.title = "뼈다귀 +1,000개 즉시 추가";
    btnAddBones.textContent = "🦴+";
    btnAddBones.addEventListener("click", handleAddBones);

    const btnReset = document.createElement("button");
    btnReset.type = "button";
    btnReset.className = "qa-review-btn";
    btnReset.id = "btn-qa-reset-all";
    btnReset.title = "구매내역·슬롯 확장·뼈다귀 초기화";
    btnReset.textContent = "↺";
    btnReset.addEventListener("click", handleResetState);

    dock.appendChild(btnAddBones);
    dock.appendChild(btnReset);
    host.appendChild(dock);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountQaReviewButtons);
  } else {
    mountQaReviewButtons();
  }
})(window);
