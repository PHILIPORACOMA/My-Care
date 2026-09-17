<?php

namespace App\Console\Commands;

use App\Domain\Accounts\AccountManager;
use App\Domain\DomainActionException;
use Illuminate\Console\Command;

/**
 * Creates the first super-admin on a fresh deployment.
 *
 * The console can only create sub-admins (Figure 38), and DemoDataSeeder
 * refuses to run in production, so something has to mint the first development
 * team account. The password is prompted, never taken as an argument, so it
 * does not land in shell history.
 */
class CreateSuperAdmin extends Command
{
    protected $signature = 'mycare:staff:create-super-admin {email}';

    protected $description = 'Create a super-admin (development team) account';

    public function handle(AccountManager $accounts): int
    {
        $password = (string) $this->secret('Password (at least 12 characters, letters and numbers)');
        $confirm = (string) $this->secret('Repeat the password');

        if ($password !== $confirm) {
            $this->error('The passwords do not match.');

            return self::FAILURE;
        }

        try {
            $user = $accounts->createSuperAdmin((string) $this->argument('email'), $password);
        } catch (DomainActionException $e) {
            foreach ($e->errors as $messages) {
                foreach ($messages as $message) {
                    $this->error($message);
                }
            }

            return self::FAILURE;
        }

        $this->info("Super-admin {$user->email} created.");

        return self::SUCCESS;
    }
}
