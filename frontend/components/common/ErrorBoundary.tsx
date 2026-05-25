
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

class ErrorBoundary extends React.Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4 text-center">
                    <div className="bg-gray-800 p-8 rounded-xl shadow-2xl border border-red-900/50 max-w-lg w-full">
                        <h1 className="text-3xl font-bold text-red-500 mb-4">Something went wrong</h1>
                        <p className="text-gray-300 mb-6 font-medium">The application encountered an unexpected error. This usually happens when the AI returns data in an format we didn't expect.</p>
                        <div className="bg-black/30 p-4 rounded text-left mb-6 overflow-auto max-h-40">
                            <code className="text-red-400 text-xs">{this.state.error?.message}</code>
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-sky-600 hover:bg-sky-500 text-white font-bold py-3 px-8 rounded-lg transition-colors"
                        >
                            Refresh Application
                        </button>
                    </div>
                </div>
            );
        }

        // @ts-ignore
        return this.props.children;
    }
}

export default ErrorBoundary;
