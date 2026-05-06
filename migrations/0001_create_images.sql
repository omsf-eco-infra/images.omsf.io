CREATE TABLE IF NOT EXISTS images (
  name TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  ami_id TEXT NOT NULL,
  docker_image TEXT NOT NULL,
  package_versions_json TEXT NOT NULL,
  image_json_url TEXT NOT NULL,
  image_json_key TEXT NOT NULL,
  pixi_lock_key TEXT NOT NULL,
  artifact_index_json TEXT NOT NULL,
  source_repository TEXT NOT NULL,
  source_workflow TEXT NOT NULL,
  source_run_id TEXT NOT NULL,
  source_sha TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_images_timestamp ON images(timestamp DESC);
