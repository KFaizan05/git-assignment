<?php
// POST /php/api/signup.php
// Body: { "email": "...", "password": "..." }
// Creates a new non-guest account, logs it in, and returns the full snapshot.

require __DIR__ . '/_common.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_fail('POST required', 405);

$body     = read_json_body();
$email    = normalize_email($body['email']    ?? null);
$password = (string) ($body['password'] ?? '');

if ($email === '')    json_fail('Email is required.');
if ($password === '') json_fail('Password is required.');
// Basic sanity limits — DB columns are VARCHAR(255).
if (strlen($email) > 255)     json_fail('Email is too long.');
if (strlen($password) > 200)  json_fail('Password is too long.');

$pdo = db();

// Check uniqueness up-front so we can return a friendly message instead of
// relying on the UNIQUE KEY's opaque integrity-violation error.
$check = $pdo->prepare('SELECT id FROM accounts WHERE email = ?');
$check->execute([$email]);
if ($check->fetch()) {
    json_fail('An account with that email already exists.', 409);
}

$hash = password_hash($password, PASSWORD_DEFAULT);

$ins = $pdo->prepare(
    'INSERT INTO accounts (email, password_hash, is_guest) VALUES (?, ?, 0)'
);
$ins->execute([$email, $hash]);
$accountId = (int) $pdo->lastInsertId();

// Seed an empty profile row so later saves can UPDATE instead of branching.
$pdo->prepare('INSERT INTO profiles (account_id, name) VALUES (?, \'\')')
    ->execute([$accountId]);

$_SESSION['account_id'] = $accountId;
session_regenerate_id(true);

json_ok(load_account_snapshot($accountId));
