import React, { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { addDoc, collection, Timestamp, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { toast } from 'sonner';
import { Search, User as UserIcon, X, Check, List } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { orderBy } from 'firebase/firestore';

const ALL_GRADES = [
  'E1', 'E2', 'E3', 'E4', 'E5', 'E6',
  'M1', 'M2', 'M3',
  'H1', 'H2', 'H3'
];

interface AddServerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serverGroupId: string;
}

interface ParentUser {
    uid: string;
    user_name: string;
    baptismal_name?: string;
    email: string;
    phone?: string;
}

export default function AddServerDrawer({ open, onOpenChange, serverGroupId }: AddServerDrawerProps) {
  const [name, setName] = useState('');
  const [baptismalName, setBaptismalName] = useState('');
  const [grade, setGrade] = useState('');
  
  // Parent Mode State
  const [parentMode, setParentMode] = useState<'search' | 'manual'>('search');
  
  // Search Mode State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ParentUser[]>([]);
  const [selectedParent, setSelectedParent] = useState<ParentUser | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Manual Mode & Common State
  const [guardianName, setGuardianName] = useState('');
  const [phoneGuardian, setPhoneGuardian] = useState('');
  const [phoneStudent, setPhoneStudent] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    if (searchQuery.length < 2) {
      toast.error('검색어는 2글자 이상 입력해주세요.');
      return;
    }

    setIsSearching(true);
    setSearchResults([]);
    try {
        // 이름(user_name)으로 검색 (Prefix)
        const qName = query(
            collection(db, 'users'), 
            where('user_name', '>=', searchQuery), 
            where('user_name', '<=', searchQuery + '\uf8ff'),
            limit(20)
        );
        
        // 세례명(baptismal_name)으로 검색 (Prefix)
        const qBaptismal = query(
            collection(db, 'users'), 
            where('baptismal_name', '>=', searchQuery), 
            where('baptismal_name', '<=', searchQuery + '\uf8ff'),
            limit(20)
        );

        // 두 쿼리 병렬 실행
        const [snapName, snapBaptismal] = await Promise.all([
          getDocs(qName), 
          getDocs(qBaptismal)
        ]);

        // 결과 병합 및 중복 제거
        const merged = new Map<string, ParentUser>();

        snapName.docs.forEach(doc => {
           merged.set(doc.id, { uid: doc.id, ...doc.data() } as ParentUser);
        });

        snapBaptismal.docs.forEach(doc => {
           merged.set(doc.id, { uid: doc.id, ...doc.data() } as ParentUser);
        });

        const results = Array.from(merged.values());
        setSearchResults(results);

        if (results.length === 0) {
            toast.info('검색 결과가 없습니다.');
        }
    } catch (e) {
        console.error(e);
        toast.error('검색 중 오류가 발생했습니다.');
    } finally {
        setIsSearching(false);
    }
  };

  const handleViewAll = async () => {
    setIsSearching(true);
    setSearchResults([]);
    try {
        const q = query(
            collection(db, 'users'), 
            orderBy('user_name'),
            limit(100)
        );
        const snapshot = await getDocs(q);
        const results: ParentUser[] = snapshot.docs.map(doc => ({
            uid: doc.id,
            ...doc.data()
        } as ParentUser));
        setSearchResults(results);
        toast.success(`전체 사용자 목록을 불러왔습니다. (상위 ${results.length}명)`);
    } catch (e) {
        console.error(e);
        toast.error('전체 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
        setIsSearching(false);
    }
  };

  const handleSelectParent = (user: ParentUser) => {
    setSelectedParent(user);
    if (user.phone) {
        setPhoneGuardian(user.phone);
    }
    setSearchResults([]);
    setSearchQuery('');
  };

  const clearSelection = () => {
      setSelectedParent(null);
      setPhoneGuardian('');
  };

  const handleAdd = async () => {
    if (!name.trim() || !baptismalName.trim() || !grade) {
      toast.error('필수 정보를 모두 입력해주세요.');
      return;
    }

    if (parentMode === 'search' && !selectedParent) {
        toast.error('부모님을 선택해주세요.');
        return;
    }

    if (parentMode === 'manual' && !guardianName.trim()) {
        toast.error('부모님 성함을 입력해주세요.');
        return;
    }

    if (!serverGroupId) {
      toast.error('잘못된 접근입니다.');
      return;
    }

    try {
      setIsSubmitting(true);
      const colRef = collection(db, 'server_groups', serverGroupId, 'members');
      
      const payload: any = {
        name_kor: name,
        baptismal_name: baptismalName,
        grade: grade,
        phone_student: phoneStudent,
        active: true,
        request_confirmed: true,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      };

      if (parentMode === 'search' && selectedParent) {
          payload.parent_uid = selectedParent.uid;
          payload.phone_guardian = phoneGuardian || selectedParent.phone; // Allow override
      } else {
          payload.guardian_name = guardianName;
          payload.phone_guardian = phoneGuardian;
      }

      await addDoc(colRef, payload);

      toast.success('복사단원이 추가되었습니다.');
      
      // Reset form
      setName('');
      setBaptismalName('');
      setGrade('');
      setPhoneGuardian('');
      setPhoneStudent('');
      setGuardianName('');
      setSelectedParent(null);
      setSearchQuery('');
      setSearchResults([]);
      setParentMode('search');
      
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error('추가 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm h-[80vh] flex flex-col">
          <DrawerHeader>
            <DrawerTitle>복사단원 추가</DrawerTitle>
          </DrawerHeader>
          
          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            {/* Student Info */}
            <h3 className="text-sm font-semibold text-gray-500 mb-2">학생 정보</h3>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                <Label htmlFor="name" className="text-xs">이름 <span className="text-red-500">*</span></Label>
                <Input 
                    id="name" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    placeholder="홍길동"
                    className="h-9"
                />
                </div>
                
                <div className="space-y-1">
                <Label htmlFor="baptismal" className="text-xs">세례명 <span className="text-red-500">*</span></Label>
                <Input 
                    id="baptismal" 
                    value={baptismalName} 
                    onChange={(e) => setBaptismalName(e.target.value)} 
                    placeholder="미카엘"
                    className="h-9"
                />
                </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">학년 <span className="text-red-500">*</span></Label>
              <Select value={grade} onValueChange={setGrade}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="학년 선택" />
                </SelectTrigger>
                <SelectContent className="bg-white max-h-[300px]">
                  {ALL_GRADES.map((g, i) => {
                      const prev = ALL_GRADES[i-1];
                      // 구분선 조건: 이전 항목이 있고, 앞글자(E/M/H)가 달라질 때
                      const isNewGroup = prev && g[0] !== prev[0];
                      return (
                        <React.Fragment key={g}>
                            {isNewGroup && <SelectSeparator className="my-1" />}
                            <SelectItem value={g}>{g}</SelectItem>
                        </React.Fragment>
                      );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="phone_student" className="text-xs">학생 연락처</Label>
              <Input 
                id="phone_student" 
                value={phoneStudent} 
                onChange={(e) => setPhoneStudent(e.target.value)} 
                placeholder="010-0000-0000"
                className="h-9"
              />
            </div>

            <hr className="border-gray-100 my-4" />

            {/* Parent Info */}
            <h3 className="text-sm font-semibold text-gray-500 mb-2">부모님 정보</h3>
            
            <Tabs value={parentMode} onValueChange={(v: string) => setParentMode(v as 'search' | 'manual')} className="w-full">
                <TabsList className="grid w-full grid-cols-2 h-9 mb-3">
                    <TabsTrigger value="search" className="text-xs">앱 사용자 검색</TabsTrigger>
                    <TabsTrigger value="manual" className="text-xs">직접 입력</TabsTrigger>
                </TabsList>

                <TabsContent value="search" className="space-y-3 mt-0">
                    {!selectedParent ? (
                        <div className="space-y-2">
                             <div className="flex gap-2">
                                <Input 
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="부모님 이름 검색 (2자 이상)"
                                    className="h-9 text-sm"
                                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                />
                                <Button size="sm" onClick={handleSearch} disabled={isSearching} className="w-[40px] h-9 px-0">
                                    {isSearching ? <span className="animate-spin text-xs">⌛</span> : <Search size={16} />}
                                </Button>
                                <Button size="sm" variant="outline" onClick={handleViewAll} disabled={isSearching} className="w-[40px] h-9 px-0" title="전체 명단 보기">
                                    <List size={16} />
                                </Button>
                             </div>

                             {/* Search Results */}
                             {searchResults.length > 0 && (
                                 <div className="border rounded-md divide-y max-h-[150px] overflow-y-auto">
                                     {searchResults.map(user => (
                                         <div 
                                            key={user.uid} 
                                            className="p-2 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
                                            onClick={() => handleSelectParent(user)}
                                         >
                                            <div className="flex flex-col">
                                                <span className="text-sm font-medium">{user.user_name}</span>
                                                <span className="text-xs text-gray-500">
                                                    {user.baptismal_name && `${user.baptismal_name} · `}
                                                    {user.email}
                                                </span>
                                            </div>
                                            <Check size={14} className="text-gray-300" />
                                         </div>
                                     ))}
                                 </div>
                             )}
                        </div>
                    ) : (
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                    <UserIcon size={16} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-gray-700">
                                        {selectedParent.user_name}
                                        {selectedParent.baptismal_name && <span className="font-normal text-xs text-gray-500 ml-1">({selectedParent.baptismal_name})</span>}
                                    </span>
                                    <span className="text-xs text-gray-500">{selectedParent.email}</span>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full" onClick={clearSelection}>
                                <X size={14} />
                            </Button>
                        </div>
                    )}
                 
                    <div className="space-y-1">
                        <Label htmlFor="phone_guardian_search" className="text-xs">비상연락처 (자동입력)</Label>
                        <Input 
                            id="phone_guardian_search" 
                            value={phoneGuardian} 
                            onChange={(e) => setPhoneGuardian(e.target.value)} 
                            placeholder="선택 시 자동 입력됨"
                            className="h-9 bg-gray-50"
                        />
                    </div>
                </TabsContent>

                <TabsContent value="manual" className="space-y-3 mt-0">
                    <div className="p-3 bg-gray-50 rounded-md mb-3 text-xs text-gray-500">
                        * 앱을 사용하지 않는 부모님의 경우 직접 정보를 입력해주세요.
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="guardian_name" className="text-xs">부모님 성함 <span className="text-red-500">*</span></Label>
                        <Input 
                            id="guardian_name" 
                            value={guardianName} 
                            onChange={(e) => setGuardianName(e.target.value)} 
                            placeholder="부모님 성함"
                            className="h-9"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label htmlFor="phone_guardian_manual" className="text-xs">비상연락처 <span className="text-red-500">*</span></Label>
                        <Input 
                            id="phone_guardian_manual" 
                            value={phoneGuardian} 
                            onChange={(e) => setPhoneGuardian(e.target.value)} 
                            placeholder="010-0000-0000"
                            className="h-9"
                        />
                    </div>
                </TabsContent>
            </Tabs>

          </div>

          <DrawerFooter className="flex-row gap-2 pt-2 border-t mt-auto">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button className="flex-1" onClick={handleAdd} disabled={isSubmitting}>
              {isSubmitting ? '추가 중...' : '추가'}
            </Button>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
