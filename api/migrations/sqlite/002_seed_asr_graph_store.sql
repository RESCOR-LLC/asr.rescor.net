INSERT INTO asr_graph_store (id, payload, updated_at)
VALUES (
  1,
  '{"assets":[],"threats":[],"vulnerabilities":[],"controls":[],"links":{"assetThreat":[],"assetVulnerability":[],"threatVulnerability":[]}}',
  CURRENT_TIMESTAMP
)
ON CONFLICT(id) DO NOTHING;
