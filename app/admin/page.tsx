"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const router = useRouter();
  
  useEffect(() => {
    // 重定向到访问码管理页面
    router.push("/admin/codes");
  }, [router]);
  
  return (
    <div style={{ textAlign: 'center', padding: '50px' }}>
      <p>正在跳转到管理页面...</p>
    </div>
  );
} 