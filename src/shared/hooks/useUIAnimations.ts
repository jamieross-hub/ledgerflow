import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * UI动画工具钩子
 * 用于实现P0优先级的列表动效和操作反馈
 */

// 动画状态类型
type AnimationState = 'idle' | 'entering' | 'entered' | 'exiting' | 'exited';

interface UseListItemAnimationOptions {
  enterDelay?: number;
  exitDelay?: number;
}

/**
 * 列表项动画钩子
 * 用于单个列表项的进入/退出动画
 */
export function useListItemAnimation(options: UseListItemAnimationOptions = {}) {
  const { enterDelay = 0, exitDelay = 0 } = options;
  const [animationState, setAnimationState] = useState<AnimationState>('idle');
  const [isVisible, setIsVisible] = useState(true);
  const timerRef = useRef<NodeJS.Timeout>();

  // 进入动画
  const enter = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setAnimationState('entering');
    timerRef.current = setTimeout(() => {
      setAnimationState('entered');
    }, enterDelay + 350);
  }, [enterDelay]);

  // 退出动画
  const exit = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setAnimationState('exiting');
    timerRef.current = setTimeout(() => {
      setAnimationState('exited');
      setIsVisible(false);
    }, exitDelay + 300);
  }, [exitDelay]);

  // 重置状态
  const reset = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setAnimationState('idle');
    setIsVisible(true);
  }, []);

  // 获取动画类名
  const getAnimationClassName = useCallback(() => {
    switch (animationState) {
      case 'entering':
        return 'list-item-enter';
      case 'exiting':
        return 'list-item-exit';
      default:
        return '';
    }
  }, [animationState]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    animationState,
    isVisible,
    enter,
    exit,
    reset,
    getAnimationClassName,
  };
}

// 拖拽状态类型
type DragState = 'idle' | 'dragging' | 'drop-target';

interface UseDragAnimationOptions {
  onDrop?: (draggedId: string, targetId: string) => void;
}

/**
 * 拖拽动画钩子
 * 用于列表项的拖拽重排动效
 */
export function useDragAnimation(options: UseDragAnimationOptions = {}) {
  const { onDrop } = options;
  const [dragState, setDragState] = useState<DragState>('idle');
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // 开始拖拽
  const startDrag = useCallback((itemId: string) => {
    setDragState('dragging');
    setDraggedItemId(itemId);
  }, []);

  // 结束拖拽
  const endDrag = useCallback(() => {
    if (dropTargetId && draggedItemId && onDrop) {
      onDrop(draggedItemId, dropTargetId);
    }
    setDragState('idle');
    setDraggedItemId(null);
    setDropTargetId(null);
  }, [dropTargetId, draggedItemId, onDrop]);

  // 设置放置目标
  const setDropTarget = useCallback((itemId: string | null) => {
    setDropTargetId(itemId);
    if (itemId) {
      setDragState('drop-target');
    } else if (draggedItemId) {
      setDragState('dragging');
    } else {
      setDragState('idle');
    }
  }, [draggedItemId]);

  // 获取拖拽相关类名
  const getDragClassName = useCallback((itemId: string) => {
    const classNames: string[] = [];
    
    if (draggedItemId === itemId) {
      classNames.push('list-item-dragging');
    }
    
    if (dropTargetId === itemId) {
      classNames.push('drop-target');
    }
    
    return classNames.join(' ');
  }, [draggedItemId, dropTargetId]);

  return {
    dragState,
    draggedItemId,
    dropTargetId,
    startDrag,
    endDrag,
    setDropTarget,
    getDragClassName,
  };
}

interface UseAmountAnimationOptions {
  duration?: number;
}

/**
 * 金额变更动画钩子
 * 用于金额变化时的动效反馈
 */
