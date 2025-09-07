// src/pages/components/Forbidden.tsx
import { Link } from "react-router-dom";

export default function Forbidden() {
  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "1rem" }}>🚫 접근 불가</h1>
      <p style={{ marginBottom: "1rem" }}>
        이 페이지에 접근할 권한이 없습니다.
      </p>
      <Link to="/login" style={{ color: "blue", textDecoration: "underline" }}>
        로그인 페이지로 돌아가기
      </Link>
    </div>
  );
}
