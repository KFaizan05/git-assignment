<?php
// POST /php/api/login.php
// Body: { "email": "...", "password": "..." }
// On success: binds $_SESSION['account_id'] and returns the account snapshot.

require __DIR__ . '/_common.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_fail('POST required', 405);

$body     = read_json_body();
$email    = normalize_email($body['email']    ?? null);
$password = (string) ($body['password'] ?? '');

if ($email === '' || $password === '') {
    json_fail('Enter your email and password.');
}

$stmt = db()->prepare(
    'SELECT id, password_hash, is_guest FROM accounts WHERE email = ?'
);
$stmt->execute([$email]);
$acct = $stmt->fetch();

// Guest accounts have a NULL password_hash — they can't log in via the
// credential form, only via the Quick Start endpoint.
if (!$acct || $acct['password_hash'] === null || (int) $acct['is_guest'] === 1) {
    json_fail('Incorrect email or password.', 401);
}

if (!password_verify($password, $acct['password_hash'])) {
    json_fail('Incorrect email or password.', 401);
}

// Opportunistic rehash if PHP's default algo/cost has changed since signup.
if (password_needs_rehash($acct['password_hash'], PASSWORD_DEFAULT)) {
    $newHash = password_hash($password, PASSWORD_DEFAULT);
    db()->prepare('UPDATE accounts SET password_hash = ? WHERE id = ?')
        ->execute([$newHash, (int) $acct['id']]);
}

$_SESSION['account_id'] = (int) $acct['id'];
session_regenerate_id(true);

json_ok(load_account_snapshot((int) $acct['id']));
