<?php

namespace App\Domain\Ruleset;

use RuntimeException;

/**
 * A lifecycle action that is not allowed from the version's current state, or
 * content that fails validation. Rendered by the console controllers as 409 or
 * 422 with the reason, never as a 500.
 */
final class RulesetException extends RuntimeException
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
        return new self('The ruleset content is invalid.', 422, $errors);
    }
}
