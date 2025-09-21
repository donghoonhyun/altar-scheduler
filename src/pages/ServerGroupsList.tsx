// src/pages/ServerGroupsList.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../lib/firestore";
import { collection, query, where, getDocs } from "firebase/firestore";
import type { ServerGroupDoc } from "../types/firestore";

export default function ServerGroupsList() {
  const { parishCode } = useParams<{ parishCode: string }>();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<ServerGroupDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!parishCode) return;

    const fetchGroups = async () => {
      const q = query(
        collection(db, "server_groups"),
        where("parish_code", "==", parishCode)
      );
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as ServerGroupDoc[];
      setGroups(list);
      setLoading(false);
    };

    fetchGroups();
  }, [parishCode]);

  if (loading) return <div className="p-4">로딩 중...</div>;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">복사단 리스트</h1>
      {groups.length === 0 && (
        <p className="mt-2 text-gray-500">아직 생성된 복사단이 없습니다.</p>
      )}
      <ul className="mt-4 space-y-2">
        {groups.map((g) => (
          <li
            key={g.id}
            className="p-3 border rounded cursor-pointer hover:bg-gray-50"
            onClick={() => navigate(`/server-groups/${g.id}/dashboard`)}
          >
            {g.name} ({g.id})
          </li>
        ))}
      </ul>

      <button
        onClick={() =>
          navigate(`/parish/${parishCode}/server-groups/new`)
        }
        className="mt-6 px-4 py-2 bg-blue-500 text-white rounded"
      >
        복사단 생성
      </button>
    </div>
  );
}
