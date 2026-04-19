<?php
// POST /php/api/save_scan.php
// Body: { productName, brandName, status, category, note, savedToSafe,
//         thumbnail, ocrText, timestamp }
//
// Inserts a new scan row and returns the full persisted scan (with the new
// server-assigned id). `timestamp` is the client's Date.now() — we store it
// in client_scanned_at so the newest-first ordering matches the legacy
// unshift() behavior even across devices with clock skew.

require __DIR__ . '/_common.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_fail('POST required', 405);

$accountId = require_login();
$body = read_json_body();

$productName = trim((string) ($body['productName'] ?? 'Scanned Product'));
if ($productName === '') $productName = 'Scanned Product';

$brandName = trim((string) ($body['brandName'] ?? ''));
$status    = (string) ($body['status']   ?? 'Safe');
$category  = trim((string) ($body['category'] ?? ''));
$note      = (string) ($body['note']     ?? '');
$savedToSafe = !empty($body['savedToSafe']) ? 1 : 0;

// ENUM values are constrained in the DB, but validate here so we can return
// a clean 400 instead of a MySQL data-truncation 500.
if (!in_array($status, ['Safe', 'Unsafe', 'Caution'], true)) {
    json_fail('Invalid status.');
}

$thumbnail = (string) ($body['thumbnail'] ?? '');
$ocrText   = (string) ($body['ocrText']   ?? '');
$timestamp = isset($body['timestamp']) ? (int) $body['timestamp'] : (int) (microtime(true) * 1000);
if ($timestamp <= 0) $timestamp = (int) (microtime(true) * 1000);

$stmt = db()->prepare(
    'INSERT INTO scans
        (account_id, product_name, brand_name, status, category, note,
         saved_to_safe, thumbnail, ocr_text, client_scanned_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);
$stmt->execute([
    $accountId, $productName, $brandName, $status, $category, $note,
    $savedToSafe, $thumbnail, $ocrText, $timestamp,
]);

$newId = (int) db()->lastInsertId();

json_ok([
    'scan' => [
        'id'          => (string) $newId,
        'productName' => $productName,
        'brandName'   => $brandName,
        'status'      => $status,
        'category'    => $category,
        'note'        => $note,
        'savedToSafe' => (bool) $savedToSafe,
        'thumbnail'   => $thumbnail,
        'ocrText'     => $ocrText,
        'timestamp'   => $timestamp,
    ],
]);
