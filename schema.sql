CREATE TABLE IF NOT EXISTS devices (
 id TEXT PRIMARY KEY, secret TEXT NOT NULL, subscription TEXT NOT NULL,
 timezone TEXT NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
 device_id TEXT NOT NULL, id TEXT NOT NULL, title TEXT NOT NULL, due TEXT NOT NULL,
 time TEXT NOT NULL, repeat TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0,
 completed_dates TEXT NOT NULL DEFAULT '[]',
 PRIMARY KEY(device_id,id)
);
CREATE TABLE IF NOT EXISTS delivered (
 device_id TEXT NOT NULL, task_id TEXT NOT NULL, local_day TEXT NOT NULL,
 sent_at INTEGER NOT NULL, PRIMARY KEY(device_id,task_id,local_day)
);
CREATE INDEX IF NOT EXISTS tasks_by_device ON tasks(device_id);
