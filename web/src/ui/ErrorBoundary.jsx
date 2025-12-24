import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    try {
      this.props.onError?.(error, info);
    } catch {
      // ignore
    }
  }

  reset() {
    this.setState({ error: null });
  }

  render() {
    if (this.state.error) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error, this.reset);
      }
      return this.props.fallback ?? null;
    }

    return this.props.children;
  }
}
