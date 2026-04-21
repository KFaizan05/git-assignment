<?php
// POST /php/api/save_language.php
// Body: { "language": "English" | "Español" | "Français" }
//
// Tiny dedicated endpoint so the Settings language picker can save without
// having to re-send the full profile (name + dietary + allergens). Keeps
// the call at ~20 bytes round-trip.

require __DIR__ . '/_common.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_fail('POST required', 405);

$accountId = require_login();
$body = read_json_body();

$language = trim((string) ($body['language'] ?? ''));

// Whitelist the three languages the front-end's i18n module knows about;
// anything else would render as English anyway, so reject early instead of
// silently poisoning the DB with unsupported values.
$ALLOWED = ['English', 'Español', 'Français'];
if (!in_array($language, $ALLOWED, true)) {
    json_fail('Unsupported language.');
}

// Upsert so legacy accounts that don't have a profile row yet still save
// cleanly. Matches the same-shape INSERT ... ON DUPLICATE KEY used by
// save_profile.php.
db()->prepare(
    'INSERT INTO profiles (account_id, language) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE language = VALUES(language)'
)->execute([$accountId, $language]);

json_ok(['language' => $language]);
