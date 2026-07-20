"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { checkQr } from "@/lib/auth-api";
import AppShell from "@/components/AppShell";
import { Camera, Check, X, Pencil, User } from "lucide-react";

function ProfilePage() {
  const { user, token, updateProfile } = useAuth();

  const [editingNickname, setEditingNickname] = useState(false);
  const [editingQr, setEditingQr] = useState(false);
  const [nickname, setNickname] = useState(user?.nickname || "");
  const [qrNumber, setQrNumber] = useState(user?.qrNumber || "");
  const [qrError, setQrError] = useState("");
  const [qrChecking, setQrChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showMsg = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(""), 2500);
  };

  // ===== 头像上传 =====
  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError("图片不能超过 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setSaving(true);
      const result = await updateProfile({ avatar: base64 });
      setSaving(false);
      if (result.error) setError(result.error);
      else showMsg("头像已更新");
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = async () => {
    setSaving(true);
    const result = await updateProfile({ avatar: null });
    setSaving(false);
    if (result.error) setError(result.error);
    else showMsg("头像已移除");
  };

  // ===== 昵称编辑 =====
  const handleSaveNickname = async () => {
    const trimmed = nickname.trim();
    if (!trimmed || trimmed.length > 20) {
      setError("昵称 1-20 个字符");
      return;
    }
    setSaving(true);
    const result = await updateProfile({ nickname: trimmed });
    setSaving(false);
    if (result.error) setError(result.error);
    else {
      setEditingNickname(false);
      showMsg("昵称已更新");
    }
  };

  // ===== QR 号编辑 =====
  const handleQrChange = (val: string) => {
    const upper = val.toUpperCase().replace(/[^A-Z0-9]/g, "");
    setQrNumber(upper);
    setQrError("");
  };

  const handleQrBlur = async () => {
    if (!qrNumber) {
      setQrNumber(user?.qrNumber || "");
      setEditingQr(false);
      return;
    }
    if (!/^[A-Z0-9]{6,12}$/.test(qrNumber)) {
      setQrError("6-12 位字母或数字");
      return;
    }
    if (qrNumber === user?.qrNumber) {
      setEditingQr(false);
      return;
    }

    setQrChecking(true);
    const result = await checkQr(token!, qrNumber);
    setQrChecking(false);

    if (!result.available) {
      setQrError("该 QR 号已被占用");
      return;
    }

    setSaving(true);
    const updateResult = await updateProfile({ qrNumber });
    setSaving(false);
    if (updateResult.error) setError(updateResult.error);
    else {
      setEditingQr(false);
      showMsg("QR 号已更新");
    }
  };

  return (
    <AppShell title="个人主页" activeNav="profile">
      <div className="mx-auto max-w-md px-4 py-6">
        {/* 未登录 */}
        {!user && (
          <div className="py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
              <User className="h-8 w-8 text-slate-300" />
            </div>
            <p className="mt-4 text-sm font-medium text-slate-500">请先登录</p>
            <p className="mt-1 text-xs text-slate-400">
              登录后即可查看和编辑个人资料
            </p>
          </div>
        )}

        {/* 已登录内容 */}
        {user && (
        <>
        <div className="mb-8 flex flex-col items-center">
          <div className="group relative">
            <div
              onClick={handleAvatarClick}
              className="flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 ring-4 ring-white shadow-lg"
            >
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt="头像"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-3xl font-bold text-white">
                  {(user?.nickname || "?")[0].toUpperCase()}
                </span>
              )}
            </div>
            <div
              onClick={handleAvatarClick}
              className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-full bg-black/40 opacity-0 transition group-hover:opacity-100"
            >
              <Camera className="h-6 w-6 text-white" />
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="mt-3 flex gap-2">
            <button
              onClick={handleAvatarClick}
              className="rounded-lg bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-100"
            >
              更换头像
            </button>
            {user?.avatar && (
              <button
                onClick={handleRemoveAvatar}
                className="rounded-lg bg-slate-100 px-3 py-1 text-xs text-slate-500 hover:bg-slate-200"
              >
                移除头像
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">支持 JPG/PNG，不超过 2MB</p>
        </div>

        {/* 信息卡片 */}
        <div className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          {/* 昵称 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              昵称
            </label>
            {editingNickname ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveNickname()}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-indigo-400"
                  maxLength={20}
                />
                <button
                  onClick={handleSaveNickname}
                  className="rounded-lg p-1.5 text-green-600 hover:bg-green-50"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setNickname(user?.nickname || "");
                    setEditingNickname(false);
                  }}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-700">
                  {user?.nickname || "-"}
                </span>
                <button
                  onClick={() => setEditingNickname(true)}
                  className="rounded p-1 text-slate-400 hover:text-slate-600"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* QR 号 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              QR 号
            </label>
            {editingQr ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={qrNumber}
                  onChange={(e) => handleQrChange(e.target.value)}
                  onBlur={handleQrBlur}
                  onKeyDown={(e) => e.key === "Enter" && handleQrBlur()}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm uppercase outline-none focus:border-indigo-400"
                  maxLength={12}
                  placeholder="6-12位"
                />
                <button
                  onClick={handleQrBlur}
                  disabled={qrChecking}
                  className="rounded-lg p-1.5 text-green-600 hover:bg-green-50"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setQrNumber(user?.qrNumber || "");
                    setQrError("");
                    setEditingQr(false);
                  }}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm text-slate-700">
                  {user?.qrNumber || "-"}
                </span>
                <button
                  onClick={() => setEditingQr(true)}
                  className="rounded p-1 text-slate-400 hover:text-slate-600"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {qrError && (
              <p className="mt-1 text-xs text-rose-500">{qrError}</p>
            )}
            {qrChecking && (
              <p className="mt-1 text-xs text-slate-400">检查中...</p>
            )}
          </div>

          {/* 邮箱 */}
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              邮箱
            </label>
            <span className="text-sm text-slate-500">{user?.email || "-"}</span>
          </div>
        </div>

        {/* 消息 */}
        {error && (
          <div className="mt-4 rounded-lg bg-rose-50 px-4 py-2 text-center text-xs text-rose-600">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-2 text-center text-xs text-emerald-600">
            {success}
          </div>
        )}
        {saving && (
          <div className="mt-4 text-center text-xs text-slate-400">
            保存中...
          </div>
        )}
        </>
        )}
      </div>
    </AppShell>
  );
}

export default ProfilePage;
