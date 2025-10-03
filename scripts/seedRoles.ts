// scripts/seedRoles.ts
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

initializeApp({ projectId: "altar-scheduler-dev" });

const auth = getAuth();
const db = getFirestore();

// ⚡ 테스트용 성당 코드
const TEST_PARISH_CODE = "DAEGU-BEOMEO";
// ⚡ 테스트용 서버그룹 코드 (5자리 zero-padding)
const TEST_SERVER_GROUP_ID = "SG00001";

// 샘플 유저 정의 (Planner / Server 전용)
const USERS = [
  {
    uid: "planner-test-uid",
    email: "planner@test.com",
    password: "123456",
    displayName: "Planner User",
    roleDocs: [
      {
        collection: "memberships",
        docId: `planner-test-uid_${TEST_SERVER_GROUP_ID}`,
        data: {
          uid: "planner-test-uid",
          server_group_id: TEST_SERVER_GROUP_ID,
          parish_code: TEST_PARISH_CODE,
          role: "planner",
        },
      },
    ],
  },
  {
    uid: "server-test-uid",
    email: "server@test.com",
    password: "123456",
    displayName: "Server User",
    roleDocs: [
      {
        collection: "memberships",
        docId: `server-test-uid_${TEST_SERVER_GROUP_ID}`,
        data: {
          uid: "server-test-uid",
          server_group_id: TEST_SERVER_GROUP_ID,
          parish_code: TEST_PARISH_CODE,
          role: "server",
        },
      },
    ],
  },
];

