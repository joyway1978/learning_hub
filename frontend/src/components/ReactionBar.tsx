'use client';

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';

// Reaction type definitions
export type ReactionType = 'thumbs_up' | 'thumbs_down' | 'question' | 'insight';

interface ReactionConfig {
  type: ReactionType;
  emoji: string;
  tooltip: string;
}

const REACTIONS: ReactionConfig[] = [
  { type: 'thumbs_up', emoji: '👍', tooltip: '有帮助' },
  { type: 'thumbs_down', emoji: '👎', tooltip: '没帮助' },
  { type: 'question', emoji: '❓', tooltip: '有疑问' },
  { type: 'insight', emoji: '💡', tooltip: '有启发' },
];

// API响应类型
interface ReactionResponse {
  counts: ReactionCounts;
  user_reaction?: {
    type: ReactionType;
  } | null;
}

interface ReactionCounts {
  thumbs_up: number;
  thumbs_down: number;
  question: number;
  insight: number;
}

interface ReactionBarProps {
  materialId: number;
  counts: ReactionCounts;
  userReaction: ReactionType | null;
  isLoading?: boolean;
  onReact: (type: ReactionType) => Promise<void>;
  onRemove: () => Promise<void>;
  className?: string;
}

export function ReactionBar({
  materialId,
  counts,
  userReaction,
  isLoading = false,
  onReact,
  onRemove,
  className,
}: ReactionBarProps) {
  const [localUserReaction, setLocalUserReaction] = useState<ReactionType | null>(userReaction);
  const [localCounts, setLocalCounts] = useState<ReactionCounts>(counts);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync with props when they change
  React.useEffect(() => {
    setLocalUserReaction(userReaction);
    setLocalCounts(counts);
  }, [userReaction, counts]);

  const handleReactionClick = useCallback(async (type: ReactionType) => {
    if (isProcessing || isLoading) return;

    setIsProcessing(true);
    setError(null);

    // Optimistic update
    const previousReaction = localUserReaction;
    const previousCounts = { ...localCounts };

    if (localUserReaction === type) {
      // Toggle off - remove reaction
      setLocalUserReaction(null);
      setLocalCounts(prev => ({
        ...prev,
        [type]: Math.max(0, prev[type] - 1),
      }));

      try {
        await onRemove();
      } catch (err) {
        // Rollback on error
        setLocalUserReaction(previousReaction);
        setLocalCounts(previousCounts);
        const message = err instanceof Error ? err.message : '移除反馈失败';
        setError(message);
        console.error('Failed to remove reaction:', err);
      }
    } else {
      // Toggle on or switch reaction
      setLocalUserReaction(type);
      setLocalCounts(prev => {
        const newCounts = { ...prev };
        if (previousReaction) {
          newCounts[previousReaction] = Math.max(0, newCounts[previousReaction] - 1);
        }
        newCounts[type] = (newCounts[type] || 0) + 1;
        return newCounts;
      });

      try {
        await onReact(type);
      } catch (err) {
        // Rollback on error
        setLocalUserReaction(previousReaction);
        setLocalCounts(previousCounts);
        const message = err instanceof Error ? err.message : '添加反馈失败';
        setError(message);
        console.error('Failed to add reaction:', err);
      }
    }

    setIsProcessing(false);
  }, [isProcessing, isLoading, localUserReaction, localCounts, onReact, onRemove]);

  const totalReactions = Object.values(localCounts).reduce((sum, count) => sum + count, 0);

  // Auto-clear error after 3 seconds
  React.useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* Reaction buttons */}
      <div className="flex items-center gap-3">
        {REACTIONS.map((reaction) => {
          const isSelected = localUserReaction === reaction.type;
          const count = localCounts[reaction.type] || 0;

          return (
            <ReactionButton
              key={reaction.type}
              emoji={reaction.emoji}
              tooltip={reaction.tooltip}
              count={count}
              isSelected={isSelected}
              isLoading={isProcessing || isLoading}
              onClick={() => handleReactionClick(reaction.type)}
            />
          );
        })}
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error.toLowerCase().includes('credentials') || error.includes('401')
            ? '请先登录后再表达反馈'
            : error}</span>
        </div>
      )}

      {/* Total reactions summary */}
      {totalReactions > 0 && (
        <p className="text-sm text-stone-500">
          {totalReactions} 人表达了反馈
        </p>
      )}
    </div>
  );
}

// Individual reaction button component
interface ReactionButtonProps {
  emoji: string;
  tooltip: string;
  count: number;
  isSelected: boolean;
  isLoading: boolean;
  onClick: () => void;
}

function ReactionButton({
  emoji,
  tooltip,
  count,
  isSelected,
  isLoading,
  onClick,
}: ReactionButtonProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    tooltipTimeoutRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, 300);
  };

  const handleMouseLeave = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    setShowTooltip(false);
  };

  React.useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      <button
        onClick={onClick}
        disabled={isLoading}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          'flex flex-col items-center gap-1 p-2 rounded-md transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
          'disabled:opacity-60 disabled:cursor-not-allowed',
          isSelected
            ? 'bg-stone-100 border-2 border-[#1a1a2e]'
            : 'bg-white border-2 border-stone-200 hover:border-stone-300',
          isLoading && 'animate-pulse'
        )}
        aria-label={tooltip}
        aria-pressed={isSelected}
        title={tooltip}
      >
        {/* Emoji */}
        <span
          className={cn(
            'text-xl leading-none transition-all duration-200',
            isSelected ? 'grayscale-0' : 'grayscale hover:grayscale-0'
          )}
        >
          {emoji}
        </span>

        {/* Count */}
        <span
          className={cn(
            'text-xs font-medium tabular-nums',
            isSelected ? 'text-[#1a1a2e]' : 'text-stone-500'
          )}
        >
          {count}
        </span>
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-stone-800 text-white text-xs rounded whitespace-nowrap z-10">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-stone-800" />
        </div>
      )}
    </div>
  );
}

// Hook for fetching reactions
export function useReactions(materialId: number) {
  const [counts, setCounts] = useState<ReactionCounts>({
    thumbs_up: 0,
    thumbs_down: 0,
    question: 0,
    insight: 0,
  });
  const [userReaction, setUserReaction] = useState<ReactionType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReactions = useCallback(async () => {
    try {
      // 使用 api 客户端自动添加 Authorization header
      const data = await api.get<ReactionResponse>(`/materials/${materialId}/reactions`);
      setCounts(data.counts);
      setUserReaction(data.user_reaction?.type || null);
    } catch (error) {
      console.error('Failed to fetch reactions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [materialId]);

  const addReaction = useCallback(async (type: ReactionType): Promise<void> => {
    // 检查是否已登录
    const token = getToken();
    if (!token) {
      throw new Error('请先登录后再表达反馈');
    }

    const data = await api.post<ReactionResponse>(`/materials/${materialId}/reactions`, {
      reaction_type: type,
    });

    setCounts(data.counts);
    setUserReaction(type);
  }, [materialId]);

  const removeReaction = useCallback(async (): Promise<void> => {
    // 检查是否已登录
    const token = getToken();
    if (!token) {
      throw new Error('请先登录后再表达反馈');
    }

    const data = await api.delete<ReactionResponse>(`/materials/${materialId}/reactions`);
    setCounts(data.counts);
    setUserReaction(null);
  }, [materialId]);

  React.useEffect(() => {
    fetchReactions();
  }, [fetchReactions]);

  return {
    counts,
    userReaction,
    isLoading,
    addReaction,
    removeReaction,
    refresh: fetchReactions,
  };
}

export default ReactionBar;
