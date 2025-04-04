import React, { useState } from "react";
import styles from "./purchase.module.scss";
import { IconButton } from "./button";
import { useNavigate } from "react-router-dom";
import { Path } from "../constant";
import Locale from "../locales";
import NeatIcon from "../icons/neat.svg";
import LeftIcon from "@/app/icons/left.svg";
import clsx from "clsx";
import { Modal } from "./ui-lib";

export function PurchasePage() {
  const navigate = useNavigate();
  const [showQrModal, setShowQrModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("");

  const handlePlanSelection = (planName: string) => {
    setSelectedPlan(planName);
    setShowQrModal(true);
  };

  // 当点击按钮时处理
  const handleButtonClick = (e: React.MouseEvent, planName: string) => {
    e.stopPropagation(); // 阻止事件冒泡到卡片
    handlePlanSelection(planName);
  };

  return (
    <div className={styles["purchase-page"]}>
      <div className={styles["purchase-header"]}>
        <IconButton
          icon={<LeftIcon />}
          text={Locale.Auth.Return}
          onClick={() => navigate(Path.Auth)}
        />
      </div>

      <div className={clsx("no-dark", styles["purchase-logo"])}>
        <NeatIcon width={50} height={50} />
      </div>

      <div className={styles["purchase-title"]}>购买访问秘钥</div>
      <div className={styles["purchase-description"]}>
        无论哪个套餐都可以试用一天哦
      </div>
      
      <div className={styles["referral-info-highlight"]}>
        <div className={styles["referral-title"]}>有邀请码各加十天！</div>
        <p>如果有的话，请在购买时告知客服推荐你购买的人的邀请码，这话有点拗口。
          反正您和您的朋友都将获得<strong>额外10天</strong>的使用时间！</p>
      </div>

      <div className={styles["purchase-plans"]}>
        <div 
          className={styles["plan-card"]}
          onClick={() => handlePlanSelection("月付套餐")}
        >
          <div className={styles["plan-title"]}>标准月付</div>
          <div className={styles["plan-price"]}>¥55</div>
          <div className={styles["plan-features"]}>
            <ul>
              <li className={styles["feature-highlight"]}>🔥 GPT-4o 不限量使用 🔥</li>
              <li>DeepSeek 全系列模型</li>
              <li>Gemini 全系列模型</li>
              <li>共计160余模型</li>
              <li>上传附件，图片</li>
              <li>语音输入</li>
              <li className={styles["feature-highlight"]}>🚀 可以破限开车 🚀</li>
              <li>会话本地存储</li>
              <li>云端多端同步</li>
              <li>绝对隐私保护</li>
              <li><strong>比季付更加便宜</strong></li>
            </ul>
          </div>
          <button 
            className={styles["plan-button"]}
            onClick={(e) => handleButtonClick(e, "月付套餐")}
          >
            选择此套餐
          </button>
        </div>

        <div 
          className={styles["plan-card"]}
          onClick={() => handlePlanSelection("季付套餐")}
        >
          <div className={styles["plan-title"]}>超值季付</div>
          <div className={styles["plan-price"]}>¥140</div>
          <div className={styles["plan-features"]}>
            <ul>
              <li className={styles["feature-highlight"]}>🔥 GPT-4o 不限量使用 🔥</li>
              <li>DeepSeek 全系列模型</li>
              <li>Gemini 全系列模型</li>
              <li>共计160余模型</li>
              <li>上传附件，图片</li>
              <li>语音输入</li>
              <li className={styles["feature-highlight"]}>🚀 可以破限开车 🚀</li>
              <li>会话本地存储</li>
              <li>云端多端同步</li>
              <li>绝对隐私保护</li>
              <li><strong>比月付更加优惠</strong></li>
            </ul>
          </div>
          <button 
            className={styles["plan-button"]}
            onClick={(e) => handleButtonClick(e, "季付套餐")}
          >
            选择此套餐
          </button>
        </div>
      </div>

      <div className={styles["purchase-footer"]}>
        © {new Date().getFullYear()} NeatChat - 让您的AI体验更加智能
      </div>

      {showQrModal && (
        <Modal
          title={`扫码联系客服购买${selectedPlan}`}
          onClose={() => setShowQrModal(false)}
        >
          <div className={styles["modal-content"]}>
            <div className={styles["modal-title"]}>
              添加客服微信完成购买
            </div>
            <div className={styles["contact-qrcode"]}>
              <img src="/wechat-qrcode.png" alt="微信二维码" />
              <p>扫码添加好友（24小时在线处理）</p>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
} 