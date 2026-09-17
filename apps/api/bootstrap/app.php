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
    })->create();
