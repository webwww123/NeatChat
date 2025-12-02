import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Path } from "../constant";
import { IconButton } from "./button";
import KeyIcon from "@/app/icons/key.svg";
import CloseIcon from "@/app/icons/close.svg";
import { useAccessStore } from "../store";

import styles from "./purchase-entry.module.scss";

export function PurchaseEntry() {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(true);
  const accessStore = useAccessStore();

  const handleClose = () => {
    setIsVisible(false);
    // 存储状态到localStorage，24小时内不再显示
    localStorage.setItem("purchase-entry-hidden", Date.now().toString());
  };

  const handleClick = () => {
    navigate(Path.Purchase);
  };

  // 检查是否需要显示购买入口
  useEffect(() => {
    const hiddenTimestamp = localStorage.getItem("purchase-entry-hidden");
    if (hiddenTimestamp) {
      const now = Date.now();
      const hiddenTime = parseInt(hiddenTimestamp);
      // 如果距离上次隐藏不到24小时，则不显示
      if (now - hiddenTime < 24 * 60 * 60 * 1000) {
        setIsVisible(false);
      } else {
        // 超过24小时，重置状态
        localStorage.removeItem("purchase-entry-hidden");
        setIsVisible(true);
      }
    }
  }, []);

  if (!isVisible) return null;

  return (
    <div className={styles["purchase-entry"]}>
      <div className={styles["purchase-entry-content"]}>
        <div className={styles["purchase-entry-text"]}>
          <p>购买Pro会员，享受Claude 4.5和Gemini 3不限量使用！</p>
          <p className={styles["purchase-entry-note"]}>
            已经购买的用户可以忽略此提示，试用码 test123 可免费体验一天
          </p>
        </div>
        <div className={styles["purchase-entry-actions"]}>
          <IconButton
            icon={<KeyIcon />}
            text="立即购买"
            onClick={handleClick}
            type="primary"
          />
          <IconButton
            icon={<CloseIcon />}
            onClick={handleClose}
            bordered
            className={styles["close-button"]}
          />
        </div>
      </div>
    </div>
  );
}
