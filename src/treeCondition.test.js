import { describe, it, expect } from 'vitest';
import { calculateFieldInsights } from './services/analytics';
import { generateSessionReport } from './services/reports';

describe('Tree Condition Support & Validation', () => {
  const sampleMeasurements = [
    { id: 1, treeNo: 1, girth: 20, girthCm: 50.8, treeCondition: 'healthy', syncStatus: 'synced' },
    { id: 2, treeNo: 2, girth: 22, girthCm: 55.88, treeCondition: 'healthy', syncStatus: 'synced' },
    { id: 3, treeNo: 3, girth: 12, girthCm: 30.48, treeCondition: 'runt', syncStatus: 'pending' },
    { id: 4, treeNo: 4, girth: null, girthCm: null, treeCondition: 'dead', conditionNote: 'Fallen tree', syncStatus: 'pending' },
    { id: 5, treeNo: 5, girth: null, girthCm: null, treeCondition: 'damaged', conditionNote: 'Elephant attack', syncStatus: 'pending' },
  ];

  it('correctly calculates field insights excluding dead/damaged from girth averages', () => {
    const insights = calculateFieldInsights(sampleMeasurements);
    expect(insights).not.toBeNull();
    expect(insights.total).toBe(5);
    expect(insights.totalMeasurable).toBe(3); // healthy (20, 22) + runt (12)
    expect(insights.healthyCount).toBe(2);
    expect(insights.runtCount).toBe(1);
    expect(insights.deadCount).toBe(1);
    expect(insights.damagedCount).toBe(1);
    // Average of 20, 22, 12 = 54 / 3 = 18
    expect(insights.avg).toBe(18);
    expect(insights.min).toBe(12);
    expect(insights.max).toBe(22);
  });

  it('correctly generates session reports with tree condition counts', () => {
    const report = generateSessionReport({
      estate: 'Kiribathgala',
      division: 'North',
      fieldNo: 'DG20',
      extent: 15.5,
      operatorName: 'Saman',
      sessionId: 'sess-1',
      sessionStartedAt: new Date().toISOString(),
      sessionLocation: '6.9,80.2',
      measurements: sampleMeasurements,
    });

    expect(report.total).toBe(5);
    expect(report.totalMeasurable).toBe(3);
    expect(report.healthyCount).toBe(2);
    expect(report.runtCount).toBe(1);
    expect(report.deadCount).toBe(1);
    expect(report.damagedCount).toBe(1);
    expect(report.avg).toBe(18);
  });
});
