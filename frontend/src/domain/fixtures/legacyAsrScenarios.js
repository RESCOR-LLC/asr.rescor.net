export const legacyAsrScenarios = {
  baselineTarLike: {
    asset: {
      dataClassification: 2,
      users: 3,
      highValueSelections: [3, 6]
    },
    threat: {
      history: 4,
      access: 2,
      means: 3
    },
    vulnerability: {
      capabilities: 2,
      resources: 2,
      visibility: 3,
      confidentialityExposure: 3,
      integrityExposure: 2,
      availabilityExposure: 2
    },
    controls: [
      { implemented: 0.75, correction: 0.5 },
      { implemented: 0.5, correction: 0.25 }
    ]
  },
  noControlsHighRisk: {
    asset: {
      dataClassification: 3,
      users: 5,
      highValueSelections: [8, 7]
    },
    threat: {
      history: 5,
      access: 3,
      means: 3
    },
    vulnerability: {
      capabilities: 3,
      resources: 3,
      visibility: 3,
      confidentialityExposure: 3,
      integrityExposure: 3,
      availabilityExposure: 3
    },
    controls: []
  }
};
