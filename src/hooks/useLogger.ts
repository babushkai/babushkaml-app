/**
 * React hook for using the enhanced logger
 * Provides convenient methods and automatic cleanup
 */

import { useEffect, useCallback, useRef } from 'react';
import { logger, type LogEntry } from '@/lib/logger';

interface UseLoggerOptions {
  componentName?: string;
  group?: string;
  enableAutoLogging?: boolean;
}

export function useLogger(options: UseLoggerOptions = {}) {
  const { componentName, group, enableAutoLogging = false } = options;
  const groupRef = useRef<string | null>(null);

  // Auto-logging for component lifecycle
  useEffect(() => {
    if (enableAutoLogging && componentName) {
      logger.info(`Component ${componentName} mounted`, undefined, { group });
    }
    return () => {
      if (enableAutoLogging && componentName) {
        logger.info(`Component ${componentName} unmounted`, undefined, { group });
      }
    };
  }, [componentName, group, enableAutoLogging]);

  // Start a log group
  const startGroup = useCallback((label: string, collapsed: boolean = false) => {
    groupRef.current = label;
    logger.group(label, collapsed);
  }, []);

  // End current log group
  const endGroup = useCallback(() => {
    if (groupRef.current) {
      logger.groupEnd();
      groupRef.current = null;
    }
  }, []);

  // Log methods with automatic group context
  const log = useCallback((level: LogEntry['level'], message: string, data?: any) => {
    const logGroup = group || groupRef.current || undefined;
    switch (level) {
      case 'debug':
        logger.debug(message, data, { group: logGroup });
        break;
      case 'info':
        logger.info(message, data, { group: logGroup });
        break;
      case 'warn':
        logger.warn(message, data, { group: logGroup });
        break;
      case 'error':
        logger.error(message, data, { group: logGroup });
        break;
    }
  }, [group]);

  const debug = useCallback((message: string, data?: any) => {
    logger.debug(message, data, { group: group || groupRef.current || undefined });
  }, [group]);

  const info = useCallback((message: string, data?: any) => {
    logger.info(message, data, { group: group || groupRef.current || undefined });
  }, [group]);

  const warn = useCallback((message: string, data?: any) => {
    logger.warn(message, data, { group: group || groupRef.current || undefined });
  }, [group]);

  const error = useCallback((message: string, data?: any) => {
    logger.error(message, data, { group: group || groupRef.current || undefined });
  }, [group]);

  // Performance timing
  const time = useCallback((label: string) => {
    logger.time(label, group || groupRef.current || undefined);
  }, [group]);

  const timeEnd = useCallback((label: string) => {
    logger.timeEnd(label);
  }, []);

  // Table logging
  const table = useCallback((data: any, columns?: string[]) => {
    logger.table(data, columns);
  }, []);

  // Subscribe to logs
  const subscribe = useCallback((listener: (entry: LogEntry) => void) => {
    return logger.subscribe(listener);
  }, []);

  return {
    log,
    debug,
    info,
    warn,
    error,
    time,
    timeEnd,
    table,
    startGroup,
    endGroup,
    subscribe,
    logger, // Direct access to logger instance
  };
}