// ⚡ 복사단원 전체 명단
const SERVERS = [
  { name_kor: "전도윤", baptismal_name: "스테파노", grade: "E6", phone_student: "01052794222", phone_guardian: "01086674222", notes: "단장" },
  { name_kor: "임찬건", baptismal_name: "가브리엘", grade: "E6", phone_student: "01088975841", phone_guardian: "01082885841", notes: "부단장" },
  { name_kor: "박범서", baptismal_name: "미카엘", grade: "E6", phone_student: "01064831802", phone_guardian: "01099322453", notes: "서기" },
  { name_kor: "김도경", baptismal_name: "안드레아", grade: "E6", phone_student: "01089236307", phone_guardian: "01089846307" },
  { name_kor: "김범준", baptismal_name: "라파엘", grade: "E6", phone_student: "01053542099", phone_guardian: "01053542099" },
  { name_kor: "김주아", baptismal_name: "소피아", grade: "E6", phone_student: "01048006450", phone_guardian: "01084268900" },
  { name_kor: "김지오", baptismal_name: "베네딕토", grade: "E6", phone_student: "01038793463", phone_guardian: "01035303463" },
  { name_kor: "김한희", baptismal_name: "임마누엘라", grade: "E6", phone_student: "01036028773", phone_guardian: "01087738246" },
  { name_kor: "박가영", baptismal_name: "스텔라", grade: "E6", phone_guardian: "01032932738" },
  { name_kor: "서민호", baptismal_name: "발렌티노", grade: "E6", phone_student: "01055231539", phone_guardian: "01072556776" },
  { name_kor: "이도현", baptismal_name: "마르코", grade: "E6", phone_student: "01038174998", phone_guardian: "01038044998" },
  { name_kor: "이서범", baptismal_name: "가브리엘", grade: "E6", phone_student: "01088610053", phone_guardian: "01020448888" },
  { name_kor: "이연서", baptismal_name: "크리스티나", grade: "E6", phone_student: "01049790196", phone_guardian: "01025140196" },
  { name_kor: "이지온", baptismal_name: "스테파노", grade: "E6", phone_student: "01096197306", phone_guardian: "01065454561" },
  { name_kor: "정도현", baptismal_name: "다니엘", grade: "E6", phone_student: "01099798019", phone_guardian: "01052714060" },
  { name_kor: "최진후", baptismal_name: "요한", grade: "E6", phone_student: "01098237972", phone_guardian: "01093597972" },
  { name_kor: "하진유", baptismal_name: "안토니오", grade: "E6", phone_student: "01071105078", phone_guardian: "01035835078" },
  { name_kor: "권유나", baptismal_name: "율리아", grade: "E5", phone_student: "01087868719", phone_guardian: "01028198719" },
  { name_kor: "김동윤", baptismal_name: "라파엘", grade: "E5", phone_student: "01025560622", phone_guardian: "01062590622" },
  { name_kor: "김민지", baptismal_name: "스텔라", grade: "E5", phone_student: "01021293688", phone_guardian: "01093903579" },
  { name_kor: "김주원", baptismal_name: "프란치스코", grade: "E5", phone_guardian: "01025801783" },
  { name_kor: "김태현", baptismal_name: "다미아노", grade: "E5", phone_student: "01073464845", phone_guardian: "01085344845" },
  { name_kor: "서혜민", baptismal_name: "노엘라", grade: "E5", phone_student: "01050648784", phone_guardian: "01071688784" },
  { name_kor: "손준우", baptismal_name: "미카엘", grade: "E5", phone_student: "01051551519", phone_guardian: "01043271519" },
  { name_kor: "원세연", baptismal_name: "엘리사벳", grade: "E5", phone_guardian: "01085950823" },
  { name_kor: "윤주하", baptismal_name: "뽀리나", grade: "E5", phone_guardian: "01025659928" },
  { name_kor: "이유현", baptismal_name: "에밀리아", grade: "E5", phone_guardian: "01031101850" },
  { name_kor: "이윤서", baptismal_name: "비오", grade: "E5", phone_guardian: "01091410825" },
  { name_kor: "이준웅", baptismal_name: "프란치스코", grade: "E5", phone_student: "01082059772", phone_guardian: "01063806919" },
  { name_kor: "이하원", baptismal_name: "라파엘라", grade: "E5", phone_student: "01048041757", phone_guardian: "01092751757" },
  { name_kor: "장수민", baptismal_name: "크리스티나", grade: "E5", phone_student: "01022809302", phone_guardian: "01076490111" },
  { name_kor: "전도준", baptismal_name: "라파엘", grade: "E5", phone_student: "01045574222", phone_guardian: "01086674222" },
  { name_kor: "정수아", baptismal_name: "아셀라", grade: "E5", phone_student: "01076823677", phone_guardian: "01099293677" },
  { name_kor: "천성재", baptismal_name: "루카", grade: "E5", phone_student: "01088498072", phone_guardian: "01095500310" },
  { name_kor: "최리원", baptismal_name: "마리스텔라", grade: "E5", phone_guardian: "01047189363" },
  { name_kor: "강지인", baptismal_name: "세실리아", grade: "E4", phone_student: "01020498100", phone_guardian: "01099449059" },
  { name_kor: "김규린", baptismal_name: "그라시아", grade: "E4", phone_student: "01090236307", phone_guardian: "01089846307" },
  { name_kor: "김우현", baptismal_name: "레오", grade: "E4", phone_guardian: "01041472522" },
  { name_kor: "김재아", baptismal_name: "베네딕토", grade: "E4", phone_student: "01029077040", phone_guardian: "01025568197" },
  { name_kor: "박지훈", baptismal_name: "필립보", grade: "E4", phone_student: "01022179981", phone_guardian: "01050265058" },
  { name_kor: "박찬서", baptismal_name: "라파엘", grade: "E4", phone_guardian: "01099982453" },
  { name_kor: "석재원", baptismal_name: "베드로토마스", grade: "E4", phone_student: "01084476678", phone_guardian: "01047101276" },
  { name_kor: "신채민", baptismal_name: "소피아", grade: "E4", phone_guardian: "01035114527" },
  { name_kor: "안서준", baptismal_name: "사도요한", grade: "E4", phone_guardian: "01030004276" },
  { name_kor: "장하윤", baptismal_name: "레오", grade: "E4", phone_student: "01099701246", phone_guardian: "01089528234" },
  { name_kor: "정태정", baptismal_name: "세례자요한", grade: "E4", phone_student: "01058133175", phone_guardian: "01095353175" },
  { name_kor: "최예라", baptismal_name: "리디아", grade: "E4", phone_student: "01032518956", phone_guardian: "01094841894" },
  { name_kor: "최요한", baptismal_name: "사도요한", grade: "E4", phone_student: "01036665633", phone_guardian: "01065205633" },
  { name_kor: "최지호", baptismal_name: "미카엘라", grade: "E4", phone_guardian: "01046088833" },
  { name_kor: "나연우", baptismal_name: "루피노", grade: "E5", phone_student: "01058202738", phone_guardian: "01085830994" },
  { name_kor: "이동훈", baptismal_name: "암브로시오", grade: "E5", phone_guardian: "01086065119" },
  { name_kor: "곽민율", baptismal_name: "그레고리오", grade: "E4", phone_guardian: "01085673832" },
  { name_kor: "하서준", baptismal_name: "도미니코", grade: "E4", phone_student: "01086323524", phone_guardian: "01086323523" },
  { name_kor: "곽민찬", baptismal_name: "제노", grade: "E3", phone_guardian: "01085673832" },
  { name_kor: "김규린", baptismal_name: "모니카", grade: "E3", phone_guardian: "01091269527" },
  { name_kor: "김예리", baptismal_name: "안젤라", grade: "E3", phone_student: "01063903807", phone_guardian: "01031386677" },
  { name_kor: "김하민", baptismal_name: "마리스텔라", grade: "E3", phone_student: "01050776203", phone_guardian: "01047836203" },
  { name_kor: "박시형", baptismal_name: "베르다", grade: "E3", phone_guardian: "01032932738" },
  { name_kor: "석재이", baptismal_name: "엘리아", grade: "E3", phone_student: "01084551276", phone_guardian: "01047101276" },
  { name_kor: "손지우", baptismal_name: "가브리엘라", grade: "E3", phone_student: "01095781519", phone_guardian: "01043261519" },
  { name_kor: "이다현", baptismal_name: "소화데레사", grade: "E3", phone_student: "01021031850", phone_guardian: "01031101850" },
  { name_kor: "황지안", baptismal_name: "클라라", grade: "E3", phone_student: "01089362785", phone_guardian: "01089362785" },
];

