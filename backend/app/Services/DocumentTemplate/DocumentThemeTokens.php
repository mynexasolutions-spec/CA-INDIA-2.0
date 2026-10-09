<?php

namespace App\Services\DocumentTemplate;

class DocumentThemeTokens
{
    /**
     * The 6 approved colour schemes, each with 4 theme tokens + rgb float array for DomPDF canvas.
     * Tokens are plain hex strings, no CSS variables.
     */
    public const THEMES = [
        'slate_blue' => [
            'key' => 'slate_blue',
            'name' => 'Slate Blue',
            'primary' => '#2563EB',
            'dark' => '#1D4ED8',
            'light_tint' => '#EFF6FF',
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
            'primary' => '#7A4A6A',
            'dark' => '#5A3250',
            'light_tint' => '#E8D5E3',
            'text_on_primary' => '#FFFFFF',
            'rgb' => [0.478, 0.290, 0.416],
        ],
        'mocha_brown' => [
            'key' => 'mocha_brown',
            'name' => 'Mocha Brown',
            'primary' => '#6C4A38',
            'dark' => '#4E3427',
            'light_tint' => '#F4ECE7',
            'text_on_primary' => '#FFFFFF',
            'rgb' => [0.424, 0.290, 0.220],
        ],
        'deep_teal' => [
            'key' => 'deep_teal',
            'name' => 'Deep Teal',
            'primary' => '#0F766E',
            'dark' => '#0C5852',
            'light_tint' => '#E0F2F1',
            'text_on_primary' => '#FFFFFF',
            'rgb' => [0.059, 0.463, 0.431],
        ],
        'antique_gold' => [
            'key' => 'antique_gold',
            'name' => 'Antique Gold',
            'primary' => '#C59B27',
            'dark' => '#947214',
            'light_tint' => '#FAF4E4',
            'text_on_primary' => '#FFFFFF',
            'rgb' => [0.773, 0.608, 0.153],
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
