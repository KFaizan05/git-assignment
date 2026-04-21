<?php
// POST /php/api/quickstart.php
// Creates a fresh guest account (is_guest=1, password_hash NULL), logs the
// caller in, and returns the snapshot. Matches the legacy "Quick Start"
// button behavior: the account and all its data are wiped on logout.

require __DIR__ . '/_common.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') json_fail('POST required', 405);

// Generate a unique placeholder email so it doesn't collide with real users
// or other concurrent guests. Format: guest-<hex>@labelwise.local
function make_guest_email(): string {
    try {
        $rand = bin2hex(random_bytes(6));
    } catch (Throwable $e) {
        $rand = dechex(mt_rand(0, PHP_INT_MAX));
    }
    return 'guest-' . $rand . '@labelwise.local';
}

$pdo = db();

// Extremely unlikely collision, but retry once just in case.
$email = make_guest_email();
$exists = $pdo->prepare('SELECT 1 FROM accounts WHERE email = ?');
$exists->execute([$email]);
if ($exists->fetch()) $email = make_guest_email();

$ins = $pdo->prepare(
    'INSERT INTO accounts (email, password_hash, is_guest) VALUES (?, NULL, 1)'
);
$ins->execute([$email]);
$accountId = (int) $pdo->lastInsertId();

// Seed an empty profile row so later saves are a straight UPDATE.
$pdo->prepare('INSERT INTO profiles (account_id, name) VALUES (?, \'\')')
    ->execute([$accountId]);

$_SESSION['account_id'] = $accountId;
session_regenerate_id(true);

json_ok(load_account_snapshot($accountId));
