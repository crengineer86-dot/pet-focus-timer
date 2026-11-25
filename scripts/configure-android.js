/**
 * Capacitor Android 프로젝트 생성/동기화 후 필수 권한과 백그라운드 오디오 WebView 설정을 자동 반영합니다.
 * - AndroidManifest.xml: POST_NOTIFICATIONS, SCHEDULE_EXACT_ALARM, WAKE_LOCK, VIBRATE
 * - MainActivity.java: setMediaPlaybackRequiresUserGesture(false) + 화면 꺼짐 시 <audio loop> 끊김 완화
 */
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const manifestPath = path.join(rootDir, "android", "app", "src", "main", "AndroidManifest.xml");
const mainActivityPath = path.join(
  rootDir,
  "android",
  "app",
  "src",
  "main",
  "java",
  "com",
  "petfocustimer",
  "app",
  "MainActivity.java"
);

const REQUIRED_PERMISSIONS = [
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.SCHEDULE_EXACT_ALARM",
  "android.permission.WAKE_LOCK",
  "android.permission.VIBRATE"
];

function patchAndroidManifest() {
  if (!fs.existsSync(manifestPath)) {
    console.warn("[configure-android] AndroidManifest.xml을 찾을 수 없습니다:", manifestPath);
    return;
  }

  let xml = fs.readFileSync(manifestPath, "utf8");
  const missing = REQUIRED_PERMISSIONS.filter((perm) => !xml.includes(perm));

  if (missing.length > 0) {
    const lines = missing
      .map((perm) => `    <uses-permission android:name="${perm}" />`)
      .join("\n");
    xml = xml.replace("<application", `${lines}\n\n    <application`);
    fs.writeFileSync(manifestPath, xml, "utf8");
    console.log("[configure-android] AndroidManifest.xml 권한 추가:", missing.join(", "));
  } else {
    console.log("[configure-android] AndroidManifest.xml 필수 권한 이미 적용됨");
  }
}

function patchMainActivity() {
  if (!fs.existsSync(mainActivityPath)) {
    console.warn("[configure-android] MainActivity.java를 찾을 수 없습니다:", mainActivityPath);
    return;
  }

  const desiredSource = `package com.petfocustimer.app;

import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureSystemBars();
        configureWebViewAudio();
    }

    @Override
    public void onStart() {
        super.onStart();
        configureSystemBars();
        configureWebViewAudio();
    }

    private void configureSystemBars() {
        Window window = getWindow();
        if (window == null) return;

        // 밝은 아이보리 배경(#FEF9F1)에 맞춰 상태바·내비게이션바 배경과 어두운 시스템 아이콘 적용
        int ivoryColor = Color.parseColor("#FEF9F1");
        window.setStatusBarColor(ivoryColor);
        window.setNavigationBarColor(ivoryColor);

        // Edge-to-Edge 일관 처리 후 루트 컨테이너에 시스템 바·노치 인셋 패딩을 직접 부여해 헤더 가림 방지
        WindowCompat.setDecorFitsSystemWindows(window, false);
        View decorView = window.getDecorView();
        WindowInsetsControllerCompat insetsController =
            WindowCompat.getInsetsController(window, decorView);
        if (insetsController != null) {
            insetsController.setAppearanceLightStatusBars(true);
            insetsController.setAppearanceLightNavigationBars(true);
        }

        View contentRoot = findViewById(android.R.id.content);
        if (contentRoot != null) {
            contentRoot.setBackgroundColor(ivoryColor);
            ViewCompat.setOnApplyWindowInsetsListener(contentRoot, (view, windowInsets) -> {
                Insets bars = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
                );
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return WindowInsetsCompat.CONSUMED;
            });
            ViewCompat.requestApplyInsets(contentRoot);
        }
    }

    private void configureWebViewAudio() {
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebSettings settings = getBridge().getWebView().getSettings();
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setDomStorageEnabled(true);
        }
    }

    @Override
    public void onPause() {
        super.onPause();
        // 화면 꺼짐/백그라운드 전환 시 WebView의 <audio loop> 환경음이 즉시 정지되지 않도록 유지
        if (getBridge() != null && getBridge().getWebView() != null) {
            WebView webView = getBridge().getWebView();
            webView.onResume();
            webView.resumeTimers();
        }
    }
}
`;

  fs.writeFileSync(mainActivityPath, desiredSource, "utf8");
  console.log("[configure-android] MainActivity.java 시스템 바 인셋 및 백그라운드 오디오 설정 적용 완료");
}

patchAndroidManifest();
patchMainActivity();
