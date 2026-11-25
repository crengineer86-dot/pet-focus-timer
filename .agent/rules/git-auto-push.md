---
trigger: always_on
---

# GitHub 자동 커밋 & 푸시 규칙 (pet-focus-timer)

이 프로젝트(`pet-focus-timer`)에서 기능 추가, UI 수정, 버그 수정을 완료할 때마다 사용자가 별도로 요청하지 않아도 아래 절차를 자동으로 마무리합니다.

1. **사전 검증**: 푸시 전 코드 문법·빌드 및 라이브 프리뷰(콘솔 오류 0건)가 깨지지 않았는지 확인합니다.
2. **한국어 요약 커밋**: 변경 사항을 간결한 한국어 커밋 메시지로 작성해 `git add -A` 및 `git commit -m "<요약>"`을 실행합니다.
3. **자동 푸시**: `git push origin main`으로 원격 저장소(`https://github.com/crengineer86-dot/pet-focus-timer.git`)에 최신 코드를 즉시 반영합니다.
4. **결과 보고**: 응답 마지막에 실행한 커밋 메시지와 푸시 완료 여부를 짧게 안내합니다.
