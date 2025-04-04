import React, { useEffect, useState } from "react";
import styles from "./welcome-modal.module.scss";
import { IconButton } from "./button";
import CloseIcon from "../icons/close.svg";
import NeatIcon from "../icons/neat.svg";
import LightningIcon from "../icons/lightning.svg";
import FireIcon from "../icons/fire.svg";
import clsx from "clsx";
import { useWelcomeStore } from "../store/welcome";

export function WelcomeModal() {
  const welcomeStore = useWelcomeStore();
  const [isVisible, setIsVisible] = useState(false);
  const [runningDays, setRunningDays] = useState(213); // 从2023年1月1日开始计算
  const [userCount, setUserCount] = useState(154); // 初始用户数量
  
  // 计算运行天数，从2023年1月1日开始
  useEffect(() => {
    const startDate = new Date("2023-01-01");
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    setRunningDays(213 + diffDays); // 从231开始每天+1
    
    // 用户数量每天+1
    const startUserCount = 154;
    setUserCount(startUserCount + diffDays);
  }, []);
  
  useEffect(() => {
    // 检查是否应该显示欢迎弹窗
    const shouldShow = welcomeStore.shouldShowWelcome();
    
    if (shouldShow) {
      setIsVisible(true);
      // 更新已显示状态
      welcomeStore.setShownWelcome(true);
      // 更新最后访问日期
      welcomeStore.updateLastVisitDate();
    }
  }, [welcomeStore]);
  
  const handleClose = () => {
    setIsVisible(false);
  };
  
  if (!isVisible) return null;

  return (
    <div className="modal-mask">
      <div className={styles["welcome-container"]}>
        <div className={styles["welcome-header"]}>
          <div className={styles["welcome-logo"]}>
            <NeatIcon width={40} height={40} />
            <div className={styles["welcome-title"]}>欢迎使用 NeatChat</div>
          </div>
          <IconButton
            icon={<CloseIcon />}
            onClick={handleClose}
            className={styles["welcome-close"]}
          />
        </div>
        
        <div className={styles["welcome-content"]}>
          <div className={styles["welcome-highlight"]}>
            此为GPT-4o、Gemini全系列、DeepSeek稳定镜像站
          </div>
          
          <div className={styles["pro-highlight"]}>
            <div className={styles["highlight-icons"]}>
              <LightningIcon className={styles["highlight-icon-left"]} />
              <FireIcon className={styles["highlight-icon-right"]} />
            </div>
            <div className={styles["pro-highlight-content"]}>
              <span className={styles["pro-text"]}>Pro会员</span>
              <div className={styles["gpt4o-container"]}>
                <span className={styles["gpt4o-text"]}>GPT-4o</span>
              </div>
              <span className={styles["unlimited-text"]}>不限量使用！</span>
            </div>
            <div className={styles["highlight-background"]}></div>
          </div>
          
          <div className={styles["welcome-features"]}>
            <div className={styles["feature-item"]}>
              <span className={styles["feature-text"]}>无需魔法，多端通用，可以破限开车</span>
            </div>
            
            <div className={styles["feature-item"]}>
              <span className={styles["feature-text"]}>提供三小时免费试用</span>
            </div>
          </div>
          
          <div className={styles["welcome-stats"]}>
            <div className={styles["stat-item"]}>
              <span className={styles["stat-label"]}>镜像站已稳定运行</span>
              <span className={styles["stat-value"]}>{runningDays}</span>
              <span className={styles["stat-unit"]}>天</span>
            </div>
            <div className={styles["stat-item"]}>
              <span className={styles["stat-label"]}>累计服务</span>
              <span className={styles["stat-value"]}>{userCount}</span>
              <span className={styles["stat-unit"]}>名用户</span>
            </div>
          </div>
        </div>
        
        <div className={styles["welcome-footer"]}>
          <IconButton
            type="primary"
            text="开始体验"
            onClick={handleClose}
            className={styles["welcome-button"]}
          />
        </div>
      </div>
    </div>
  );
} 