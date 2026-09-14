<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/*
|--------------------------------------------------------------------------
| Test Case
|--------------------------------------------------------------------------
|
| Feature tests boot the application and run against a real MySQL 8 schema
| (mycare_test), never SQLite — see config/database.php.
|
| Unit tests deliberately do not extend TestCase: SuppressionRule is pure PHP
| and must stay testable without booting Laravel or touching a database.
|
*/

pest()->extend(TestCase::class)
    ->use(RefreshDatabase::class)
    ->in('Feature');
