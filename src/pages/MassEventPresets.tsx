import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFirestore, doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { Container, Heading, Card, Button } from '@/components/ui';
import { ArrowLeft, Save, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

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

  useEffect(() => {
    if (!serverGroupId) return;

    const docRef = doc(db, 'server_groups', serverGroupId, 'mass_presets', 'default');
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
      newList[index] = { ...newList[index], [field]: value };
      return { ...prev, [dayKey]: newList };
    });
  };

  const handleSave = async () => {
    if (!serverGroupId) return;
    setSaving(true);
    try {
      const docRef = doc(db, 'server_groups', serverGroupId, 'mass_presets', 'default');
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
    <Container className="py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="p-0 w-8 h-8">
            <ArrowLeft size={24} />
          </Button>
          <Heading size="md">미사 일정 프리셋 설정</Heading>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? '저장 중...' : '저장하기'}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {WEEKDAYS.map((day) => (
          <Card key={day.key} className="p-4 flex flex-col h-full">
            <div className="flex justify-between items-center mb-4 pb-2 border-b">
              <h3 className="font-bold text-lg">{day.label}</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => handleAddItem(day.key)}
                className="h-8 w-8 p-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex-1 space-y-3">
              {presets[day.key].length === 0 ? (
                <div className="text-gray-400 text-sm text-center py-4">
                  등록된 미사가 없습니다.
                </div>
              ) : (
                presets[day.key].map((item, idx) => (
                  <div key={idx} className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md border text-sm group relative">
                    <div className="space-y-2">
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">미사 명</label>
                        <input
                          type="text"
                          className="w-full p-1.5 border rounded bg-white dark:bg-gray-700 text-sm"
                          value={item.title}
                          placeholder="예: 교중미사"
                          onChange={(e) => handleChangeItem(day.key, idx, 'title', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">필요 인원</label>
                        <input
                          type="number"
                          min={1}
                          className="w-full p-1.5 border rounded bg-white dark:bg-gray-700 text-sm"
                          value={item.required_servers}
                          onChange={(e) => handleChangeItem(day.key, idx, 'required_servers', parseInt(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveItem(day.key, idx)}
                      className="absolute top-2 right-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
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
  );
};

export default MassEventPresets;
