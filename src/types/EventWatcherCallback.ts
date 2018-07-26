import { LogEntry } from '@marketprotocol/types';

export interface LogEntryEvent extends LogEntry {
  removed: boolean;
}
export type EventWatcherCallback = (err: null | Error, log?: LogEntryEvent) => void;
