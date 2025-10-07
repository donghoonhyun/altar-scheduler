import React from "react";
import { useNavigate } from "react-router-dom";
import { Home } from "lucide-react";
import { Button, Card, Heading, Container } from "@/components/ui";

const Forbidden: React.FC = () => {
  const navigate = useNavigate();
  return (
    <Container className="flex justify-center items-center min-h-screen bg-gradient-to-b from-blue-50 to-blue-100">
      <Card className="text-center max-w-md w-full">
        <div className="text-6xl mb-4">🚫</div>
        <Heading size="md" className="mb-2">
          접근이 제한되었습니다
        </Heading>
        <p className="text-gray-600 mb-8">이 페이지에 접근할 수 있는 권한이 없습니다.</p>
        <Button onClick={() => navigate("/")} className="mx-auto flex items-center gap-2">
          <Home size={20} />
          홈으로 돌아가기
        </Button>
      </Card>
    </Container>
  );
};

export default Forbidden;
