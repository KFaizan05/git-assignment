<?php
// POST /php/api/save_profile.php
// Body: { name, dietary[], allergens[], customAllergens[] }
//
// Replaces the whole profile for the logged-in user. Matches the legacy
// profileStorage.saveCurrentProfile() contract: name is a string, the three
// tag arrays are set wholesale (not patched). We wrap the three DELETE+INSERT
// passes in a transaction so a partial failure can't leave half-stale tags.

require __DIR__ . '/_common.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_fail('POST required', 405);

$accountId = require_login();
$body = read_json_body();

$name = trim((string) ($body['name'] ?? ''));
if (strlen($name) > 120) json_fail('Name is too long.');

$dietary         = array_values((array) ($body['dietary']         ?? []));
$allergens       = array_values((array) ($body['allergens']       ?? []));
$customAllergens = array_values((array) ($body['customAllergens'] ?? []));

$pdo = db();
$pdo->beginTransaction();
try {
    // Upsert the profile row. We seed an empty row at signup so INSERT is rare,
    // but the ON DUPLICATE KEY UPDATE keeps legacy accounts working too.
    $pdo->prepare(
        'INSERT INTO profiles (account_id, name) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE name = VALUES(name)'
    )->execute([$accountId, $name]);

    replace_tags('account_dietary',          $accountId, $dietary);
    replace_tags('account_allergens',        $accountId, $allergens);
    replace_tags('account_custom_allergens', $accountId, $customAllergens);

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    json_fail('Could not save profile.', 500);
}

json_ok(['profile' => [
    'name'            => $name,
    'dietary'         => fetch_tags('account_dietary',          $accountId),
    'allergens'       => fetch_tags('account_allergens',        $accountId),
    'customAllergens' => fetch_tags('account_custom_allergens', $accountId),
]]);
