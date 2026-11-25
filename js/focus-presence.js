/**
 * Firebase Realtime Database 기반 실시간 동시 집중 인원(Presence) 유틸리티 (focusPresence)
 * - 개인정보 수집 없이 세션당 임시 랜덤 sessionId 1개만 사용
 * - 집중 타이머 실행 중일 때만 focusing/{sessionId} = true 기록 + onDisconnect(ref).remove()
 * - .info/connected 구독으로 네트워크 재연결 시 자동 재등록 및 onDisconnect 재설정
 * - 오프라인·네트워크 장애·SDK 로드 실패 시에도 모든 호출을 try/catch로 감싸 앱/타이머에 영향 없음
 */
(function (global) {
  const PetFocus = (global.PetFocus = global.PetFocus || {});

  const firebaseConfig = {
    apiKey: "AIzaSyDE-A6I2i32HhcCXRmPDBzZVMCDJEe9G38",
    authDomain: "pet-focus-timer.firebaseapp.com",
    databaseURL: "https://pet-focus-timer-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "pet-focus-timer",
    storageBucket: "pet-focus-timer.firebasestorage.app",
    messagingSenderId: "1014144766343",
    appId: "1:1014144766343:web:6a7916a50277ca77074322",
    measurementId: "G-SMB6BFYJW0"
  };

  function generateSessionId() {
    try {
      if (global.crypto && typeof global.crypto.getRandomValues === "function") {
        const bytes = new Uint8Array(8);
        global.crypto.getRandomValues(bytes);
        const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
        return `s_${Date.now().toString(36)}_${hex}`;
      }
    } catch (_) {}
    return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }

  class FocusPresenceManager {
    constructor() {
      this.sessionId = generateSessionId();
      this.currentCount = 0;
      this.isConnected = false;
      this.isUserFocusing = false;
      this.listeners = new Set();

      this.db = null;
      this.dbApi = null;
      this.mySessionRef = null;
      this.initialized = false;

      this.bindUnloadCleanup();
    }

    bindUnloadCleanup() {
      if (typeof global.addEventListener !== "function") return;
      const cleanup = () => {
        if (this.isUserFocusing) {
          this.leaveFocusingPresence();
        }
      };
      global.addEventListener("pagehide", cleanup);
      global.addEventListener("beforeunload", cleanup);
    }

    init(onUpdate) {
      if (typeof onUpdate === "function") {
        this.listeners.add(onUpdate);
      }

      // 초기 상태 즉시 통지 (오프라인/0명 -> '조용히 집중하는 시간')
      this.notify();

      if (!this.initialized) {
        this.initialized = true;
        this.connectFirebase();
      }
    }

    async connectFirebase() {
      try {
        const [appMod, dbMod] = await Promise.all([
          import("https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js"),
          import("https://www.gstatic.com/firebasejs/11.0.2/firebase-database.js")
        ]);

        const existingApps = typeof appMod.getApps === "function" ? appMod.getApps() : [];
        const app = existingApps.length > 0 ? existingApps[0] : appMod.initializeApp(firebaseConfig);
        const db = dbMod.getDatabase(app);

        this.db = db;
        this.dbApi = dbMod;
        this.mySessionRef = dbMod.ref(db, `focusing/${this.sessionId}`);

        // 1) .info/connected 구독: 재연결 시 focusing/{sessionId} 및 onDisconnect 자동 재설정
        const connectedRef = dbMod.ref(db, ".info/connected");
        dbMod.onValue(
          connectedRef,
          (snap) => {
            try {
              const connected = Boolean(snap.val());
              this.isConnected = connected;
              if (connected && this.isUserFocusing) {
                this.registerFocusingPresence();
              }
              if (!connected) {
                this.currentCount = 0;
              }
              this.notify();
            } catch (_) {}
          },
          () => {
            this.isConnected = false;
            this.currentCount = 0;
            this.notify();
          }
        );

        // 2) focusing 경로 실시간 접속자 수 구독
        const focusingListRef = dbMod.ref(db, "focusing");
        dbMod.onValue(
          focusingListRef,
          (snapshot) => {
            try {
              const val = snapshot.val();
              const count = val && typeof val === "object" ? Object.keys(val).length : 0;
              this.currentCount = count;
              this.notify();
            } catch (_) {}
          },
          () => {
            this.currentCount = 0;
            this.notify();
          }
        );
      } catch (err) {
        // 오프라인/차단 환경에서도 타이머와 앱이 전혀 영향을 받지 않도록 조용히 폴백
        this.isConnected = false;
        this.currentCount = 0;
        this.notify();
      }
    }

    async registerFocusingPresence() {
      if (!this.dbApi || !this.mySessionRef) return;
      try {
        await this.dbApi.onDisconnect(this.mySessionRef).remove();
        await this.dbApi.set(this.mySessionRef, true);
      } catch (_) {}
    }

    async leaveFocusingPresence() {
      if (!this.dbApi || !this.mySessionRef) return;
      try {
        await this.dbApi.remove(this.mySessionRef);
      } catch (_) {}
    }

    /**
     * 집중 타이머 실행(true) / 일시정지·중단·완료(false) 상태 반영
     */
    setUserFocusing(focusing) {
      const next = Boolean(focusing);
      if (this.isUserFocusing === next) return;
      this.isUserFocusing = next;

      try {
        if (next) {
          if (this.isConnected) {
            this.registerFocusingPresence();
          }
        } else {
          this.leaveFocusingPresence();
        }
      } catch (_) {}
    }

    notify() {
      const payload = {
        count: this.currentCount,
        connected: this.isConnected
      };
      for (const cb of this.listeners) {
        try {
          cb(payload.count, payload);
        } catch (_) {}
      }
    }
  }

  const focusPresence = new FocusPresenceManager();
  PetFocus.firebaseConfig = firebaseConfig;
  PetFocus.focusPresence = focusPresence;
  PetFocus.liveCounter = focusPresence;
})(window);
