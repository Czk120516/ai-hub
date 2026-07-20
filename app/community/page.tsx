"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchPosts,
  fetchPost,
  createPost,
  addPostComment,
  type PostSummary,
  type Post,
  type Comment,
} from "@/lib/auth-api";
import AppShell from "@/components/AppShell";
import {
  MessageSquare,
  Send,
  Plus,
  ArrowLeft,
  User,
  Loader2,
} from "lucide-react";

function CommunityPage() {
  const { user, token } = useAuth();

  // 列表状态
  const [posts, setPosts] = useState<PostSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // 发帖状态
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createContent, setCreateContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState("");

  // 详情状态
  const [detailPost, setDetailPost] = useState<Post | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commenting, setCommenting] = useState(false);

  const loadPosts = useCallback(async (p = 1) => {
    setLoadingPosts(true);
    const { items, total: t } = await fetchPosts(p, 15);
    setPosts(items);
    setTotal(t);
    setPage(p);
    setLoadingPosts(false);
  }, []);

  useEffect(() => {
    if (user) loadPosts(1);
  }, [loadPosts, user]);

  // ===== 发帖 =====
  const handleCreate = async () => {
    if (!createTitle.trim() || !createContent.trim()) {
      setPostError("请填写标题和内容");
      return;
    }
    setPosting(true);
    setPostError("");
    const result = await createPost(token!, createTitle, createContent);
    setPosting(false);
    if (result.error) {
      setPostError(result.error);
    } else {
      setShowCreate(false);
      setCreateTitle("");
      setCreateContent("");
      loadPosts(1); // 刷新列表
    }
  };

  // ===== 查看帖子详情 =====
  const handleViewPost = async (id: string) => {
    setLoadingDetail(true);
    const post = await fetchPost(id);
    setDetailPost(post);
    setLoadingDetail(false);
  };

  // ===== 评论 =====
  const handleComment = async () => {
    if (!commentText.trim() || !detailPost) return;
    setCommenting(true);
    const result = await addPostComment(token!, detailPost.id, commentText);
    setCommenting(false);
    if ("comment" in result && result.comment) {
      // 刷新帖子详情
      setCommentText("");
      handleViewPost(detailPost.id);
    }
  };

  // 时间格式化
  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "刚刚";
    if (mins < 60) return `${mins} 分钟前`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    return `${days} 天前`;
  };

  // ===== 帖子详情视图 =====
  if (detailPost) {
    return (
      <AppShell title="讨论社区" activeNav="community">
        <div className="mx-auto max-w-2xl px-4 py-4">
          {/* 返回 */}
          <button
            onClick={() => setDetailPost(null)}
            className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            返回列表
          </button>

          {/* 帖子 */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-xs font-bold text-white">
                {detailPost.authorAvatar ? (
                  <img
                    src={detailPost.authorAvatar}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  detailPost.authorNickname[0]
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">
                  {detailPost.authorNickname}
                </p>
                <p className="text-[10px] text-slate-400">
                  QR: {detailPost.authorQr} · {timeAgo(detailPost.createdAt)}
                </p>
              </div>
            </div>

            <h2 className="mb-2 text-lg font-semibold text-slate-800">
              {detailPost.title}
            </h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
              {detailPost.content}
            </p>
          </div>

          {/* 评论区 */}
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-medium text-slate-600">
              评论 ({detailPost.comments?.length || 0})
            </h3>

            {detailPost.comments?.length === 0 && (
              <p className="text-center text-xs text-slate-400 py-6">
                暂无评论，来发表第一条吧
              </p>
            )}

            <div className="space-y-3">
              {detailPost.comments?.map((c: Comment) => (
                <div
                  key={c.id}
                  className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-slate-100"
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500">
                      {c.authorAvatar ? (
                        <img
                          src={c.authorAvatar}
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        c.authorNickname[0]
                      )}
                    </div>
                    <span className="text-xs font-medium text-slate-600">
                      {c.authorNickname}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {timeAgo(c.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{c.content}</p>
                </div>
              ))}
            </div>

            {/* 发表评论 */}
            <div className="mt-4 flex gap-2">
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleComment()}
                placeholder="写评论..."
                maxLength={2000}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
              <button
                onClick={handleComment}
                disabled={!commentText.trim() || commenting}
                className="rounded-lg bg-indigo-600 px-3 py-2 text-white transition hover:bg-indigo-700 disabled:opacity-50"
              >
                {commenting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  // ===== 帖子列表视图 =====
  return (
    <AppShell title="讨论社区" activeNav="community">
      <div className="mx-auto max-w-2xl px-4 py-4">
        {/* 未登录提示 */}
        {!user && (
          <div className="py-16 text-center">
            <MessageSquare className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-4 text-sm font-medium text-slate-500">请先登录</p>
            <p className="mt-1 text-xs text-slate-400">
              登录后即可浏览和参与讨论
            </p>
          </div>
        )}

        {/* 已登录：发帖入口 */}
        {user && !showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 py-4 text-sm text-slate-500 transition hover:border-indigo-300 hover:text-indigo-500"
          >
            <Plus className="h-4 w-4" />
            发布新帖子
          </button>
        )}

        {/* 发帖表单 */}
        {user && showCreate && (
          <div className="mb-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <h3 className="mb-3 text-sm font-semibold text-slate-700">
              发表帖子
            </h3>
            <input
              autoFocus
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              placeholder="标题（1-100 字）"
              maxLength={100}
              className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
            <textarea
              value={createContent}
              onChange={(e) => setCreateContent(e.target.value)}
              placeholder="内容（支持换行，1-5000 字）"
              maxLength={5000}
              rows={5}
              className="mb-2 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
            {postError && (
              <p className="mb-2 text-xs text-rose-500">{postError}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={posting}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {posting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                发布
              </button>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setCreateTitle("");
                  setCreateContent("");
                  setPostError("");
                }}
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-600 hover:bg-slate-200"
              >
                取消
              </button>
            </div>
          </div>
        )}

        {/* 加载中 */}
        {user && loadingPosts && posts.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        )}

        {/* 空状态 */}
        {user && !loadingPosts && posts.length === 0 && (
          <div className="py-12 text-center">
            <MessageSquare className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm text-slate-400">
              还没有帖子，来发布第一条吧
            </p>
          </div>
        )}

        {/* 帖子列表 */}
        {user && (
        <div className="space-y-3">
          {posts.map((post) => (
            <button
              key={post.id}
              onClick={() => handleViewPost(post.id)}
              className="w-full rounded-xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200 transition hover:shadow-md"
            >
              <h3 className="mb-1.5 text-sm font-semibold text-slate-800">
                {post.title}
              </h3>
              <p className="mb-2 line-clamp-2 text-xs text-slate-500">
                {post.content.slice(0, 150)}
              </p>
              <div className="flex items-center gap-2">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-500">
                  {post.authorAvatar ? (
                    <img
                      src={post.authorAvatar}
                      className="h-full w-full rounded-full object-cover"
                      alt=""
                    />
                  ) : (
                    post.authorNickname[0]
                  )}
                </div>
                <span className="text-xs text-slate-500">
                  {post.authorNickname}
                </span>
                <span className="text-xs text-slate-300">·</span>
                <span className="text-xs text-slate-400">
                  {timeAgo(post.createdAt)}
                </span>
                {post.commentCount > 0 && (
                  <>
                    <span className="text-xs text-slate-300">·</span>
                    <span className="text-xs text-slate-400">
                      <MessageSquare className="mr-0.5 inline h-3 w-3" />
                      {post.commentCount}
                    </span>
                  </>
                )}
              </div>
            </button>
          ))}
        </div>
        )}

        {/* 分页 */}
        {user && total > 15 && (
          <div className="mt-6 flex justify-center gap-2">
            <button
              disabled={page === 1}
              onClick={() => loadPosts(page - 1)}
              className="rounded-lg bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-30"
            >
              上一页
            </button>
            <span className="px-3 py-1.5 text-xs text-slate-400">
              {page} / {Math.ceil(total / 15)}
            </span>
            <button
              disabled={page >= Math.ceil(total / 15)}
              onClick={() => loadPosts(page + 1)}
              className="rounded-lg bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-30"
            >
              下一页
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default CommunityPage;
