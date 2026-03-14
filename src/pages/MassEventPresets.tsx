import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFirestore, doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { Container, Card, Button } from '@/components/ui';
import { Save, Plus, Trash2, CalendarDays, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { COLLECTIONS } from '@/lib/collections';
import PremiumHeader from '@/components/common/PremiumHeader';

interface PresetItem {
  title: string;
  required_servers: number;
}

interface WeekdayMap {
  [key: string]: PresetItem[];
}

const WEEKDAYS = [
  { key: '0', label: '일요일' },
  { key: '1', label: '월요일' },
  { key: '2', label: '화요일' },
  { key: '3', label: '수요일' },
  { key: '4', label: '목요일' },
  { key: '5', label: '금요일' },
  { key: '6', label: '토요일' },
];

const MassEventPresets: React.FC = () => {
  const { serverGroupId } = useParams<{ serverGroupId: string }>();
  const navigate = useNavigate();
  const db = getFirestore();

  const [presets, setPresets] = useState<WeekdayMap>({
    '0': [], '1': [], '2': [], '3': [], '4': [], '5': [], '6': []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const clampRequiredServers = (value: number) => {
    if (Number.isNaN(value)) return 1;
    return Math.min(12, Math.max(1, value));
  };

  const getDayCardTone = (dayKey: string) => {
    if (dayKey === '0') return 'bg-red-50/70 border-red-100 dark:bg-red-900/15 dark:border-red-900/30';
    if (dayKey === '6') return 'bg-blue-50/70 border-blue-100 dark:bg-blue-900/15 dark:border-blue-900/30';
    return '';
  };

  useEffect(() => {
    if (!serverGroupId) return;

    const docRef = doc(db, COLLECTIONS.SERVER_GROUPS, serverGroupId, 'mass_presets', 'default');
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const loadedWeekdays = data.weekdays || {};
        // Ensure all keys exist
        const merged: WeekdayMap = {
          '0': [], '1': [], '2': [], '3': [], '4': [], '5': [], '6': [],
          ...loadedWeekdays
        };
        setPresets(merged);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching presets:", error);
      toast.error("프리셋을 불러오는 중 오류가 발생했습니다.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [serverGroupId, db]);

  const handleAddItem = (dayKey: string) => {
    setPresets(prev => ({
      ...prev,
      [dayKey]: [...prev[dayKey], { title: '', required_servers: 2 }]
    }));
  };

  const handleRemoveItem = (dayKey: string, index: number) => {
    setPresets(prev => ({
      ...prev,
      [dayKey]: prev[dayKey].filter((_, i) => i !== index)
    }));
  };

  const handleChangeItem = (dayKey: string, index: number, field: keyof PresetItem, value: string | number) => {
    setPresets(prev => {
      const newList = [...prev[dayKey]];
      if (field === 'required_servers') {
        newList[index] = { ...newList[index], required_servers: clampRequiredServers(Number(value)) };
      } else {
        newList[index] = { ...newList[index], title: String(value) };
      }
      return { ...prev, [dayKey]: newList };
    });
  };

  const handleAdjustRequired = (dayKey: string, index: number, delta: number) => {
    const current = presets[dayKey]?.[index]?.required_servers ?? 1;
    handleChangeItem(dayKey, index, 'required_servers', clampRequiredServers(current + delta));
  };

  const handleSave = async () => {
    if (!serverGroupId) return;
    setSaving(true);
    try {
      const docRef = doc(db, COLLECTIONS.SERVER_GROUPS, serverGroupId, 'mass_presets', 'default');
      await setDoc(docRef, {
        weekdays: presets,
        updated_at: serverTimestamp()
      });
      toast.success("미사 프리셋이 저장되었습니다.");
    } catch (error) {
      console.error("Error saving presets:", error);
      toast.error("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (!serverGroupId) return <div>잘못된 접근입니다.</div>;
  if (loading) return <div>로딩 중...</div>;

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-slate-950 transition-colors duration-200">
      <div className="mb-4">
        <PremiumHeader
          title="미사 일정 프리셋"
          subtitle="요일별 반복 미사와 필요 인원을 설정합니다."
          icon={<CalendarDays size={18} />}
          onBack={() => navigate(-1)}
        />
      </div>

      <Container className="py-2 pb-6">
        <div className="flex justify-end mb-4">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" />
            {saving ? '저장 중...' : '저장하기'}
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-7 gap-2.5">
          {WEEKDAYS.map((day) => (
            <Card key={day.key} className={`p-2.5 flex flex-col ${getDayCardTone(day.key)}`}>
              <div className="flex justify-between items-center mb-2 pb-1.5 border-b">
                <h3 className="font-bold text-sm">{day.label}</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAddItem(day.key)}
                  className="h-6 w-6 p-0"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>

              <div className="space-y-2">
                {presets[day.key].length === 0 ? (
                  <div className="text-gray-400 text-xs text-center py-3">
                    등록된 미사가 없습니다.
                  </div>
                ) : (
                  presets[day.key].map((item, idx) => (
                    <div key={idx} className="bg-gray-50 dark:bg-gray-800 p-2 rounded-md border text-sm group relative">
                      <div className="flex items-center gap-1.5 pr-6">
                        <input
                          type="text"
                          className="min-w-0 flex-1 h-7 px-2 border rounded bg-white dark:bg-gray-700 text-xs"
                          value={item.title}
                          placeholder="미사명"
                          onChange={(e) => handleChangeItem(day.key, idx, 'title', e.target.value)}
                        />
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleAdjustRequired(day.key, idx, -1)}
                            aria-label="필요 인원 감소"
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="h-7 w-10 px-1 border rounded bg-white dark:bg-gray-700 text-xs text-center font-semibold"
                            value={item.required_servers}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/[^0-9]/g, '');
                              if (!raw) {
                                handleChangeItem(day.key, idx, 'required_servers', 1);
                                return;
                              }
                              handleChangeItem(day.key, idx, 'required_servers', parseInt(raw, 10));
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleAdjustRequired(day.key, idx, 1)}
                            aria-label="필요 인원 증가"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveItem(day.key, idx)}
                        className="absolute top-1.5 right-1.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </Card>
          ))}
        </div>
      </Container>
    </div>
  );
};

export default MassEventPresets;
