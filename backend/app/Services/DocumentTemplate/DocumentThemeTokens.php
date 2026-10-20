<?php

namespace App\Services\DocumentTemplate;

class DocumentThemeTokens
{
    /**
     * The 6 approved colour schemes, each with 4 theme tokens + rgb float array for DomPDF canvas.
     * Tokens are plain hex strings, no CSS variables.
     */
    public const THEMES = [
        // The five colours offered in Settings > Layouts, sampled from the approved Layout 1/2/3 designs.
        'simple' => [
            'key' => 'simple',
            'name' => 'Simple',
            'primary' => '#111111',
            'dark' => '#000000',
            'light_tint' => '#F3F4F6',
            'text_on_primary' => '#FFFFFF',
            'rgb' => [0.067, 0.067, 0.067],
        ],
        'royal_blue' => [
            'key' => 'royal_blue',
            'name' => 'Royal Blue',
            'primary' => '#1D40AF',
            'dark' => '#16318A',
            'light_tint' => '#CFE8FC',
            // the approved Royal Blue form shows the grand total on a light blue band with a black label
            'grand_bg' => '#CAE9FD',
            'grand_line' => '#2B6CE0',
            'grand_label' => '#0F172A',
            'text_on_primary' => '#FFFFFF',
            'rgb' => [0.114, 0.251, 0.686],
            // Layout 1 only (the approved form): brighter title blue and a two-tone corner ribbon.
            'l1_title' => '#1368CA',
            'ribbon_dark' => [0.024, 0.306, 0.667],
            'ribbon_light' => [0.314, 0.58, 0.863],
        ],
        'slate_blue' => [
            'key' => 'slate_blue',
            'name' => 'Slate Blue',
            // Matches the blue swatch the client picks in Settings > Layouts (#2563EB), so choosing
            // "Slate Blue" gives a genuinely blue document.
            'primary' => '#2563EB',
            'dark' => '#1D4ED8',
            'light_tint' => '#E6EEFD',
            'text_on_primary' => '#FFFFFF',
            'rgb' => [0.145, 0.388, 0.922],
        ],
        'charcoal_grey' => [
            'key' => 'charcoal_grey',
            'name' => 'Charcoal Grey',
            'primary' => '#3F4650',
            'dark' => '#2B3038',
            'light_tint' => '#DCE0E5',
            'text_on_primary' => '#FFFFFF',
            'rgb' => [0.247, 0.275, 0.314],
        ],
        'dusty_plum' => [
            'key' => 'dusty_plum',
            'name' => 'Dusty Plum',
            'primary' => '#8C2F5F',
            'dark' => '#6B2249',
            'light_tint' => '#ECCFDD',
            'text_on_primary' => '#FFFFFF',
            'rgb' => [0.549, 0.184, 0.373],
        ],
        'mocha_brown' => [
            'key' => 'mocha_brown',
            'name' => 'Mocha Brown',
            'primary' => '#793312',
            'dark' => '#5A2610',
            'light_tint' => '#F6DDC8',
            'text_on_primary' => '#FFFFFF',
            'rgb' => [0.475, 0.200, 0.071],
        ],
        'deep_teal' => [
            'key' => 'deep_teal',
            'name' => 'Deep Teal',
            'primary' => '#036070',
            'dark' => '#024A56',
            'light_tint' => '#BDEFF6',
            'text_on_primary' => '#FFFFFF',
            'rgb' => [0.012, 0.376, 0.439],
        ],
        'antique_gold' => [
            'key' => 'antique_gold',
            'name' => 'Antique Gold',
            'primary' => '#A8832F',
            'dark' => '#7A5E1E',
            'light_tint' => '#F6EEDA',
            'text_on_primary' => '#FFFFFF',
            'rgb' => [0.659, 0.514, 0.184],
        ],
    ];

    /**
     * Aliases for backwards compatibility or short keys (e.g. spike keys).
     */
    private const ALIASES = [
        'charcoal' => 'charcoal_grey',
        'plum' => 'dusty_plum',
    ];

    public static function get(string $key): array
    {
        $normalized = self::ALIASES[$key] ?? $key;
        return self::THEMES[$normalized] ?? self::THEMES['slate_blue'];
    }

    public static function all(): array
    {
        return self::THEMES;
    }
}
