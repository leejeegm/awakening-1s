"use client";

import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallbackTitle?: string;
  onRetry?: () => void;
};

type State = { hasError: boolean };

/** 섹션 단위로 오류를 잡아 전체 페이지가 깨지지 않도록 합니다. */
export default class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("[SectionErrorBoundary]", error);
  }

  retry = () => {
    this.setState({ hasError: false });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="py-6 px-4 rounded-lg bg-slate-800/60 border border-slate-700 text-center">
          <p className="text-slate-400 text-sm mb-3">
            {this.props.fallbackTitle ?? "이 섹션을 불러오는 중 문제가 생겼습니다."}
          </p>
          <button
            type="button"
            onClick={this.retry}
            className="px-3 py-2 rounded-lg bg-slate-700 text-slate-200 text-sm hover:bg-slate-600 touch-manipulation"
          >
            다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
