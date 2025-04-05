"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import styles from "./layout.module.scss";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  
  useEffect(() => {
    // 检查是否已登录
    const token = localStorage.getItem("admin_token");
    
    // 如果是登录页面，不需要验证
    if (pathname === "/admin/login") {
      return;
    }
    
    if (!token) {
      router.push("/admin/login");
    } else {
      setIsLoggedIn(true);
    }
  }, [pathname, router]);
  
  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    router.push("/admin/login");
  };
  
  // 如果在登录页面或未登录状态，只渲染子内容（不显示导航栏）
  if (pathname === "/admin/login" || !isLoggedIn) {
    return <>{children}</>;
  }
  
  return (
    <div className={styles.adminLayout}>
      <nav className={styles.sidebar}>
        <div className={styles.logo}>
          <h2>NeatChat 管理</h2>
        </div>
        
        <ul className={styles.menu}>
          <li className={pathname?.includes("/admin/codes") ? styles.active : ""}>
            <Link href="/admin/codes">
              访问码管理
            </Link>
          </li>
          {/* 未来可以在这里添加更多的管理菜单项 */}
        </ul>
        
        <div className={styles.logout}>
          <button onClick={handleLogout}>退出登录</button>
        </div>
      </nav>
      
      <main className={styles.content}>{children}</main>
    </div>
  );
} 