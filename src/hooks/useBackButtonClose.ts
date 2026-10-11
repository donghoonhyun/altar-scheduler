import { useCallback, useEffect, useRef, useState } from 'react';
import { registerOverlay } from '@/lib/overlayHistory';

/**
 * ✅ useBackButtonClose
 * ---------------------------------------------------------
 * open 인 동안 휴대폰/브라우저 "뒤로 가기"가 페이지를 떠나지 않고 onClose 를 호출하게 한다.
 * 여러 겹으로 열려 있으면 가장 위의 것부터 하나씩 닫힌다. (src/lib/overlayHistory.ts)
 * ---------------------------------------------------------
 */
export function useBackButtonClose(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // 뒤로 가기에도 닫히지 않은(저장 중 등으로 닫기를 거부한) 오버레이를 다시 등록하기 위한 카운터
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;

    return registerOverlay({
      close: () => {
        onCloseRef.current();
        setAttempt((n) => n + 1);
      },
    });
  }, [open, attempt]);
}

interface OpenStateProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Radix Root(Dialog·Sheet·Drawer·AlertDialog)의 open 상태에 useBackButtonClose 를 연결한다.
 * 반환값을 Root 에 그대로 넘긴다.
 */
export function useBackDismissibleOpenState({ open: openProp, defaultOpen, onOpenChange }: OpenStateProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen ?? false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : uncontrolledOpen;

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange]
  );

  // open 만 고정으로 주고 onOpenChange 가 없는 오버레이는 스스로 닫을 수 없으므로 연결하지 않는다
  const dismissible = !isControlled || !!onOpenChange;
  useBackButtonClose(open && dismissible, () => handleOpenChange(false));

  return { open, onOpenChange: handleOpenChange };
}
