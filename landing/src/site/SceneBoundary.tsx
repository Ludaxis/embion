import { Component, type ReactNode } from 'react';

/**
 * Error boundary around the 3D layer. R3F rethrows Canvas-tree errors into the
 * DOM React tree, and under React 19 an uncaught error unmounts the ENTIRE
 * root — a failed GLB fetch or missing WebGL would blank the whole prerendered
 * page. Instead: swallow the failure, render nothing, and let the page fall
 * back to its poster + DOM story via onFail.
 */
export class SceneBoundary extends Component<
  { onFail: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[embion] 3D layer failed — falling back to poster:', error);
    this.props.onFail();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
