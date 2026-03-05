CREATE TABLE asr_graph_store (
  id INTEGER NOT NULL PRIMARY KEY,
  payload CLOB(2M) NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  CONSTRAINT chk_asr_graph_store_id CHECK (id = 1)
);
