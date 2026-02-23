export const mockRiskGraph = {
  assets: [
    { id: 'A-API', name: 'Customer API', assetShare: 0.04 },
    { id: 'A-BILLING', name: 'Billing Engine', assetShare: 0.07 }
  ],
  threats: [
    {
      id: 'T-CRED',
      name: 'Credential Stuffing',
      category: 'Network',
      history: 5,
      access: 2,
      means: 1,
      probability: 0.2222,
      impact: 0.2222
    },
    {
      id: 'T-INSIDER',
      name: 'Insider Abuse',
      category: 'Human',
      history: 3,
      access: 2,
      means: 1,
      probability: 0.1333,
      impact: 0.2222
    }
  ],
  vulnerabilities: [
    { id: 'V-IDOR', name: 'IDOR Exposure', severity: 0.62 },
    { id: 'V-SECRETS', name: 'Secrets Misconfiguration', severity: 0.51 },
    { id: 'V-PRIV', name: 'Privileged Endpoint Exposure', severity: 0.74 }
  ],
  controls: [
    {
      id: 'C-MFA',
      name: 'Mandatory MFA',
      implemented: 0.8,
      correction: 0.6,
      appliesToThreatIds: ['T-CRED']
    },
    {
      id: 'C-SEGMENT',
      name: 'Network Segmentation',
      implemented: 0.7,
      correction: 0.4,
      appliesToAssetIds: ['A-BILLING']
    },
    {
      id: 'C-IDOR-FIX',
      name: 'Object Access Validation',
      implemented: 0.9,
      correction: 0.5,
      appliesToVulnerabilityIds: ['V-IDOR']
    },
    {
      id: 'C-PAIR',
      name: 'Privileged Admin Bastion',
      implemented: 0.6,
      correction: 0.5,
      appliesToPairs: [{ threatId: 'T-INSIDER', vulnerabilityId: 'V-PRIV' }]
    }
  ],
  links: {
    assetThreat: [
      { assetId: 'A-API', threatId: 'T-CRED' },
      { assetId: 'A-API', threatId: 'T-INSIDER' },
      { assetId: 'A-BILLING', threatId: 'T-INSIDER' }
    ],
    assetVulnerability: [
      { assetId: 'A-API', vulnerabilityId: 'V-IDOR' },
      { assetId: 'A-API', vulnerabilityId: 'V-SECRETS' },
      { assetId: 'A-BILLING', vulnerabilityId: 'V-PRIV' },
      { assetId: 'A-BILLING', vulnerabilityId: 'V-SECRETS' }
    ],
    threatVulnerability: [
      { threatId: 'T-CRED', vulnerabilityId: 'V-IDOR' },
      { threatId: 'T-CRED', vulnerabilityId: 'V-SECRETS' },
      { threatId: 'T-INSIDER', vulnerabilityId: 'V-PRIV' },
      { threatId: 'T-INSIDER', vulnerabilityId: 'V-SECRETS' }
    ]
  }
};
