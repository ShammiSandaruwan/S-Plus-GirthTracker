import Dexie from 'dexie';

export const db = new Dexie('GirthTrackerDB');

db.version(1).stores({
  measurements: '++id, estate, division, fieldNo, extent, treeNo, caliperReading, girth, timestamp, syncStatus',
  settings: 'id, estate, division, fieldNo, extent, treeNo'
});

db.version(2).stores({
  measurements: '++id, syncStatus, [estate+fieldNo]',
  settings: 'id'
});

db.version(3).stores({
  measurements: '++id, syncStatus, [estate+fieldNo], sessionId, timestamp, abnormalFlag, recommendationStatus',
  settings: 'id, estate, deviceId, accessStatus'
});

db.version(4).stores({
  measurements: '++id, syncStatus, [estate+fieldNo], sessionId, timestamp, abnormalFlag, recommendationStatus, [estate+division+fieldNo+extent+treeNo]',
  settings: 'id, estate, deviceId, accessStatus'
});

db.version(5).stores({
  measurements: '++id, syncStatus, [estate+fieldNo], sessionId, timestamp, abnormalFlag, recommendationStatus, [estate+division+fieldNo+extent+treeNo]',
  settings: 'id, estate, deviceId, accessStatus',
  fieldConfig: 'id'
});

db.version(6).stores({
  measurements: '++id, syncStatus, [estate+fieldNo], sessionId, timestamp, abnormalFlag, recommendationStatus, [estate+division+fieldNo+extent+treeNo], [fieldId+treeNo]',
  settings: 'id, estate, deviceId, accessStatus',
  fieldConfig: 'id'
});

