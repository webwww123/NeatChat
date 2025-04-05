"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.scss";

interface AccessCode {
  id: number;
  hashed_code: string;
  masked_code: string;
  created_at: string;
  last_used_at: string | null;
  usage_count: number;
  is_active: boolean;
  usage_limit: number | null;
  expiry_date: string | null;
}

export default function AccessCodesPage() {
  const router = useRouter();
  const [codes, setCodes] = useState<AccessCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [token, setToken] = useState("");
  
  // 新访问码表单
  const [newCode, setNewCode] = useState("");
  const [usageLimit, setUsageLimit] = useState<string>("");
  const [expiryDate, setExpiryDate] = useState<string>("");
  
  // 确认删除弹窗
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [codeToDelete, setCodeToDelete] = useState<number | null>(null);

  useEffect(() => {
    // 从localStorage获取令牌
    const savedToken = localStorage.getItem("admin_token");
    if (!savedToken) {
      router.push("/admin/login");
      return;
    }
    
    setToken(savedToken);
    fetchCodes(savedToken);
  }, [router]);

  const fetchCodes = async (authToken: string) => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/codes", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${authToken}`
        }
      });

      if (response.status === 401) {
        localStorage.removeItem("admin_token");
        router.push("/admin/login");
        return;
      }

      const data = await response.json();
      if (data.success) {
        setCodes(data.data);
      } else {
        setError(data.message || "获取访问码失败");
      }
    } catch (err) {
      setError("发生错误，请重试");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode) return;

    try {
      const response = await fetch("/api/admin/codes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          code: newCode,
          usageLimit: usageLimit || undefined,
          expiryDate: expiryDate || undefined
        })
      });

      const data = await response.json();
      if (data.success) {
        fetchCodes(token);
        setNewCode("");
        setUsageLimit("");
        setExpiryDate("");
      } else {
        setError(data.message || "添加访问码失败");
      }
    } catch (err) {
      setError("发生错误，请重试");
      console.error(err);
    }
  };

  const confirmDelete = (id: number) => {
    setCodeToDelete(id);
    setShowDeleteConfirm(true);
  };

  const handleDelete = async () => {
    if (!codeToDelete) return;

    try {
      const response = await fetch(`/api/admin/codes/${codeToDelete}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        fetchCodes(token);
      } else {
        setError(data.message || "删除访问码失败");
      }
    } catch (err) {
      setError("发生错误，请重试");
      console.error(err);
    } finally {
      setShowDeleteConfirm(false);
      setCodeToDelete(null);
    }
  };

  const toggleActive = async (id: number, currentState: boolean) => {
    try {
      const response = await fetch(`/api/admin/codes/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          is_active: !currentState
        })
      });

      const data = await response.json();
      if (data.success) {
        fetchCodes(token);
      } else {
        setError(data.message || "更新访问码状态失败");
      }
    } catch (err) {
      setError("发生错误，请重试");
      console.error(err);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "从未";
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>访问码管理</h1>
      
      {error && <div className={styles.error}>{error}</div>}
      
      <div className={styles.formContainer}>
        <form onSubmit={handleAddCode} className={styles.form}>
          <h2>添加新访问码</h2>
          <div className={styles.formGroup}>
            <label htmlFor="newCode">访问码:</label>
            <input
              type="text"
              id="newCode"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              required
              placeholder="输入新的访问码"
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="usageLimit">使用次数限制:</label>
            <input
              type="number"
              id="usageLimit"
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value)}
              placeholder="留空表示无限制"
              min="1"
            />
          </div>
          
          <div className={styles.formGroup}>
            <label htmlFor="expiryDate">过期日期:</label>
            <input
              type="datetime-local"
              id="expiryDate"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              placeholder="留空表示永不过期"
            />
          </div>
          
          <button type="submit" className={styles.addButton}>
            添加
          </button>
        </form>
      </div>
      
      <div className={styles.tableContainer}>
        <h2>访问码列表</h2>
        {loading ? (
          <div className={styles.loading}>加载中...</div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>访问码</th>
                <th>创建时间</th>
                <th>最后使用</th>
                <th>使用次数</th>
                <th>使用限制</th>
                <th>过期日期</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {codes.length === 0 ? (
                <tr>
                  <td colSpan={9} className={styles.noData}>
                    暂无数据
                  </td>
                </tr>
              ) : (
                codes.map((code) => (
                  <tr key={code.id}>
                    <td>{code.id}</td>
                    <td>{code.masked_code}</td>
                    <td>{formatDate(code.created_at)}</td>
                    <td>{formatDate(code.last_used_at)}</td>
                    <td>{code.usage_count}</td>
                    <td>{code.usage_limit === null ? "无限制" : code.usage_limit}</td>
                    <td>{code.expiry_date ? formatDate(code.expiry_date) : "永不过期"}</td>
                    <td>
                      <span 
                        className={code.is_active ? styles.active : styles.inactive}
                        onClick={() => toggleActive(code.id, code.is_active)}
                      >
                        {code.is_active ? "启用中" : "已禁用"}
                      </span>
                    </td>
                    <td>
                      <button
                        className={styles.deleteButton}
                        onClick={() => confirmDelete(code.id)}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
      
      {showDeleteConfirm && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h3>确认删除</h3>
            <p>确定要删除这个访问码吗？此操作不可撤销。</p>
            <div className={styles.modalButtons}>
              <button onClick={() => setShowDeleteConfirm(false)}>取消</button>
              <button onClick={handleDelete} className={styles.deleteButton}>
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 