export function useAmountAnimation(options: UseAmountAnimationOptions = {}) {
  const { duration = 600 } = options;
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationDirection, setAnimationDirection] = useState<'up' | 'down' | null>(null);
  const timerRef = useRef<NodeJS.Timeout>();

  // 触发金额增加动画
  const animateUp = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setIsAnimating(true);
    setAnimationDirection('up');
    timerRef.current = setTimeout(() => {
      setIsAnimating(false);
      setAnimationDirection(null);
    }, duration);
  }, [duration]);

  // 触发金额减少动画
  const animateDown = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setIsAnimating(true);
    setAnimationDirection('down');
    timerRef.current = setTimeout(() => {
      setIsAnimating(false);
      setAnimationDirection(null);
    }, duration);
  }, [duration]);

  // 根据值变化自动选择动画方向
  const animateChange = useCallback((oldValue: number, newValue: number) => {
    if (newValue > oldValue) {
      animateUp();
    } else if (newValue < oldValue) {
      animateDown();
    }
  }, [animateUp, animateDown]);

  // 获取动画类名
  const getAnimationClassName = useCallback(() => {
    if (!isAnimating || !animationDirection) {
      return '';
    }
    return animationDirection === 'up' ? 'amount-change-up' : 'amount-change-down';
  }, [isAnimating, animationDirection]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    isAnimating,
    animationDirection,
    animateUp,
    animateDown,
    animateChange,
    getAnimationClassName,
  };
}

interface UseButtonFeedbackOptions {
  ripple?: boolean;
  scale?: boolean;
}

/**
 * 按钮反馈钩子
 * 用于按钮点击的即时反馈
 */
export function useButtonFeedback(options: UseButtonFeedbackOptions = {}) {
  const { ripple = true, scale = true } = options;
  const [isPressed, setIsPressed] = useState(false);
  const [ripplePosition, setRipplePosition] = useState<{ x: number; y: number } | null>(null);

  // 处理鼠标/触摸按下
  const handlePress = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    setIsPressed(true);
    
    if (ripple) {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      let clientX: number, clientY: number;
      
      if ('touches' in event) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
      } else {
        clientX = event.clientX;
        clientY = event.clientY;
      }
      
      setRipplePosition({
        x: clientX - rect.left,
        y: clientY - rect.top,
      });
    }
  }, [ripple]);

  // 处理鼠标/触摸释放
  const handleRelease = useCallback(() => {
    setIsPressed(false);
    // 延迟清除涟漪位置，让动画完成
    setTimeout(() => {
      setRipplePosition(null);
    }, 400);
  }, []);

  // 获取按钮状态类名
  const getButtonClassName = useCallback(() => {
    const classNames: string[] = [];
    if (isPressed && scale) {
      classNames.push('button-pressed');
    }
    return classNames.join(' ');
  }, [isPressed, scale]);

  return {
    isPressed,
    ripplePosition,
    handlePress,
    handleRelease,
    getButtonClassName,
  };
}

/**
 * 主题切换动画钩子
 * 用于深浅模式切换的平滑过渡
 */
export function useThemeTransition() {
  const [isTransitioning, setIsTransitioning] = useState(false);

  const startTransition = useCallback(() => {
    setIsTransitioning(true);
    // 添加过渡类到body
    document.body.classList.add('theme-transition');
    
    // 移除临时动画禁用
    document.body.classList.remove('theme-transition-no-animation');
  }, []);

  const endTransition = useCallback(() => {
    setIsTransitioning(false);
    // 延迟移除过渡类，让动画完成
    setTimeout(() => {
      document.body.classList.remove('theme-transition');
    }, 500);
  }, []);

  // 切换主题的包装函数
  const switchTheme = useCallback(async (themeSwitchFn: () => Promise<void> | void) => {
    startTransition();
    try {
      await themeSwitchFn();
    } finally {
      endTransition();
    }
  }, [startTransition, endTransition]);

  return {
    isTransitioning,
    startTransition,
    endTransition,
    switchTheme,
  };
}
