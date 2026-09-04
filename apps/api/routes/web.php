<?php

use Illuminate\Support\Facades\Route;

/*
| apps/api is a JSON API with no asset pipeline — Laravel's stock package.json,
| vite.config.js and welcome view were removed, so there is no Blade entry point
| to serve here. This root route exists only so the service identifies itself
| when something reaches it.
*/

Route::get('/', fn () => response()->json([
    'service' => 'My Care API',
    'status' => 'ok',
]));
