<?php

use App\Http\Middleware\AuthenticateDevice;
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
        $middleware->alias([
            'device' => AuthenticateDevice::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
