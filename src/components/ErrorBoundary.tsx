import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, X, ChevronDown, ChevronUp, ShieldAlert, Sparkles } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  componentName?: string;
  compact?: boolean;
  onReset?: () => void;
  onClose?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

/**
 * Generic React Error Boundary for Echoes of Aurion.
 * Isolates component runtime exceptions to prevent them from crashing the 3D Babylon/WebGL engine,
 * and provides a graceful Aurion-themed retry state.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[ErrorBoundary:${this.props.componentName || 'Generic'}] Caught runtime error:`, error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const {
      fallbackTitle = 'Ätherische Resonanz-Unterbrechung',
      fallbackMessage = 'In dieser Schnittstellen-Komponente ist ein unerwarteter Fehler aufgetreten. Die 3D-Spielwelt läuft im Hintergrund stabil weiter.',
      componentName = 'Interface-Modul',
      compact = false,
      onClose,
    } = this.props;

    if (compact) {
      return (
        <div className="p-3 rounded-xl bg-[#081a2e]/90 border border-amber-500/40 text-gray-200 backdrop-blur-md shadow-lg flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <span className="font-serif font-bold text-amber-300">{componentName} blockiert</span>
              <p className="text-[11px] text-gray-400 truncate max-w-xs">{this.state.error?.message || fallbackMessage}</p>
            </div>
          </div>
          <button
            onClick={this.handleReset}
            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 font-mono text-[11px] flex items-center gap-1 cursor-pointer transition-all active:scale-95"
          >
            <RefreshCw className="w-3 h-3" /> Wiederholen
          </button>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-[#081a2e] border-2 border-amber-500/50 rounded-2xl p-5 sm:p-6 text-gray-200 shadow-[0_0_40px_rgba(0,240,255,0.15)] flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-start justify-between border-b border-gray-800 pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-500/40 flex items-center justify-center text-amber-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-base text-amber-200 tracking-wide flex items-center gap-2">
                  {fallbackTitle}
                </h3>
                <span className="text-[11px] font-mono text-[#00f0ff] uppercase tracking-wider">
                  Schnittstelle: {componentName}
                </span>
              </div>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg bg-black/50 border border-gray-800 hover:border-amber-500 text-gray-400 hover:text-white transition-colors cursor-pointer"
                title="Schließen"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Body message */}
          <div className="space-y-2 text-xs font-sans text-gray-300 leading-relaxed bg-black/40 p-3.5 rounded-xl border border-gray-800/80">
            <p>{fallbackMessage}</p>
            <div className="text-[11px] font-mono text-red-300 bg-red-950/30 p-2 rounded border border-red-900/40 break-words">
              <strong>Fehler:</strong> {this.state.error?.message || 'Unbekannter Ausnahmefehler'}
            </div>
          </div>

          {/* Collapsible Details */}
          <div>
            <button
              onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
              className="text-[11px] font-mono text-gray-400 hover:text-gray-200 flex items-center gap-1 cursor-pointer transition-colors"
            >
              {this.state.showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {this.state.showDetails ? 'Technische Diagnose verbergen' : 'Technische Diagnose anzeigen'}
            </button>

            {this.state.showDetails && (
              <pre className="mt-2 p-3 bg-black/90 border border-gray-800 rounded-lg text-[10px] font-mono text-gray-400 max-h-40 overflow-y-auto whitespace-pre-wrap select-all">
                {this.state.error?.stack || 'Kein Stack-Trace verfügbar.'}
                {this.state.errorInfo?.componentStack}
              </pre>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-800/80">
            {onClose && (
              <button
                onClick={onClose}
                className="px-3.5 py-2 rounded-xl bg-black/60 hover:bg-black/90 border border-gray-700 text-gray-300 font-serif text-xs font-bold transition-all cursor-pointer"
              >
                Schließen
              </button>
            )}
            <button
              onClick={this.handleReset}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 hover:brightness-110 text-black font-serif font-bold text-xs flex items-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.3)] transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Schnittstelle neu initialisieren
            </button>
          </div>
        </div>
      </div>
    );
  }
}
