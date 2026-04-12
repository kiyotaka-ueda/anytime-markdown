// domain/model/task.ts — Release file and feature row types

// Database row types (snake_case, maps to SQLite columns)

export interface ReleaseFileRow {
  readonly release_tag: string;
  readonly file_path: string;
  readonly lines_added: number;
  readonly lines_deleted: number;
  readonly change_type: string;
}

export interface ReleaseFeatureRow {
  readonly release_tag: string;
  readonly feature_id: string;
  readonly feature_name: string;
  readonly role: string;
}
