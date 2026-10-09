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
            'primary' => '#4A5F7A',
            'dark' => '#34455C',
            'light_tint' => '#E6EBF2',
            'text_on_primary' => '#FFFFFF',
            'rgb' => [0.290, 0.373, 0.478],
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
            'primary' => '#6B4F3F',
            'dark' => '#4A342A',
            'light_tint' => '#F0E8E3',
            'text_on_primary' => '#FFFFFF',
            'rgb' => [0.420, 0.310, 0.247],
        ],
        'deep_teal' => [
            'key' => 'deep_teal',
            'name' => 'Deep Teal',
            'primary' => '#1F6F6F',
            'dark' => '#14504F',
            'light_tint' => '#E0F0EF',
            'text_on_primary' => '#FFFFFF',
            'rgb' => [0.122, 0.435, 0.435],
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
