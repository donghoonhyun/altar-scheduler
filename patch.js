import fs from 'fs';
let text = fs.readFileSync('src/pages/MemberRoleManagement.tsx', 'utf8');

text = text.replace(
    /import \{ Container, Card, Heading, Button, InfoBox \}[\s\S]*?import \{ COLLECTIONS \} from '@\/lib\/collections';/,
    "import { Container, Card, Heading, Button, InfoBox, Input } from '@/components/ui';\n" +
    "import { ArrowLeft, User, Shield, Calendar, Edit2, Check, X, Info, Trash2, Mail, Plus, Search } from 'lucide-react';\n" +
    "import { format } from 'date-fns';\n" +
    "import { ko } from 'date-fns/locale';\n" +
    "import { toast } from 'sonner';\n" +
    "import { cn } from '@/lib/utils';\n" +
    "import { COLLECTIONS } from '@/lib/collections';\n" +
    "import {\n  Dialog,\n  DialogContent,\n  DialogHeader,\n  DialogTitle,\n} from '@/components/ui/dialog';"
);

text = text.replace(
    /deleteDoc\r?\n\} from 'firebase\/firestore';/,
    "deleteDoc,\n  addDoc,\n  serverTimestamp\n} from 'firebase/firestore';"
);

text = text.replace(
    /const \[hideInactive, setHideInactive\] = useState<boolean>\(false\);\r?\n\s+const \[editActive, setEditActive\] = useState<boolean>\(false\);/,
    "const [hideInactive, setHideInactive] = useState<boolean>(false);\n" +
    "  const [editActive, setEditActive] = useState<boolean>(false);\n\n" +
    "  // Add Member State\n" +
    "  const [isAddModalOpen, setIsAddModalOpen] = useState(false);\n" +
    "  const [searchEmail, setSearchEmail] = useState('');\n" +
    "  const [searchResult, setSearchResult] = useState<any>(null);\n" +
    "  const [isSearching, setIsSearching] = useState(false);\n" +
    "  const [addRoles, setAddRoles] = useState<string[]>(['server']);"
);

const submitCode = `
  const handleSearchUser = async (e) => {
    e.preventDefault();
    if (!searchEmail.trim()) {
      toast.error('이메일을 입력해주세요.');
      return;
    }
    setIsSearching(true);
    setSearchResult(null);
    try {
      const q = query(collection(db, 'users'), where('email', '==', searchEmail.trim()));
      const snap = await getDocs(q);
      if (snap.empty) {
        toast.error('해당 이메일로 가입된 유저를 찾을 수 없습니다.');
      } else {
        setSearchResult({ uid: snap.docs[0].id, ...snap.docs[0].data() });
      }
    } catch (err) {
      console.error(err);
      toast.error('검색 중 오류가 발생했습니다.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddMember = async () => {
    if (!searchResult || !serverGroupId) return;
    if (addRoles.length === 0) {
      toast.error('최소 하나 이상의 역할을 선택해주세요.');
      return;
    }
    const exists = memberships.some(m => m.uid === searchResult.uid);
    if (exists) {
      toast.error('이미 이 복사단에 등록된 유저입니다.');
      return;
    }

    try {
      const sgDoc = await getDoc(doc(db, COLLECTIONS.SERVER_GROUPS, serverGroupId));
      const parishCode = sgDoc.exists() ? sgDoc.data().parish_code : '';

      await addDoc(collection(db, COLLECTIONS.MEMBERSHIPS), {
        uid: searchResult.uid,
        server_group_id: serverGroupId,
        parish_code: parishCode,
        role: addRoles,
        active: true,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
      toast.success('새 멤버가 성공적으로 추가되었습니다.');
      setIsAddModalOpen(false);
      setSearchEmail('');
      setSearchResult(null);
      setAddRoles(['server']);
      fetchMemberships();
    } catch (err) {
      console.error('Add member failed:', err);
      toast.error('가입 처리에 실패했습니다.');
    }
  };

  const availableRoles = ['admin', 'planner', 'server'];`;

text = text.replace(
    /const availableRoles = \['admin', 'planner', 'server'\];/,
    submitCode
);

const headerTitleCode = `
        <div className="flex-1">
          <Heading size="lg" className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">
            멤버십 역할 관리
          </Heading>
          <p className="text-gray-500 text-sm dark:text-gray-400">
            복사단의 멤버별 권한과 정보를 관리합니다.
          </p>
        </div>
        <Button 
            onClick={() => { setIsAddModalOpen(true); setSearchEmail(''); setSearchResult(null); setAddRoles(['server']); }}
            className="gap-1.5 font-bold font-sans dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700"
        >
            <Plus size={16} />
            새 멤버 추가
        </Button>
      </div>`;

