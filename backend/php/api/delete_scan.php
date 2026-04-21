<?php
// POST /php/api/delete_scan.php
// Body: { id }
// Deletes one scan owned by the logged-in user.

require __DIR__ . '/_common.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_fail('POST required', 405);

$accountId = require_login();
$body = read_json_body();
$scanId = isset($body['id']) ? (int) $body['id'] : 0;
if ($scanId <= 0) json_fail('Scan id is required.');

$stmt = db()->prepare('DELETE FROM scans WHERE id = ? AND account_id = ?');
$stmt->execute([$scanId, $accountId]);

json_ok(['deleted' => $stmt->rowCount() > 0]);
