/* 9~10차시 수업 적용: 배울 내용별 사례와 개인 수업 메모.
   메모는 이 브라우저에만 저장하며, 서버에 보내지 않는다. */
(function () {
  'use strict';
  var MK = window.MK, esc = MK.esc;
  var cases = [
    { name: '움직임을 설계하기', goal: '원하는 움직임에 맞게 코드와 구조를 바꾸고 이유를 설명한다.', task: '이야기 속 인물이 인사하거나 놀라는 모습을 움직임으로 표현해 봅시다.',
      support: '서보를 움직이는 기본 코드와 연결된 장치를 준비합니다. AI 신호는 한 가지로 함께 사용합니다.',
      choice: '어떤 장면을 표현할지, 얼마나 빠르고 크게 움직일지, 인물을 어떻게 세울지 정합니다.',
      evidence: '친구가 어떤 장면으로 보이는지 말해 줍니다. 움직임을 바꿔 보고 표현이 어떻게 달라졌는지 설명합니다.' },
    { name: 'AI의 판단을 살펴보기', goal: '학습 데이터가 달라지면 AI의 분류 결과도 달라질 수 있음을 확인한다.', task: '내가 학습시킨 이미지분류 모델이 친구의 물건도 구분하도록 고쳐 봅시다.',
      support: '이미지분류 학습 방법을 먼저 익힙니다. 분류 결과를 보여 줄 안내판과 코드는 간단한 예제로 제공합니다.',
      choice: '구분할 물건과 학습 사진을 정합니다. 잘못 구분한 사례를 보고 어떤 사진을 더 넣을지 생각합니다.',
      evidence: '학습에 쓰지 않은 사진으로 확인합니다. 데이터를 보완한 뒤 같은 시험 사진으로 결과를 비교합니다.' },
    { name: '쓸 사람을 생각하기', goal: '사용자의 의견을 듣고 작품을 고치며, 바꾼 이유를 설명한다.', task: '교실에서 전하고 싶은 말을 움직이는 안내판으로 만들어 봅시다.',
      support: '사용할 사람과 상황을 함께 이야기합니다. 기본 코드와 재료를 제공하고, 친구가 써 볼 시간을 확보합니다.',
      choice: '누구에게 무엇을 알릴지, 어떤 신호와 움직임이 좋을지 정합니다. AI 인식이 필요한 이유도 생각합니다.',
      evidence: '친구가 안내의 뜻을 알아보고 편하게 쓸 수 있는지 확인합니다. 받은 의견과 고친 부분을 함께 소개합니다.' }
  ];
  function copy(text, status) {
    function fallback() {
      var box = document.createElement('textarea'); box.value = text;
      box.style.cssText = 'position:fixed;left:-9999px;top:0'; document.body.appendChild(box); box.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) {}
      box.remove(); status.textContent = ok ? '복사했습니다.' : '복사하지 못했습니다. 입력한 글을 선택해 복사해 주세요.';
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { status.textContent = '복사했습니다.'; }, fallback);
    else fallback();
  }
  MK.widgets['teaching-focus'] = function (el) {
    el.innerHTML = '<div class="teach-tabs" role="group" aria-label="배울 내용 선택">' + cases.map(function (c, i) {
      return '<button type="button" data-focus="' + i + '" aria-pressed="false">' + esc(c.name) + '</button>';
    }).join('') + '</div><div data-case aria-live="polite"></div><div class="teach-foot"><span>어느 수업에서든 학생이 정하고, 해 보고, 고칠 시간을 줍니다.</span><button type="button" class="btn btn--sm btn--ghost" data-copy-case>이 수업 예시 복사</button><span class="teach-status" role="status"></span></div>';
    var current = 0, panel = el.querySelector('[data-case]'), status = el.querySelector('[role="status"]');
    function paint() {
      var c = cases[current];
      el.querySelectorAll('[data-focus]').forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.focus === current)); });
      panel.innerHTML = '<div class="teach-goal"><span>배울 내용</span><strong>' + esc(c.goal) + '</strong></div><div class="teach-case"><div class="teach-task"><span class="kk">학생에게 건넬 제안</span><h3>' + esc(c.task) + '</h3></div><div class="teach-details">' + [['교사가 준비할 것', c.support], ['학생이 정할 것', c.choice], ['배움을 확인할 장면', c.evidence]].map(function (r) { return '<div><h4>' + r[0] + '</h4><p>' + esc(r[1]) + '</p></div>'; }).join('') + '</div></div>';
      status.textContent = '';
    }
    el.querySelectorAll('[data-focus]').forEach(function (b) { b.addEventListener('click', function () { current = +b.dataset.focus; paint(); }); });
    el.querySelector('[data-copy-case]').addEventListener('click', function () { var c = cases[current]; copy(c.name + '\n배울 내용: ' + c.goal + '\n학생에게 건넬 제안: ' + c.task + '\n교사가 준비할 것: ' + c.support + '\n학생이 정할 것: ' + c.choice + '\n배움을 확인할 장면: ' + c.evidence, status); });
    paint();
  };
  MK.widgets['teaching-focus'].once = true;

  MK.widgets['lesson-note'] = function (el) {
    var key = MK.config.storageKey + '-lesson-note-v1';
    var fields = [
      ['대상과 시간', '어느 학년, 어떤 교과·동아리에서 몇 차시로 해 볼까요?'],
      ['배울 내용과 만들 작품', '학생이 무엇을 알아가면 좋을까요? 어떤 작품으로 배워 볼까요?'],
      ['학생의 선택과 교사의 준비', '학생에게 맡길 결정은? 미리 익힐 도구나 제공할 도움은?'],
      ['써 보고 고치는 방법', '누가 써 보고 무엇을 알려 줄까요? 어떤 변화와 설명을 살펴볼까요?']
    ];
    var values = {}, readable = true;
    try { var raw = JSON.parse(localStorage.getItem(key) || '{}'); if (raw && typeof raw === 'object') values = raw; } catch (e) { readable = false; }
    el.innerHTML = '<div class="teach-note"><div class="teach-fields">' + fields.map(function (f, i) {
      return '<label class="teach-field"><span><b>' + (i + 1) + '</b>' + f[0] + '</span><textarea rows="2" maxlength="600" data-note="' + i + '" placeholder="' + esc(f[1]) + '">' + esc(typeof values[i] === 'string' ? values[i] : '') + '</textarea></label>';
    }).join('') + '</div><aside class="teach-note-side"><span class="tag tag--solid c-yellow">옆 선생님과 나누기</span><h3>학생이 스스로<br>정할 부분이 있나요?</h3><p>도구를 익히다가 수업이 끝나지 않도록, <b>직접 해 보고 고칠 시간</b>도 남겨 두었는지 이야기해 보세요.</p><div class="teach-note-actions"><button type="button" class="btn btn--yellow" data-copy-note>내 수업 메모 복사</button><span class="teach-status" role="status"></span><small data-save-status role="status"></small></div></aside></div>';
    var saveStatus = el.querySelector('[data-save-status]');
    saveStatus.textContent = readable ? '입력하면 이 브라우저에 자동 저장됩니다.' : '저장소를 읽을 수 없습니다. 메모를 복사해 보관해 주세요.';
    el.querySelectorAll('[data-note]').forEach(function (input) {
      input.addEventListener('input', function () {
        values[input.dataset.note] = input.value;
        try { localStorage.setItem(key, JSON.stringify(values)); saveStatus.textContent = '이 브라우저에 저장했습니다. 다른 기기에서는 보이지 않습니다.'; }
        catch (e) { saveStatus.textContent = '저장하지 못했습니다. 메모를 복사해 보관해 주세요.'; }
      });
    });
    el.querySelector('[data-copy-note]').addEventListener('click', function () {
      copy('우리 반에서 해 볼 메이커 수업\n\n' + fields.map(function (f, i) { return f[0] + '\n' + (el.querySelector('[data-note="' + i + '"]').value.trim() || '(아직 적지 않음)'); }).join('\n\n'), el.querySelector('.teach-status'));
    });
  };
  MK.widgets['lesson-note'].once = true;
})();
