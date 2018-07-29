import { LogEntry } from '@marketprotocol/types';

export interface LogEntryEvent extends LogEntry {
  removed: boolean;
}

// similar to LogEntry but unparsed. Every parameter is a string
export interface RawLogEntry {
  logIndex: string | null;
  transactionIndex: string | null;
  transactionHash: string;
  blockHash: string | null;
  blockNumber: number | null;
  address: string;
  data: string;
  topics: string[];
}

export type EventWatcherCallback = (err: null | Error, log?: LogEntryEvent) => void;
