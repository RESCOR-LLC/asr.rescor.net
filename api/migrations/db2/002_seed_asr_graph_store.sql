MERGE INTO asr_graph_store AS target
USING (
  VALUES (
    1,
    '{"assets":[],"threats":[],"vulnerabilities":[],"controls":[],"links":{"assetThreat":[],"assetVulnerability":[],"threatVulnerability":[]}}',
    CURRENT TIMESTAMP
  )
) AS source (id, payload, updated_at)
ON target.id = source.id
WHEN NOT MATCHED THEN
  INSERT (id, payload, updated_at)
  VALUES (source.id, source.payload, source.updated_at);