// 시드 실행 함수
async function seed() {
  console.log("✅ Firebase Admin 연결됨 (Emulator, altar-scheduler-dev)");

  // Auth / memberships / users
  for (const u of USERS) {
    try {
      await auth.getUser(u.uid);
      console.log(`ℹ️ 이미 존재하는 유저: ${u.email}`);
    } catch {
      await auth.createUser({
        uid: u.uid,
        email: u.email,
        password: u.password,
        displayName: u.displayName,
      });
      console.log(`✅ Auth 사용자 생성: ${u.email}`);
    }

    for (const r of u.roleDocs) {
      await db.collection(r.collection).doc(r.docId).set({
        ...r.data,
        created_at: new Date(),
        updated_at: new Date(),
      });
      console.log(`✅ Firestore 문서 생성: ${r.collection}/${r.docId}`);
    }

    await db.collection("users").doc(u.uid).set({
      uid: u.uid,
      email: u.email,
      display_name: u.displayName,
      created_at: new Date(),
      updated_at: new Date(),
    });
  }

  // server_groups 문서
  const sgRef = db.collection("server_groups").doc(TEST_SERVER_GROUP_ID);
  await sgRef.set({
    server_group_id: TEST_SERVER_GROUP_ID,
    parish_code: TEST_PARISH_CODE,
    name: "범어성당 복사단 1그룹",
    timezone: "Asia/Seoul",
    locale: "ko-KR",
    active: true,
    created_at: new Date(),
    updated_at: new Date(),
  });
  console.log(`✅ server_groups/${TEST_SERVER_GROUP_ID} 문서 생성`);

  // members 서브컬렉션 시드
  const batch = db.batch();
  SERVERS.forEach((s, idx) => {
    const memberId = `M${String(idx + 1).padStart(4, "0")}`; // M0001, M0002 ...
    const mRef = sgRef.collection("members").doc(memberId);
    batch.set(mRef, {
      ...s,
      created_at: new Date(),
      updated_at: new Date(),
    });
  });
  await batch.commit();
  console.log(`✅ ${SERVERS.length}명 복사단원 추가 완료`);

  console.log("🎉 모든 시드 작업 완료");
}

seed().catch((err) => {
  console.error("❌ 시드 작업 실패:", err);
  process.exit(1);
});
