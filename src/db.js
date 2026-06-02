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
