<?php
// POST /php/api/update_scan.php
// Body: { id, patch: { ...fields to change... } }
//
// Partial update — only the whitelisted fields get written. Matches the
// legacy profileStorage.updateCurrentScan(id, patch) contract used by the
// star-toggle on SafeItems and anywhere else we tweak an existing scan.

require __DIR__ . '/_common.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_fail('POST required', 405);

$accountId = require_login();
$body = read_json_body();

$scanId = isset($body['id']) ? (int) $body['id'] : 0;
if ($scanId <= 0) json_fail('Scan id is required.');

$patch = is_array($body['patch'] ?? null) ? $body['patch'] : [];

// Whitelist of editable fields → their SQL column names.
$fieldMap = [
    'productName' => 'product_name',
    'brandName'   => 'brand_name',
    'status'      => 'status',
    'category'    => 'category',
    'note'        => 'note',
    'savedToSafe' => 'saved_to_safe',
    'thumbnail'   => 'thumbnail',
    'ocrText'     => 'ocr_text',
];

$sets = [];
$args = [];
foreach ($patch as $key => $value) {
    if (!isset($fieldMap[$key])) continue;
    $col = $fieldMap[$key];

    if ($key === 'status') {
        if (!in_array($value, ['Safe', 'Unsafe', 'Caution'], true)) {
            json_fail('Invalid status.');
        }
        $sets[] = "{$col} = ?";
        $args[] = $value;
    } elseif ($key === 'savedToSafe') {
        $sets[] = "{$col} = ?";
        $args[] = $value ? 1 : 0;
    } else {
        $sets[] = "{$col} = ?";
        $args[] = (string) $value;
    }
}

if (empty($sets)) json_fail('Nothing to update.');

// Scope the UPDATE to rows owned by the current account so one user can't
// mutate another user's scan by guessing its id.
$sql = 'UPDATE scans SET ' . implode(', ', $sets) . ' WHERE id = ? AND account_id = ?';
$args[] = $scanId;
$args[] = $accountId;

$stmt = db()->prepare($sql);
$stmt->execute($args);

if ($stmt->rowCount() === 0) {
    // Either the scan doesn't exist, belongs to someone else, or the patch
    // didn't actually change anything. Check existence so we can distinguish.
    $exists = db()->prepare('SELECT 1 FROM scans WHERE id = ? AND account_id = ?');
    $exists->execute([$scanId, $accountId]);
    if (!$exists->fetch()) json_fail('Scan not found.', 404);
}

// Return the updated row so the client cache can replace its copy.
$sel = db()->prepare(
    'SELECT id, product_name, brand_name, status, category, note,
            saved_to_safe, thumbnail, ocr_text, client_scanned_at
       FROM scans WHERE id = ? AND account_id = ?'
);
$sel->execute([$scanId, $accountId]);
$row = $sel->fetch();

json_ok(['scan' => row_to_scan($row)]);
