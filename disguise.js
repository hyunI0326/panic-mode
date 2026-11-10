const requestedView = new URLSearchParams(location.search).get('view');
const view = ['spreadsheet', 'code', 'ios', 'windows'].includes(requestedView) ? requestedView : 'spreadsheet';
for (const [name, id] of [['spreadsheet', 'sheet'], ['code', 'code'], ['ios', 'ios'], ['windows', 'windows']]) {
  document.querySelector('#' + id + '-view').hidden = view !== name;
}
if (view === 'ios' || view === 'windows') {
  document.title = view === 'ios' ? '소프트웨어 업데이트' : 'Windows 업데이트';
} else if (view === 'code') {
  document.title = 'dashboard.ts - project-dashboard';
  document.querySelector('#code-content').textContent = [
    '// Project dashboard', '', "type TaskStatus = 'pending' | 'in-progress' | 'done';", '',
    'interface Task {', '  id: string;', '  title: string;', '  owner: string;', '  status: TaskStatus;', '}', '',
    'export function getSummary(tasks: Task[]) {', '  return {', '    total: tasks.length,',
    "    completed: tasks.filter((task) => task.status === 'done').length,",
    "    inProgress: tasks.filter((task) => task.status === 'in-progress').length,", '  };', '}', '',
    'export const dashboardConfig = {', '  refreshInterval: 30000,', '  showCompleted: true,', '};'
  ].join('\n');
} else {
  const rows = [
    ['프로젝트 업무 현황'], ['2026년 11월  |  팀 운영 현황'], [],
    ['구분', '업무 내용', '담당자', '시작일', '마감일', '진행 상태', '비고'],
    ['기획', '프로젝트 요구사항 정리', '김민준', '11.03', '11.07', '완료', '검토 완료'],
    ['디자인', '화면 구성 및 시안 제작', '이서연', '11.05', '11.12', '진행 중', '1차 시안'],
    ['개발', '핵심 기능 구현', '박지훈', '11.10', '11.21', '진행 중', '일정 확인'],
    ['운영', '주간 업무 회의', '최유진', '11.10', '11.10', '예정', '회의실 예약'],
    ['검토', '중간 결과물 검토', '김민준', '11.17', '11.19', '예정', ''],
    ['보고', '월간 진행 현황 보고', '이서연', '11.24', '11.28', '예정', '']
  ];
  const grid = document.querySelector('#grid');
  const head = grid.createTHead().insertRow();
  [''].concat('ABCDEFGHIJKL'.split('')).forEach((value) => { const th = document.createElement('th'); th.textContent = value; head.appendChild(th); });
  const body = grid.createTBody();
  for (let r = 0; r < 40; r++) {
    const row = body.insertRow();
    const number = document.createElement('th'); number.textContent = r + 1; row.appendChild(number);
    for (let c = 0; c < 12; c++) {
      const cell = row.insertCell();
      cell.contentEditable = 'true';
      cell.spellcheck = false;
      cell.textContent = rows[r]?.[c] || '';
      if (r === 0) cell.classList.add('title-cell');
      if (r === 3) cell.classList.add('heading-cell');
      cell.addEventListener('focus', () => { document.querySelector('#cell-name').textContent = 'ABCDEFGHIJKL'[c] + (r + 1); document.querySelector('#formula-text').textContent = cell.textContent; });
      cell.addEventListener('input', () => { document.querySelector('#formula-text').textContent = cell.textContent; });
    }
  }
}
