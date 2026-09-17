<?php

namespace App\Domain;

use RuntimeException;

/**
 * An action a domain service refuses — a lifecycle move not allowed from the
 * current state (409), or input that fails validation (422). Expected outcomes
 * of authoring and administration, not server faults: bootstrap/app.php renders
 * them as JSON with the reason, never as a 500.
 */
final class DomainActionException extends RuntimeException
{
    /** @param array<string, list<string>> $errors */
    private function __construct(string $message, public readonly int $status, public readonly array $errors = [])
    {
        parent::__construct($message);
    }

    public static function conflict(string $message): self
    {
        return new self($message, 409);
    }

    /** @param array<string, list<string>> $errors */
    public static function invalid(array $errors): self
    {
        return new self('The submitted data is invalid.', 422, $errors);
    }
}
