<?php

use App\Http\Middleware\AuthenticateDevice;
use App\Http\Middleware\EnsureRole;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    /*
    | routes/api.php is registered by hand rather than by `php artisan
    | install:api`, because that command also installs Laravel Sanctum — which
    | would add a personal_access_tokens table the Data Dictionary does not
    | have, and would pre-empt the staff-auth decision (JWT vs Sanctum) that is
    | still open for Phase 4. Device endpoints need neither: they authenticate
    | against DEVICE.api_token, a column the manuscript already specifies.
    */
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        /*
        | Sanctum in SPA (cookie) mode, not token mode. statefulApi() puts the
        | session and CSRF middleware in front of /api for requests coming from
        | SANCTUM_STATEFUL_DOMAINS, so apps/portal and apps/console authenticate
        | with a first-party cookie and no personal_access_tokens table is ever
        | needed — which is what keeps the schema equal to the 20 Data
        | Dictionary entities and avoids a manuscript amendment.
        |
        | Devices do NOT go through this. They keep AuthenticateDevice on
        | DEVICE.api_token: a device is not an account, has no role, and must
        | never reach a staff endpoint (ADR-0003).
        */
        $middleware->statefulApi();

        $middleware->alias([
            'device' => AuthenticateDevice::class,
            'role' => EnsureRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
