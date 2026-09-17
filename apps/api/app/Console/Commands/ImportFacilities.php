<?php

namespace App\Console\Commands;

use App\Models\Barangay;
use App\Models\Facility;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * Loads FACILITY rows (Table 20) from a CSV the health office maintains.
 *
 * The manuscript has no facility-management screen, and facility names and
 * emergency numbers are real-world contact details that must come from the
 * City Health Office — never be typed in by the build. So they arrive as a
 * file, and every row passes through the model so the change is audited.
 *
 * CSV header (exactly these columns, any order):
 *
 *     name,type,barangay,address,contact_number,operating_hours,is_active
 *
 * - `barangay` is a barangay name, or blank for a city-wide facility.
 * - `type` is free text up to 30 characters; the PWA's "Call for help" prefers
 *   `emergency_hotline`, then `rhu`, then any facility with a number.
 * - Rows are matched on (name, barangay): re-importing updates in place.
 *
 * The whole file is applied in one transaction; one bad row changes nothing.
 */
class ImportFacilities extends Command
{
    protected $signature = 'mycare:facilities:import {file : Path to the facilities CSV}';

    protected $description = 'Import or update FACILITY rows used by the emergency "Call for help" action';

    private const COLUMNS = ['name', 'type', 'barangay', 'address', 'contact_number', 'operating_hours', 'is_active'];

    public function handle(): int
    {
        $path = (string) $this->argument('file');

        if (! is_readable($path)) {
            $this->error("Cannot read {$path}.");

            return self::FAILURE;
        }

        $handle = fopen($path, 'r');
        $header = fgetcsv($handle, escape: '\\');

        if ($header === false || array_diff(self::COLUMNS, array_map('trim', $header)) !== []) {
            $this->error('Header must contain: '.implode(',', self::COLUMNS));

            return self::FAILURE;
        }

        $header = array_map('trim', $header);
        $rows = [];
        $line = 1;

        while (($values = fgetcsv($handle, escape: '\\')) !== false) {
            $line++;

            if ($values === [null]) {
                continue;
            }

            $row = array_combine($header, array_pad(array_map('trim', $values), count($header), ''));
            $errors = $this->validate($row);

            if ($errors !== []) {
                fclose($handle);
                $this->error("Line {$line}: ".implode(' ', $errors));
                $this->error('Nothing was imported.');

                return self::FAILURE;
            }

            $rows[] = $row;
        }

        fclose($handle);

        DB::transaction(function () use ($rows): void {
            foreach ($rows as $row) {
                $barangayId = $row['barangay'] === ''
                    ? null
                    : Barangay::where('name', $row['barangay'])->value('id');

                Facility::updateOrCreate(
                    ['name' => $row['name'], 'barangay_id' => $barangayId],
                    [
                        'type' => $row['type'],
                        'address' => $row['address'] ?: null,
                        'contact_number' => $row['contact_number'] ?: null,
                        'operating_hours' => $row['operating_hours'] ?: null,
                        'is_active' => in_array(strtolower($row['is_active']), ['1', 'true', 'yes'], true),
                    ],
                );
            }
        });

        $this->info(count($rows).' facilities imported.');

        return self::SUCCESS;
    }

    /**
     * Column widths come from Data Dictionary Table 20.
     *
     * @param  array<string, string>  $row
     * @return list<string>
     */
    private function validate(array $row): array
    {
        $validator = Validator::make($row, [
            'name' => ['required', 'max:150'],
            'type' => ['required', 'max:30'],
            'address' => ['max:255'],
            'contact_number' => ['max:30'],
            'operating_hours' => ['max:100'],
            'is_active' => ['required', 'in:0,1,true,false,yes,no,TRUE,FALSE,Yes,No'],
        ]);

        $errors = $validator->errors()->all();

        if ($row['barangay'] !== '' && ! Barangay::where('name', $row['barangay'])->exists()) {
            $errors[] = "Unknown barangay \"{$row['barangay']}\".";
        }

        return $errors;
    }
}
