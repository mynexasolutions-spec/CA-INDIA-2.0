<?php

namespace App\Services\Billing;

use App\Models\ClientProfile;
use App\Models\CommercialDocument;
use Illuminate\Validation\ValidationException;

/**
 * Per-document-type numbering settings (prefix / separator / next number / prefix position /
 * status) as edited from the client's Settings → Document Numbering & Prefix tab.
 *
 * The client submits them as flat change-request fields named "<doc_key>_<prop>"
 * (e.g. invoice_separator, delivery_challan_next_number). On approval they are written into
 * client_profiles.document_numbering_settings (what InvoiceService builds numbers from) and the
 * legacy prefix / next-number columns are kept in sync. The numbering TYPE (auto / manual) is
 * deliberately NOT part of this — only an admin can change it.
 */
class DocumentNumberingSettings
{
    public const DOCS = [
        'invoice' => ['type' => 'tax_invoice', 'label' => 'Tax Invoice', 'seq' => 'invoice_next_number'],
        'bill_of_supply' => ['type' => 'bill_of_supply', 'label' => 'Bill of Supply', 'seq' => 'bill_of_supply_next_number'],
        'credit_note' => ['type' => 'credit_note', 'label' => 'Credit Note', 'seq' => 'credit_note_next_number'],
        'debit_note' => ['type' => 'debit_note', 'label' => 'Debit Note', 'seq' => 'debit_note_next_number'],
        'quotation' => ['type' => 'quotation', 'label' => 'Quotation', 'seq' => 'quotation_next_number'],
        'delivery_challan' => ['type' => 'delivery_challan', 'label' => 'Delivery Challan', 'seq' => 'delivery_challan_next_number'],
    ];

    public const PROPS = ['prefix', 'separator', 'next_number', 'prefix_position', 'status'];

    /** Props that decide what the next generated number looks like (status doesn't). */
    private const FORMAT_PROPS = ['prefix', 'separator', 'next_number', 'prefix_position'];

    /** Every flat field name, e.g. invoice_prefix, invoice_separator, … */
    public static function fields(): array
    {
        $out = [];
        foreach (array_keys(self::DOCS) as $key) {
            foreach (self::PROPS as $prop) {
                $out[] = "{$key}_{$prop}";
            }
        }

        return $out;
    }

    /** @return array{0:string,1:string}|null [docKey, prop] */
    public static function parse(string $field): ?array
    {
        foreach (array_keys(self::DOCS) as $key) {
            if (str_starts_with($field, $key.'_')) {
                $prop = substr($field, strlen($key) + 1);
                if (in_array($prop, self::PROPS, true)) {
                    return [$key, $prop];
                }
            }
        }

        return null;
    }

    public static function isField(string $field): bool
    {
        return self::parse($field) !== null;
    }

    private static function settingsOf(ClientProfile $profile): array
    {
        return is_array($profile->document_numbering_settings) ? $profile->document_numbering_settings : [];
    }

    /** 'auto' | 'manual' — set by the admin only. */
    public static function numberingType(ClientProfile $profile, string $docType): string
    {
        $key = InvoiceService::typeToSettingsKey($docType);
        $cfg = self::settingsOf($profile)[$key] ?? null;

        return is_array($cfg) && ($cfg['numbering_type'] ?? 'auto') === 'manual' ? 'manual' : 'auto';
    }

    /** doc_key => 'auto'|'manual', for the client UI. */
    public static function numberingTypes(ClientProfile $profile): array
    {
        $out = [];
        foreach (self::DOCS as $key => $info) {
            $out[$key] = self::numberingType($profile, $info['type']);
        }

        return $out;
    }

    /** The live (approved) value of a flat numbering field, as a display string. */
    public static function currentValue(ClientProfile $profile, string $field): ?string
    {
        $parsed = self::parse($field);
        if (! $parsed) {
            return null;
        }
        [$key, $prop] = $parsed;
        $info = self::DOCS[$key];
        [$prefix, $separator, $position, $padLen] = app(InvoiceService::class)->resolveNumberingConfig($profile, $info['type']);

        return match ($prop) {
            'prefix' => $prefix,
            'separator' => $separator,
            'prefix_position' => $position,
            'next_number' => str_pad((string) max(1, (int) ($profile->{$info['seq']} ?? 1)), $padLen, '0', STR_PAD_LEFT),
            'status' => (self::settingsOf($profile)[$key]['status'] ?? true) ? 'active' : 'inactive',
        };
    }

    /** Normalises a submitted value so it can be compared with / stored next to the live one. */
    public static function normalize(string $prop, mixed $value): string
    {
        $value = (string) $value;

        return match ($prop) {
            'prefix' => trim($value),
            'next_number' => str_pad((string) max(1, (int) $value), max(2, strlen(trim($value))), '0', STR_PAD_LEFT),
            default => $value,
        };
    }

