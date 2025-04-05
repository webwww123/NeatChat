"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.scss";

export default function AdminLoginPage() {
  const router = useRouter();
  const [accessCode, setAccessCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  useEffect(() => {
    // 检查是否已经登录
    const token = localStorage.getItem("admin_token");
    if (token) {
      router.push("/admin/codes");
    }
  }, [router]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!accessCode) {
      setError("请输入访问码");
      return;
    }
    
    try {
      setLoading(true);
      setError("");
      
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ accessCode })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // 保存令牌到localStorage
        localStorage.setItem("admin_token", data.token);
        router.push("/admin/codes");
      } else {
        setError(data.message || "登录失败");
      }
    } catch (err) {
      setError("登录过程中发生错误");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className={styles.container}>
      <div className={styles.loginCard}>
        <h1 className={styles.title}>管理员登录</h1>
        
        {error && <div className={styles.error}>{error}</div>}
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="accessCode">管理员访问码</label>
            <input
              type="password"
              id="accessCode"
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              placeholder="请输入管理员访问码"
              disabled={loading}
            />
          </div>
          
          <button 
            type="submit" 
            className={styles.loginButton}
            disabled={loading}
          >
            {loading ? "登录中..." : "登录"}
          </button>
        </form>
      </div>
    </div>
  );
} 