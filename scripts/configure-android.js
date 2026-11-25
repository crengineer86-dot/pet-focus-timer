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

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureWebViewAudio();
    }

    @Override
    public void onStart() {
        super.onStart();
        configureWebViewAudio();
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
  console.log("[configure-android] MainActivity.java 백그라운드 오디오 WebView 설정 적용 완료");
}

patchAndroidManifest();
patchMainActivity();
