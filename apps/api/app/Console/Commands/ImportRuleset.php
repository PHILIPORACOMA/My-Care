<?php

namespace App\Console\Commands;

use App\Domain\Ruleset\BundleImporter;
use App\Domain\Ruleset\RulesetException;
use Illuminate\Console\Command;

/**
 * Imports a RulesetBundle JSON file as a new draft version.
 *
 * The usual source is the v1 bundle encoded in packages/ruleset:
 *
 *     npm run export:v1 -w @mycare/ruleset          # writes packages/ruleset/dist/v1.json
 *     php artisan mycare:ruleset:import ../../packages/ruleset/dist/v1.json
 *
 * The result is a DRAFT. It must still be submitted for review and published
 * with clinical-review attestation from the console before any device sees it.
 */
class ImportRuleset extends Command
{
    protected $signature = 'mycare:ruleset:import {file : Path to a RulesetBundle JSON file}';

    protected $description = 'Import a RulesetBundle JSON file as a new draft ruleset version';

    public function handle(BundleImporter $importer): int
    {
        $path = (string) $this->argument('file');

        if (! is_readable($path)) {
            $this->error("Cannot read {$path}.");

            return self::FAILURE;
        }

        $bundle = json_decode((string) file_get_contents($path), true);

        if (! is_array($bundle)) {
            $this->error('The file is not a JSON object.');

            return self::FAILURE;
        }

        try {
            $version = $importer->import($bundle);
        } catch (RulesetException $e) {
            $this->error($e->getMessage());

            foreach ($e->errors as $field => $messages) {
                foreach ($messages as $message) {
                    $this->line("  {$field}: {$message}");
                }
            }

            return self::FAILURE;
        }

        $this->info("Imported as draft {$version->label}.");
        $this->warn('Not live. Submit it for review and publish it from the console after clinical review.');

        return self::SUCCESS;
    }
}
