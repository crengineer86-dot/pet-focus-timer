/**
 * Capacitor 안드로이드 네이티브 브리지 & 웹 폴백 모듈 (nativeBridge)
 * - 네이티브 앱 환경(Capacitor.isNativePlatform()):
 *   1) @capacitor-community/keep-awake: 화면 꺼짐 방지 (keepAwake / allowSleep)
 *   2) @capacitor/local-notifications: Android 8+ 채널('focus-complete') 등록,
 *      Android 13+ 권한 요청, 정확 시각(allowWhileIdle) 집중 완료 푸시 예약/취소 (고정 ID 1001)
 * - 일반 웹 브라우저 환경:
 *   1) Screen Wake Lock API 폴백 (visibilitychange 시 자동 재획득)
 *   2) Web Notification API 폴백
 */
(function (global) {
  const PetFocus = (global.PetFocus = global.PetFocus || {});

  const FOCUS_NOTIFICATION_ID = 1001;
  const FOCUS_CHANNEL_ID = "focus-complete";

  class NativeBridge {
    constructor() {
      this.wakeLockSentinel = null;
      this.keepAwakeRequested = false;
      this.channelReady = false;
      this.bindVisibilityRecovery();
    }

    getCapacitor() {
      return global.Capacitor || null;
    }

    isNative() {
      const cap = this.getCapacitor();
      try {
        return Boolean(cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform());
      } catch (_) {
        return false;
      }
    }

    getKeepAwakePlugin() {
      return this.getCapacitor()?.Plugins?.KeepAwake || null;
    }

    getLocalNotificationsPlugin() {
      return this.getCapacitor()?.Plugins?.LocalNotifications || null;
    }

    bindVisibilityRecovery() {
      if (typeof document === "undefined") return;
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && this.keepAwakeRequested && !this.isNative()) {
          this.acquireWebWakeLock();
        }
      });
    }

    /**
     * 앱 시작 시 1회 호출: Android 8+ 집중 완료 알림 채널('focus-complete') 등록
     */
    async init() {
      if (!this.isNative() || this.channelReady) return;
      const LocalNotifications = this.getLocalNotificationsPlugin();
      if (!LocalNotifications || typeof LocalNotifications.createChannel !== "function") return;

      try {
        await LocalNotifications.createChannel({
          id: FOCUS_CHANNEL_ID,
          name: "집중 완료 알림",
          description: "포모도로 집중 타이머가 끝났을 때 알려드려요",
          importance: 4, // IMPORTANCE_HIGH (소리·진동·헤드업 알림)
          visibility: 1, // VISIBILITY_PUBLIC
          sound: "default",
          vibration: true,
          lights: true
        });
        this.channelReady = true;
      } catch (err) {
        console.warn("[nativeBridge] 알림 채널 생성 실패:", err);
      }
    }

    /**
     * 화면 꺼짐 방지(Keep Awake) 설정
     * - 네이티브: @capacitor-community/keep-awake (KeepAwake.keepAwake / allowSleep)
     * - 웹: navigator.wakeLock API 폴백
     */
    async setKeepAwake(enabled) {
      const wantOn = Boolean(enabled);
      this.keepAwakeRequested = wantOn;

      if (this.isNative()) {
        const KeepAwake = this.getKeepAwakePlugin();
        if (KeepAwake) {
          try {
            if (wantOn && typeof KeepAwake.keepAwake === "function") {
              await KeepAwake.keepAwake();
            } else if (!wantOn && typeof KeepAwake.allowSleep === "function") {
              await KeepAwake.allowSleep();
            }
            return true;
          } catch (err) {
            console.warn("[nativeBridge] KeepAwake 호출 실패:", err);
          }
        }
        return false;
      }

      // 웹 환경: Wake Lock API 폴백
      if (wantOn) {
        return this.acquireWebWakeLock();
      }
      return this.releaseWebWakeLock();
    }

    async acquireWebWakeLock() {
      if (typeof navigator === "undefined" || !("wakeLock" in navigator)) {
        return false;
      }
      try {
        if (this.wakeLockSentinel && !this.wakeLockSentinel.released) {
          return true;
        }
        this.wakeLockSentinel = await navigator.wakeLock.request("screen");
        this.wakeLockSentinel.addEventListener("release", () => {
          this.wakeLockSentinel = null;
        });
        return true;
      } catch (_) {
        return false;
      }
    }

    async releaseWebWakeLock() {
      if (!this.wakeLockSentinel) return true;
      try {
        await this.wakeLockSentinel.release();
      } catch (_) {}
      this.wakeLockSentinel = null;
      return true;
    }

    /**
     * 알림 권한 요청 (Android 13+ POST_NOTIFICATIONS 포함)
     */
    async requestNotificationPermission() {
      if (this.isNative()) {
        const LocalNotifications = this.getLocalNotificationsPlugin();
        if (!LocalNotifications) return false;

        try {
          await this.init();
          if (typeof LocalNotifications.checkPermissions === "function") {
            const cur = await LocalNotifications.checkPermissions();
            if (cur?.display === "granted") return true;
          }
          if (typeof LocalNotifications.requestPermissions === "function") {
            const res = await LocalNotifications.requestPermissions();
            return res?.display === "granted";
          }
        } catch (err) {
          console.warn("[nativeBridge] 알림 권한 요청 실패:", err);
        }
        return false;
      }

      // 웹 환경 폴백
      if (typeof Notification === "undefined") return false;
      if (Notification.permission === "granted") return true;
      if (Notification.permission === "denied") return false;
      try {
        const res = await Notification.requestPermission();
        return res === "granted";
      } catch (_) {
        return false;
      }
    }

    /**
     * 집중 완료 로컬 푸시 예약 (고정 ID 1001, 기존 예약 취소 후 재등록)
     */
    async scheduleFocusNotification(endTimeMs, title, body) {
      const targetMs = Number(endTimeMs);
      if (!Number.isFinite(targetMs) || targetMs <= Date.now() + 500) {
        return false;
      }

      if (!this.isNative()) {
        return false;
      }

      const LocalNotifications = this.getLocalNotificationsPlugin();
      if (!LocalNotifications || typeof LocalNotifications.schedule !== "function") {
        return false;
      }

      try {
        await this.init();
        await this.cancelFocusNotification();

        await LocalNotifications.schedule({
          notifications: [
            {
              id: FOCUS_NOTIFICATION_ID,
              channelId: FOCUS_CHANNEL_ID,
              title: title || "집중 완료! 🐾",
              body: body || "반려동물과 함께 집중을 완주했어요! 뼈다귀 보상을 확인해 보세요.",
              schedule: {
                at: new Date(targetMs),
                allowWhileIdle: true
              },
              sound: "default",
              actionTypeId: "",
              extra: { type: "focus-complete" }
            }
          ]
        });
        return true;
      } catch (err) {
        console.warn("[nativeBridge] 집중 완료 알림 예약 실패:", err);
        return false;
      }
    }

    /**
     * 예약된 집중 완료 로컬 푸시 취소 (고정 ID 1001)
     */
    async cancelFocusNotification() {
      if (!this.isNative()) return true;

      const LocalNotifications = this.getLocalNotificationsPlugin();
      if (!LocalNotifications || typeof LocalNotifications.cancel !== "function") {
        return false;
      }

      try {
        await LocalNotifications.cancel({
          notifications: [{ id: FOCUS_NOTIFICATION_ID }]
        });
        return true;
      } catch (err) {
        console.warn("[nativeBridge] 집중 완료 알림 취소 실패:", err);
        return false;
      }
    }
  }

  const nativeBridge = new NativeBridge();
  PetFocus.nativeBridge = nativeBridge;
  global.nativeBridge = nativeBridge;

  // 네이티브 환경에서는 앱 로드 시 알림 채널 사전 등록
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => nativeBridge.init());
    } else {
      nativeBridge.init();
    }
  }
})(window);
