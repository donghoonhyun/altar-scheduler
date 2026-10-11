/**
 * 오버레이(Drawer·Dialog·Sheet) ↔ 브라우저 히스토리 연동
 *
 * 오버레이가 열려 있는 동안 휴대폰/브라우저 "뒤로 가기"가 페이지를 떠나지 않고
 * 가장 위의 오버레이만 닫도록, 열린 오버레이 수만큼 히스토리 항목을 쌓아 둔다.
 *
 * 불변식: (현재 히스토리 항목의 depth) === (열려 있는 오버레이 수)
 *  - 오버레이가 열리면 pushState 로 depth 를 올리고
 *  - 뒤로 가기(popstate)로 depth 가 내려가면 그만큼 위에서부터 닫고
 *  - 버튼 등으로 닫히면 history.go 로 남는 항목을 되돌린다.
 *
 * 추가하는 항목의 state 는 기존 값(React Router 의 key/idx/usr)을 그대로 복사하므로
 * 라우터에는 같은 위치로 보이고 페이지가 다시 마운트되지 않는다.
 */

const DEPTH_KEY = '__overlayDepth';

export interface OverlayEntry {
  /** 뒤로 가기로 이 오버레이를 닫아야 할 때 호출된다 */
  close: () => void;
}

const stack: OverlayEntry[] = [];
let syncQueued = false;

function currentDepth(): number {
  const state: unknown = window.history.state;
  if (state && typeof state === 'object' && DEPTH_KEY in state) {
    const depth = (state as Record<string, unknown>)[DEPTH_KEY];
    return typeof depth === 'number' ? depth : 0;
  }
  return 0;
}

/** 히스토리 depth 를 열린 오버레이 수에 맞춘다 */
function sync() {
  syncQueued = false;
  const depth = currentDepth();

  if (stack.length > depth) {
    for (let d = depth + 1; d <= stack.length; d++) {
      window.history.pushState({ ...window.history.state, [DEPTH_KEY]: d }, '');
    }
  } else if (stack.length < depth) {
    // 닫으면서 다른 페이지로 이동한 경우에는 현재 항목이 오버레이 항목이 아니므로(depth 0) 여기로 오지 않는다
    window.history.go(stack.length - depth);
  }
}

/**
 * 같은 렌더에서 일어난 열기/닫기를 한 번에 반영하기 위해 마이크로태스크로 미룬다.
 * (StrictMode 의 effect 이중 실행, "A 닫고 B 열기", "닫으면서 navigate" 가 모두 여기서 정리된다)
 */
function scheduleSync() {
  if (syncQueued) return;
  syncQueued = true;
  queueMicrotask(sync);
}

function handlePopState() {
  const depth = currentDepth();

  // 뒤로 가기로 빠져나온 만큼 위에서부터 닫는다
  while (stack.length > depth) {
    stack.pop()!.close();
  }

  // 열린 오버레이가 없는 오버레이 항목(닫으면서 이동한 뒤 남은 항목 등)은 건너뛴다
  if (depth > stack.length) {
    window.history.go(stack.length - depth);
  }
}

/** 열린 오버레이를 등록한다. 반환된 함수는 오버레이가 닫히거나 언마운트될 때 호출한다. */
export function registerOverlay(entry: OverlayEntry): () => void {
  stack.push(entry);
  scheduleSync();

  return () => {
    const index = stack.indexOf(entry);
    if (index !== -1) stack.splice(index, 1);
    scheduleSync();
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', handlePopState);
  // 오버레이가 열린 채 새로고침하면 오버레이 항목만 남으므로 시작할 때 한 번 맞춘다
  scheduleSync();

  if (import.meta.hot) {
    import.meta.hot.dispose(() => window.removeEventListener('popstate', handlePopState));
  }
}
