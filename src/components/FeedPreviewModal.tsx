import React, { useState, useEffect } from 'react';
import { SourceChannel, TelegramPost } from '../types';
import { getChannelPreview } from '../lib/telegramApi';
import {
  X,
  RefreshCw,
  Image,
  Film,
  Music,
  Paperclip,
  ExternalLink,
  Calendar,
} from 'lucide-react';

interface FeedPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  source: SourceChannel | null;
}

export const FeedPreviewModal: React.FC<FeedPreviewModalProps> = ({
  isOpen,
  onClose,
  source,
}) => {
  const [posts, setPosts] = useState<TelegramPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && source) {
      fetchFeed();
    } else {
      setPosts([]);
      setError(null);
    }
  }, [isOpen, source]);

  const fetchFeed = async () => {
    if (!source) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await getChannelPreview(source.id);
      if (res.success && res.preview) {
        setPosts(res.preview.posts || []);
      } else {
        setError(res.message || 'خطا در دریافت پست‌ها.');
      }
    } catch (err: any) {
      setError('امکان برقراری ارتباط با سرور وجود ندارد.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !source) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fadeIn">
      <div className="bg-white border border-slate-200/80 rounded-3xl max-w-2xl w-full p-6 shadow-2xl relative max-h-[85vh] flex flex-col space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-3 space-x-reverse">
            {source.avatarUrl ? (
              <img src={source.avatarUrl} alt={source.title} className="w-10 h-10 rounded-xl object-cover shadow-sm" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-bold">
                {source.title.charAt(0)}
              </div>
            )}
            <div>
              <h3 className="text-base font-bold text-slate-800">پست‌های اخیر «{source.title}»</h3>
              <p className="text-xs text-slate-400 dir-ltr text-right">@{source.username}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 space-x-reverse">
            <button
              onClick={fetchFeed}
              disabled={isLoading}
              className="p-2 text-slate-500 hover:text-slate-800 bg-slate-100 rounded-xl transition"
              title="به‌روزرسانی پست‌ها"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto py-2 space-y-4 pr-1">
          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
              <p className="text-xs text-slate-500">در حال دریافت آخرین پست‌های تلگرام...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs text-center">
              {error}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              پستی در این کانال یا گروه یافت نشد.
            </div>
          ) : (
            posts.slice().reverse().map((post) => (
              <div
                key={post.id}
                className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 transition space-y-3 shadow-sm hover:shadow-md"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-500 pb-2 border-b border-slate-200/60">
                  <div className="flex items-center space-x-2 space-x-reverse">
                    <span className="font-mono bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-md font-bold">
                      #{post.id}
                    </span>
                    <span className="flex items-center space-x-1 space-x-reverse">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      <span>{new Date(post.date).toLocaleString('fa-IR')}</span>
                    </span>
                  </div>

                  <a
                    href={post.rawUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 space-x-reverse text-blue-600 font-semibold hover:underline"
                  >
                    <span>مشاهده در تلگرام</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Formatted Text */}
                {post.formattedTextHtml && (
                  <div
                    className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap dir-rtl text-right"
                    dangerouslySetInnerHTML={{ __html: post.formattedTextHtml }}
                  />
                )}

                {/* Media Badges */}
                {post.mediaType !== 'text' && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {post.mediaType === 'photo' && (
                      <div className="flex items-center space-x-1 space-x-reverse text-[11px] bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg border border-blue-200">
                        <Image className="w-3.5 h-3.5" />
                        <span>عکس متصل</span>
                      </div>
                    )}
                    {post.mediaType === 'video' && (
                      <div className="flex items-center space-x-1 space-x-reverse text-[11px] bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-200">
                        <Film className="w-3.5 h-3.5" />
                        <span>ویدیو متصل</span>
                      </div>
                    )}
                    {post.mediaType === 'media_group' && (
                      <div className="flex items-center space-x-1 space-x-reverse text-[11px] bg-purple-50 text-purple-700 px-2.5 py-1 rounded-lg border border-purple-200">
                        <Image className="w-3.5 h-3.5" />
                        <span>آلبوم چندرسانه‌ای ({post.mediaGroup?.length || 0} فایل)</span>
                      </div>
                    )}
                    {post.mediaType === 'audio' && (
                      <div className="flex items-center space-x-1 space-x-reverse text-[11px] bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-200">
                        <Music className="w-3.5 h-3.5" />
                        <span>فایل صوتی</span>
                      </div>
                    )}
                    {post.mediaType === 'document' && (
                      <div className="flex items-center space-x-1 space-x-reverse text-[11px] bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg border border-amber-200">
                        <Paperclip className="w-3.5 h-3.5" />
                        <span>سند / فایل</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition"
          >
            بستن
          </button>
        </div>
      </div>
    </div>
  );
};
