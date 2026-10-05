const fs = require('fs');
const path = require('path');

const IMAGES_DIR = path.join(__dirname, 'images');
const INDEX_HTML = path.join(__dirname, 'index.html');

// Known sports list for categorization if no prefix is given
const KNOWN_SPORTS = [
  'windsurfing', 'netball', 'water polo', 'gymnastics',
  'archery', 'squash', 'badminton', 'football', 'tennis',
  'american football', 'ice hockey', 'karate', 'formula 1',
  'table tennis', 'bowling', 'wrestling', 'triathlon',
  'cricket', 'swimming', 'polo', 'basketball', 'rugby', 'chess',
  'volleyball', 'baseball', 'weightlifting', 'shooting'
];

// Title casing with preservation for lowercase connector words
function formatTitleCase(str) {
  const lowerWords = ['and', 'of', 'the', 'in', 'on', 'at', 'to', 'for', 'with', 'a', 'an'];
  return str
    .split(/\s+/)
    .map((word, idx) => {
      const wLower = word.toLowerCase();
      if (idx !== 0 && lowerWords.includes(wLower)) {
        return wLower;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function parseImageFilename(filename) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);

  let type = null;
  let rawName = base;

  if (base.toLowerCase().startsWith('personality_') || base.toLowerCase().startsWith('personality-')) {
    type = 'personality';
    rawName = base.slice(12);
  } else if (base.toLowerCase().startsWith('sport_') || base.toLowerCase().startsWith('sport-')) {
    type = 'sport';
    rawName = base.slice(6);
  } else if (/^p\d+[_-]/i.test(base)) {
    type = 'personality';
    rawName = base.replace(/^p\d+[_-]/i, '');
  } else if (/^s\d+[_-]/i.test(base)) {
    type = 'sport';
    rawName = base.replace(/^s\d+[_-]/i, '');
  }

  let cleanName = rawName.replace(/[_-]+/g, ' ').trim();

  // If cleanName is just a number or empty, flag as Unnamed
  if (/^\d+$/.test(cleanName) || !cleanName) {
    return {
      filename,
      type: type || 'personality',
      section: type === 'sport' ? 'Sport' : 'Personality',
      answer: 'Unnamed',
      isUnclear: true
    };
  }

  // Auto-detect type if not prefixed
  if (!type) {
    const checkLower = cleanName.toLowerCase();
    if (KNOWN_SPORTS.some(s => checkLower.includes(s))) {
      type = 'sport';
    } else {
      type = 'personality';
    }
  }

  const formattedName = formatTitleCase(cleanName);

  return {
    filename,
    type,
    section: type === 'sport' ? 'Sport' : 'Personality',
    answer: formattedName,
    isUnclear: false
  };
}

function scanImagesFolder() {
  if (!fs.existsSync(IMAGES_DIR)) {
    console.error('images/ directory not found.');
    return null;
  }

  const files = fs.readdirSync(IMAGES_DIR);
  const validExts = ['.png', '.jpg', '.jpeg', '.webp'];

  const round3Items = [];
  const duplicates = [];
  const unclear = [];
  const seenAnswers = new Map();

  // Original personalities to keep first (Sushil Kumar removed)
  const originalPersonalityOrder = ['LeBron James', 'Usain Bolt', 'Muttiah Muralitharan'];
  // Original 4 sports
  const originalSportOrder = ['Windsurfing', 'Netball', 'Water Polo', 'Gymnastics'];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!validExts.includes(ext)) continue;

    // Ignore Round 1 rebus files: 1.png to 13.png
    if (/^\d+\.png$/i.test(file)) {
      const num = parseInt(file, 10);
      if (num >= 1 && num <= 13) continue;
    }

    const parsed = parseImageFilename(file);
    if (parsed.isUnclear) {
      unclear.push(parsed);
    }

    const key = parsed.answer.toLowerCase();
    // Exclude sushil kumar if present in folder
    if (key === 'sushil kumar' || key === 'sunil kumar') {
      continue;
    }

    if (seenAnswers.has(key)) {
      duplicates.push({ kept: seenAnswers.get(key), duplicateFile: file });
      continue;
    }

    seenAnswers.set(key, file);
    round3Items.push({
      type: parsed.type,
      section: parsed.section,
      question: parsed.type === 'sport' ? 'Identify this sport from the image:' : 'Name this legendary sports personality:',
      image: `images/${file}`,
      options: [],
      answer: parsed.answer,
      rules: parsed.isUnclear ? '⚠️ Unnamed item — please check filename' : ''
    });
  }

  let personalities = round3Items.filter(i => i.type === 'personality');
  let sports = round3Items.filter(i => i.type === 'sport');

  // Sort personalities: original first, then alphabetical/rest
  personalities.sort((a, b) => {
    const idxA = originalPersonalityOrder.indexOf(a.answer);
    const idxB = originalPersonalityOrder.indexOf(b.answer);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.answer.localeCompare(b.answer);
  });

  // Sort sports: original first, then rest
  sports.sort((a, b) => {
    const idxA = originalSportOrder.indexOf(a.answer);
    const idxB = originalSportOrder.indexOf(b.answer);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.answer.localeCompare(b.answer);
  });

  const finalQuestions = [...personalities, ...sports];

  console.log(`\n==================================================`);
  console.log(`  SCAN REPORT FOR ROUND 3: PERSONALITY & SPORT`);
  console.log(`==================================================`);
  console.log(`Total files scanned: ${files.length}`);
  console.log(`Personalities found: ${personalities.length}`);
  console.log(`Sports found:        ${sports.length}`);
  console.log(`Total questions:     ${finalQuestions.length}`);

  if (duplicates.length > 0) {
    console.log(`\n⚠️  Duplicates skipped:`);
    duplicates.forEach(d => console.log(` - Skipped "${d.duplicateFile}" (kept "${d.kept}")`));
  } else {
    console.log(`\n✓ No duplicate filenames found.`);
  }

  if (unclear.length > 0) {
    console.log(`\n⚠️  Unclear filenames (marked Unnamed):`);
    unclear.forEach(u => console.log(` - "${u.filename}"`));
  } else {
    console.log(`✓ No unclear filenames.`);
  }

  console.log(`\nFinal Item List:`);
  finalQuestions.forEach((q, i) => {
    console.log(` ${String(i + 1).padStart(2, ' ')}. [${q.section.padEnd(11, ' ')}] ${q.answer.padEnd(34, ' ')} (${q.image})`);
  });
  console.log(`==================================================\n`);

  return { finalQuestions, personalities, sports, duplicates, unclear };
}

function updateIndexHtml(round3Questions) {
  if (!fs.existsSync(INDEX_HTML)) {
    console.error('index.html not found.');
    return;
  }

  let html = fs.readFileSync(INDEX_HTML, 'utf8');

  const r3Regex = /(id:\s*["']round-3["'][\s\S]*?questions:\s*)\[[\s\S]*?\](\s*\}\s*\];)/;

  if (r3Regex.test(html)) {
    const newQuestionsJson = JSON.stringify(round3Questions, null, 6)
      .replace(/^{\n\s+/gm, '{\n        ')
      .replace(/^    \}/gm, '      }');

    html = html.replace(r3Regex, `$1${newQuestionsJson}$2`);
    fs.writeFileSync(INDEX_HTML, html, 'utf8');
    console.log('✓ Successfully updated Round 3 questions in index.html!\n');
  } else {
    console.warn('Could not locate Round 3 regex pattern in index.html.');
  }
}

if (require.main === module) {
  const result = scanImagesFolder();
  if (result && result.finalQuestions) {
    updateIndexHtml(result.finalQuestions);
  }
}

module.exports = { scanImagesFolder, updateIndexHtml };
