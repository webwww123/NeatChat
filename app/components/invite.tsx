import { useMemo, useState } from "react";
import styles from "./invite.module.scss";
import { useNavigate } from "react-router-dom";
import { IconButton } from "./button";
import LeftIcon from "@/app/icons/left.svg";
import CloseIcon from "@/app/icons/close.svg";
import CopyIcon from "@/app/icons/copy.svg";
import ShareIcon from "@/app/icons/share.svg";
import NeatIcon from "@/app/icons/neat.svg";
import Locale from "@/app/locales";
import { Path } from "@/app/constant";
import { useAccessStore } from "@/app/store";
import { showToast } from "./ui-lib";
import clsx from "clsx";

export function InvitePage() {
  const navigate = useNavigate();
  const accessStore = useAccessStore();
  
  // 检查用户是否已填写访问密钥
  const hasAccessCode = useMemo(() => {
    return accessStore.accessCode && accessStore.accessCode.length > 0;
  }, [accessStore.accessCode]);
  
  // 获取邀请码（用户访问密钥的后四位）
  const inviteCode = useMemo(() => {
    if (!hasAccessCode) return "";
    return accessStore.accessCode.slice(-4);
  }, [hasAccessCode, accessStore.accessCode]);
  
  // 复制邀请码到剪贴板
  const copyInviteCode = () => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      showToast("已复制邀请码");
    }
  };
  
  // 如果用户未填写访问密钥，则重定向到验证页面
  if (!hasAccessCode) {
    navigate(Path.Auth);
    return null;
  }
  
  return (
    <div className={styles["invite-page"]}>
      <div className={styles["invite-header"]}>
        <IconButton
          icon={<LeftIcon />}
          text="返回"
          onClick={() => navigate(Path.Home)}
        />
      </div>
      
      <div className={clsx("no-dark", styles["invite-logo"])}>
        <NeatIcon width={50} height={50} />
      </div>
      
      <div className={styles["invite-title"]}>邀请好友，双方各得10天</div>
      <div className={styles["invite-description"]}>
        每邀请一位好友购买服务，您和您的好友都将获得额外10天的使用时间，无限制次数！
      </div>
      
      <div className={styles["invite-code-container"]}>
        <div className={styles["invite-code-label"]}>您的专属邀请码</div>
        <div className={styles["invite-code"]}>{inviteCode}</div>
        <div className={styles["invite-code-actions"]}>
          <IconButton 
            icon={<CopyIcon />} 
            text="复制邀请码" 
            onClick={copyInviteCode}
          />
        </div>
      </div>
      
      <div className={styles["invite-instruction"]}>
        <h3>如何邀请好友</h3>
        <ol>
          <li>将您的邀请码 <strong>{inviteCode}</strong> 分享给好友</li>
          <li>好友购买时向客服提供您的邀请码</li>
          <li>购买成功后，双方都将获得10天额外使用时间</li>
        </ol>
      </div>
      
      <div className={styles["invite-promotion-tips"]}>
        <p>您可以在小红书、微信、朋友圈等社交平台分享您的邀请码</p>
        <p>邀请次数不限，获得的奖励会自动添加到您的账户中</p>
      </div>
    </div>
  );
} 