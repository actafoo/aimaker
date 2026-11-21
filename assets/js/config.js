/* =========================================================
   연수 정보와 설정 — 여기만 고치면 교안 전체에 반영됩니다
   ========================================================= */
window.MK = window.MK || {};

MK.config = {
  course: '2026 AI·디지털 기반 융합·메이커교육 역량강화 직무연수',
  session: '9~10차시',
  title: '링비트와 AI모델을 활용한 문제해결 작품 제작 및 수업 적용',
  tagline: '섞인 바둑돌을 AI로 나누는 분류기를 만들고, 우리 반 수업으로 가져갑니다',
  date: '2026. 11. 21.(토) 16:00~17:50',
  place: '서울한서초등학교',
  instructor: '지주선',            // ← 강사 이름을 적어 주세요
  instructorRole: '',                  // 예: '○○초등학교 교사'

  // 연수생이 노트북에서 열 주소. 배포 뒤 짧은 주소를 적으면 5쪽에 크게 보입니다.
  shareUrl: 'https://joo.is/aimaker',

  // 교안을 파일로 직접 열었을 때 유튜브 영상을 띄우는 중계 페이지(배포한 사이트의 yt.html). 이게 없으면 「오류 153」이 납니다.
  ytRelay: 'https://actafoo.github.io/aimaker/yt.html',

  // 「제출용 동영상 찍기」에서 연수생이 영상을 올릴 강사 구글 드라이브 폴더 주소.
  // 폴더 공유를 「링크가 있는 모든 사용자 · 편집자」로 해 두어야 올릴 수 있고, 올린 영상도 발표 때 재생됩니다.
  driveUrl: 'https://drive.google.com/drive/folders/1NhHnVNdrR8g_KZvnkLBVkenE6UbFVPl1?usp=sharing',

  // 온라인 저장소(구글 시트 Apps Script 웹 앱) 주소. 비워 두면 이 브라우저에만 저장하는 데모 모드입니다.
  apiUrl: 'https://script.google.com/macros/s/AKfycbw7sm3uzVGkmfLkHtfmGcurtYaklgWFF4taYoBIDclS43XbxbH3VceRWc6_gtGQABCE/exec',
  pollSeconds: 10,                     // 현황판·도전과제 쪽을 보고 있을 때 다시 받아 오는 간격(초)

  // 데모 모드 전용 관리자 비밀번호. 온라인 저장소를 쓰면 비밀번호는 Code.gs에서 확인하므로 여기는 비워 둡니다.
  adminPassword: '',

  storageKey: 'mk910-data-v1',

  defaultCapacity: 4,
  descMax: 300
};
