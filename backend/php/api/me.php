<?php
// GET /php/api/me.php
// Returns the full account snapshot for the logged-in user, or
// { ok: true, user: null } when nobody's signed in. Used by
// profileStorage.ready() to hydrate the in-memory cache on page load.

require __DIR__ . '/_common.php';

$id = current_account_id();
if (!$id) {
    json_ok(['user' => null]);
}

json_ok(load_account_snapshot($id));
