import { describe, it, expect } from 'vitest';
import { generateLinkedRiskRows } from './riskGraph.js';
import { mockRiskGraph } from '../data/mockRiskGraph.js';

describe('linked risk graph generation', () => {
  it('generates only linked A-T-V combinations', () => {
    const rows = generateLinkedRiskRows(mockRiskGraph);

    const combinations = rows.map((row) => `${row.assetId}/${row.threatId}/${row.vulnerabilityId}`);

    expect(combinations).toContain('A-API/T-CRED/V-IDOR');
    expect(combinations).toContain('A-BILLING/T-INSIDER/V-PRIV');

    expect(combinations).not.toContain('A-BILLING/T-CRED/V-IDOR');
  });

  it('applies relevant controls to row-level C via diminishing returns', () => {
    const rows = generateLinkedRiskRows(mockRiskGraph);
    const row = rows.find((item) =>
      item.assetId === 'A-BILLING' &&
      item.threatId === 'T-INSIDER' &&
      item.vulnerabilityId === 'V-PRIV'
    );

    expect(row).toBeTruthy();
    expect(row.controls).toContain('Network Segmentation');
    expect(row.controls).toContain('Privileged Admin Bastion');
    expect(row.C).toBeGreaterThan(0);
    expect(row.C).toBeLessThanOrEqual(1);
  });

  it('sorts rows by DLE descending', () => {
    const rows = generateLinkedRiskRows(mockRiskGraph);

    for (let index = 1; index < rows.length; index += 1) {
      expect(rows[index - 1].DLE).toBeGreaterThanOrEqual(rows[index].DLE);
    }
  });
});
