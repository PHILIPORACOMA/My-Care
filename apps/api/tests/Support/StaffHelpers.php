<?php

namespace Tests\Support;

use App\Models\Barangay;
use App\Models\Role;
use App\Models\User;

/**
 * Staff fixtures for console and portal tests.
 *
 * Requests carry an Origin header, as a browser SPA's always do: that is how
 * Sanctum's statefulApi() decides a request is first-party and gives it a
 * session, and several staff middlewares need that session.
 */
trait StaffHelpers
{
    protected function staffRole(string $name): Role
    {
        return Role::firstOrCreate(['name' => $name], [
            'label' => ucwords(str_replace('_', ' ', $name)),
            'description' => "The {$name} role.",
        ]);
    }

    protected function superAdmin(string $email = 'super@example.test'): User
    {
        return User::create([
            'email' => $email,
            'password_hash' => 'correct-horse',
            'role_id' => $this->staffRole('super_admin')->getKey(),
            'barangay_id' => null,
        ]);
    }

    protected function subAdmin(Barangay $barangay, string $email = 'nurse@example.test'): User
    {
        return User::create([
            'email' => $email,
            'password_hash' => 'correct-horse',
            'role_id' => $this->staffRole('sub_admin')->getKey(),
            'barangay_id' => $barangay->getKey(),
        ]);
    }

    protected function actingAsStaff(User $user): static
    {
        return $this->withHeaders(['Origin' => 'http://localhost'])->actingAs($user, 'web');
    }
}
