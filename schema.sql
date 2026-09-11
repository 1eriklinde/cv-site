-- One row, one number. No address, no agent, no timestamp: there is nothing
-- here that could be traced back to a person, by design.
CREATE TABLE IF NOT EXISTS hits (
  k TEXT PRIMARY KEY,
  n INTEGER NOT NULL DEFAULT 0
);
