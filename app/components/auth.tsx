import styles from "./auth.module.scss";
import { IconButton } from "./button";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Path } from "../constant";
import { useAccessStore } from "../store";
import Locale from "../locales";
import NeatIcon from "../icons/neat.svg";
import { getClientConfig } from "../config/client";
import { PasswordInput } from "./ui-lib";
import LeftIcon from "@/app/icons/left.svg";
import clsx from "clsx";
import KeyIcon from "@/app/icons/key.svg";
import LoadingIcon from "@/app/icons/three-dots.svg";
import { showToast } from "./ui-lib";

export function AuthPage() {
  const navigate = useNavigate();
  const accessStore = useAccessStore();
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  // 用于表单的临时访问码，不直接操作存储的accessCode
  const [inputAccessCode, setInputAccessCode] = useState(
    accessStore.accessCode || "",
  );

  const verifyAndGoChat = async () => {
    if (!inputAccessCode.trim()) {
      setErrorMessage("请输入访问码");
      return;
    }

    setIsVerifying(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/verify-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accessCode: inputAccessCode,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // 验证成功后才将访问码保存到store中
        accessStore.update((access) => (access.accessCode = inputAccessCode));
        showToast("验证成功");
        navigate(Path.Chat);
      } else {
        // 验证失败，清除store中的访问码
        accessStore.update((access) => (access.accessCode = ""));
        setErrorMessage(data.message || "访问码验证失败");
      }
    } catch (error) {
      console.error("验证访问码时出错:", error);
      setErrorMessage("服务器错误，请稍后再试");
      // 发生错误时也清除store中的访问码
      accessStore.update((access) => (access.accessCode = ""));
    } finally {
      setIsVerifying(false);
    }
  };

  const resetAccessCode = () => {
    setInputAccessCode("");
    accessStore.update((access) => {
      access.openaiApiKey = "";
      access.accessCode = "";
    });
    setErrorMessage("");
  };

  useEffect(() => {
    if (getClientConfig()?.isApp) {
      navigate(Path.Settings);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles["auth-page"]}>
      <div className={styles["auth-header"]}>
        <IconButton
          icon={<LeftIcon />}
          text={Locale.Auth.Return}
          onClick={() => navigate(Path.Home)}
        ></IconButton>
      </div>
      <div className={clsx("no-dark", styles["auth-logo"])}>
        <NeatIcon width={30} height={30} />
      </div>

      <div className={styles["auth-title"]}>{Locale.Auth.Title}</div>
      <div className={styles["auth-tips"]}>{Locale.Auth.Tips}</div>

      <PasswordInput
        style={{ marginTop: "3vh", marginBottom: "1vh" }}
        aria={Locale.Settings.ShowPassword}
        aria-label={Locale.Auth.Input}
        value={inputAccessCode}
        type="text"
        placeholder={Locale.Auth.Input}
        onChange={(e) => {
          setInputAccessCode(e.currentTarget.value);
          setErrorMessage("");
        }}
      />

      {errorMessage && (
        <div className={styles["auth-error"]}>{errorMessage}</div>
      )}

      <div style={{ textAlign: "center", margin: "1vh 0 3vh" }}>
        <a
          onClick={() => navigate(Path.Purchase)}
          style={{
            color: "var(--primary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "5px",
            fontSize: "14px",
          }}
        >
          <KeyIcon style={{ width: "14px", height: "14px" }} />
          点击这里购买秘钥
        </a>
      </div>

      <div className={styles["auth-actions"]}>
        <IconButton
          text={isVerifying ? "验证中..." : Locale.Auth.Confirm}
          type="primary"
          icon={isVerifying ? <LoadingIcon /> : undefined}
          disabled={isVerifying || !inputAccessCode.trim()}
          onClick={verifyAndGoChat}
        />
      </div>
    </div>
  );
}
