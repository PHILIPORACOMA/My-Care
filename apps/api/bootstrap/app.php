<?php

use App\Domain\DomainActionException;
use App\Http\Middleware\AuthenticateDevice;
use App\Http\Middleware\EnsureRole;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    /*
    | routes/api.php is registered by hand rather than by `php artisan
    | install:api`, because that command also publishes Sanctum's migration —
    | which would add a personal_access_tokens table the Data Dictionary does
    | not have. Staff use Sanctum's SPA cookie mode, which needs no table
    | (ADR-0004); devices authenticate against DEVICE.api_token, a column the
    | manuscript already specifies (ADR-0003).
    */
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        /*
        | Sanctum in SPA (cookie) mode, not token mode: apps/portal and
        | apps/console authenticate with a first-party session cookie, and no
        | personal_access_tokens table is ever needed - which keeps the schema
        | equal to the 20 Data Dictionary entities (ADR-0004).
        |
        | The session and CSRF middleware are applied to the staff and console
        | route groups ONLY (routes/api.php), not to all of /api. This used to
        | be statefulApi(), which applies them to every /api request from a
        | SANCTUM_STATEFUL_DOMAINS origin. On one host (Phase 9) the patient app
        | shares that origin, so every phone upload was treated as a staff
        | browser request, checked for a CSRF token it never has, and answered
        | 419 - found by the deploy-smoke job (BUILD-LOG 9b). Devices
        | authenticate with DEVICE.api_token (ADR-0003) and never get a session.
        */

        /*
        | No guest redirect. Laravel's default is route('login'), called for any
        | unauthenticated request that does not send Accept: application/json —
        | and this API has no route named `login`, so Postman's default
        | wildcard Accept header turned every unauthenticated staff request
        | into a 500 (RouteNotFoundException). With no redirect, the exception
        | handler falls through to shouldRenderJsonWhen() below and answers a
        | JSON 401. The SPAs route their own login screens client-side.
        */
        $middleware->redirectGuestsTo(null);

        $middleware->alias([
            'device' => AuthenticateDevice::class,
            'role' => EnsureRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // A refused lifecycle action or invalid ruleset content is an expected
        // outcome of authoring, not a server fault: 409 or 422 with the reason.
        $exceptions->render(fn (DomainActionException $e) => response()->json(
            array_filter(['message' => $e->getMessage(), 'errors' => $e->errors ?: null]),
            $e->status,
        ));
    })->create();
