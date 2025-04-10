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

  // 生成或获取客户端唯一标识，用于跟踪此浏览器实例
  const [clientId, setClientId] = useState("");

  useEffect(() => {
    // 尝试从localStorage获取已有的clientId
    let storedClientId = localStorage.getItem("clientUniqueId");

    // 如果没有，生成新的
    if (!storedClientId) {
      storedClientId =
        Date.now().toString() + Math.random().toString(36).substring(2);
      localStorage.setItem("clientUniqueId", storedClientId);
    }

    setClientId(storedClientId);
  }, []);

  const verifyAndGoChat = async () => {
    if (!inputAccessCode.trim()) {
      setErrorMessage("请输入访问码");
      return;
    }

    setIsVerifying(true);
    setErrorMessage("");

    // 判断是否是临时访问码
    const isTemporaryCode = ["test123", "test1234"].includes(inputAccessCode);

    // 确定临时访问码的存储键名（固定格式，与访问码相关）
    // 不使用本地客户端ID，而是使用公共键名，这样所有浏览器实例共享过期时间
    const tempCodeKey = `global_temp_access_${inputAccessCode}`;

    // 从localStorage中获取已存储的过期时间
    let existingExpiryTime = parseInt(localStorage.getItem(tempCodeKey) || "0");

    // 如果存在有效的过期时间（未过期），则复用它
    const now = Date.now();
    const hasValidExpiry = existingExpiryTime > now;

    try {
      // 临时访问码逻辑处理
      let data;

      // 如果是临时访问码且有有效的过期时间，直接使用
      if (isTemporaryCode && hasValidExpiry) {
        console.log(
          "使用已存储的全局过期时间:",
          new Date(existingExpiryTime).toLocaleString(),
        );
        data = {
          success: true,
          isTemporary: true,
          expiryTime: existingExpiryTime,
        };
      } else {
        // 需要发送验证请求
        const response = await fetch("/api/verify-access", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accessCode: inputAccessCode,
            clientId: clientId,
          }),
        });

        data = await response.json();

        // 如果是临时访问码且验证成功，全局保存过期时间
        if (data.success && data.isTemporary && isTemporaryCode) {
          console.log(
            "保存新的全局过期时间:",
            new Date(data.expiryTime).toLocaleString(),
          );
          // 使用全局键名保存过期时间，确保所有浏览器实例共享
          localStorage.setItem(tempCodeKey, String(data.expiryTime));
        }
      }

      if (data.success) {
        // 验证成功后，将访问码保存到store中
        accessStore.update((access) => {
          access.accessCode = inputAccessCode;

          // 如果是临时访问码，保存过期信息
          if (data.isTemporary) {
            access.isTemporaryAccess = true;
            access.accessExpiryTime = data.expiryTime;

            // 在localStorage中存储过期时间，用于跨页面共享
            localStorage.setItem("accessExpiryTime", String(data.expiryTime));
          } else {
            // 不是临时访问码，确保清除相关标记
            access.isTemporaryAccess = false;
            access.accessExpiryTime = undefined;
            localStorage.removeItem("accessExpiryTime");
          }
        });

        // 临时访问码显示剩余时间
        if (data.isTemporary) {
          const remainingSecs = Math.max(
            0,
            Math.floor((data.expiryTime - Date.now()) / 1000),
          );
          const remainingMins = Math.floor(remainingSecs / 60);
          const remainingSecsText = remainingSecs % 60;
          showToast(
            `验证成功，此访问码将在${remainingMins}分${remainingSecsText}秒后过期`,
          );
        } else {
          showToast("验证成功");
        }

        navigate(Path.Chat);
      } else {
        // 验证失败，清除store中的访问码和相关存储
        accessStore.update((access) => {
          access.accessCode = "";
          access.isTemporaryAccess = false;
          access.accessExpiryTime = undefined;
        });
        localStorage.removeItem("accessExpiryTime");

        // 注意：验证失败时不清除全局过期时间，保留给其他实例使用
        setErrorMessage(data.message || "访问码验证失败");
      }
    } catch (error) {
      console.error("验证访问码时出错:", error);
      setErrorMessage("服务器错误，请稍后再试");
      // 发生错误时也清除store中的访问码
      accessStore.update((access) => {
        access.accessCode = "";
        access.isTemporaryAccess = false;
        access.accessExpiryTime = undefined;
      });
      localStorage.removeItem("accessExpiryTime");
    } finally {
      setIsVerifying(false);
    }
  };

  const resetAccessCode = () => {
    setInputAccessCode("");
    accessStore.update((access) => {
      access.openaiApiKey = "";
      access.accessCode = "";
      access.isTemporaryAccess = false;
      access.accessExpiryTime = undefined;
    });
    localStorage.removeItem("accessExpiryTime");

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
