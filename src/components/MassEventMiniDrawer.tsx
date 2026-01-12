import { Fragment, useEffect, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import dayjs from 'dayjs';
import { Card } from '@/components/ui';
import { db } from '@/lib/firebase';
import { getDoc, doc } from 'firebase/firestore';
import type { MassEventDoc } from '@/types/firestore';

interface MassEventMiniDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  events: MassEventDoc[];
  date: dayjs.Dayjs | null;
  serverGroupId?: string;
  monthStatus?: string; // ✅ 추가
}

export default function MassEventMiniDrawer({
  isOpen,
  onClose,
  events,
  date,
  serverGroupId,
  monthStatus = 'MASS-NOTCONFIRMED',
}: MassEventMiniDrawerProps) {
  const [namesMap, setNamesMap] = useState<Record<string, { id: string; name: string; isMain: boolean }[]>>({});

  useEffect(() => {
    // ✅ monthStatus와 상관없이 항상 배정 정보를 조회하도록 수정
    if (!isOpen || events.length === 0 || !serverGroupId) return;

    const fetchNames = async () => {
      const newMap: Record<string, { id: string; name: string; isMain: boolean }[]> = {};

      for (const ev of events) {
        const ids = ev.member_ids ?? [];
        const infoList: { id: string; name: string; isMain: boolean }[] = [];

        for (const uid of ids) {
          try {
            const ref = doc(db, 'server_groups', serverGroupId, 'members', uid);
            const snap = await getDoc(ref);

            if (snap.exists()) {
              const d = snap.data();
              const displayName =
                d.name_kor && d.baptismal_name
                  ? `${d.name_kor} ${d.baptismal_name}`
                  : d.name_kor || '이름없음';
              
              infoList.push({
                id: uid,
                name: displayName,
                isMain: ev.main_member_id === uid
              });
            }
          } catch (e) {
            console.error('❌ 이름 조회 오류:', e);
          }
        }
        // 주복사를 맨 앞으로 정렬 (선택사항)
        infoList.sort((a, b) => (Number(b.isMain) - Number(a.isMain)));
        newMap[ev.id] = infoList;
      }

      setNamesMap(newMap);
    };

    fetchNames();
  }, [isOpen, events, serverGroupId]);

  if (!date) return null;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/40" />
        </Transition.Child>

        <div className="fixed inset-x-0 bottom-0 flex justify-center">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="translate-y-full"
            enterTo="translate-y-0"
            leave="ease-in duration-200"
            leaveFrom="translate-y-0"
            leaveTo="translate-y-full"
          >
            <Dialog.Panel className="w-full max-w-md rounded-t-2xl bg-white dark:bg-slate-900 p-5 shadow-xl">
              <div className="flex justify-between items-center mb-3">
                <Dialog.Title className="text-lg font-bold text-gray-800 dark:text-gray-100">
                  {date.format('YYYY년 M월 D일 (ddd)')}
                </Dialog.Title>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 text-xl leading-none"
                >
                  ✕
                </button>
              </div>

              {events.length === 0 ? (
                <p className="text-center text-gray-500 py-6">
                  해당 날짜에는 미사 일정이 없습니다.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {events.map((ev) => {
                    const members = namesMap[ev.id] ?? [];
                    const hasMembers = members.length > 0;

                    return (
                      <Card key={ev.id} className="p-3 border border-gray-200 dark:border-slate-800 dark:bg-slate-800">
                        <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-2">{ev.title}</h3>
                        <div className="flex flex-wrap gap-1">
                          {hasMembers ? (
                            members.map((m) => (
                              <span
                                key={m.id}
                                className={`px-2 py-0.5 rounded-md text-sm ${
                                  m.isMain
                                    ? 'bg-blue-100 text-blue-700 font-bold border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800'
                                    : 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300'
                                }`}
                              >
                                {m.name}
                                {m.isMain && <span className="text-xs ml-1">(주복사)</span>}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500 text-sm">배정 대기 중</span>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  );
}
