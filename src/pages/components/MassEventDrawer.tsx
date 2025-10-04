// src/pages/components/MassEventDrawer.tsx
import React, { useState } from 'react';

interface MassEventDrawerProps {
  date: Date | null;
  onClose: () => void;
}

const MassEventDrawer: React.FC<MassEventDrawerProps> = ({ date, onClose }) => {
  const [title, setTitle] = useState('');
  const [requiredServers, setRequiredServers] = useState<number | null>(null);

  const handleSave = () => {
    // TODO: Firestore 저장 로직 연결 예정
    console.log('Saving MassEvent:', { title, date, requiredServers });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-end z-50">
      {/* Drawer 영역 */}
      <div className="bg-white w-80 h-full shadow-lg p-4 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">미사 일정 등록</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-black">
            ✕
          </button>
        </div>

        {/* 날짜 표시 */}
        <p className="text-sm text-gray-600 mb-4">
          선택한 날짜: {date ? date.toLocaleDateString() : '미선택'}
        </p>

        {/* 제목 입력 */}
        <label className="block mb-2">
          <span className="text-sm font-medium">미사 제목</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full border rounded px-2 py-1"
            placeholder="예: 주일 미사"
          />
        </label>

        {/* 필요 복사 인원 */}
        <label className="block mb-2">
          <span className="text-sm font-medium">필요 인원</span>
          <div className="flex gap-2 mt-1">
            {Array.from({ length: 6 }, (_, i) => i + 1).map((n) => (
              <label key={n} className="flex items-center gap-1">
                <input
                  type="radio"
                  name="requiredServers"
                  value={n}
                  checked={requiredServers === n}
                  onChange={() => setRequiredServers(n)}
                />
                {n}명
              </label>
            ))}
          </div>
        </label>

        <div className="mt-auto flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 rounded border border-gray-300">
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

export default MassEventDrawer;
