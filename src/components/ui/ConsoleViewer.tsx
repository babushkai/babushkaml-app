/**
 * Enhanced Console Viewer Component
 * Displays logs with beautiful styling, filtering, and search capabilities
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { logger, type LogEntry } from '@/lib/logger';
import { Search, Download, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from './Button';

interface ConsoleViewerProps {
  maxHeight?: string;
  showControls?: boolean;
  autoScroll?: boolean;
  filterLevel?: 'debug' | 'info' | 'warn' | 'error' | null;
  filterGroup?: string | null;
  className?: string;
}

export function ConsoleViewer({
  maxHeight = '400px',
  showControls = true,
  autoScroll = true,
  filterLevel = null,
  filterGroup = null,
  className = '',
}: ConsoleViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<LogEntry['level'] | 'all'>('all');
  const [selectedGroup, setSelectedGroup] = useState<string | 'all'>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState(logger.getStats());
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get logs from logger
  useEffect(() => {
    const unsubscribe = logger.subscribe(() => {
      setLogs(logger.getLogs());
      setStats(logger.getStats());
    });

    // Initial load
    setLogs(logger.getLogs());
    setStats(logger.getStats());

    return unsubscribe;
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    let filtered = logs;

    // Apply level filter
    if (selectedLevel !== 'all') {
      filtered = filtered.filter(log => log.level === selectedLevel);
    }

    // Apply group filter
    if (selectedGroup !== 'all') {
      filtered = filtered.filter(log => log.group === selectedGroup);
    }

    // Apply search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(log =>
        log.message.toLowerCase().includes(query) ||
        log.source?.toLowerCase().includes(query) ||
        JSON.stringify(log.data).toLowerCase().includes(query)
      );
    }

    // Apply external filters
    if (filterLevel) {
      filtered = filtered.filter(log => log.level === filterLevel);
    }
    if (filterGroup) {
      filtered = filtered.filter(log => log.group === filterGroup);
    }

    return filtered;
  }, [logs, selectedLevel, selectedGroup, searchQuery, filterLevel, filterGroup]);

  // Group logs by group name
  const groupedLogs = useMemo(() => {
    const groups: Record<string, LogEntry[]> = {};
    const ungrouped: LogEntry[] = [];

    filteredLogs.forEach(log => {
      if (log.group) {
        if (!groups[log.group]) {
          groups[log.group] = [];
        }
        groups[log.group].push(log);
      } else {
        ungrouped.push(log);
      }
    });

    return { groups, ungrouped };
  }, [filteredLogs]);

  const getLevelColor = (level: LogEntry['level']) => {
    const colors = {
      debug: 'text-gray-400 bg-gray-900/50',
      info: 'text-blue-400 bg-blue-900/20',
      warn: 'text-yellow-400 bg-yellow-900/20',
      error: 'text-red-400 bg-red-900/20',
    };
    return colors[level];
  };

  const getLevelIcon = (level: LogEntry['level']) => {
    const icons = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
    };
    return icons[level];
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${hours}:${minutes}:${seconds}.${ms}`;
  };

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  const handleClear = () => {
    logger.clear();
    setLogs([]);
    setStats(logger.getStats());
  };

  const handleDownload = () => {
    logger.downloadLogs();
  };

  const groups = logger.getGroups();

  return (
    <div className={`flex flex-col bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-lg overflow-hidden ${className}`}>
      {/* Controls */}
      {showControls && (
        <div className="flex items-center gap-2 p-3 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-subtle)]" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            />
          </div>

          {/* Level Filter */}
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value as LogEntry['level'] | 'all')}
            className="px-3 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <option value="all">All Levels</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>

          {/* Group Filter */}
          {groups.length > 0 && (
            <select
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              className="px-3 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              <option value="all">All Groups</option>
              {groups.map(group => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
          )}

          {/* Stats */}
          <div className="flex items-center gap-2 text-xs text-[var(--text-subtle)]">
            <span className={stats.errors > 0 ? 'text-red-400 font-semibold' : ''}>
              {stats.errors} errors
            </span>
            <span className={stats.warnings > 0 ? 'text-yellow-400 font-semibold' : ''}>
              {stats.warnings} warnings
            </span>
            <span>{stats.total} total</span>
          </div>

          {/* Actions */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            title="Download logs"
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            title="Clear logs"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Logs Display */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto font-mono text-xs"
        style={{ maxHeight }}
      >
        {filteredLogs.length === 0 ? (
          <div className="p-4 text-center text-[var(--text-subtle)]">
            No logs to display
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {/* Grouped logs */}
            {Object.entries(groupedLogs.groups).map(([group, groupLogs]) => (
              <div key={group} className="border border-[var(--border-primary)] rounded-md overflow-hidden">
                <button
                  onClick={() => toggleGroup(group)}
                  className="w-full px-3 py-2 flex items-center justify-between bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {expandedGroups.has(group) ? (
                      <ChevronDown className="w-4 h-4 text-[var(--text-subtle)]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[var(--text-subtle)]" />
                    )}
                    <span className="text-purple-400 font-semibold">📁 {group}</span>
                    <span className="text-xs text-[var(--text-subtle)]">({groupLogs.length})</span>
                  </div>
                </button>
                {expandedGroups.has(group) && (
                  <div className="divide-y divide-[var(--border-primary)]">
                    {groupLogs.map((log, idx) => (
                      <LogEntryItem key={idx} log={log} formatTimestamp={formatTimestamp} getLevelColor={getLevelColor} getLevelIcon={getLevelIcon} />
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Ungrouped logs */}
            {groupedLogs.ungrouped.map((log, idx) => (
              <LogEntryItem key={idx} log={log} formatTimestamp={formatTimestamp} getLevelColor={getLevelColor} getLevelIcon={getLevelIcon} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface LogEntryItemProps {
  log: LogEntry;
  formatTimestamp: (ts: string) => string;
  getLevelColor: (level: LogEntry['level']) => string;
  getLevelIcon: (level: LogEntry['level']) => string;
}

function LogEntryItem({ log, formatTimestamp, getLevelColor, getLevelIcon }: LogEntryItemProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`px-3 py-2 hover:bg-[var(--bg-secondary)] transition-colors ${getLevelColor(log.level)}`}>
      <div className="flex items-start gap-2">
        {/* Timestamp */}
        <span className="text-[var(--text-subtle)] text-[10px] flex-shrink-0 w-16">
          {formatTimestamp(log.timestamp)}
        </span>

        {/* Level Badge */}
        <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase">
          {getLevelIcon(log.level)} {log.level}
        </span>

        {/* Source */}
        {log.source && (
          <span className="text-[var(--text-subtle)] text-[10px] flex-shrink-0">
            {log.source}
          </span>
        )}

        {/* Message */}
        <span className="flex-1">{log.message}</span>

        {/* Expand button for data */}
        {log.data !== undefined && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[var(--text-subtle)] hover:text-[var(--text-primary)] flex-shrink-0"
          >
            {expanded ? '▼' : '▶'}
          </button>
        )}
      </div>

      {/* Stack trace */}
      {log.stack && (
        <div className="mt-2 ml-4 text-[10px] text-red-300 whitespace-pre-wrap font-mono">
          {log.stack}
        </div>
      )}

      {/* Data */}
      {expanded && log.data !== undefined && (
        <div className="mt-2 ml-4 p-2 bg-black/30 rounded text-[10px] overflow-x-auto">
          <pre className="whitespace-pre-wrap">
            {typeof log.data === 'object' && !(log.data instanceof Error)
              ? JSON.stringify(log.data, null, 2)
              : String(log.data)}
          </pre>
        </div>
      )}

      {/* Duration */}
      {log.duration && (
        <div className="mt-1 ml-4 text-[10px] text-[var(--text-subtle)]">
          ⏱️ Duration: {log.duration}ms
        </div>
      )}
    </div>
  );
}

