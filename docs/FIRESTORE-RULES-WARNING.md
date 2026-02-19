# ⚠️ Firestore Rules 관리 정책

## 🚨 매우 중요한 경고

**이 프로젝트(Altar Scheduler)의 `firestore.rules` 파일은 독립적으로 배포하면 안 됩니다!**

### 이유
- Firebase 프로젝트(`ordo-eb11a`)는 **여러 앱(Ordo, Altar Scheduler, Verbum 등)이 공유**합니다
- Firestore Security Rules는 **프로젝트당 단 1개만 존재**합니다
- 이 프로젝트에서 Rules를 배포하면 **다른 앱의 Rules가 덮어써지며 즉시 파괴**됩니다!

---

## ✅ 올바른 프로세스 (자동화됨)

### 1. Rules 수정이 필요할 때

**⚡ 자동 병합 스크립트 사용:**

```bash
# 1단계: Ordo 메인 앱의 firestore.rules를 베이스로 병합
npm run rules:merge

# 2단계: 생성된 firestore.rules 확인
# -> altar-scheduler/firestore.rules 파일이 자동으로 업데이트됨

# 3단계: Ordo 프로젝트에 복사
Copy-Item .\firestore.rules ..\Ordo\firestore.rules -Force

# 4단계: Ordo 프로젝트에서 배포
cd ..\Ordo
firebase deploy --only firestore:rules
```

**📝 수동으로 Altar Scheduler 섹션 수정이 필요한 경우:**

`scripts/merge-firestore-rules.js` 파일 내의 `ALTAR_SCHEDULER_SECTION` 상수를 수정한 후,  
위의 자동 병합 프로세스를 실행하세요.

### 2. 병합 스크립트 작동 방식

자동 병합 스크립트(`npm run rules:merge`)는:
1. ✅ Ordo 메인 앱의 `firestore.rules`를 읽어옴
2. ✅ `isSuperAdmin()` 함수를 Ordo + Altar 통합 버전으로 교체
3. ✅ Altar Scheduler 헬퍼 함수 추가
4. ✅ Altar Scheduler 전용 Rules 섹션 추가
5. ✅ 최종 병합된 `firestore.rules` 생성

---

## ❌ 절대 하지 말아야 할 것

```bash
# ❌ 이 명령어를 실행하면 다른 앱들이 즉시 파괴됩니다!
firebase deploy --only firestore:rules  # 절대 금지!!!
```

---

## 📚 자세한 내용

Ordo Ecosystem PRD 문서를 참조하세요:
- 위치: `d:\works_ordo\Ordo\docs\PRD\PRD-Ordo Eco.md`
- 섹션: **5.2 Firestore Security Rules 관리 정책**

---

**마지막 업데이트**: 2026-02-16  
**책임자**: Ordo Ecosystem Team
