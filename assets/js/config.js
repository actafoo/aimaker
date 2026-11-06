/* =========================================================
   연수 정보와 설정 — 여기만 고치면 교안 전체에 반영됩니다
   ========================================================= */
window.MK = window.MK || {};

MK.config = {
  course: '2026 AI·디지털 기반 융합·메이커교육 역량강화 직무연수',
  session: '9~10차시',
  title: '링비트와 AI모델을 활용한 문제해결 작품 제작 및 수업 적용',
  tagline: '도전과제 하나를 골라 30초 동안 움직이는 작품을 만듭니다',
  date: '2026. 11. 21.(토) 16:00~17:50',
  place: '중부과학교육센터',
  instructor: '지주선',            // ← 강사 이름을 적어 주세요
  instructorRole: '',                  // 예: '○○초등학교 교사'

  // 연수생이 노트북에서 열 주소. 배포 뒤 짧은 주소를 적으면 5쪽에 크게 보입니다.
  shareUrl: 'https://actafoo.github.io/aimaker/910/',

  // 온라인 저장소(구글 시트 Apps Script 웹 앱) 주소. 비워 두면 이 브라우저에만 저장하는 데모 모드입니다.
  apiUrl: 'https://script.google.com/macros/s/AKfycbw7sm3uzVGkmfLkHtfmGcurtYaklgWFF4taYoBIDclS43XbxbH3VceRWc6_gtGQABCE/exec',
  pollSeconds: 10,                     // 현황판·도전과제 쪽을 보고 있을 때 다시 받아 오는 간격(초)

  // 데모 모드 전용 관리자 비밀번호. 온라인 저장소를 쓰면 비밀번호는 Code.gs에서 확인하므로 여기는 비워 둡니다.
  adminPassword: '',

  storageKey: 'mk910-data-v1',

  defaultCapacity: 4,
  descMax: 300
};