text = text.replace(
    /<div>\s*<Heading size="lg"[\s\S]*?<\/div>\s*<\/div>/,
    headerTitleCode
);

const modalCode = `
      <InfoBox title="역할 부여 안내" className="mt-8">
        한 멤버에게 여러 역할을 동시에 부여할 수 있습니다. 
        변경 사항은 저장 즉시 반영되며 다음 로그인부터 해당 권한이 활성화됩니다.
        어드민은 모든 설정을 변경할 수 있으며, 플래너는 일정 관리 권한을 가집니다.
      </InfoBox>

      {/* 새 멤버 추가 모달 */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[425px] p-0 font-sans border-0 shadow-2xl rounded-[32px] overflow-hidden bg-white dark:bg-slate-900 outline-none">
          <div className="relative h-20 bg-gradient-to-br from-[#1E40AF] via-[#2563EB] to-[#3B82F6] rounded-b-[32px] shadow-lg flex items-center shrink-0 w-full overflow-hidden">
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
            <div className="px-6 flex items-center justify-between w-full h-full">
              <div className="space-y-0 text-left pt-2 pb-1">
                <p className="text-sm font-medium text-white/90 tracking-tight font-gamja mb-0.5 mt-2">
                  기존 가입 검색을 통해
                </p>
                <DialogTitle className="text-2xl font-bold text-white tracking-tight font-gamja flex items-center gap-1.5 justify-start p-0 m-0">
                  <User size={20} className="text-white opacity-80" />
                  새 멤버 추가하기
                </DialogTitle>
              </div>
            </div>
          </div>
          <div className="p-6 pt-6 space-y-6">
            <form onSubmit={handleSearchUser} className="space-y-2">
                <label className="text-sm font-bold text-gray-700 dark:text-gray-300">유저 검색 (이메일)</label>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input 
                            type="email"
                            placeholder="user@example.com" 
                            className="bg-gray-50 dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-2 disabled:opacity-50 h-11 pl-9 w-full transition-shadow dark:text-white rounded-xl font-sans"
                            value={searchEmail}
                            onChange={(e) => setSearchEmail(e.target.value)}
                        />
                    </div>
                    <Button type="submit" variant="secondary" disabled={isSearching} className="h-11 px-4 font-bold shrink-0">
                        {isSearching ? '검색중...' : '검색'}
                    </Button>
                </div>
            </form>

            {searchResult && (
                <div className="bg-gray-50 dark:bg-slate-800/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700 animate-in fade-in zoom-in-95 duration-200">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex justify-center items-center text-blue-600 dark:bg-blue-900/30 shrink-0">
                            <User size={20} />
                        </div>
                        <div>
                            <p className="font-bold text-gray-900 dark:text-white text-sm">{searchResult.user_name} {searchResult.baptismal_name && <span className="text-xs text-gray-500 font-normal">({searchResult.baptismal_name})</span>}</p>
                            <p className="text-xs text-gray-500">{searchResult.email}</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-600 dark:text-gray-400">부여할 역할 (다중선택 가능)</label>
                        <div className="flex flex-wrap gap-1.5">
                            {['admin', 'planner', 'server'].map(r => (
                                <button
                                    type="button"
                                    key={r}
                                    onClick={() => setAddRoles(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])}
                                    className={\`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border \${
                                        addRoles.includes(r)
                                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                        : 'bg-white text-gray-600 border-gray-200 dark:bg-slate-700 dark:text-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600'
                                    }\`}
                                >
                                    {r === 'admin' ? '어드민' : r === 'planner' ? '플래너' : '복사(Server)'}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-end gap-2 mt-8 pt-4 border-t border-gray-100 dark:border-slate-800">
                <Button variant="outline" type="button" onClick={() => setIsAddModalOpen(false)}>취소</Button>
                <Button 
                    variant="primary" 
                    type="button"
                    onClick={handleAddMember} 
                    disabled={!searchResult}
                    className="font-bold gap-1.5"
                >
                    <Plus size={16} /> 추가하기
                </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
`;

text = text.replace(
    /<InfoBox title="역할 부여 안내"[\s\S]*?<\/InfoBox>/,
    modalCode
);

fs.writeFileSync('src/pages/MemberRoleManagement.tsx', text, 'utf8');
console.log('Update successful!');
