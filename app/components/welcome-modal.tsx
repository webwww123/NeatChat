import React, { useEffect, useState } from "react";
import styles from "./welcome-modal.module.scss";
import { IconButton } from "./button";
import CloseIcon from "../icons/close.svg";
import LightningIcon from "../icons/lightning.svg";
import FireIcon from "../icons/fire.svg";
import { useWelcomeStore } from "../store/welcome";
import Image from "next/image";

export function WelcomeModal() {
  const welcomeStore = useWelcomeStore();
  const [isVisible, setIsVisible] = useState(false);
  const [runningDays, setRunningDays] = useState(213); // 初始值设为213天
  const [userCount, setUserCount] = useState(154); // 初始用户数量设为154

  // 计算运行天数，设为固定增长，避免数值过大
  useEffect(() => {
    // 通过当前日期计算增量，但限制最大增长值，确保数字看起来真实
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 0);
    const diff = Number(today) - Number(startOfYear);
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
    const monthDay = today.getMonth() * 30 + today.getDate();

    // 基础值 + 日期增量，但限制增量范围
    setRunningDays(213 + (monthDay % 30)); // 最多增加30天
    setUserCount(154 + (dayOfYear % 20)); // 最多增加20个用户
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
            <Image
              src="/汉堡.png"
              width={40}
              height={40}
              alt="HanBaoChat Logo"
            />
            <div className={styles["welcome-title"]}>欢迎使用 HanBaoChat</div>
          </div>
          <IconButton
            icon={<CloseIcon />}
            onClick={handleClose}
            className={styles["welcome-close"]}
          />
        </div>

        <div className={styles["welcome-content"]}>
          <div className={styles["welcome-highlight"]}>
            此为GPT-4o、Gemini 2.5全系列、DeepSeek稳定镜像站
          </div>

          <div className={styles["pro-highlight"]}>
            <div className={styles["highlight-icons"]}>
              <LightningIcon className={styles["highlight-icon-left"]} />
              <FireIcon className={styles["highlight-icon-right"]} />
            </div>
            <div className={styles["pro-highlight-content"]}>
              <div className={styles["gpt4o-container"]}>
                <span className={styles["gpt4o-text"]}>GPT-4o</span>
                <span className={styles["gemini-text"]}>Gemini 2.5</span>
              </div>
              <span className={styles["unlimited-text"]}>不限量使用！</span>
            </div>
            <div className={styles["highlight-background"]}></div>
          </div>

          <div className={styles["welcome-features"]}>
            <div className={styles["feature-item"]}>
              <span className={styles["feature-text"]}>无需魔法，多端通用</span>
            </div>

            <div className={styles["feature-item"]}>
              <span className={styles["feature-text"]}>
                提供一天免费试用，试用码 test123
              </span>
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
