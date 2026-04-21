<?php
// -----------------------------------------------------------------------------
// LabelWise - shared PHP bootstrap for every API endpoint.
//
// Every endpoint under php/api/ starts with:
//   require __DIR__ . '/_common.php';
//
// This file:
//   - opens a PDO connection to the MySQL `labelwise` database
//   - boots a PHP session so we can track "who's logged in"
//   - provides JSON request/response helpers so endpoints stay tiny
//   - defines an auth gate (`require_login()`) and small DB helper functions
//     that the individual endpoints build on top of.
//
// Database credentials default to the XAMPP factory settings (user=root,
// password='', host=127.0.0.1, port=3306). If you changed them locally, edit
// the four constants below.
// -----------------------------------------------------------------------------

// ---- Database credentials (override here if your XAMPP is non-default) -----
const DB_HOST = '127.0.0.1';
const DB_PORT = 3306;
const DB_NAME = 'labelwise';
const DB_USER = 'root';
const DB_PASS = '';

// ---- Session ---------------------------------------------------------------
// SameSite=Lax keeps the cookie working across the same-origin fetch() calls
// we make from our own html/ pages. HttpOnly blocks JS from reading it.
if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

// ---- JSON response helpers -------------------------------------------------
header('Content-Type: application/json; charset=utf-8');
// The front-end is same-origin under XAMPP (http://localhost/...), so no CORS
// headers are needed; if you ever serve the html/ files from a different
// origin, add the appropriate Access-Control-Allow-* headers here.

function json_ok(array $data = []): void {
    echo json_encode(['ok' => true] + $data);
    exit;
}

function json_fail(string $message, int $status = 400, array $extra = []): void {
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $message] + $extra);
    exit;
}

/** Read the raw JSON request body and decode it. Returns [] on empty/invalid. */
function read_json_body(): array {
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') return [];
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

// ---- Database --------------------------------------------------------------
function db(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    } catch (PDOException $e) {
        // Hide the real DSN/credentials from the client; log-grep the web
        // server error log if the message is not obvious.
        json_fail('Database unavailable', 500);
    }
    return $pdo;
}

// ---- Auth ------------------------------------------------------------------
function current_account_id(): ?int {
    return isset($_SESSION['account_id']) ? (int) $_SESSION['account_id'] : null;
}

function require_login(): int {
    $id = current_account_id();
    if (!$id) {
        json_fail('Not logged in', 401);
    }
    return $id;
}

function normalize_email(?string $email): string {
    return strtolower(trim((string) $email));
}

// ---- Account hydration helpers --------------------------------------------
/**
 * Build the full "current user" snapshot the front-end expects: the email,
 * their profile, and every scan they own (newest first). This is what gets
 * returned by me.php, login.php, signup.php and quickstart.php so the JS
 * cache can stay in sync without a second round-trip.
 */
function load_account_snapshot(int $accountId): array {
    $pdo = db();

    $acct = $pdo->prepare('SELECT id, email, is_guest FROM accounts WHERE id = ?');
    $acct->execute([$accountId]);
    $account = $acct->fetch();
    if (!$account) {
        json_fail('Account not found', 404);
    }

    // Profile row + its three tag tables.
    $prof = $pdo->prepare('SELECT name, language FROM profiles WHERE account_id = ?');
    $prof->execute([$accountId]);
    $profileRow = $prof->fetch();

    $dietary          = fetch_tags('account_dietary',          $accountId);
    $allergens        = fetch_tags('account_allergens',        $accountId);
    $customAllergens  = fetch_tags('account_custom_allergens', $accountId);

    $profile = [
        'name'            => $profileRow['name'] ?? '',
        // Persisted UI language preference — mirrored into localStorage on
        // the client so the synchronous i18n layer picks it up without a
        // round-trip on every page load.
        'language'        => $profileRow['language'] ?? 'English',
        'dietary'         => $dietary,
        'allergens'       => $allergens,
        'customAllergens' => $customAllergens,
    ];

    // Scans, newest-first to match the legacy `unshift` behavior.
    $scanStmt = $pdo->prepare(
        'SELECT id, product_name, brand_name, status, category, note,
                saved_to_safe, thumbnail, ocr_text, client_scanned_at
           FROM scans
          WHERE account_id = ?
          ORDER BY client_scanned_at DESC, id DESC'
    );
    $scanStmt->execute([$accountId]);
    $scans = array_map('row_to_scan', $scanStmt->fetchAll());

    return [
        'user'    => $account['email'],
        'isGuest' => (int) $account['is_guest'] === 1,
        'profile' => $profile,
        'scans'   => $scans,
    ];
}

/** Fetch a simple list of tag strings from one of the account_* tables. */
function fetch_tags(string $table, int $accountId): array {
    // $table is never user-supplied; it's one of the three whitelisted
    // table names passed from our own code, so direct interpolation is safe.
    $allowed = ['account_dietary', 'account_allergens', 'account_custom_allergens'];
    if (!in_array($table, $allowed, true)) {
        json_fail('Internal error', 500);
    }
    $stmt = db()->prepare("SELECT tag FROM {$table} WHERE account_id = ? ORDER BY tag");
    $stmt->execute([$accountId]);
    return array_map(static fn($r) => $r['tag'], $stmt->fetchAll());
}

/** Replace all rows in one of the tag tables with the supplied list. */
function replace_tags(string $table, int $accountId, array $tags): void {
    $allowed = ['account_dietary', 'account_allergens', 'account_custom_allergens'];
    if (!in_array($table, $allowed, true)) {
        json_fail('Internal error', 500);
    }
    $pdo = db();
    $del = $pdo->prepare("DELETE FROM {$table} WHERE account_id = ?");
    $del->execute([$accountId]);

    if (empty($tags)) return;

    $ins = $pdo->prepare("INSERT INTO {$table} (account_id, tag) VALUES (?, ?)");
    $seen = [];
    foreach ($tags as $raw) {
        $tag = trim((string) $raw);
        if ($tag === '' || isset($seen[$tag])) continue;
        $seen[$tag] = true;
        $ins->execute([$accountId, $tag]);
    }
}

/** Convert a scans-table row into the shape the front-end expects. */
function row_to_scan(array $row): array {
    return [
        'id'          => (string) $row['id'],
        'productName' => $row['product_name'],
        'brandName'   => $row['brand_name'],
        'status'      => $row['status'],
        'category'    => $row['category'],
        'note'        => $row['note'] ?? '',
        'savedToSafe' => (int) ($row['saved_to_safe'] ?? 0) === 1,
        'thumbnail'   => $row['thumbnail'] ?? '',
        'ocrText'     => $row['ocr_text'] ?? '',
        // client_scanned_at is stored as a BIGINT of ms-since-epoch so the
        // front-end's `new Date(timestamp)` / relative-time helpers work
        // without any conversion.
        'timestamp'   => (int) $row['client_scanned_at'],
    ];
}
