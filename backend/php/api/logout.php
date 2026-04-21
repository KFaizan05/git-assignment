<?php
// POST /php/api/logout.php
// Clears the session. If the current account is a guest (Quick Start), the
// whole account + its data is hard-deleted via ON DELETE CASCADE so guest
// data is truly ephemeral — matches the old localStorage logout behavior.

require __DIR__ . '/_common.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_fail('POST required', 405);

$accountId = current_account_id();

if ($accountId) {
    $stmt = db()->prepare('SELECT is_guest FROM accounts WHERE id = ?');
    $stmt->execute([$accountId]);
    $row = $stmt->fetch();
    if ($row && (int) $row['is_guest'] === 1) {
        db()->prepare('DELETE FROM accounts WHERE id = ?')->execute([$accountId]);
    }
}

$_SESSION = [];
if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params['path'], $params['domain'] ?? '',
        $params['secure'], $params['httponly']);
}
session_destroy();

json_ok();
