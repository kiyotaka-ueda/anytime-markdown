export interface DbLogger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string, err?: unknown): void;
}

export const noopDbLogger: DbLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};
