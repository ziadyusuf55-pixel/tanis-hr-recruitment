import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// 1. Check existing indexes
const [indexes] = await conn.query(`SHOW INDEX FROM cycle_stats`);
console.log('\n=== Current indexes on cycle_stats ===');
for (const idx of indexes) {
  console.log(`  ${idx.Key_name} | col: ${idx.Column_name} | unique: ${idx.Non_unique === 0 ? 'YES' : 'NO'} | seq: ${idx.Seq_in_index}`);
}

const hasUniqueConstraint = indexes.some(
  idx => idx.Non_unique === 0 && idx.Column_name === 'crdts'
) && indexes.some(
  idx => idx.Non_unique === 0 && idx.Column_name === 'date'
);

// More precise: check for a composite unique index covering both crdts and date
const indexGroups = {};
for (const idx of indexes) {
  if (!indexGroups[idx.Key_name]) indexGroups[idx.Key_name] = [];
  indexGroups[idx.Key_name].push(idx);
}

let hasCompositUnique = false;
for (const [name, cols] of Object.entries(indexGroups)) {
  const colNames = cols.map(c => c.Column_name);
  const isUnique = cols[0].Non_unique === 0;
  if (isUnique && colNames.includes('crdts') && colNames.includes('date')) {
    hasCompositUnique = true;
    console.log(`\n✅ Composite unique index "${name}" on (crdts, date) already exists.`);
  }
}

// 2. Count duplicates
const [dupRows] = await conn.query(`
  SELECT crdts, date, COUNT(*) as cnt
  FROM cycle_stats
  GROUP BY crdts, date
  HAVING cnt > 1
`);

console.log(`\n=== Duplicate check ===`);
if (dupRows.length === 0) {
  console.log('✅ No duplicates found.');
} else {
  const totalDups = dupRows.reduce((sum, r) => sum + (r.cnt - 1), 0);
  console.log(`⚠️  Found ${dupRows.length} (crdts, date) pairs with duplicates — ${totalDups} extra rows to remove.`);
  for (const r of dupRows.slice(0, 10)) {
    console.log(`   CRDTS=${r.crdts} date=${r.date} count=${r.cnt}`);
  }
  if (dupRows.length > 10) console.log(`   ... and ${dupRows.length - 10} more`);

  // 3. De-duplicate: keep the row with the highest id (most recently inserted)
  console.log('\nRemoving duplicates (keeping highest id per crdts+date)...');
  const [delResult] = await conn.query(`
    DELETE cs FROM cycle_stats cs
    INNER JOIN (
      SELECT crdts, date, MAX(id) AS keep_id
      FROM cycle_stats
      GROUP BY crdts, date
      HAVING COUNT(*) > 1
    ) keep ON cs.crdts = keep.crdts AND cs.date = keep.date AND cs.id != keep.keep_id
  `);
  console.log(`✅ Removed ${delResult.affectedRows} duplicate rows.`);
}

// 4. Add unique index if not present
if (!hasCompositUnique) {
  console.log('\nAdding unique index on (crdts, date)...');
  try {
    await conn.query(`ALTER TABLE cycle_stats ADD UNIQUE INDEX uq_cycle_stats_crdts_date (crdts, date)`);
    console.log('✅ Unique index uq_cycle_stats_crdts_date added successfully.');
  } catch (e) {
    console.error('❌ Failed to add index:', e.message);
  }
} else {
  console.log('\nSkipping index creation — already exists.');
}

await conn.end();
console.log('\nDone.');
