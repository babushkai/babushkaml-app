/**
 * Logger implementation
 * Provides logging functionality with grouping, timing, and export
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
  source?: string;
  group?: string;
  stack?: string;
  duration?: number;
}

interface PerformanceTimer {
  label: string;
  startTime: number;
  group?: string;
}

class Logger {
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private listeners: ((entry: LogEntry) => void)[] = [];
  private timers: Map<string, PerformanceTimer> = new Map();
  private groups: Map<string, LogEntry[]> = new Map();
  private currentGroup: string | null = null;

  private log(level: LogLevel, message: string, data?: any, options?: { group?: string; source?: string }) {
    const entry: LogEntry = {
      level,
      message,
      data,
      timestamp: new Date().toISOString(),
      source: options?.source,
      group: options?.group || this.currentGroup || undefined,
    };

    // Console output
    const consoleMethod = level === 'error' ? console.error :
                          level === 'warn' ? console.warn :
                          console.log;
    consoleMethod(`[${level.toUpperCase()}] ${message}`, data || '');

    // Store log
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Add to group if grouping is enabled
    if (entry.group) {
      if (!this.groups.has(entry.group)) {
        this.groups.set(entry.group, []);
      }
      this.groups.get(entry.group)!.push(entry);
    }

    // Notify listeners
    this.listeners.forEach((listener) => listener(entry));
  }

  debug(message: string, data?: any, options?: { group?: string; source?: string }) {
    this.log('debug', message, data, options);
  }

  info(message: string, data?: any, options?: { group?: string; source?: string }) {
    this.log('info', message, data, options);
  }

  warn(message: string, data?: any, options?: { group?: string; source?: string }) {
    this.log('warn', message, data, options);
  }

  error(message: string, data?: any, options?: { group?: string; source?: string }) {
    this.log('error', message, data, options);
  }

  group(label: string, collapsed: boolean = false) {
    this.currentGroup = label;
    if (collapsed) {
      console.groupCollapsed(label);
    } else {
      console.group(label);
    }
  }

  groupEnd() {
    this.currentGroup = null;
    console.groupEnd();
  }

  time(label: string, group?: string): void {
    this.timers.set(label, {
      label,
      startTime: performance.now(),
      group: group || this.currentGroup || undefined,
    });
  }

  timeEnd(label: string): void {
    const timer = this.timers.get(label);
    if (!timer) {
      this.warn(`Timer "${label}" was not started`);
      return;
    }

    const duration = performance.now() - timer.startTime;
    this.timers.delete(label);

    const durationStr = duration < 1000 
      ? `${duration.toFixed(2)}ms` 
      : `${(duration / 1000).toFixed(2)}s`;

    this.info(`⏱️ ${timer.label}`, { duration: durationStr, durationMs: duration }, {
      group: timer.group,
    });
  }

  table(data: any, columns?: string[]) {
    if (Array.isArray(data) && data.length > 0) {
      console.table(data, columns);
    } else {
      console.table(data);
    }
  }

  getLogs(filter?: { level?: LogLevel; group?: string; search?: string }): LogEntry[] {
    let filtered = [...this.logs];

    if (filter) {
      if (filter.level) {
        filtered = filtered.filter(entry => entry.level === filter.level);
      }
      if (filter.group) {
        filtered = filtered.filter(entry => entry.group === filter.group);
      }
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        filtered = filtered.filter(entry =>
          entry.message.toLowerCase().includes(searchLower) ||
          entry.source?.toLowerCase().includes(searchLower) ||
          JSON.stringify(entry.data).toLowerCase().includes(searchLower)
        );
      }
    }

    return filtered;
  }

  getLogsByGroup(group: string): LogEntry[] {
    return this.groups.get(group) || [];
  }

  getGroups(): string[] {
    return Array.from(this.groups.keys());
  }

  getStats() {
    const stats = {
      total: this.logs.length,
      byLevel: {
        debug: 0,
        info: 0,
        warn: 0,
        error: 0,
      },
      byGroup: {} as Record<string, number>,
      errors: this.logs.filter(l => l.level === 'error').length,
      warnings: this.logs.filter(l => l.level === 'warn').length,
    };

    this.logs.forEach(entry => {
      stats.byLevel[entry.level]++;
      if (entry.group) {
        stats.byGroup[entry.group] = (stats.byGroup[entry.group] || 0) + 1;
      }
    });

    return stats;
  }

  clear() {
    this.logs = [];
    this.groups.clear();
    console.clear();
  }

  exportLogs(format: 'json' | 'text' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.logs, null, 2);
    } else {
      return this.logs.map(entry => {
        const parts = [
          entry.timestamp,
          `[${entry.level.toUpperCase()}]`,
          entry.group ? `[${entry.group}]` : '',
          entry.source ? `(${entry.source})` : '',
          entry.message,
          entry.data ? JSON.stringify(entry.data) : '',
        ].filter(Boolean);
        return parts.join(' ');
      }).join('\n');
    }
  }

  downloadLogs(filename: string = `logs-${Date.now()}.json`) {
    const content = this.exportLogs('json');
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  subscribe(listener: (entry: LogEntry) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}

export const logger = new Logger();

// Make logger available globally in development
if (import.meta.env.DEV) {
  (window as any).logger = logger;
}
