<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

/**
 * The two staff roles named in the manuscript (Table 30, List of Modules).
 *
 * Patients are not a role: they are anonymous and have no account at all
 * (RA 10173). Do not add one.
 */
class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            [
                'name' => 'super_admin',
                'label' => 'Super Admin',
                'description' => 'Development team. Authors and publishes triage rules and lexicon, '
                    .'manages sub-admin accounts, views sync health and audit logs.',
            ],
            [
                'name' => 'sub_admin',
                'label' => 'Sub Admin',
                'description' => 'RHU/LGU health staff. Read-only access to de-identified aggregates '
                    .'for their assigned barangay only.',
            ],
        ];

        foreach ($roles as $role) {
            Role::updateOrCreate(['name' => $role['name']], $role);
        }
    }
}