    /** True when a submitted value is exactly what is already live (so it isn't a change). */
    public static function isUnchanged(ClientProfile $profile, string $field, mixed $value): bool
    {
        $parsed = self::parse($field);
        if (! $parsed) {
            return false;
        }
        $current = self::currentValue($profile, $field);
        if ($parsed[1] === 'next_number') {
            return (int) $current === (int) $value;
        }

        return $current === self::normalize($parsed[1], $value);
    }

    /**
     * Applies the numbering fields found in $payload on top of the profile's current settings.
     *
     * @return array{0:array,1:array} [new document_numbering_settings JSON, column updates]
     *                                — both empty when $payload carries no numbering field.
     */
    public static function apply(ClientProfile $profile, array $payload): array
    {
        $settings = self::settingsOf($profile);
        $columns = [];
        $touched = false;

        foreach (self::DOCS as $key => $info) {
            $cfg = is_array($settings[$key] ?? null) ? $settings[$key] : [];
            $docTouched = false;
            foreach (self::PROPS as $prop) {
                $field = "{$key}_{$prop}";
                if (! array_key_exists($field, $payload)) {
                    continue;
                }
                $value = self::normalize($prop, $payload[$field]);
                switch ($prop) {
                    case 'prefix':
                        if ($value === '') {
                            continue 2;
                        }
                        $cfg['prefix'] = $value;
                        $columns[$field] = $value;
                        break;
                    case 'next_number':
                        $cfg['next_number'] = $value;
                        $columns[$info['seq']] = max(1, (int) $value);
                        break;
                    case 'status':
                        $cfg['status'] = $value === 'active';
                        break;
                    default:
                        $cfg[$prop] = $value;
                }
                $docTouched = true;
            }
            if ($docTouched) {
                $settings[$key] = $cfg;
                $touched = true;
            }
        }

        return $touched ? [$settings, $columns] : [[], []];
    }

    /**
     * Rejects a numbering change that would make the next generated number collide with an
     * existing document, or step back onto numbers that have already been used. Only the
     * documents whose format actually changes are checked, and manual-numbering types are
     * skipped (their numbers are typed by hand, not generated).
     *
     * @throws ValidationException
     */
    public static function assertValid(ClientProfile $profile, array $payload): void
    {
        $invoices = app(InvoiceService::class);
        [$settings] = self::apply($profile, $payload);
        if (! $settings) {
            return;
        }

        $errors = [];
        foreach (self::DOCS as $key => $info) {
            $touchesFormat = false;
            foreach (self::FORMAT_PROPS as $prop) {
                $touchesFormat = $touchesFormat || array_key_exists("{$key}_{$prop}", $payload);
            }
            if (! $touchesFormat || self::numberingType($profile, $info['type']) === 'manual') {
                continue;
            }

            $temp = clone $profile;
            $temp->document_numbering_settings = $settings;
            [$prefix, $separator, $position, $padLen] = $invoices->resolveNumberingConfig($temp, $info['type']);

            $next = array_key_exists("{$key}_next_number", $payload)
                ? max(1, (int) $payload["{$key}_next_number"])
                : max(1, (int) ($profile->{$info['seq']} ?? 1));
            $candidate = $invoices->formatDocNumber($prefix, $next, $separator, $position, $padLen);

            if (CommercialDocument::where('client_profile_id', $profile->id)->where('number', $candidate)->exists()) {
                $errors["{$key}_next_number"] = ["Document number '{$candidate}' is already in use for {$info['label']}. Choose a higher Next Number."];
                continue;
            }

            $highest = self::highestUsed($profile, $info['type'], $prefix, $separator, $position);
            if ($highest > 0 && $next <= $highest) {
                $errors["{$key}_next_number"] = ["Next Number for {$info['label']} must be greater than {$highest}, the highest number already used with this format."];
            }
        }

        if ($errors) {
            throw ValidationException::withMessages($errors);
        }
    }

    /** Highest sequence already issued for this exact prefix / separator / position pattern. */
    public static function highestUsed(ClientProfile $profile, string $type, string $prefix, string $separator, string $position): int
    {
        $quotedPrefix = preg_quote($prefix, '/');
        $quotedSep = preg_quote($separator, '/');
        $prefixHasEdgeSep = $position === 'last'
            ? (str_starts_with($prefix, '-') || str_starts_with($prefix, '/'))
            : (str_ends_with($prefix, '-') || str_ends_with($prefix, '/'));

        if ($position === 'last') {
            $pattern = $prefixHasEdgeSep ? '/^(\d+)'.$quotedPrefix.'$/' : '/^(\d+)'.$quotedSep.$quotedPrefix.'$/';
        } else {
            $pattern = $prefixHasEdgeSep ? '/^'.$quotedPrefix.'(\d+)$/' : '/^'.$quotedPrefix.$quotedSep.'(\d+)$/';
        }

        $highest = 0;
        $numbers = CommercialDocument::where('client_profile_id', $profile->id)
            ->where('type', $type)
            ->where('status', '!=', 'draft')
            ->pluck('number');
        foreach ($numbers as $number) {
            if (preg_match($pattern, (string) $number, $m)) {
                $highest = max($highest, (int) $m[1]);
            }
        }

        return $highest;
    }
}
