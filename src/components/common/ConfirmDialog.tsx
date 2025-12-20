import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { createRoot } from 'react-dom/client';

export interface ConfirmDialogProps {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onClose?: (v: boolean) => void;
}

/**
 * ✅ ConfirmDialog
 * - Fade/Scale 애니메이션 + Shake 효과
 * - openConfirm()으로 어디서나 쉽게 호출 가능
 */
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title = '확인',
  message = '이 작업을 진행하시겠습니까?',
  confirmText = '확인',
  cancelText = '취소',
  onClose,
}) => {
  const [visible, setVisible] = useState(true);
  const controls = useAnimation();

  const handleClose = (v: boolean) => {
    setVisible(false);
    setTimeout(() => onClose?.(v), 300);
  };



  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <motion.div
            animate={controls}
            initial={{ opacity: 0, scale: 0.85 }}
            whileInView={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-[90%] max-w-sm"
          >
            <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">{title}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">{message}</p>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => handleClose(false)}
                className="px-4 py-2 text-sm rounded-md bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
              >
                {cancelText}
              </button>

              <button
                onClick={() => handleClose(true)}
                className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700"
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default ConfirmDialog;

/**
 * ✅ openConfirm() 함수 (동일 파일 내 통합)
 * 어디서든 Promise<boolean> 형태로 모달을 띄움
 */
export const openConfirm = (props: ConfirmDialogProps): Promise<boolean> => {
  return new Promise((resolve) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const handleClose = (result: boolean) => {
      root.unmount();
      container.remove();
      resolve(result);
    };

    root.render(<ConfirmDialog {...props} onClose={handleClose} />);
  });
};
