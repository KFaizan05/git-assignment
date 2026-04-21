<?php
// POST /php/api/delete_account.php
// Nukes the logged-in account. Scans/profile/tag rows are cleaned up by the
// ON DELETE CASCADE foreign keys on each child table. The session is then
// destroyed so the user lands on the Login page as a stranger.

require __DIR__ . '/_common.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_fail('POST required', 405);

$accountId = require_login();

db()->prepare('DELETE FROM accounts WHERE id = ?')->execute([$accountId]);

$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params['path'], $params['domain'] ?? '',
        $params['secure'], $params['httponly']);
}
session_destroy();

json_ok();
