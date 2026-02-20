import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeAssetValueA,
  computeThreatT,
  computeVulnerabilityV,
  computeControlEffective,
  computeControlEfficacy
} from '../src/domain/stormRsk.js';
import { computeLossExpectancies } from '../src/domain/lossExpectancy.js';
import { legacyAsrScenarios } from '../src/domain/fixtures/legacyAsrScenarios.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const reportPath = path.resolve(__dirname, '../reports/legacy-parity-report.json');

function round(value, digits = 10) {
  return Number(Number(value).toFixed(digits));
}

function computeScenario(name, scenario) {
  const AResult = computeAssetValueA(scenario.asset);
  const TResult = computeThreatT(scenario.threat);
  const VResult = computeVulnerabilityV(scenario.vulnerability);

  const controlEffectives = scenario.controls.map((control) =>
    computeControlEffective(control)
  );

  const C = computeControlEfficacy(controlEffectives);

  const loss = computeLossExpectancies({
    assetValue: AResult.value,
    threatProbability: TResult.probability,
    vulnerabilitySeverity: VResult.value,
    controlEfficacy: 0,
    controlEffectives
  });

  return {
    scenario: name,
    inputs: scenario,
    transforms: {
      A: round(AResult.value),
      T: round(TResult.probability),
      T_impact: round(TResult.impact),
      V: round(VResult.value),
      C: round(C)
    },
    loss: {
      SLE: round(loss.SLE),
      DLE: round(loss.DLE)
    }
  };
}

function buildReport() {
  const scenarios = Object.keys(legacyAsrScenarios)
    .sort()
    .map((scenarioName) =>
      computeScenario(scenarioName, legacyAsrScenarios[scenarioName])
    );

  return {
    schemaVersion: 1,
    description: 'Legacy-shaped STORM/RSK parity snapshot for ASR migration',
    scenarios
  };
}

function stableStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function main() {
  const checkMode = process.argv.includes('--check');
  const report = buildReport();
  const serialized = stableStringify(report);

  await fs.mkdir(path.dirname(reportPath), { recursive: true });

  if (checkMode) {
    let existing = null;

    try {
      existing = await fs.readFile(reportPath, 'utf8');
    } catch {
      existing = null;
    }

    if (existing !== serialized) {
      console.error('Legacy parity report drift detected. Run: npm run parity:report');
      process.exit(1);
    }

    console.log('Legacy parity report is up to date.');
    return;
  }

  await fs.writeFile(reportPath, serialized, 'utf8');
  console.log(`Wrote ${reportPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
